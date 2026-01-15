import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveUserDocument,
  getUserRuleCollectionRefFromResolved,
} from "@/lib/firebase";
import { parseRuleFromNaturalLanguageTool } from "@/lib/agent/parse-rule";
import { createRuleSchema } from "@/lib/validations/rule";
import { withErrorHandler } from "@/lib/errors/handler";

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser();
  const { id: actualUserId, ref: userRef } = await resolveUserDocument(user.id);
  const rulesCollection = getUserRuleCollectionRefFromResolved(userRef);
  const snapshot = await rulesCollection
    .orderBy("createdAt", "desc")
    .get();

  const rules = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
    updatedAt: doc.data().updatedAt?.toDate?.() || new Date(doc.data().updatedAt),
  }));

  return NextResponse.json({ rules });
});

export const POST = withErrorHandler(async (request: Request) => {
  const user = await getCurrentUser();
  const body = await request.json();

  // Validate input
  const { naturalLanguageText } = createRuleSchema.parse(body);
  const { id: actualUserId } = await resolveUserDocument(user.id);
  const rule = await parseRuleFromNaturalLanguageTool(
    actualUserId,
    naturalLanguageText
  );

  return NextResponse.json({ success: true, rule });
});

