import { google } from "googleapis";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { db, COLLECTIONS } from "@/lib/firebase";
import { OAuth2Client } from "google-auth-library";
import { DetectedEvent } from "@/types";
import { getActiveAccountId } from "@/lib/user-settings";

/**
 * Get OAuth2 client for Google Calendar API.
 * Uses activeAccountId from user settings when set; otherwise first Google account.
 */
export async function getCalendarClient(userId: string, accountId?: string | null) {
  let accountDoc: DocumentSnapshot | null = null;

  if (accountId) {
    const doc = await db.collection(COLLECTIONS.ACCOUNTS).doc(accountId).get();
    if (doc.exists && (doc.data()?.userId === userId) && (doc.data()?.provider === "google")) {
      accountDoc = doc;
    }
  }
  if (!accountDoc) {
    const activeId = await getActiveAccountId(userId);
    if (activeId) {
      const doc = await db.collection(COLLECTIONS.ACCOUNTS).doc(activeId).get();
      if (doc.exists && doc.data()?.provider === "google") {
        accountDoc = doc;
      }
    }
  }
  if (!accountDoc) {
    const accountSnapshot = await db
      .collection(COLLECTIONS.ACCOUNTS)
      .where("userId", "==", userId)
      .where("provider", "==", "google")
      .limit(1)
      .get();
    if (!accountSnapshot.empty) {
      accountDoc = accountSnapshot.docs[0];
    }
  }

  if (!accountDoc || !accountDoc.exists) {
    throw new Error("No Google OAuth tokens found. Please sign in again.");
  }

  const account = accountDoc.data()!;

  if (!account?.access_token || !account?.refresh_token) {
    throw new Error("No Google OAuth tokens found. Please sign in again.");
  }
  
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  try {
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    });
  } catch (error: any) {
    throw new Error("Failed to set OAuth credentials. Please sign in again.");
  }

  // Auto-refresh token when expired
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await accountDoc.ref.update({
        access_token: tokens.access_token,
        expires_at: tokens.expiry_date
          ? Math.floor(tokens.expiry_date / 1000)
          : null,
        refresh_token: tokens.refresh_token || account.refresh_token,
      });
    }
  });

  // Handle token refresh errors
  (oauth2Client as any).on("error", async (error: any) => {
    if (error.message?.includes("invalid_grant") || error.code === 400) {
      try {
        await accountDoc.ref.update({
          access_token: null,
          refresh_token: null,
          expires_at: null,
        });
      } catch (_) {}
    }
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Create a calendar event from DetectedEvent
 */
export async function createCalendarEvent(
  userId: string,
  event: DetectedEvent
): Promise<string> {
  const calendar = await getCalendarClient(userId);

  const calendarEvent = {
    summary: event.title,
    description: event.notes,
    location: event.location,
    start: event.startTime
      ? {
          dateTime: event.startTime,
          timeZone: "Asia/Seoul",
        }
      : event.dueTime
      ? {
          dateTime: event.dueTime,
          timeZone: "Asia/Seoul",
        }
      : undefined,
    end: event.endTime
      ? {
          dateTime: event.endTime,
          timeZone: "Asia/Seoul",
        }
      : event.startTime
      ? {
          dateTime: new Date(
            new Date(event.startTime).getTime() + 60 * 60 * 1000
          ).toISOString(),
          timeZone: "Asia/Seoul",
        }
      : event.dueTime
      ? {
          dateTime: new Date(
            new Date(event.dueTime).getTime() + 60 * 60 * 1000
          ).toISOString(),
          timeZone: "Asia/Seoul",
        }
      : undefined,
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: calendarEvent,
  });

  return response.data.id || "";
}

/**
 * List calendar events for a user
 */
export async function listCalendarEvents(
  userId: string,
  timeMin?: Date,
  timeMax?: Date,
  maxResults: number = 50
) {
  const calendar = await getCalendarClient(userId);

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin?.toISOString(),
    timeMax: timeMax?.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.data.items || [];
}

/**
 * Delete a calendar event from Google Calendar
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<void> {
  const calendar = await getCalendarClient(userId);

  await calendar.events.delete({
    calendarId: "primary",
    eventId: eventId,
  });
}

