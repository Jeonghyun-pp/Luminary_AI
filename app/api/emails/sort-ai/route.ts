import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { Email } from "@/types";

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { emails, prompt } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Emails array is required" }, { status: 400 });
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Sort prompt is required" }, { status: 400 });
    }

    // Prepare email summaries for AI sorting
    const emailSummaries = emails.map((email: Email) => ({
      id: email.id,
      subject: email.subject || "제목 없음",
      product: email.emailAnalysis?.product || "정보 없음",
      type: email.emailAnalysis?.type || "정보 없음",
      requirements: email.emailAnalysis?.requirements || email.sponsorshipInfo?.requiredContent || "정보 없음",
      reward: email.sponsorshipInfo?.reward || "정보 없음",
      schedule: email.emailAnalysis?.schedule || email.sponsorshipInfo?.deadline || "정보 없음",
      priority: email.priorityLabel || "LOW",
      receivedAt: email.receivedAt ? new Date(email.receivedAt).toLocaleDateString('ko-KR') : "정보 없음",
    }));

    const systemPrompt = `You are an email sorting assistant. Your task is to sort emails according to the user's criteria.

You will receive a list of emails with their information (제품, 유형, 요구사항, 보상, 일정, 우선순위 등) and a sorting criteria.

Return a JSON object with a "sortedEmailIds" array containing the email IDs in the desired order (most important first).

Example response:
{
  "sortedEmailIds": ["email-id-1", "email-id-2", "email-id-3", ...]
}`;

    const userPrompt = `Sort these ${emailSummaries.length} emails according to this criteria: "${prompt}"

Email list:
${emailSummaries.map((e, i) => 
  `${i + 1}. ID: ${e.id}
   제목: ${e.subject}
   제품: ${e.product}
   유형: ${e.type}
   요구사항: ${e.requirements}
   보상: ${e.reward}
   일정: ${e.schedule}
   우선순위: ${e.priority}
   수신일: ${e.receivedAt}`
).join("\n\n")}

Return a JSON object with a "sortedEmailIds" array containing all email IDs in the sorted order (most important/matching first).`;

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
      const sortedEmailIds = parsed.sortedEmailIds || [];

      // Validate that all email IDs are present
      const inputEmailIds = new Set(emails.map((e: Email) => e.id));
      const sortedSet = new Set(sortedEmailIds);
      
      // Check if all IDs are present
      if (sortedSet.size !== inputEmailIds.size) {
        console.warn("[AI Sort] Some email IDs are missing in sorted result");
      }

      // Add any missing IDs to the end
      const missingIds = Array.from(inputEmailIds).filter(id => !sortedSet.has(id));
      const finalSortedIds = [...sortedEmailIds, ...missingIds];

      return NextResponse.json({
        success: true,
        sortedEmailIds: finalSortedIds,
        total: emails.length,
      });
    } catch (error: any) {
      console.error("[AI Sort] Error:", error);
      throw error;
    }
  } catch (error: any) {
    console.error("[AI Sort] Error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to sort emails",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

