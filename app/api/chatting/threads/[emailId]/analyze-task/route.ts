import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { openai } from "@/lib/openai";

export async function POST(
  request: NextRequest,
  { params }: { params: { emailId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { conversationText, subject } = body;

    if (!conversationText) {
      return NextResponse.json({ error: "Conversation text is required" }, { status: 400 });
    }

    // Summarize the original email subject for task title
    let summarizedTitle = subject || "협업 작업";
    if (subject && subject.trim()) {
      try {
        const titleResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: "You are a title summarization assistant. Summarize the given email subject into a concise, clear task title. Maximum 50 characters in Korean. Remove unnecessary words like 'Re:', 'Fwd:', etc. Keep only the essential information." 
            },
            { 
              role: "user", 
              content: `Summarize this email subject into a concise task title:\n\n${subject}` 
            },
          ],
          temperature: 0.3,
          max_tokens: 50,
        });
        
        const summarized = titleResponse.choices[0].message.content?.trim();
        if (summarized) {
          summarizedTitle = summarized;
        }
      } catch (error) {
        console.error("[Analyze Task] Failed to summarize title:", error);
        // Use original subject if summarization fails
      }
    }

    // Get current date for context
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const currentDateISO = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Use OpenAI to extract collaboration information in structured format
    const systemPrompt = `You are a collaboration task extraction assistant. Analyze the email conversation and extract structured information about the collaboration.

**IMPORTANT: Current Date Context**
- Current Date: ${currentDateStr}
- Current Year: ${currentYear}
- Current Month: ${currentMonth}
- Current Day: ${currentDay}
- ISO Format: ${currentDateISO}

When extracting dates, use the current date as reference:
- If the email mentions "1월 15일" without a year, assume it means ${currentYear}년 1월 15일 (if that date hasn't passed) or ${currentYear + 1}년 1월 15일 (if it has passed this year)
- If the email mentions "다음 주 월요일", calculate from the current date
- If the email mentions "2주 후", calculate from the current date
- Always return dates in YYYY-MM-DD format when you can determine the absolute date
- For relative dates like "2주 후", return the calculated date in YYYY-MM-DD format

Extract the following information from the collaboration conversation:
1. **product**: Product or service category and name (e.g., "스킨케어 제품 - 세럼", "전자 제품 - 스마트폰", "음식 - 커피", "화장품 - 뷰러", "의류 - 옷", "서비스 - ", "웹서비스 - ", "건강기능식품 - 영양제"). If not mentioned, use "정보 없음".
2. **requirements**: Required content or deliverables (e.g., "최소 3분 이상 영상, 해시태그 필수", "10장 이상 사진, 언박싱 영상 포함", "인스타그램 게시물 3개 이상"). Format as a clear, itemized list in Korean. If not mentioned, use "정보 없음".
3. **schedule**: Deadline or schedule information. Calculate the absolute date based on the current date (${currentDateISO}). 
   - If the email says "1월 15일까지" and today is before January 15 in the current year, return "${currentYear}-01-15"
   - If the email says "1월 15일까지" and today is after January 15 in the current year, return "${currentYear + 1}-01-15"
   - If the email says "2주 후", calculate and return the date in YYYY-MM-DD format
   - If the email says "다음 주 월요일", calculate and return the date in YYYY-MM-DD format
   - Always return in YYYY-MM-DD format when possible. If the date cannot be determined, return null.
4. **reward**: Compensation or reward information (e.g., "제품 제공 + 50만원", "100만원", "제품 샘플 제공", "무료 체험"). If not mentioned, use "정보 없음".

Return a JSON object with all fields:
{
  "product": "제품 정보",
  "requirements": "요구사항 (항목화된 목록)",
  "schedule": "마감일 정보 (YYYY-MM-DD 형식의 절대 날짜, 계산 불가능하면 null)",
  "reward": "보상 정보"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract collaboration schedule and actionable tasks from this conversation. Current date is ${currentDateStr} (${currentDateISO}).\n\nConversation:\n${conversationText}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("[Analyze Task] Failed to parse AI response:", error);
      parsed = { 
        product: "정보 없음",
        requirements: "정보 없음",
        schedule: null,
        reward: "정보 없음"
      };
    }
    const product = parsed.product || "정보 없음";
    const requirements = parsed.requirements || "정보 없음";
    const schedule = parsed.schedule || null;
    const reward = parsed.reward || "정보 없음";

    // Format content as structured summary
    const contentText = `제품: ${product}\n\n요구사항:\n${requirements}\n\n보상: ${reward}`;

    // Parse schedule to Date if it's a date string
    let dueAt: Date | null = null;
    let scheduleDisplay: string = schedule || "";
    
    if (schedule) {
      // Try to parse date string
      const dateMatch = schedule.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        dueAt = new Date(schedule);
        scheduleDisplay = schedule;
      } else {
        // Try relative dates
        const relativeMatch = schedule.match(/(\d+)\s*(일|주|개월|달)\s*(후|뒤)/);
        if (relativeMatch) {
          const amount = parseInt(relativeMatch[1]);
          const unit = relativeMatch[2];
          const now = new Date();
          if (unit === "일") {
            now.setDate(now.getDate() + amount);
          } else if (unit === "주") {
            now.setDate(now.getDate() + amount * 7);
          } else if (unit === "개월" || unit === "달") {
            now.setMonth(now.getMonth() + amount);
          }
          dueAt = now;
          scheduleDisplay = schedule;
        } else {
          // Keep as string if can't parse
          scheduleDisplay = schedule;
        }
      }
    }

    return NextResponse.json({
      success: true,
      analysis: {
        title: summarizedTitle,
        content: contentText,
        product: product,
        requirements: requirements,
        reward: reward,
        schedule: scheduleDisplay,
        dueAt: dueAt ? dueAt.toISOString() : null,
      },
    });
  } catch (error: any) {
    console.error("[Analyze Task] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze task" },
      { status: 500 }
    );
  }
}

