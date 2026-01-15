import { openai } from "@/lib/openai";
import { getUserEmailCollectionRef } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

export interface SponsorshipInfo {
  reward?: string; // 보상
  requiredContent?: string; // 요구 콘텐츠
  deadline?: string; // 마감일자
  description?: string; // 상세 설명
}

/**
 * Extract sponsorship information from an email
 */
export async function extractSponsorshipInfo(
  emailId: string,
  userId: string
): Promise<SponsorshipInfo> {
  console.log(`[ExtractSponsorship] Starting extraction for email: ${emailId}`);
  const inboxCollection = await getUserEmailCollectionRef(userId);
  const emailDoc = await inboxCollection.doc(emailId).get();

  if (!emailDoc.exists) {
    console.error(`[ExtractSponsorship] Email not found: ${emailId}`);
    throw new Error("Email not found");
  }

  const emailData = emailDoc.data();
  const email = {
    id: emailDoc.id,
    ...emailData,
  } as {
    id: string;
    from?: string;
    subject?: string;
    bodyFullText?: string;
    bodySnippet?: string;
  };

  console.log(`[ExtractSponsorship] Email found: ${email.subject} from ${email.from}`);

  const systemPrompt = `You are a sponsorship email analysis assistant. Extract structured information from sponsorship emails.
Extract the following information:
1. Reward (보상): The payment, compensation, or benefits offered (e.g., "100만원", "제품 제공", "수익 분배")
2. Required Content (요구 콘텐츠): What content needs to be created (e.g., "유튜브 영상 1개", "인스타그램 포스트 3개", "리뷰 작성")
3. Deadline (마감일자): The deadline for submission or completion (e.g., "2024년 1월 15일", "2주 내")
4. Description (상세 설명): A detailed summary of the sponsorship offer

Return a JSON object with: reward, requiredContent, deadline, description.
If any information is not found, use null for that field.`;

  const userPrompt = `Extract sponsorship information from this email:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.bodyFullText || email.bodySnippet || ""}

Return only valid JSON, no markdown formatting.`;

  try {
    console.log(`[ExtractSponsorship] Calling OpenAI API...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    console.log(`[ExtractSponsorship] OpenAI API response received`);
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI API returned empty content");
    }

    console.log(`[ExtractSponsorship] Parsing JSON response...`);
    const result = JSON.parse(content) as SponsorshipInfo;
    console.log(`[ExtractSponsorship] Extracted info:`, result);

    // Save extracted information to email document
    await inboxCollection.doc(emailId).update({
      sponsorshipInfo: result,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[ExtractSponsorship] Extraction completed successfully`);
    return result;
  } catch (error) {
    console.error(`[ExtractSponsorship] Error during extraction:`, error);
    if (error instanceof Error) {
      console.error(`[ExtractSponsorship] Error message:`, error.message);
      console.error(`[ExtractSponsorship] Error stack:`, error.stack);
    }
    throw error;
  }
}

