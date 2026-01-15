import {
  getUserEmailCollectionRef,
  getUserTaskCollectionRef,
} from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { addTaskToCalendar } from "@/lib/calendar-helper";

/**
 * Create a task from an email
 */
export async function createTaskFromEmailTool(
  emailId: string,
  userId: string,
  title: string,
  description?: string,
  dueAt?: string
) {
  const inboxCollection = await getUserEmailCollectionRef(userId);
  const emailDoc = await inboxCollection.doc(emailId).get();

  if (!emailDoc.exists) {
    throw new Error("Email not found");
  }

  const email = {
    id: emailDoc.id,
    ...emailDoc.data(),
  } as any;

  const taskCollection = await getUserTaskCollectionRef(userId);
  const taskRef = await taskCollection.add({
    userId: email.userId,
    emailId,
    title,
    description: description || `Task related to: ${email.subject}`,
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
      userId,
      taskId,
      title,
      description || `Task related to: ${email.subject}`,
      taskDueAt
    );
  }

  return {
    id: taskId,
    ...taskData,
    dueAt: taskDueAt,
    createdAt: taskData?.createdAt?.toDate?.() || new Date(),
    updatedAt: taskData?.updatedAt?.toDate?.() || new Date(),
  };
}

