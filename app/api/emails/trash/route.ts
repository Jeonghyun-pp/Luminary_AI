import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";

/**
 * Get all trashed emails for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { ref: userRef } = await resolveUserDocument(userId);
    const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

    // Get all emails and filter trashed ones in memory (to avoid index requirement)
    const snapshot = await inboxCollection.get();

    const emails = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        
        // Safely convert Firestore timestamps to Date objects
        let trashedAt: Date | null = null;
        if (data.trashedAt) {
          try {
            if (data.trashedAt.toDate) {
              trashedAt = data.trashedAt.toDate();
            } else if (data.trashedAt instanceof Date) {
              trashedAt = data.trashedAt;
            } else if (typeof data.trashedAt === 'string' || typeof data.trashedAt === 'number') {
              trashedAt = new Date(data.trashedAt);
            }
            // Validate date
            if (trashedAt && isNaN(trashedAt.getTime())) {
              trashedAt = null;
            }
          } catch (error) {
            console.error("[Get Trash] Error parsing trashedAt:", error);
            trashedAt = null;
          }
        }
        
        let receivedAt: Date | null = null;
        if (data.receivedAt) {
          try {
            if (data.receivedAt.toDate) {
              receivedAt = data.receivedAt.toDate();
            } else if (data.receivedAt instanceof Date) {
              receivedAt = data.receivedAt;
            } else if (typeof data.receivedAt === 'string' || typeof data.receivedAt === 'number') {
              receivedAt = new Date(data.receivedAt);
            }
            if (receivedAt && isNaN(receivedAt.getTime())) {
              receivedAt = null;
            }
          } catch (error) {
            receivedAt = null;
          }
        }
        
        return {
          id: doc.id,
          ...data,
          trashedAt: trashedAt,
          receivedAt: receivedAt || (data.receivedAt ? new Date(data.receivedAt) : new Date()),
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt || Date.now()),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt || Date.now()),
        };
      })
      .filter((email) => email.trashedAt !== null)
      .sort((a, b) => {
        // Sort by trashedAt descending, fallback to receivedAt
        const aTime = a.trashedAt && !isNaN(a.trashedAt.getTime()) 
          ? a.trashedAt.getTime() 
          : (a.receivedAt ? a.receivedAt.getTime() : 0);
        const bTime = b.trashedAt && !isNaN(b.trashedAt.getTime())
          ? b.trashedAt.getTime()
          : (b.receivedAt ? b.receivedAt.getTime() : 0);
        return bTime - aTime;
      });

    return NextResponse.json({
      success: true,
      emails,
      count: emails.length,
    });
  } catch (error: any) {
    console.error("[Get Trash] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get trashed emails" },
      { status: 500 }
    );
  }
}

