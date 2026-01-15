import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { ref: userRef } = await resolveUserDocument(userId);
    const templatesCollection = getUserSubcollectionRefFromResolved(userRef, "TEMPLATES");

    const snapshot = await templatesCollection.get();
    let templates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // If no templates exist, create a default template
    if (templates.length === 0) {
      const defaultTemplate = {
        name: "기본 협찬 수락 템플릿",
        subject: "협업 제안에 대한 답변",
        body: `안녕하세요,

협업 제안 감사드립니다. 제안해주신 내용을 검토한 결과, 협업 진행에 동의합니다.

다음 단계에 대해 안내 부탁드립니다:
- 제품/서비스 전달 일정
- 콘텐츠 제작 가이드라인
- 마감일자 및 제출 방법
- 보상 관련 상세 정보

추가로 필요한 정보가 있으시면 언제든지 연락 주시기 바랍니다.

감사합니다.`,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const templateRef = await templatesCollection.add(defaultTemplate);
      templates = [{
        id: templateRef.id,
        ...defaultTemplate,
      }];
    }

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error: any) {
    console.error("[Templates] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const { ref: userRef } = await resolveUserDocument(userId);
    const templatesCollection = getUserSubcollectionRefFromResolved(userRef, "TEMPLATES");

    const templateRef = await templatesCollection.add({
      name: name.trim(),
      subject: subject.trim(),
      body: templateBody.trim(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      template: {
        id: templateRef.id,
        name: name.trim(),
        subject: subject.trim(),
        body: templateBody.trim(),
      },
    });
  } catch (error: any) {
    console.error("[Templates] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create template" },
      { status: 500 }
    );
  }
}

