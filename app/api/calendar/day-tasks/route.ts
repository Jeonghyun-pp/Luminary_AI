import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveUserDocument,
  getUserTaskCollectionRefFromResolved,
  getUserCalendarCollectionRefFromResolved,
} from "@/lib/firebase";
import { listCalendarEvents } from "@/lib/calendar";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const dayTasksQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validated = dayTasksQuerySchema.parse(queryParams);

    const date = new Date(validated.date);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const { ref: userRef } = await resolveUserDocument(user.id);
    const tasksCollection = getUserTaskCollectionRefFromResolved(userRef);
    const calendarCollection = getUserCalendarCollectionRefFromResolved(userRef);

    // Get Google Calendar events for the day
    let googleEvents: any[] = [];
    try {
      googleEvents = await listCalendarEvents(user.id, date, nextDay, 100);
    } catch (error) {
      // Continue even if Google Calendar fails
    }

    // Get Firebase calendar collection to find taskId mappings
    const calendarSnapshot = await calendarCollection.get();
    const googleEventIdToTaskId = new Map<string, string>();
    calendarSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.googleEventId && data.taskId) {
        googleEventIdToTaskId.set(data.googleEventId, data.taskId);
      }
    });

    // Get all tasks to fetch status
    const tasksSnapshot = await tasksCollection.get();
    const taskMap = new Map<string, any>();
    tasksSnapshot.docs.forEach((doc) => {
      taskMap.set(doc.id, {
        id: doc.id,
        status: doc.data().status || "IN_PROGRESS",
      });
    });

    // Filter Google Calendar events for the day and add task info
    const dayStartISO = date.toISOString();
    const dayEndISO = nextDay.toISOString();

    const items = googleEvents
      .map((event) => {
        const eventStart = event.start?.dateTime || event.start?.date;
        if (!eventStart) return null;

        const eventStartDate = new Date(eventStart);
        if (eventStartDate < date || eventStartDate >= nextDay) return null;

        // Find associated task
        const taskId = googleEventIdToTaskId.get(event.id || "");
        const task = taskId ? taskMap.get(taskId) : null;

        return {
          id: event.id || "",
          title: event.summary || "제목 없음",
          description: event.description || "",
          time: eventStart,
          startTime: eventStart,
          endTime: event.end?.dateTime || event.end?.date || eventStart,
          type: "event" as const,
          taskId: taskId || null,
          taskStatus: task?.status || null,
        };
      })
      .filter((item) => item !== null)
      .sort((a, b) => {
        if (!a || !b) return 0;
        return new Date(a.time).getTime() - new Date(b.time).getTime();
      });

    return NextResponse.json({
      success: true,
      items: items,
    });
  } catch (error: any) {
    console.error("[Day Tasks] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch day tasks" },
      { status: 500 }
    );
  }
}

