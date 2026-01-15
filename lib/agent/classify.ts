import { openai } from "@/lib/openai";
import { getUserEmailCollectionRef } from "@/lib/firebase";
import { PriorityLabel } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Classify an email using AI
 */
export async function classifyEmailTool(emailId: string, userId: string) {
  console.log(`[ClassifyEmailTool] Starting classification for email: ${emailId}`);
  const inboxCollection = await getUserEmailCollectionRef(userId);
  const emailDoc = await inboxCollection.doc(emailId).get();

  if (!emailDoc.exists) {
    console.error(`[ClassifyEmailTool] Email not found: ${emailId}`);
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

  console.log(`[ClassifyEmailTool] Email found: ${email.subject || "No subject"} from ${email.from || "Unknown"}`);

  const systemPrompt = `You are an email classification assistant. Analyze the email and classify it by:
1. Priority: HIGH (80-100), MEDIUM (50-79), or LOW (0-49) with a numeric score
2. Spam: true or false with a spam score (0-100)

Return a JSON object with: priorityScore (0-100), priorityLabel (HIGH/MEDIUM/LOW), spamScore (0-100), isSpam (boolean)`;

  const userPrompt = `Classify this email:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.bodyFullText || email.bodySnippet || ""}

Return only valid JSON, no markdown formatting.`;

  try {
    console.log(`[ClassifyEmailTool] Calling OpenAI API...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    console.log(`[ClassifyEmailTool] OpenAI API response received`);
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI API returned empty content");
    }

    console.log(`[ClassifyEmailTool] Parsing JSON response...`);
    const result = JSON.parse(content);
    console.log(`[ClassifyEmailTool] Classification result:`, result);

    // Validate required fields
    if (!result.priorityScore || !result.priorityLabel) {
      console.error(`[ClassifyEmailTool] Invalid classification result:`, result);
      throw new Error("Invalid classification result: missing required fields");
    }

    // Validate priority label
    const validPriorityLabels: PriorityLabel[] = ["HIGH", "MEDIUM", "LOW"];
    const priorityLabel = validPriorityLabels.includes(result.priorityLabel)
      ? (result.priorityLabel as PriorityLabel)
      : result.priorityScore >= 80
      ? "HIGH"
      : result.priorityScore >= 50
      ? "MEDIUM"
      : "LOW";
    
    if (result.priorityLabel !== priorityLabel) {
      console.warn(`[ClassifyEmailTool] Invalid priority label "${result.priorityLabel}", using "${priorityLabel}" instead`);
    }

    // Validate and normalize priority score
    const priorityScore = Math.max(0, Math.min(100, Number(result.priorityScore) || 50));
    const spamScore = Math.max(0, Math.min(100, Number(result.spamScore) || 0));
    const isSpam = Boolean(result.isSpam);

    // Update email with classification
    console.log(`[ClassifyEmailTool] Updating email in database with priority: ${priorityLabel} (${priorityScore})`);
    await inboxCollection.doc(emailId).update({
      priorityScore,
      priorityLabel,
      spamScore,
      isSpam,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Verify the update was successful
    const updatedDoc = await inboxCollection.doc(emailId).get();
    const updatedData = updatedDoc.data();
    console.log(`[ClassifyEmailTool] Verification - Saved priority: ${updatedData?.priorityLabel}`);

    console.log(`[ClassifyEmailTool] Classification completed successfully`);
    return result;
  } catch (error) {
    console.error(`[ClassifyEmailTool] Error during classification:`, error);
    if (error instanceof Error) {
      console.error(`[ClassifyEmailTool] Error message:`, error.message);
      console.error(`[ClassifyEmailTool] Error stack:`, error.stack);
    }
    throw error;
  }
}

