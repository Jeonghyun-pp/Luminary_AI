import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveUserDocument,
  getUserTaskCollectionRefFromResolved,
} from "@/lib/firebase";
import { updateTaskSchema, taskIdSchema } from "@/lib/validations/task";
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
  taskIdSchema.parse({ id });
  
  const body = await request.json();
  const validated = updateTaskSchema.parse(body);

  const { ref: userRef } = await resolveUserDocument(user.id);
  const tasksCollection = getUserTaskCollectionRefFromResolved(userRef);
  const taskDoc = await tasksCollection.doc(id).get();

  if (!taskDoc.exists) {
    throw new NotFoundError("작업을 찾을 수 없습니다.");
  }

  const updateData: any = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (validated.title) updateData.title = validated.title;
  if (validated.description !== undefined) updateData.description = validated.description;
  if (validated.status) updateData.status = validated.status;
  if (validated.dueAt) updateData.dueAt = new Date(validated.dueAt);

  await tasksCollection.doc(id).update(updateData);

  const updatedDoc = await tasksCollection.doc(id).get();
  const updatedData = updatedDoc.data();

  return NextResponse.json({
    success: true,
    task: {
      id: updatedDoc.id,
      ...updatedData,
      dueAt: updatedData?.dueAt?.toDate?.() || (updatedData?.dueAt ? new Date(updatedData.dueAt) : null),
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
  taskIdSchema.parse({ id });

  const { ref: userRef } = await resolveUserDocument(user.id);
  const tasksCollection = getUserTaskCollectionRefFromResolved(userRef);
  const taskDoc = await tasksCollection.doc(id).get();

  if (!taskDoc.exists) {
    throw new NotFoundError("작업을 찾을 수 없습니다.");
  }

  await tasksCollection.doc(id).delete();

  return NextResponse.json({ success: true });
});

