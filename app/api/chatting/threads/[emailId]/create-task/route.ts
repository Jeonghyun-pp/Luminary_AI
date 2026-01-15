import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserTaskCollectionRefFromResolved, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { addTaskToCalendar } from "@/lib/calendar-helper";
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

    const userId = user.id;
    const emailId = params.emailId;
    const body = await request.json();
    const { conversationText, subject } = body;

    if (!conversationText) {
      return NextResponse.json({ error: "Conversation text is required" }, { status: 400 });
    }

    const { ref: userRef } = await resolveUserDocument(userId);
    const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

    // Get original email for emailId reference
    const emailDoc = await inboxCollection.doc(emailId).get();
    if (!emailDoc.exists) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const email = emailDoc.data();
    if (!email) {
      return NextResponse.json({ error: "Email data not found" }, { status: 404 });
    }
    const originalSubject = email.subject || subject || "협업 작업";

    // Summarize the original email subject for task title
    let summarizedTitle = originalSubject;
    if (originalSubject && originalSubject.trim()) {
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
              content: `Summarize this email subject into a concise task title:\n\n${originalSubject}` 
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
        console.error("[Create Task] Failed to summarize title:", error);
        // Use original subject if summarization fails
      }
    }

    // Use OpenAI to extract collaboration information in structured format
    const systemPrompt = `You are a collaboration task extraction assistant. Analyze the email conversation and extract structured information about the collaboration.

Extract the following information from the collaboration conversation:
1. **product**: Product or service category and name (e.g., "스킨케어 제품 - 세럼", "전자 제품 - 스마트폰", "음식 - 커피", "화장품 - 뷰러", "의류 - 옷", "서비스 - ", "웹서비스 - ", "건강기능식품 - 영양제"). If not mentioned, use "정보 없음".
2. **requirements**: Required content or deliverables (e.g., "최소 3분 이상 영상, 해시태그 필수", "10장 이상 사진, 언박싱 영상 포함", "인스타그램 게시물 3개 이상"). Format as a clear, itemized list in Korean. If not mentioned, use "정보 없음".
3. **schedule**: Deadline or schedule information (e.g., "2024년 1월 15일까지", "2주 내 완료", "다음 주 월요일"). Format as YYYY-MM-DD if absolute date, or relative date like "2주 후", "다음 주 월요일" if relative. If not mentioned, use null.
4. **reward**: Compensation or reward information (e.g., "제품 제공 + 50만원", "100만원", "제품 샘플 제공", "무료 체험"). If not mentioned, use "정보 없음".

Return a JSON object with all fields:
{
  "product": "제품 정보",
  "requirements": "요구사항 (항목화된 목록)",
  "schedule": "마감일 정보 (구체적인 날짜 또는 상대적 날짜, 없으면 null)",
  "reward": "보상 정보"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract collaboration schedule and content from this conversation:\n\n${conversationText}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("[Create Task] Failed to parse AI response:", error);
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
    if (schedule) {
      // Try to parse date string
      const dateMatch = schedule.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        dueAt = new Date(schedule);
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
        }
      }
    }

    // Create task
    const tasksCollection = getUserTaskCollectionRefFromResolved(userRef);
    const taskRef = await tasksCollection.add({
      userId: user.id,
      emailId: emailId,
      title: summarizedTitle,
      description: contentText,
      status: "IN_PROGRESS",
      dueAt: dueAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const taskDoc = await taskRef.get();
    const taskData = taskDoc.data();
    const taskId = taskDoc.id;
    const taskDueAt = taskData?.dueAt?.toDate?.() || (taskData?.dueAt ? new Date(taskData.dueAt) : null);

    // Automatically add to calendar if dueAt exists
    if (taskDueAt) {
      await addTaskToCalendar(
        user.id,
        taskId,
        summarizedTitle,
        contentText,
        taskDueAt
      );
    }

    return NextResponse.json({
      success: true,
      task: {
        id: taskId,
        ...taskData,
        dueAt: taskDueAt,
        createdAt: taskData?.createdAt?.toDate?.() || new Date(),
        updatedAt: taskData?.updatedAt?.toDate?.() || new Date(),
      },
    });
  } catch (error: any) {
    console.error("[Create Task from Chat] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create task" },
      { status: 500 }
    );
  }
}

