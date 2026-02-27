import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchGmailEmails } from "@/lib/gmail";
import {
  resolveUserDocument,
  getUserEmailCollectionRefFromResolved,
} from "@/lib/firebase";
import { getActiveAccountId } from "@/lib/user-settings";
import { applyRulesToEmailTool } from "@/lib/agent/apply-rules";
import { extractSponsorshipInfo } from "@/lib/agent/extract-sponsorship";
import { summarizeEmailTool } from "@/lib/agent/summarize";
import { isCollaborationRequest } from "@/lib/agent/is-collaboration";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = 'force-dynamic';

type ProgressEvent =
  | { type: "log"; subject: string; reason: string; status: "skipped" | "accepted" }
  | { type: "summary"; success: boolean; count: number }
  | { type: "error"; message: string };

function createStream(handler: (send: (event: ProgressEvent) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const send = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      handler(send)
        .catch((error) => {
          console.error("[Fetch Emails] Stream error:", error);
          send({ type: "error", message: error.message || "이메일 가져오기 실패" });
        })
        .finally(() => controller.close());
    },
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stream = createStream(async (send) => {
    try {
      // Find actual user document ID (handle ID mismatch)
      let actualUserId = user.id;
      const { id: resolvedUserId, ref: userRef } = await resolveUserDocument(user.id);
      actualUserId = resolvedUserId;
      const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);
      const activeAccountId = await getActiveAccountId(user.id);

      // Fetch emails from Gmail
      let gmailEmails;
      try {
        gmailEmails = await fetchGmailEmails(user.id, 50);
      } catch (error: any) {
        if (error.message?.includes("INVALID_GRANT")) {
          send({ 
            type: "error", 
            message: "Google 인증이 만료되었습니다. 다음 단계를 따라주세요:\n1. Google 계정 설정에서 이 앱의 권한을 취소하세요\n2. 로그아웃 후 다시 로그인해주세요\n3. 동의 화면에서 모든 권한을 허용해주세요" 
          });
          return;
        }
        throw error;
      }

      // Process emails in parallel batches
      const BATCH_SIZE = 10; // Process 10 emails at a time
      const savedEmails: any[] = [];

      // First, filter emails by AI to check if they are collaboration requests
      // Then save only collaboration requests to Firebase (parallel)
      const emailSavePromises = gmailEmails.map(async (emailData) => {
        // Check if email already exists
        const existingSnapshot = await inboxCollection
          .where("externalId", "==", emailData.externalId)
          .limit(1)
          .get();

        if (!existingSnapshot.empty) {
          return null; // Skip if already exists
        }

        const subject = emailData.subject || "제목 없음";

        // Check if this is a collaboration request using AI
        try {
          const result = await isCollaborationRequest(
            emailData.subject || "",
            emailData.bodyFullText || emailData.bodySnippet || "",
            emailData.from || ""
          );

          if (!result.isCollaboration) {
            send({
              type: "log",
              subject,
              reason: "협업 요청이 아닙니다",
              status: "skipped",
            });
            return null; // Skip non-collaboration emails
          } else {
            send({
              type: "log",
              subject,
              reason: "협업 요청으로 분류되었습니다",
              status: "accepted",
            });
          }
        } catch (error) {
          console.error(
            `[Fetch Emails] Error checking collaboration status for email ${emailData.externalId}:`,
            error
          );
          send({
            type: "log",
            subject,
            reason: "AI 판단 중 오류가 발생하여 건너뛰었습니다.",
            status: "skipped",
          });
          // On error, skip the email to be safe (don't include uncertain emails)
          return null;
        }

        // Save email (confirmed as collaboration request)
        const emailRef = await inboxCollection.add({
          userId: actualUserId,
          accountId: activeAccountId || null,
          channel: "gmail",
          externalId: emailData.externalId,
          threadId: emailData.threadId,
          from: emailData.from,
          to: emailData.to,
          cc: emailData.cc,
          bcc: emailData.bcc,
          subject: emailData.subject,
          bodySnippet: emailData.bodySnippet,
          bodyFullText: emailData.bodyFullText,
          receivedAt: emailData.receivedAt,
          isRead: emailData.isRead,
          isStarred: emailData.isStarred,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        const emailDoc = await emailRef.get();
        return {
          id: emailDoc.id,
          ...emailDoc.data(),
          receivedAt: emailDoc.data()?.receivedAt?.toDate?.() || new Date(emailDoc.data()?.receivedAt),
        };
      });

      const savedEmailResults = await Promise.all(emailSavePromises);
      const newEmails = savedEmailResults.filter((email) => email !== null);

      // Process AI analysis in batches (parallel within batch)
      for (let i = 0; i < newEmails.length; i += BATCH_SIZE) {
        const batch = newEmails.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (email) => {
            // Extract sponsorship info and generate summary (all emails are sponsorship emails)
            const analysisPromises = [
              extractSponsorshipInfo(email.id, actualUserId).catch((error) => {
                console.error(
                  `[Fetch Emails] Error extracting sponsorship info for email ${email.id}:`,
                  error
                );
                return null;
              }),
              summarizeEmailTool(email.id, actualUserId).catch((error) => {
                console.error(
                  `[Fetch Emails] Error generating summary for email ${email.id}:`,
                  error
                );
                return null;
              }),
            ];

            await Promise.all(analysisPromises);

            // Apply rules to the email (don't fail if rules fail)
            try {
              await applyRulesToEmailTool(email.id, actualUserId);
            } catch (error) {
              console.error(`[Fetch Emails] Error applying rules for email ${email.id}:`, error);
            }

            savedEmails.push(email);
          })
        );
      }

      send({
        type: "summary",
        success: true,
        count: savedEmails.length,
      });
    } catch (error: any) {
      console.error("[Fetch Emails] Error:", error);
      send({
        type: "error",
        message: error.message || "이메일 가져오기 실패",
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

