import { openai } from "@/lib/openai";

export interface CollaborationCheckResult {
  isCollaboration: boolean;
  confidence: number;
  reason: string;
}

/**
 * Check if an email is a collaboration/sponsorship request
 * Returns classification result with confidence and reason
 */
export async function isCollaborationRequest(
  subject: string,
  body: string,
  from: string
): Promise<CollaborationCheckResult> {
  const systemPrompt = `You are an email classification assistant. Your task is to determine if an email is a concrete collaboration/sponsorship proposal TO THE RECIPIENT.

Classify as collaboration/sponsorship request ONLY when:
- The sender explicitly asks the recipient to review/advertise/feature a product or service
- A brand proposes sponsored content, partnership, or campaign specifically with the recipient
- There is a clear call-to-action for the recipient to create content or promote something
- The sender requests deliverables (영상, 게시물, 후기 등) in exchange for reward/compensation
- The email contains specific terms like "협찬", "제휴", "스폰서", "인플루언서", "크리에이터", "콘텐츠 제작", "리뷰", "체험단" AND asks the recipient to create content

Do NOT treat the following as collaboration requests:
- General 공모전, 콘테스트, 체험단, 오픈 클래스, 세미나, 행사 초대 안내
- 뉴스레터, 커뮤니티 공지, 교육/강연 안내, 회원가입/웰컴 메일
- 스타트업/서비스 홍보, 투자/네트워킹/동아리 모집, 일반적인 마케팅 메일
- 제품/서비스 소개 및 홍보 메일 (예: "Zoom이 제안하는 더 스마트한 작업 공간 구축", "새로운 기능 소개", "서비스 업데이트 안내")
- 제안/제안서 형태의 일반 마케팅 메일 (제품 구매, 서비스 이용, 솔루션 도입 제안 등)
- 공공기관/학교에서 보내는 일반 안내(시민의회 제안, 사회혁신/교육 캠프 등)
- 사용자 스스로 신청해야 하는 일반 프로그램 안내(예: "크리에이터 공모전 신청 안내")
- 인증 코드, 프로모션 코드, 일반 서비스 알림
- B2B 제품/서비스 판매 제안, 솔루션 소개, 기업용 서비스 홍보
- 웨비나, 세미나, 이벤트 초대 (콘텐츠 제작 요청이 없는 경우)

IMPORTANT: Even if the email contains words like "제안" or "협업", it is NOT a collaboration request if:
- It's just promoting a product/service without asking the recipient to create content
- It's a general marketing email about features, updates, or solutions
- It doesn't explicitly ask the recipient to create deliverables (영상, 게시물, 후기 등)

Return a JSON object with:
{
  "isCollaboration": boolean,
  "confidence": number (0-100),
  "reason": string (brief explanation in Korean)
}`;

  const userPrompt = `Determine if this email is a collaboration/sponsorship request:

From: ${from}
Subject: ${subject}
Body: ${body.substring(0, 2000)}${body.length > 2000 ? "..." : ""}

Return only valid JSON, no markdown formatting.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return {
        isCollaboration: false,
        confidence: 0,
        reason: "AI 응답이 없어 협업 요청이 아닌 것으로 처리했습니다.",
      };
    }

    const result = JSON.parse(content);
    const isCollaboration = Boolean(result.isCollaboration);
    const confidence = Number(result.confidence) || 0;
    const reason =
      typeof result.reason === "string" && result.reason.trim().length > 0
        ? result.reason.trim()
        : isCollaboration
        ? "협업 요청으로 분류되었습니다."
        : "협업 요청이 아닌 것으로 분류되었습니다.";

    // Only accept if confidence is high enough (>= 70)
    if (isCollaboration && confidence >= 70) {
      return { isCollaboration: true, confidence, reason };
    } else {
      return { isCollaboration: false, confidence, reason };
    }
  } catch (error) {
    console.error("[IsCollaborationRequest] Error:", error);
    // On error, default to false (don't include uncertain emails)
    return {
      isCollaboration: false,
      confidence: 0,
      reason: "AI 분석 중 오류가 발생했습니다.",
    };
  }
}

