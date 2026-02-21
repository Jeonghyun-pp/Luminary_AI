import { google } from "googleapis";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { db, COLLECTIONS } from "@/lib/firebase";
import { OAuth2Client } from "google-auth-library";
import { getActiveAccountId } from "@/lib/user-settings";

/**
 * Get OAuth2 client for Gmail API.
 * Uses activeAccountId from user settings when set; otherwise first Google account.
 */
export async function getGmailClient(userId: string, accountId?: string | null) {
  const functionStartTime = Date.now();
  console.log(`[Gmail] getGmailClient started for userId: ${userId}, accountId: ${accountId ?? "(auto)"}`);

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
    const startTime = Date.now();
    const accountSnapshot = await db
      .collection(COLLECTIONS.ACCOUNTS)
      .where("userId", "==", userId)
      .where("provider", "==", "google")
      .limit(1)
      .get();
    const queryTime = Date.now() - startTime;
    console.log(`[Gmail] Firebase query took ${queryTime}ms`);
    if (!accountSnapshot.empty) {
      accountDoc = accountSnapshot.docs[0];
    }
  }

  if (!accountDoc || !accountDoc.exists) {
    throw new Error("No Google OAuth tokens found. Please sign in again.");
  }

  const account = accountDoc.data()!;

  // 디버깅: 토큰 상태 확인
  console.log("[Gmail] Token check:", {
    userId,
    hasAccessToken: !!account?.access_token,
    hasRefreshToken: !!account?.refresh_token,
    accessTokenLength: account?.access_token?.length || 0,
    refreshTokenLength: account?.refresh_token?.length || 0,
    expiresAt: account?.expires_at,
    tokenType: account?.token_type,
    scope: account?.scope,
    accountId: account?.providerAccountId,
  });

  if (!account?.access_token || !account?.refresh_token) {
    console.error("[Gmail] Missing tokens:", {
      hasAccessToken: !!account?.access_token,
      hasRefreshToken: !!account?.refresh_token,
      accountData: Object.keys(account || {}),
    });
    throw new Error("No Google OAuth tokens found. Please sign in again.");
  }

  const clientInitStart = Date.now();
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  const clientInitTime = Date.now() - clientInitStart;
  console.log(`[Gmail] OAuth2Client initialization took ${clientInitTime}ms`);

  try {
    const credentialsStart = Date.now();
    const expiryDate = account.expires_at ? account.expires_at * 1000 : undefined;
    const isExpired = expiryDate ? Date.now() >= expiryDate : false;
    
    console.log("[Gmail] Setting credentials:", {
      hasExpiryDate: !!expiryDate,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      isExpired,
      currentTime: new Date().toISOString(),
    });

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: expiryDate,
    });
    const credentialsTime = Date.now() - credentialsStart;
    console.log(`[Gmail] Setting credentials took ${credentialsTime}ms`);

    // If token is expired, try to refresh it immediately
    if (isExpired && account.refresh_token) {
      console.log("[Gmail] Token expired, attempting to refresh...");
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        console.log("[Gmail] Token refreshed successfully");
        // Update tokens in database
        await accountDoc.ref.update({
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date
            ? Math.floor(credentials.expiry_date / 1000)
            : null,
          refresh_token: credentials.refresh_token || account.refresh_token,
        });
      } catch (refreshError: any) {
        console.error("[Gmail] Failed to refresh token:", {
          message: refreshError.message,
          code: refreshError.code,
          response: refreshError.response?.data,
        });
        // If refresh fails with invalid_grant, delete tokens and require re-login
        if (refreshError.message?.includes("invalid_grant") || 
            refreshError.response?.data?.error === "invalid_grant") {
          console.log("[Gmail] Invalid grant error - clearing tokens for user:", userId);
          try {
            await accountDoc.ref.update({
              access_token: null,
              refresh_token: null,
              expires_at: null,
            });
            console.log("[Gmail] Cleared invalid tokens");
          } catch (updateError) {
            console.error("[Gmail] Failed to clear tokens:", updateError);
          }
          throw new Error("INVALID_GRANT: Google 인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.");
        }
        throw refreshError;
      }
    }
  } catch (error: any) {
    console.error("[Gmail] Error setting credentials:", error);
    if (error.message?.includes("INVALID_GRANT")) {
      throw error;
    }
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
    console.error("[Gmail] OAuth2Client error:", error);
    if (error.message?.includes("invalid_grant") || error.code === 400) {
      console.error("[Gmail] Invalid grant error - refresh token may be expired or revoked");
      // Mark account as needing re-authentication by deleting tokens
      try {
        await accountDoc.ref.update({
          access_token: null,
          refresh_token: null,
          expires_at: null,
        });
        console.log("[Gmail] Cleared invalid tokens for user:", userId);
      } catch (updateError) {
        console.error("[Gmail] Failed to clear tokens:", updateError);
      }
    }
  });

  const gmailClient = google.gmail({ version: "v1", auth: oauth2Client });
  const totalTime = Date.now() - functionStartTime;
  console.log(`[Gmail] getGmailClient completed in ${totalTime}ms`);
  return gmailClient;
}

