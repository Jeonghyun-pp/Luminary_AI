import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { classifyEmailTool } from "@/lib/agent/classify";
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
  console.log("[Classify API] Starting classification request");
  
  const user = await getCurrentUser();
  console.log("[Classify API] User authenticated:", user.id);
  
  const { id } = await params;
  console.log("[Classify API] Email ID:", id);
  
  // Validate params
  try {
    emailIdSchema.parse({ id });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Classify API] Validation error: ${errorMsg}`);
    throw error;
  }

  const { id: actualUserId, ref: userRef } = await resolveUserDocument(user.id);
  const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);
  const emailDoc = await inboxCollection.doc(id).get();

  if (!emailDoc.exists) {
    const errorMsg = `[Classify API] Email not found for user ${actualUserId}: ${id}`;
    console.error(errorMsg);
    throw new NotFoundError("이메일을 찾을 수 없습니다.");
  }

  console.log("[Classify API] Authorization passed, calling classifyEmailTool...");
  try {
    const result = await classifyEmailTool(id, actualUserId);
    console.log("[Classify API] Classification successful");
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[Classify API] Error in classifyEmailTool:", errorMessage);
    if (errorStack) {
      console.error("[Classify API] Error stack:", errorStack);
    }
    throw error;
  }
});

