import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extractScheduleFromEmailTool } from "@/lib/agent/extract-schedule";
import { emailIdSchema } from "@/lib/validations/email";
import { withErrorHandler } from "@/lib/errors/handler";
import { NotFoundError } from "@/lib/errors/handler";
import {
  resolveUserDocument,
  getUserEmailCollectionRefFromResolved,
} from "@/lib/firebase";

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

  const result = await extractScheduleFromEmailTool(id, actualUserId);
  return NextResponse.json({ success: true, event: result });
});

