import { resolveUserDocument, getUserCalendarCollectionRefFromResolved } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { createCalendarEvent } from "@/lib/calendar";

/**
 * Automatically add a task to calendar when it's created
 */
export async function addTaskToCalendar(
  userId: string,
  taskId: string,
  title: string,
  description: string | null,
  dueAt: Date | null
) {
  if (!dueAt) {
    // No due date, skip calendar addition
    return null;
  }

  try {
    const { ref: userRef } = await resolveUserDocument(userId);
    const calendarCollection = getUserCalendarCollectionRefFromResolved(userRef);

    // Check if calendar event already exists for this task
    const existingEventSnapshot = await calendarCollection
      .where("taskId", "==", taskId)
      .limit(1)
      .get();

    if (!existingEventSnapshot.empty) {
      // Calendar event already exists for this task, return existing ID
      console.log(`[Add Task to Calendar] Calendar event already exists for task ${taskId}`);
      return existingEventSnapshot.docs[0].id;
    }

    const startTime = dueAt.toISOString();
    const endTime = new Date(dueAt.getTime() + 60 * 60 * 1000).toISOString(); // +1 hour

    // Try to add to Google Calendar (if connected)
    let googleEventId: string | null = null;
    try {
      const googleEvent = await createCalendarEvent(userId, {
        title: title || "협업 마감일",
        type: "DEADLINE",
        dueTime: startTime,
        notes: description || "",
      });
      googleEventId = googleEvent;
    } catch (error) {
      console.log("[Add Task to Calendar] Google Calendar not connected or failed:", error);
      // Continue to save to Firebase even if Google Calendar fails
    }

    // Always save to Firebase calendar collection
    const calendarEventRef = await calendarCollection.add({
      taskId: taskId,
      title: title || "협업 마감일",
      description: description || "",
      startTime: startTime,
      endTime: endTime,
      googleEventId: googleEventId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return calendarEventRef.id;
  } catch (error) {
    console.error("[Add Task to Calendar] Error:", error);
    // Don't throw error, just log it - task creation should succeed even if calendar addition fails
    return null;
  }
}

