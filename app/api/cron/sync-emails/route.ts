import { NextResponse } from "next/server";
import {
  db,
  COLLECTIONS,
  getUserEmailCollectionRefFromResolved,
} from "@/lib/firebase";
import { fetchGmailEmails } from "@/lib/gmail";
import { applyRulesToEmailTool } from "@/lib/agent/apply-rules";
import { extractSponsorshipInfo } from "@/lib/agent/extract-sponsorship";
import { summarizeEmailTool } from "@/lib/agent/summarize";
import { isCollaborationRequest } from "@/lib/agent/is-collaboration";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = 'force-dynamic';

// User type from Firestore
interface FirestoreUser {
  id: string;
  email?: string;
  [key: string]: any;
}

/**
 * Vercel Cron Job endpoint for syncing emails from Gmail
 * 
 * This endpoint should be called by Vercel Cron Jobs.
 * Configure in vercel.json or Vercel dashboard:
 * 
 * vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-emails",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 * 
 * Or in Vercel Dashboard:
 * Settings > Cron Jobs > Add Cron Job
 * - Path: /api/cron/sync-emails
 * - Schedule: 0 * * * * (every hour)
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all users with active Gmail accounts
    const usersSnapshot = await db.collection(COLLECTIONS.USERS).get();
    const results = [];

    for (const userDoc of usersSnapshot.docs) {
      const user: FirestoreUser = { id: userDoc.id, ...userDoc.data() };

      // Check if user has Google account
      const accountSnapshot = await db
        .collection(COLLECTIONS.ACCOUNTS)
        .where("userId", "==", user.id)
        .where("provider", "==", "google")
        .where("access_token", "!=", null)
        .limit(1)
        .get();

      if (accountSnapshot.empty) {
        continue; // Skip users without Google OAuth tokens
      }

      try {
        // Fetch emails from Gmail
        let gmailEmails;
        try {
          gmailEmails = await fetchGmailEmails(user.id, 50);
        } catch (error: any) {
          if (error.message?.includes("INVALID_GRANT")) {
            console.error(`[Sync Emails] Invalid grant for user ${user.id} - skipping`);
            continue; // Skip this user and continue with others
          }
          throw error;
        }
        const inboxCollection = getUserEmailCollectionRefFromResolved(userDoc.ref);

        // Process emails in parallel batches
        const BATCH_SIZE = 10; // Process 10 emails at a time

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

          // Check if this is a collaboration request using AI
          try {
            const result = await isCollaborationRequest(
              emailData.subject || "",
              emailData.bodyFullText || emailData.bodySnippet || "",
              emailData.from || ""
            );

            if (!result.isCollaboration) {
              return null; // Skip non-collaboration emails
            }
          } catch (error) {
            console.error(`[Cron] Error checking collaboration status for email ${emailData.externalId}:`, error);
            // On error, skip the email to be safe (don't include uncertain emails)
            return null;
          }

          // Save email (confirmed as collaboration request)
          const emailRef = await inboxCollection.add({
            userId: user.id,
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

          return {
            id: emailRef.id,
            ...emailData,
          };
        });

        const savedEmailResults = await Promise.all(emailSavePromises);
        const newEmails = savedEmailResults.filter((email) => email !== null);
        let newEmailsCount = newEmails.length;

        // Process AI analysis in batches (parallel within batch)
        for (let i = 0; i < newEmails.length; i += BATCH_SIZE) {
          const batch = newEmails.slice(i, i + BATCH_SIZE);
          
          await Promise.all(
            batch.map(async (email) => {
              // Extract sponsorship info and generate summary (parallel)
              const analysisPromises = [
                extractSponsorshipInfo(email.id, user.id).catch((error) => {
                  console.error(`[Cron] Error extracting sponsorship info for email ${email.id}:`, error);
                  return null;
                }),
                summarizeEmailTool(email.id, user.id).catch((error) => {
                  console.error(`[Cron] Error generating summary for email ${email.id}:`, error);
                  return null;
                }),
              ];

              await Promise.all(analysisPromises);

              // Apply rules to the email
              try {
                await applyRulesToEmailTool(email.id, user.id);
              } catch (error) {
                console.error(`[Cron] Error applying rules to email ${email.id}:`, error);
              }
            })
          );
        }

        results.push({
          userId: user.id,
          userEmail: user.email,
          newEmailsCount,
          status: "success",
        });
      } catch (error: any) {
        console.error(`Error syncing emails for user ${user.id}:`, error);
        results.push({
          userId: user.id,
          userEmail: user.email,
          status: "error",
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync emails",
      },
      { status: 500 }
    );
  }
}

