import { openai } from "@/lib/openai";
import { getUserEmailCollectionRef } from "@/lib/firebase";
import { DetectedEvent } from "@/types";

/**
 * Extract schedule/event information from an email
 */
export async function extractScheduleFromEmailTool(
  emailId: string,
  userId: string
): Promise<DetectedEvent | null> {
  const inboxCollection = await getUserEmailCollectionRef(userId);
  const emailDoc = await inboxCollection.doc(emailId).get();

  if (!emailDoc.exists) {
    throw new Error("Email not found");
  }

  const email = {
    id: emailDoc.id,
    ...emailDoc.data(),
  } as any;

  const systemPrompt = `You are a schedule extraction assistant. Extract event/schedule information from emails.
Return a JSON object with: title, type (MEETING/DEADLINE/REMINDER/OTHER), startTime (ISO), endTime (ISO), dueTime (ISO), location, notes.
If no schedule is found, return null.`;

  const userPrompt = `Extract schedule information from this email:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.bodyFullText || email.bodySnippet || ""}

Return only valid JSON, no markdown formatting. Return null if no schedule found.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content || "null");

  if (!result || result === null) {
    return null;
  }

  return result as DetectedEvent;
}

