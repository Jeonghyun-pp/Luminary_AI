import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveUserDocument,
  getUserEmailCollectionRefFromResolved,
} from "@/lib/firebase";
import { parseSortCommand } from "@/lib/agent/parse-sort-command";
import { withErrorHandler } from "@/lib/errors/handler";

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: Request) => {
  const user = await getCurrentUser();
  const { command } = await request.json();

  if (!command || typeof command !== "string") {
    return NextResponse.json(
      { error: "Command is required" },
      { status: 400 }
    );
  }

  // Get a few sample emails for context
  const { ref: userRef } = await resolveUserDocument(user.id);
  const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);
  const snapshot = await inboxCollection
    .orderBy("receivedAt", "desc")
    .limit(5)
    .get();

  const sampleEmails = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      receivedAt: data.receivedAt?.toDate?.() || new Date(data.receivedAt),
    } as any; // Type assertion for sample emails
  });

  const sortCommand = await parseSortCommand(command, sampleEmails as any);

  return NextResponse.json({ success: true, command: sortCommand });
});

