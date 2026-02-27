import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveUserDocument,
  getUserEmailCollectionRefFromResolved,
} from "@/lib/firebase";
import { getActiveAccountId } from "@/lib/user-settings";
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
  const activeAccountId = await getActiveAccountId(user.id);

  // Get all emails for the user; filter by active account when set
  const fetchLimit = validated.limit * validated.page;
  const snapshot = await inboxCollection
    .orderBy("receivedAt", "desc")
    .limit(fetchLimit * 2)
    .get();

  const skip = (validated.page - 1) * validated.limit;
  const allDocs = snapshot.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, ...data };
  });
  const accountFiltered = activeAccountId != null
    ? allDocs.filter((d) => (d as any).accountId === activeAccountId)
    : allDocs;
  const allEmails = accountFiltered
    .map((data: any) => ({
      id: data.id,
      ...data,
      isStarred: data.isStarred || false,
      isTrashed: data.isTrashed || false,
      priorityLabel: data.priorityLabel as string | undefined,
      emailAnalysis: data.emailAnalysis || null,
      sponsorshipInfo: data.sponsorshipInfo || null,
      receivedAt: data.receivedAt?.toDate?.() || new Date(data.receivedAt),
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
    }));

  const emails = allEmails.slice(skip, skip + validated.limit);

  const totalSnapshot = await inboxCollection.orderBy("receivedAt", "desc").get();
  const total = activeAccountId != null
    ? totalSnapshot.docs.filter((doc) => doc.data().accountId === activeAccountId).length
    : totalSnapshot.docs.length;


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

