import { openai } from "@/lib/openai";
import { Email } from "@/types";

export interface EfficiencyScore {
  emailId: string;
  efficiency: number; // 노동력 투입 대비 보상 점수 (0-100)
  laborEstimate: number; // 추정 노동력 (시간 단위)
  rewardEstimate: number; // 추정 보상 (만원 단위)
}

/**
 * Analyze emails based on custom prompt
 * Uses AI to analyze emails according to the provided criteria
 */
export async function analyzeEfficiencyBatch(
  emails: Email[],
  analysisPrompt: string = "시간 투입 대비 보상이 높은 순으로 정렬"
): Promise<Map<string, EfficiencyScore>> {
  if (emails.length === 0) {
    return new Map();
  }

  // Prepare email summaries for batch analysis
  const emailSummaries = emails.map((email) => ({
    id: email.id,
    subject: email.subject,
    product: email.emailAnalysis?.product || "",
    type: email.emailAnalysis?.type || "",
    requirements: email.emailAnalysis?.requirements || email.sponsorshipInfo?.requiredContent || "",
    reward: email.sponsorshipInfo?.reward || "",
    schedule: email.emailAnalysis?.schedule || email.sponsorshipInfo?.deadline || "",
  }));

  const systemPrompt = `You are an email analysis assistant. Analyze sponsorship emails according to the user's criteria: "${analysisPrompt}"

For each email, analyze based on the criteria and return:
1. laborEstimate: If the criteria involves labor/time, estimate in hours. Otherwise, use a relevant metric (0-100 scale).
2. rewardEstimate: If the criteria involves reward/compensation, estimate in 만원. Otherwise, use a relevant metric (0-100 scale).
3. efficiency: Calculate a score (0-100) based on how well the email matches the criteria. Higher score = better match.

Examples:
- If criteria is "노동력 투입 대비 보상": laborEstimate = hours, rewardEstimate = 만원, efficiency = (rewardEstimate / laborEstimate) * 10
- If criteria is "마감일이 가까운 순": laborEstimate = days until deadline, rewardEstimate = 0, efficiency = 100 - (days until deadline)
- If criteria is "보상이 높은 순": laborEstimate = 0, rewardEstimate = 만원, efficiency = rewardEstimate

Return JSON object with a "results" array containing objects with: emailId, laborEstimate, rewardEstimate, efficiency.`;

  const userPrompt = `Analyze these ${emailSummaries.length} emails according to the criteria: "${analysisPrompt}"

${emailSummaries.map((e, i) => 
  `${i + 1}. ID: ${e.id}
   제목: ${e.subject}
   제품: ${e.product}
   유형: ${e.type}
   요구사항: ${e.requirements}
   보상: ${e.reward}
   일정: ${e.schedule}`
).join("\n\n")}

Return a JSON object with a "results" array containing objects with: emailId, laborEstimate, rewardEstimate, efficiency.`;

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

    const parsed = JSON.parse(content);
    const results = parsed.results || parsed.emails || (Array.isArray(parsed) ? parsed : []);

    const efficiencyMap = new Map<string, EfficiencyScore>();
    
    for (const result of results) {
      if (result.emailId) {
        efficiencyMap.set(result.emailId, {
          emailId: result.emailId,
          efficiency: Math.min(100, Math.max(0, result.efficiency || 0)),
          laborEstimate: result.laborEstimate || 0,
          rewardEstimate: result.rewardEstimate || 0,
        });
      }
    }

    // Fill in missing emails with default scores
    for (const email of emails) {
      if (!efficiencyMap.has(email.id)) {
        efficiencyMap.set(email.id, {
          emailId: email.id,
          efficiency: 50, // Default score
          laborEstimate: 0,
          rewardEstimate: 0,
        });
      }
    }

    return efficiencyMap;
  } catch (error) {
    console.error("[AnalyzeEfficiency] Error:", error);
    // Return default scores on error
    const defaultMap = new Map<string, EfficiencyScore>();
    for (const email of emails) {
      defaultMap.set(email.id, {
        emailId: email.id,
        efficiency: 50,
        laborEstimate: 0,
        rewardEstimate: 0,
      });
    }
    return defaultMap;
  }
}