/**
 * Fetch sponsorship emails from Gmail
 * Only fetches emails that match sponsorship-related keywords in subject
 * Excludes emails sent by the user
 */
export async function fetchGmailEmails(userId: string, maxResults: number = 50) {
  const fetchStartTime = Date.now();
  console.log(`[Gmail] fetchGmailEmails started for userId: ${userId}`);
  
  let gmail;
  try {
    gmail = await getGmailClient(userId);
  } catch (error: any) {
    console.error("[Gmail] Error getting Gmail client:", {
      message: error.message,
      code: error.code,
    });
    if (error.message?.includes("invalid_grant") || error.message?.includes("Invalid grant")) {
      throw new Error("INVALID_GRANT: Google 인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.");
    }
    throw error;
  }
  
  // Get user's email address to filter out sent emails
  let profile;
  try {
    const profileStartTime = Date.now();
    profile = await gmail.users.getProfile({ userId: "me" });
    const profileTime = Date.now() - profileStartTime;
    console.log(`[Gmail] getProfile API call took ${profileTime}ms`);
  } catch (error: any) {
    console.error("[Gmail] Error getting profile:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
    });
    // Only throw INVALID_GRANT if it's actually an invalid_grant error
    if (error.message?.includes("invalid_grant") || 
        error.message?.includes("Invalid grant") ||
        error.response?.data?.error === "invalid_grant") {
      throw new Error("INVALID_GRANT: Google 인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.");
    }
    throw error;
  }
  const userEmail = profile.data.emailAddress || "";
  
  // Gmail search query for sponsorship-related emails
  // Search in subject for sponsorship keywords
  // Exclude emails sent by the user using -from:user@email.com
  const sponsorshipQuery = [
    "subject:협찬",
    'subject:협업',
    "subject:제휴",
    "subject:스폰서",
    "subject:sponsor",
    "subject:collaboration",
    "subject:partnership",
    "subject:광고문의",
    "subject:마켓",
    "subject:제안",
    "subject:크리에이터",
    "subject:인플루언서",
    "subject:influencer",
    "subject:체험단",
    "subject:체험",
    "subject:샘플",
    "subject:보상",
  ].join(" OR ");
  
  // Add filters to exclude:
  // 1. Emails sent by the user
  // 2. Reply emails (subject starts with "Re:" or "RE:")
  let query = sponsorshipQuery;
  if (userEmail) {
    query += ` -from:${userEmail}`;
  }
  // Exclude reply emails (Re:, RE:, re:)
  query += ` -subject:"Re:" -subject:"RE:" -subject:"re:"`;
  
  let response;
  try {
    const listStartTime = Date.now();
    response = await gmail.users.messages.list({
      userId: "me",
      q: query, // Filter by sponsorship keywords and exclude sent emails
      maxResults,
    });
    const listTime = Date.now() - listStartTime;
    console.log(`[Gmail] messages.list API call took ${listTime}ms, found ${response.data.messages?.length || 0} messages`);
  } catch (error: any) {
    console.error("[Gmail] Error listing messages:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
    });
    // Only throw INVALID_GRANT if it's actually an invalid_grant error
    if (error.message?.includes("invalid_grant") || 
        error.message?.includes("Invalid grant") ||
        error.response?.data?.error === "invalid_grant") {
      throw new Error("INVALID_GRANT: Google 인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.");
    }
    throw error;
  }

  const messages = response.data.messages || [];
  const emails = [];

  for (const message of messages) {
    if (!message.id) continue;

    const msg = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "full",
    });

    const payload = msg.data.payload;
    if (!payload) continue;

    const headers = payload.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    const subject = getHeader("Subject");
    const from = getHeader("From");
    const to = getHeader("To");
    const cc = getHeader("Cc");
    const bcc = getHeader("Bcc");
    const date = getHeader("Date");

    // Skip emails with "Re:" or "RE:" in subject (reply emails)
    if (subject && (subject.trim().startsWith("Re:") || subject.trim().startsWith("RE:") || subject.trim().startsWith("re:"))) {
      continue; // Skip reply emails
    }

    // Additional check: Skip if from field contains user's email (double-check)
    if (userEmail && from) {
      const fromEmail = from.includes("<") 
        ? from.split("<")[1].split(">")[0].toLowerCase()
        : from.toLowerCase();
      if (fromEmail === userEmail.toLowerCase()) {
        continue; // Skip emails sent by the user
      }
    }

    // Extract body text
    let bodyText = "";
    if (payload.body?.data) {
      bodyText = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
          break;
        }
      }
    }

    const bodySnippet = bodyText.substring(0, 200);

    emails.push({
      externalId: message.id,
      threadId: msg.data.threadId || null,
      from,
      to,
      cc: cc || null,
      bcc: bcc || null,
      subject,
      bodySnippet,
      bodyFullText: bodyText,
      receivedAt: date ? new Date(date) : new Date(),
      isRead: msg.data.labelIds?.includes("UNREAD") === false,
      isStarred: msg.data.labelIds?.includes("STARRED") === true,
    });
  }

  const totalFetchTime = Date.now() - fetchStartTime;
  console.log(`[Gmail] fetchGmailEmails completed in ${totalFetchTime}ms, returning ${emails.length} emails`);
  return emails;
}

