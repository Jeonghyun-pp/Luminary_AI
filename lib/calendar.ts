import { google } from "googleapis";
import { db, COLLECTIONS } from "@/lib/firebase";
import { OAuth2Client } from "google-auth-library";
import { DetectedEvent } from "@/types";

/**
 * Get OAuth2 client for Google Calendar API
 */
export async function getCalendarClient(userId: string) {
  console.log("[Calendar] Getting calendar client for userId:", userId);
  
  // Try to find account by userId
  let accountSnapshot = await db
    .collection(COLLECTIONS.ACCOUNTS)
    .where("userId", "==", userId)
    .where("provider", "==", "google")
    .limit(1)
    .get();

  // If not found, try to find user first and then account
  if (accountSnapshot.empty) {
    console.log("[Calendar] Account not found by userId, trying to find user first...");
    
    // Find user by document ID or ID field
    let userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    
    if (!userDoc.exists) {
      // Try to find by ID field
      const usersSnapshot = await db.collection(COLLECTIONS.USERS)
        .where("id", "==", userId)
        .limit(1)
        .get();
      
      if (!usersSnapshot.empty) {
        userDoc = usersSnapshot.docs[0];
        console.log("[Calendar] Found user by ID field, document ID:", userDoc.id);
        // Try to find account with actual document ID
        accountSnapshot = await db
          .collection(COLLECTIONS.ACCOUNTS)
          .where("userId", "==", userDoc.id)
          .where("provider", "==", "google")
          .limit(1)
          .get();
      }
    } else {
      // User found by document ID, try to find account with document ID
      accountSnapshot = await db
        .collection(COLLECTIONS.ACCOUNTS)
        .where("userId", "==", userDoc.id)
        .where("provider", "==", "google")
        .limit(1)
        .get();
    }
  }

  if (accountSnapshot.empty) {
    console.error("[Calendar] No Google OAuth account found for userId:", userId);
    console.log("[Calendar] Debugging: Listing all accounts:");
    const allAccounts = await db.collection(COLLECTIONS.ACCOUNTS)
      .where("provider", "==", "google")
      .limit(10)
      .get();
    allAccounts.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - Account userId: ${data.userId}, providerAccountId: ${data.providerAccountId}`);
    });
    throw new Error("No Google OAuth tokens found");
  }

  const accountDoc = accountSnapshot.docs[0];
  const account = accountDoc.data();

  if (!account?.access_token || !account?.refresh_token) {
    console.error("[Calendar] Account found but missing tokens:", {
      hasAccessToken: !!account?.access_token,
      hasRefreshToken: !!account?.refresh_token,
    });
    throw new Error("No Google OAuth tokens found. Please sign in again.");
  }
  
  console.log("[Calendar] Account found, setting up OAuth client...");

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
    console.error("[Calendar] Error setting credentials:", error);
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
    console.error("[Calendar] OAuth2Client error:", error);
    if (error.message?.includes("invalid_grant") || error.code === 400) {
      console.error("[Calendar] Invalid grant error - refresh token may be expired or revoked");
      // Mark account as needing re-authentication by deleting tokens
      try {
        await accountDoc.ref.update({
          access_token: null,
          refresh_token: null,
          expires_at: null,
        });
        console.log("[Calendar] Cleared invalid tokens for user:", userId);
      } catch (updateError) {
        console.error("[Calendar] Failed to clear tokens:", updateError);
      }
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

