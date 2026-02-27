import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserCalendarCollectionRefFromResolved } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { createCalendarEvent } from "@/lib/calendar";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const taskId = params.id;
    const { ref: userRef } = await resolveUserDocument(userId);
    const calendarCollection = getUserCalendarCollectionRefFromResolved(userRef);

    // Get task details (we'll need to fetch from tasks collection)
    const tasksCollection = userRef.collection("tasks");
    const taskDoc = await tasksCollection.doc(taskId).get();
    
    if (!taskDoc.exists) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = taskDoc.data();
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    
    if (!task.dueAt) {
      return NextResponse.json({ error: "Task has no due date" }, { status: 400 });
    }

    const dueDate = task.dueAt instanceof Date ? task.dueAt : task.dueAt.toDate();
    const startTime = dueDate.toISOString();
    const endTime = new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString(); // +1 hour

    // Try to add to Google Calendar (if connected)
    let googleEventId: string | null = null;
    try {
      const googleEvent = await createCalendarEvent(userId, {
        title: task.title || "협업 마감일",
        type: "DEADLINE",
        dueTime: startTime,
        notes: task.description || "",
      });
      googleEventId = googleEvent;
    } catch (error) {
      // Continue to save to Firebase even if Google Calendar fails
    }

    // Always save to Firebase calendar collection
    const calendarEventRef = await calendarCollection.add({
      taskId: taskId,
      title: task.title || "협업 마감일",
      description: task.description || "",
      startTime: startTime,
      endTime: endTime,
      googleEventId: googleEventId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      eventId: calendarEventRef.id,
      googleEventId: googleEventId,
    });
  } catch (error: any) {
    console.error("[Add to Calendar] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add to calendar" },
      { status: 500 }
    );
  }
}

