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
    const expiryDate = account.expires_at ? account.expires_at * 1000 : undefined;
    const isExpired = expiryDate ? Date.now() >= expiryDate : false;

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: expiryDate,
    });

    if (isExpired && account.refresh_token) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await accountDoc.ref.update({
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date
            ? Math.floor(credentials.expiry_date / 1000)
            : null,
          refresh_token: credentials.refresh_token || account.refresh_token,
        });
      } catch (refreshError: any) {
        if (refreshError.message?.includes("invalid_grant") ||
            refreshError.response?.data?.error === "invalid_grant") {
          try {
            await accountDoc.ref.update({
              access_token: null,
              refresh_token: null,
              expires_at: null,
            });
          } catch (_) {}
          throw new Error("INVALID_GRANT: Google 인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.");
        }
        throw refreshError;
      }
    }
  } catch (error: any) {
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

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Fetch sponsorship emails from Gmail
 * Only fetches emails that match sponsorship-related keywords in subject
 * Excludes emails sent by the user
 */
export async function fetchGmailEmails(userId: string, maxResults: number = 50) {
  let gmail;
  try {
    gmail = await getGmailClient(userId);
  } catch (error: any) {
    if (error.message?.includes("invalid_grant") || error.message?.includes("Invalid grant")) {
      throw new Error("INVALID_GRANT: Google 인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.");
    }
    throw error;
  }

  let profile;
  try {
    profile = await gmail.users.getProfile({ userId: "me" });
  } catch (error: any) {
    if (error.message?.includes("invalid_grant") ||
        error.message?.includes("Invalid grant") ||
        error.response?.data?.error === "invalid_grant") {
      throw new Error("INVALID_GRANT: Google 인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.");
    }
    throw error;
  }
  const userEmail = profile.data.emailAddress || "";

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

  let query = sponsorshipQuery;
  if (userEmail) {
    query += ` -from:${userEmail}`;
  }
  query += ` -subject:"Re:" -subject:"RE:" -subject:"re:"`;

  let response;
  try {
    response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });
  } catch (error: any) {
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

    if (subject && (subject.trim().startsWith("Re:") || subject.trim().startsWith("RE:") || subject.trim().startsWith("re:"))) {
      continue;
    }

    if (userEmail && from) {
      const fromEmail = from.includes("<")
        ? from.split("<")[1].split(">")[0].toLowerCase()
        : from.toLowerCase();
      if (fromEmail === userEmail.toLowerCase()) {
        continue;
      }
    }

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

  let replySubject = subject;
  if (!replySubject.startsWith("Re:") && !replySubject.startsWith("RE:")) {
    replySubject = `Re: ${replySubject}`;
  }

  const encodedSubject = `=?UTF-8?B?${Buffer.from(replySubject).toString("base64")}?=`;

  const replyMessage = [
    `To: ${recipientEmail}`,
    `Subject: ${encodedSubject}`,
    `In-Reply-To: ${originalMessageIdHeader}`,
    `References: ${originalMessageIdHeader}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\n");

  const messageBytes = Buffer.from(replyMessage, "utf-8");
  const messageB64 = messageBytes.toString("base64url");

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
  await gmail.users.messages.trash({ userId: "me", id: messageId });
  return { success: true };
}

/**
 * Restore email from trash in Gmail
 */
export async function untrashGmailMessage(userId: string, messageId: string) {
  const gmail = await getGmailClient(userId);
  await gmail.users.messages.untrash({ userId: "me", id: messageId });
  return { success: true };
}

/**
 * Permanently delete email from Gmail
 */
export async function deleteGmailMessage(userId: string, messageId: string) {
  const gmail = await getGmailClient(userId);
  await gmail.users.messages.delete({ userId: "me", id: messageId });
  return { success: true };
}

/**
 * Fetch all messages in a Gmail thread
 */
export async function fetchThreadMessages(userId: string, threadId: string) {
  const gmail = await getGmailClient(userId);

  const profile = await gmail.users.getProfile({ userId: "me" });
  const userEmail = profile.data.emailAddress || "";

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

    let bodyText = "";
    if (payload.body?.data) {
      bodyText = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
          break;
        }
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

  result.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

  return result;
}

/**
 * Get unread message count for a Gmail thread
 */
export async function getThreadUnreadCount(userId: string, threadId: string): Promise<number> {
  const gmail = await getGmailClient(userId);

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

  await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}
