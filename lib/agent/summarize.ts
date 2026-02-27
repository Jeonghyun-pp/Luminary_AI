import { openai } from "@/lib/openai";
import { getUserEmailCollectionRef } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Generate a summary of an email
 */
export async function summarizeEmailTool(emailId: string, userId: string) {
  const inboxCollection = await getUserEmailCollectionRef(userId);
  const emailDoc = await inboxCollection.doc(emailId).get();

  if (!emailDoc.exists) {
    throw new Error("Email not found");
  }

  const email = {
    id: emailDoc.id,
    ...emailDoc.data(),
  } as any;

  // Use existing sponsorshipInfo.deadline if available
  const existingDeadline = email.sponsorshipInfo?.deadline;

  const systemPrompt = `You are a sponsorship email analysis assistant. Analyze the email and extract structured information in Korean.

Extract the following information from the sponsorship email:
1. **product**: Product or service category and name (e.g., "스킨케어 제품 - 세럼", "전자 제품 - 스마트폰", "음식 - 커피", "화장품 - 뷰러", "의류 - 옷", "서비스 - ", "웹서비스 - ", "건강기능식품 - 영양제")
2. **type**: Collaboration type (e.g., "제품 리뷰 영상", "블로그 리뷰, "광고 영상", "PPL", "제품 협찬", "제품 포스팅", "공동구매", "라이브 커머스", "마켓")
3. **requirements**: Required content or deliverables (e.g., "최소 3분 이상 영상, 해시태그 필수", "10장 이상 사진, 언박싱 영상 포함")
4. **schedule**: Deadline or schedule information (e.g., "2024년 1월 15일까지", "2주 내 완료")
5. **summary**: A bullet-point summary covering all key details

Return a JSON object with all fields. If a field cannot be determined, use "정보 없음".
Example format:
{
  "product": "스킨케어 제품 - 세럼",
  "type": "제품 리뷰 영상",
  "requirements": "최소 3분 이상 영상, 해시태그 필수",
  "schedule": "2024년 1월 15일까지",
  "summary": "• 제품: 스킨케어 제품 - 세럼\\n• 협찬 유형: 제품 리뷰 영상\\n• 요구사항: 최소 3분 이상 영상, 해시태그 필수\\n• 마감일: 2024년 1월 15일까지\\n• 보상: 제품 제공 + 50만원"
}`;

  const userPrompt = `Analyze this sponsorship email and extract structured information:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.bodyFullText || email.bodySnippet || ""}
${existingDeadline ? `\nNote: There is an existing deadline: "${existingDeadline}". Use this for the "schedule" field.` : ""}

Return only valid JSON with fields: product, type, requirements, schedule, summary. No markdown formatting.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content || "";
  let product = "정보 없음";
  let type = "정보 없음";
  let requirements = "정보 없음";
  let schedule = "정보 없음";
  let summary = "요약 정보가 없습니다.";
  
  try {
    const parsed = JSON.parse(content);
    product = parsed.product || "정보 없음";
    type = parsed.type || "정보 없음";
    requirements = parsed.requirements || "정보 없음";
    schedule = parsed.schedule || (existingDeadline || "정보 없음");
    summary = parsed.summary || "요약 정보가 없습니다.";
    
    // If existing deadline is available and not in schedule, use it
    if (existingDeadline && schedule === "정보 없음") {
      schedule = existingDeadline;
    }
    
    // If existing deadline is available and not in summary, add it
    if (existingDeadline && !summary.includes(existingDeadline)) {
      summary += `\n• 마감일: ${existingDeadline}`;
    }
  } catch (error) {
    console.error("[Summarize] Failed to parse analysis JSON:", error, "Content:", content);
    // Fallback: try to extract fields from content directly
    try {
      if (content.includes("product")) {
        const match = content.match(/"product"\s*:\s*"([^"]+)"/);
        if (match) product = match[1];
      }
      if (content.includes("type")) {
        const match = content.match(/"type"\s*:\s*"([^"]+)"/);
        if (match) type = match[1];
      }
      if (content.includes("requirements")) {
        const match = content.match(/"requirements"\s*:\s*"([^"]+)"/);
        if (match) requirements = match[1];
      }
      if (content.includes("schedule")) {
        const match = content.match(/"schedule"\s*:\s*"([^"]+)"/);
        if (match) {
          schedule = match[1];
        } else if (existingDeadline) {
          schedule = existingDeadline;
        }
      }
      if (content.includes("summary")) {
        const match = content.match(/"summary"\s*:\s*"([^"]+)"/);
        if (match) {
          summary = match[1].replace(/\\n/g, "\n");
        }
      }
    } catch (e) {
      console.error("[Summarize] Failed to extract fields from content:", e);
    }
    
    // If existing deadline is available, use it for schedule
    if (existingDeadline && schedule === "정보 없음") {
      schedule = existingDeadline;
    }
    
    // If existing deadline is available, add it to summary
    if (existingDeadline) {
      summary += `\n• 마감일: ${existingDeadline}`;
    }
  }

  // Update email with all analysis fields (preserve existing emailAnalysis fields)
  const currentEmailAnalysis = email.emailAnalysis || {};
  await inboxCollection.doc(emailId).update({
    emailAnalysis: {
      ...currentEmailAnalysis,
      product: product,
      type: type,
      requirements: requirements,
      schedule: schedule,
      summary: summary,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { product, type, requirements, schedule, summary };
}

