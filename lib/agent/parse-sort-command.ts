import { openai } from "@/lib/openai";
import { Email } from "@/types";

export interface SortCommand {
  filters?: {
    category?: string; // 카테고리 필터 (예: "뷰티", "전자제품")
    deadline?: {
      type: "within" | "before" | "after";
      days?: number; // "이번 주" = 7일
    };
    minReward?: number; // 최소 보상
  };
  sortBy?: Array<{
    field: "deadline" | "reward" | "priority" | "receivedAt";
    order: "asc" | "desc";
  }>;
}

/**
 * Parse natural language command into sort/filter instructions
 */
export async function parseSortCommand(
  command: string,
  sampleEmails: Email[]
): Promise<SortCommand> {
  const systemPrompt = `You are an email sorting and filtering assistant. Parse natural language commands into structured sort and filter instructions.

Available fields:
- deadline: 마감일/일정 (schedule field from emailAnalysis)
- reward: 보상 (sponsorshipInfo.reward)
- priority: 우선순위 (priorityLabel: HIGH, MEDIUM, LOW)
- receivedAt: 받은 날짜

Filter options:
- category: 제품 카테고리 (from emailAnalysis.product, extract category part before "-")
- deadline: 마감일 필터 ("이번 주" = within 7 days, "이번 달" = within 30 days)
- minReward: 최소 보상 금액

Sort options:
- Multiple sort criteria can be specified (e.g., "보상 높은 순 + 마감 여유 있는 순")
- "높은 순" = desc, "낮은 순" = asc
- "마감 여유 있는 순" = deadline desc (later deadline first)
- "마감 임박한 순" = deadline asc (earlier deadline first)

Return JSON with filters and sortBy array.`;

  // Provide sample email structure for context
  const sampleContext = sampleEmails.slice(0, 3).map((email) => ({
    id: email.id,
    subject: email.subject,
    product: email.emailAnalysis?.product || null,
    schedule: email.emailAnalysis?.schedule || null,
    reward: email.sponsorshipInfo?.reward || null,
    priorityLabel: email.priorityLabel || null,
    receivedAt: email.receivedAt,
  }));

  const userPrompt = `Parse this command: "${command}"

Sample email structure:
${JSON.stringify(sampleContext, null, 2)}

Return only valid JSON with filters and sortBy fields. No markdown formatting.`;

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
      throw new Error("OpenAI API returned empty content");
    }

    const parsed = JSON.parse(content) as SortCommand;
    return parsed;
  } catch (error) {
    console.error("[ParseSortCommand] Error:", error);
    // Return default: no filters, sort by receivedAt desc
    return {
      sortBy: [{ field: "receivedAt", order: "desc" }],
    };
  }
}

