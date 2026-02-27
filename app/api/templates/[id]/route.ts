import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, subject, body: templateBody } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: "Name, subject, and body are required" },
        { status: 400 }
      );
    }

    const userId = user.id;
    const templateId = params.id;
    const { ref: userRef } = await resolveUserDocument(userId);
    const templatesCollection = getUserSubcollectionRefFromResolved(userRef, "TEMPLATES");

    const templateRef = templatesCollection.doc(templateId);
    const templateDoc = await templateRef.get();

    if (!templateDoc.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await templateRef.update({
      name: name.trim(),
      subject: subject.trim(),
      body: templateBody.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      template: {
        id: templateId,
        name: name.trim(),
        subject: subject.trim(),
        body: templateBody.trim(),
      },
    });
  } catch (error: any) {
    console.error("[Templates] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const templateId = params.id;
    const { ref: userRef } = await resolveUserDocument(userId);
    const templatesCollection = getUserSubcollectionRefFromResolved(userRef, "TEMPLATES");

    const templateRef = templatesCollection.doc(templateId);
    const templateDoc = await templateRef.get();

    if (!templateDoc.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await templateRef.delete();

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("[Templates] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete template" },
      { status: 500 }
    );
  }
}

