import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";

export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events endpoint for real-time message updates
 * This streams Firebase changes to the client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { emailId: string } }
) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = user.id;
  const emailId = params.emailId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { ref: userRef } = await resolveUserDocument(userId);
        const repliesCollection = getUserSubcollectionRefFromResolved(userRef, "REPLIES");
        const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

        // Check if replies exist (email may have been deleted)
        const repliesCheck = await repliesCollection
          .where("emailId", "==", emailId)
          .limit(1)
          .get();
        
        const emailDoc = await inboxCollection.doc(emailId).get();
        
        // If no replies and no email, return error
        if (repliesCheck.empty && !emailDoc.exists) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Email not found" })}\n\n`));
          controller.close();
          return;
        }

        // Set up Firebase real-time listener
        const unsubscribe = repliesCollection
          .where("emailId", "==", emailId)
          .onSnapshot(
            (snapshot) => {
              const messages = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                  id: doc.id,
                  subject: data.subject || "",
                  body: data.body || "",
                  from: data.from || "",
                  to: data.to || "",
                  sentAt: data.sentAt?.toDate?.()?.toISOString() || new Date(data.sentAt).toISOString(),
                  isSent: data.from === user.email,
                };
              });

              // Sort by sentAt
              messages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "update", messages })}\n\n`)
              );
            },
            (error) => {
              console.error("[SSE] Firebase listener error:", error);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`)
              );
            }
          );

        // Handle client disconnect
        request.signal.addEventListener("abort", () => {
          unsubscribe();
          controller.close();
        });

        // Send initial connection message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));
      } catch (error: any) {
        console.error("[SSE] Error:", error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

