import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveUserDocument,
  getUserTaskCollectionRefFromResolved,
  getUserEmailCollectionRefFromResolved,
} from "@/lib/firebase";
import { createTaskSchema, taskQuerySchema } from "@/lib/validations/task";
import { withErrorHandler } from "@/lib/errors/handler";
import { NotFoundError } from "@/lib/errors/handler";
import { FieldValue, Query } from "firebase-admin/firestore";
import { addTaskToCalendar } from "@/lib/calendar-helper";

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (request: Request) => {
  const user = await getCurrentUser();
  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryParams = Object.fromEntries(searchParams.entries());
  const validated = taskQuerySchema.parse(queryParams);

  const { id: actualUserId, ref: userRef } = await resolveUserDocument(user.id);
  const tasksCollection = getUserTaskCollectionRefFromResolved(userRef);
  const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);
  let query: Query = tasksCollection;

  if (validated.status) {
    query = query.where("status", "==", validated.status);
  }

  if (validated.dueToday) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    query = query
      .where("dueAt", ">=", today)
      .where("dueAt", "<", tomorrow);
  }

  const snapshot = await query.orderBy("dueAt", "asc").get();
  const tasks = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const taskData = doc.data();
      let email = null;

      if (taskData.emailId) {
        const emailDoc = await inboxCollection.doc(taskData.emailId).get();
        if (emailDoc.exists) {
          email = {
            id: emailDoc.id,
            subject: emailDoc.data()?.subject,
            from: emailDoc.data()?.from,
          };
        }
      }

      return {
        id: doc.id,
        ...taskData,
        email,
        dueAt: taskData.dueAt?.toDate?.() || (taskData.dueAt ? new Date(taskData.dueAt) : null),
        createdAt: taskData.createdAt?.toDate?.() || new Date(taskData.createdAt),
        updatedAt: taskData.updatedAt?.toDate?.() || new Date(taskData.updatedAt),
      };
    })
  );

  return NextResponse.json({ tasks });
});

export const POST = withErrorHandler(async (request: Request) => {
  const user = await getCurrentUser();
  const body = await request.json();

  // Validate input
  const { id: actualUserId, ref: userRef } = await resolveUserDocument(user.id);
  const tasksCollection = getUserTaskCollectionRefFromResolved(userRef);
  const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

  const { emailId, title, description, dueAt } = createTaskSchema.parse(body);

  // If emailId is provided, verify it exists for this user
  if (emailId) {
    const emailDoc = await inboxCollection.doc(emailId).get();

    if (!emailDoc.exists) {
      throw new NotFoundError("이메일을 찾을 수 없습니다.");
    }
  }

  const taskRef = await tasksCollection.add({
    userId: actualUserId,
    emailId: emailId || null,
    title,
    description: description || null,
    status: "TODO",
    dueAt: dueAt ? new Date(dueAt) : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const taskDoc = await taskRef.get();
  const taskData = taskDoc.data();
  const taskId = taskDoc.id;
  const taskDueAt = taskData?.dueAt?.toDate?.() || (taskData?.dueAt ? new Date(taskData.dueAt) : null);

  // Automatically add to calendar if dueAt exists
  if (taskDueAt) {
    await addTaskToCalendar(
      actualUserId,
      taskId,
      title,
      description || null,
      taskDueAt
    );
  }

  return NextResponse.json({
    success: true,
    task: {
      id: taskId,
      ...taskData,
      dueAt: taskDueAt,
      createdAt: taskData?.createdAt?.toDate?.() || new Date(),
      updatedAt: taskData?.updatedAt?.toDate?.() || new Date(),
    },
  });
});

