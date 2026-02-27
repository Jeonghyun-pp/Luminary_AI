import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extractSponsorshipInfo } from "@/lib/agent/extract-sponsorship";
import { emailIdSchema } from "@/lib/validations/email";
import { withErrorHandler } from "@/lib/errors/handler";
import { NotFoundError } from "@/lib/errors/handler";
import {
  resolveUserDocument,
  getUserEmailCollectionRefFromResolved,
} from "@/lib/firebase";

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();

  const { id } = await params;

  // Validate params
  emailIdSchema.parse({ id });

  const { id: actualUserId, ref: userRef } = await resolveUserDocument(user.id);
  const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);
  const emailDoc = await inboxCollection.doc(id).get();

  if (!emailDoc.exists) {
    throw new NotFoundError("이메일을 찾을 수 없습니다.");
  }

  try {
    const result = await extractSponsorshipInfo(id, actualUserId);
    return NextResponse.json({ success: true, info: result });
  } catch (error) {
    console.error("[Extract Sponsorship API] Error in extractSponsorshipInfo:", error);
    throw error;
  }
});