/**
 * Send a reply email via Gmail API
 */
export async function sendGmailReply(
  userId: string,
  originalMessageId: string,
  subject: string,
  body: string,
  recipientEmail: string
) {
  const gmail = await getGmailClient(userId);

  // Get original message to extract headers
  const originalMessage = await gmail.users.messages.get({
    userId: "me",
    id: originalMessageId,
    format: "full",
  });

  const headers = originalMessage.data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  const originalSubject = getHeader("Subject");
  const originalMessageIdHeader = getHeader("Message-ID");

  // Create reply subject
  let replySubject = subject;
  if (!replySubject.startsWith("Re:") && !replySubject.startsWith("RE:")) {
    replySubject = `Re: ${replySubject}`;
  }

  // Encode subject for RFC 2047 (Korean characters)
  // Format: =?charset?encoding?encoded-text?=
  const encodedSubject = `=?UTF-8?B?${Buffer.from(replySubject).toString("base64")}?=`;

  // Create reply message
  const replyMessage = [
    `To: ${recipientEmail}`,
    `Subject: ${encodedSubject}`,
    `In-Reply-To: ${originalMessageIdHeader}`,
    `References: ${originalMessageIdHeader}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\n");

  // Base64 encode
  const messageBytes = Buffer.from(replyMessage, "utf-8");
  const messageB64 = messageBytes.toString("base64url");

  // Send message
  const sentMessage = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: messageB64,
      threadId: originalMessage.data.threadId || undefined,
    },
  });

  return {
    success: true,
    messageId: sentMessage.data.id,
  };
}

/**
 * Move email to trash in Gmail
 */
export async function trashGmailMessage(userId: string, messageId: string) {
  const gmail = await getGmailClient(userId);
  
  try {
    await gmail.users.messages.trash({
      userId: "me",
      id: messageId,
    });
    return { success: true };
  } catch (error: any) {
    console.error("[Gmail] Error trashing message:", error);
    throw error;
  }
}

/**
 * Restore email from trash in Gmail
 */
export async function untrashGmailMessage(userId: string, messageId: string) {
  const gmail = await getGmailClient(userId);
  
  try {
    await gmail.users.messages.untrash({
      userId: "me",
      id: messageId,
    });
    return { success: true };
  } catch (error: any) {
    console.error("[Gmail] Error untrashing message:", error);
    throw error;
  }
}

/**
 * Permanently delete email from Gmail
 */
export async function deleteGmailMessage(userId: string, messageId: string) {
  const gmail = await getGmailClient(userId);
  
  try {
    await gmail.users.messages.delete({
      userId: "me",
      id: messageId,
    });
    return { success: true };
  } catch (error: any) {
    console.error("[Gmail] Error deleting message:", error);
    throw error;
  }
}

/**
 * Fetch all messages in a Gmail thread
 */
export async function fetchThreadMessages(userId: string, threadId: string) {
  const gmail = await getGmailClient(userId);
  
  // Get user's email address
  const profile = await gmail.users.getProfile({ userId: "me" });
  const userEmail = profile.data.emailAddress || "";

  // Get thread
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages = thread.data.messages || [];
  const result = [];

  for (const message of messages) {
    if (!message.id) continue;

    const payload = message.payload;
    if (!payload) continue;

    const headers = payload.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    const subject = getHeader("Subject");
    const from = getHeader("From");
    const to = getHeader("To");
    const date = getHeader("Date");

    // Extract body text
    let bodyText = "";
    if (payload.body?.data) {
      bodyText = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
          break;
        }
        // Also check for nested parts
        if (part.parts) {
          for (const nestedPart of part.parts) {
            if (nestedPart.mimeType === "text/plain" && nestedPart.body?.data) {
              bodyText = Buffer.from(nestedPart.body.data, "base64").toString("utf-8");
              break;
            }
          }
          if (bodyText) break;
        }
      }
    }

    // Determine if message is sent by user
    const fromEmail = from.includes("<")
      ? from.split("<")[1].split(">")[0].toLowerCase()
      : from.toLowerCase();
    const isSent = fromEmail === userEmail.toLowerCase();

    result.push({
      id: message.id,
      subject,
      body: bodyText,
      from,
      to,
      sentAt: date ? new Date(date) : new Date(),
      isSent,
    });
  }

  // Sort by sentAt
  result.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

  return result;
}

/**
 * Get unread message count for a Gmail thread
 */
export async function getThreadUnreadCount(userId: string, threadId: string): Promise<number> {
  const gmail = await getGmailClient(userId);
  
  // Get thread
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["From"],
  });

  const messages = thread.data.messages || [];
  let unreadCount = 0;

  for (const message of messages) {
    if (!message.id) continue;
    
    // Check if message is unread (has UNREAD label)
    if (message.labelIds?.includes("UNREAD")) {
      unreadCount++;
    }
  }

  return unreadCount;
}

/**
 * Mark a Gmail message as read
 */
export async function markMessageAsRead(userId: string, messageId: string): Promise<void> {
  const gmail = await getGmailClient(userId);
  
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}

/**
 * Mark all messages in a thread as read
 */
export async function markThreadAsRead(userId: string, threadId: string): Promise<void> {
  const gmail = await getGmailClient(userId);
  
  try {
    const result = await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: {
        removeLabelIds: ["UNREAD"],
      },
    });
    console.log(`[Gmail] Thread ${threadId} marked as read, result:`, result.data);
  } catch (error: any) {
    console.error(`[Gmail] Error marking thread ${threadId} as read:`, error);
    throw error;
  }
}

