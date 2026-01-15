import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveUserDocument,
  getUserRuleCollectionRefFromResolved,
} from "@/lib/firebase";
import { ruleIdSchema, updateRuleSchema } from "@/lib/validations/rule";
import { withErrorHandler } from "@/lib/errors/handler";
import { NotFoundError } from "@/lib/errors/handler";
import { FieldValue } from "firebase-admin/firestore";

export const PATCH = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  const { id } = await params;
  
  // Validate params
  ruleIdSchema.parse({ id });
  
  const body = await request.json();
  const validated = updateRuleSchema.parse(body);

  // Verify rule exists and belongs to user
  const { ref: userRef } = await resolveUserDocument(user.id);
  const rulesCollection = getUserRuleCollectionRefFromResolved(userRef);
  const ruleDoc = await rulesCollection.doc(id).get();

  if (!ruleDoc.exists) {
    throw new NotFoundError("규칙을 찾을 수 없습니다.");
  }

  const updateData: any = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (validated.name) updateData.name = validated.name;
  if (validated.description !== undefined) updateData.description = validated.description;
  if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

  await rulesCollection.doc(id).update(updateData);

  const updatedDoc = await rulesCollection.doc(id).get();
  const updatedData = updatedDoc.data();

  return NextResponse.json({
    success: true,
    rule: {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate?.() || new Date(updatedData?.createdAt),
      updatedAt: updatedData?.updatedAt?.toDate?.() || new Date(updatedData?.updatedAt),
    },
  });
});

export const DELETE = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  const { id } = await params;
  
  // Validate params
  ruleIdSchema.parse({ id });

  // Verify rule exists and belongs to user
  const { ref: userRef } = await resolveUserDocument(user.id);
  const rulesCollection = getUserRuleCollectionRefFromResolved(userRef);
  const ruleDoc = await rulesCollection.doc(id).get();

  if (!ruleDoc.exists) {
    throw new NotFoundError("규칙을 찾을 수 없습니다.");
  }

  await rulesCollection.doc(id).delete();

  return NextResponse.json({ success: true });
});

