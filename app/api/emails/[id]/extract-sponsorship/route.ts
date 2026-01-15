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

export const POST = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  console.log("[Extract Sponsorship API] Starting extraction request");
  
  const user = await getCurrentUser();
  console.log("[Extract Sponsorship API] User authenticated:", user.id);
  
  const { id } = await params;
  console.log("[Extract Sponsorship API] Email ID:", id);
  
  // Validate params
  try {
    emailIdSchema.parse({ id });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Extract Sponsorship API] Validation error: ${errorMsg}`);
    throw error;
  }

  const { id: actualUserId, ref: userRef } = await resolveUserDocument(user.id);
  const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);
  const emailDoc = await inboxCollection.doc(id).get();

  if (!emailDoc.exists) {
    const errorMsg = `[Extract Sponsorship API] Email not found for user ${actualUserId}: ${id}`;
    console.error(errorMsg);
    throw new NotFoundError("이메일을 찾을 수 없습니다.");
  }

  console.log("[Extract Sponsorship API] Authorization passed, calling extractSponsorshipInfo...");
  try {
    const result = await extractSponsorshipInfo(id, actualUserId);
    console.log("[Extract Sponsorship API] Extraction successful");
    return NextResponse.json({ success: true, info: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[Extract Sponsorship API] Error in extractSponsorshipInfo:", errorMessage);
    if (errorStack) {
      console.error("[Extract Sponsorship API] Error stack:", errorStack);
    }
    throw error;
  }
});

