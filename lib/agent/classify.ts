import { openai } from "@/lib/openai";
import { getUserEmailCollectionRef } from "@/lib/firebase";
import { PriorityLabel } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Classify an email using AI
 */
export async function classifyEmailTool(emailId: string, userId: string) {
  const inboxCollection = await getUserEmailCollectionRef(userId);
  const emailDoc = await inboxCollection.doc(emailId).get();

  if (!emailDoc.exists) {
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

  const systemPrompt = `You are an email classification assistant. Analyze the email and classify it by:
1. Priority: HIGH (80-100), MEDIUM (50-79), or LOW (0-49) with a numeric score
2. Spam: true or false with a spam score (0-100)

Return a JSON object with: priorityScore (0-100), priorityLabel (HIGH/MEDIUM/LOW), spamScore (0-100), isSpam (boolean)`;

  const userPrompt = `Classify this email:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.bodyFullText || email.bodySnippet || ""}

Return only valid JSON, no markdown formatting.`;

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

  const result = JSON.parse(content);

  if (!result.priorityScore || !result.priorityLabel) {
    throw new Error("Invalid classification result: missing required fields");
  }

  const validPriorityLabels: PriorityLabel[] = ["HIGH", "MEDIUM", "LOW"];
  const priorityLabel = validPriorityLabels.includes(result.priorityLabel)
    ? (result.priorityLabel as PriorityLabel)
    : result.priorityScore >= 80
    ? "HIGH"
    : result.priorityScore >= 50
    ? "MEDIUM"
    : "LOW";

  const priorityScore = Math.max(0, Math.min(100, Number(result.priorityScore) || 50));
  const spamScore = Math.max(0, Math.min(100, Number(result.spamScore) || 0));
  const isSpam = Boolean(result.isSpam);

  await inboxCollection.doc(emailId).update({
    priorityScore,
    priorityLabel,
    spamScore,
    isSpam,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return result;
}
