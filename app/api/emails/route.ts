import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveUserDocument,
  getUserEmailCollectionRefFromResolved,
} from "@/lib/firebase";
import { emailQuerySchema } from "@/lib/validations/email";
import { withErrorHandler } from "@/lib/errors/handler";

// Firebase Admin SDK requires Node.js runtime
export const runtime = 'nodejs';

export const GET = withErrorHandler(async (request: Request) => {
  const user = await getCurrentUser();
  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryParams = Object.fromEntries(searchParams.entries());
  const validated = emailQuerySchema.parse(queryParams);

  // Find actual user document ID (handle ID mismatch)
  const { id: actualUserId, ref: userRef } = await resolveUserDocument(user.id);
  const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

  // Get all emails for the user (all are sponsorship emails now)
  // Exclude trashed emails (isTrashed !== true)
  // For pagination, we'll fetch more and slice in memory (simple approach)
  const fetchLimit = validated.limit * validated.page;
  
  // Fetch all emails and filter out trashed ones in memory
  // This avoids index issues with != queries
  const snapshot = await inboxCollection
    .orderBy("receivedAt", "desc")
    .limit(fetchLimit * 2) // Fetch more to account for trashed emails
    .get();

  // Apply pagination in memory and filter out trashed emails
  const skip = (validated.page - 1) * validated.limit;
  const allEmails = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        isStarred: data.isStarred || false, // Ensure isStarred is always a boolean
        isTrashed: data.isTrashed || false, // Ensure isTrashed is always a boolean
        priorityLabel: data.priorityLabel as string | undefined,
        emailAnalysis: data.emailAnalysis || null,
        sponsorshipInfo: data.sponsorshipInfo || null,
        receivedAt: data.receivedAt?.toDate?.() || new Date(data.receivedAt),
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
      };
    })
    // Note: bookmarked and trashed emails are now included in the list (will be filtered by bookmarkFilter and trashFilter on client)

  const emails = allEmails.slice(skip, skip + validated.limit);

  // Get total count (excluding trashed emails)
  // Fetch all and count in memory to avoid index issues
  const totalSnapshot = await inboxCollection
    .orderBy("receivedAt", "desc")
    .get();
  const total = totalSnapshot.docs.length;

  console.log("[Emails API] Returning", emails.length, "emails (total matching:", total, ")");

  return NextResponse.json({
    emails,
    pagination: {
      page: validated.page,
      limit: validated.limit,
      total,
      totalPages: Math.ceil(total / validated.limit),
    },
  });
});

