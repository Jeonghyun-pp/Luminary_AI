import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listCalendarEvents } from "@/lib/calendar";
import { resolveUserDocument, getUserCalendarCollectionRefFromResolved, getUserTaskCollectionRefFromResolved } from "@/lib/firebase";
import { withErrorHandler } from "@/lib/errors/handler";
import { z } from "zod";

const calendarEventsQuerySchema = z.object({
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
  maxResults: z.string().regex(/^\d+$/).transform(Number).default("50"),
});

export const GET = withErrorHandler(async (request: Request) => {
  const user = await getCurrentUser();
  const { searchParams } = new URL(request.url);

  const queryParams = Object.fromEntries(searchParams.entries());
  const validated = calendarEventsQuerySchema.parse(queryParams);

  const timeMin = validated.timeMin ? new Date(validated.timeMin) : undefined;
  const timeMax = validated.timeMax ? new Date(validated.timeMax) : undefined;

  // Get events from Google Calendar (if connected)
  let googleEvents: any[] = [];
  try {
    googleEvents = await listCalendarEvents(
      user.id,
      timeMin,
      timeMax,
      validated.maxResults
    );
  } catch (error) {
    console.log("[Calendar Events] Google Calendar not connected or failed:", error);
    // Continue to get Firebase events even if Google Calendar fails
  }

  // Get events from Firebase calendar collection (without orderBy to avoid index requirement)
  const { ref: userRef } = await resolveUserDocument(user.id);
  const calendarCollection = getUserCalendarCollectionRefFromResolved(userRef);
  const tasksCollection = getUserTaskCollectionRefFromResolved(userRef);
  
  const snapshot = await calendarCollection.get();
  
  // Get all calendar events with taskId mappings
  const googleEventIdToTaskId = new Map<string, string>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.googleEventId && data.taskId) {
      googleEventIdToTaskId.set(data.googleEventId, data.taskId);
    }
  });

  // Get all tasks to fetch status and match by title/date
  const tasksSnapshot = await tasksCollection.get();
  const taskMap = new Map<string, any>();
  const taskTitleDateMap = new Map<string, string>(); // Key: "title|date", Value: taskId
  
  tasksSnapshot.docs.forEach((doc) => {
    const taskData = doc.data();
    const taskId = doc.id;
    const dueAt = taskData.dueAt?.toDate?.() || (taskData.dueAt ? new Date(taskData.dueAt) : null);
    const title = taskData.title || "";
    
    taskMap.set(taskId, {
      id: taskId,
      status: taskData.status || "IN_PROGRESS",
      title: title,
      dueAt: dueAt,
    });
    
    // Create a map for matching by title and date
    if (title && dueAt) {
      // Normalize date to YYYY-MM-DD format for comparison
      const dateStr = dueAt.toISOString().split('T')[0];
      const key = `${title.trim()}|${dateStr}`;
      taskTitleDateMap.set(key, taskId);
    }
  });
  
  const allFirebaseEvents = snapshot.docs.map((doc: any) => {
    const data = doc.data();
    return {
      id: doc.id,
      googleEventId: data.googleEventId || null, // Store googleEventId for deduplication
      summary: data.title || "제목 없음",
      description: data.description || "",
      start: {
        dateTime: data.startTime,
      },
      end: {
        dateTime: data.endTime || data.startTime,
      },
    };
  });

  // Filter by time range in memory
  const firebaseEvents = allFirebaseEvents.filter((event) => {
    if (!event.start?.dateTime) return false;
    const eventTime = new Date(event.start.dateTime).getTime();
    if (timeMin && eventTime < timeMin.getTime()) return false;
    if (timeMax && eventTime > timeMax.getTime()) return false;
    return true;
  });

  // Create a set of Google Calendar event IDs that are already in Firebase
  const googleEventIdsInFirebase = new Set(
    firebaseEvents
      .map((e: any) => e.googleEventId)
      .filter((id: any) => id !== null && id !== undefined)
  );

  // Filter out Google Calendar events that are already in Firebase (to avoid duplicates)
  const uniqueGoogleEvents = googleEvents.filter((event) => {
    // If this Google Calendar event ID is in Firebase, skip it (Firebase version will be shown)
    return !googleEventIdsInFirebase.has(event.id);
  });

  // Merge events (Firebase events + unique Google Calendar events)
  const allEvents = [...firebaseEvents, ...uniqueGoogleEvents];
  
  // Additional deduplication based on start time and summary (safety check)
  const uniqueEvents = allEvents.filter((event, index, self) =>
    index === self.findIndex((e) => {
      // If both have googleEventId, match by ID
      if (e.googleEventId && event.googleEventId) {
        return e.googleEventId === event.googleEventId;
      }
      // Otherwise match by start time and summary
      return (
        e.start?.dateTime === event.start?.dateTime && 
        e.summary === event.summary
      );
    })
  );

  // Sort by start time
  uniqueEvents.sort((a, b) => {
    const aTime = a.start?.dateTime ? new Date(a.start.dateTime).getTime() : 0;
    const bTime = b.start?.dateTime ? new Date(b.start.dateTime).getTime() : 0;
    return aTime - bTime;
  });

  // Add task information to events
  const eventsWithTasks = uniqueEvents.map((event) => {
    const googleEventId = event.id || (event as any).googleEventId;
    
    // First, try to match by googleEventId (existing mapping)
    let taskId = googleEventId ? googleEventIdToTaskId.get(googleEventId) : null;
    
    // If not found, try to match by title and date
    if (!taskId) {
      const eventTitle = event.summary || "";
      const eventStart = event.start?.dateTime || event.start?.date;
      
      if (eventTitle && eventStart) {
        try {
          const eventDate = new Date(eventStart);
          const dateStr = eventDate.toISOString().split('T')[0];
          const key = `${eventTitle.trim()}|${dateStr}`;
          taskId = taskTitleDateMap.get(key) || null;
        } catch (error) {
          // Invalid date, skip matching
          console.log("[Calendar Events] Failed to parse event date:", eventStart);
        }
      }
    }
    
    const task = taskId ? taskMap.get(taskId) : null;

    return {
      ...event,
      taskId: taskId || null,
      taskStatus: task?.status || null,
    };
  });

  return NextResponse.json({ events: eventsWithTasks });
});

