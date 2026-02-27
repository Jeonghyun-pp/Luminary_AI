import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { analyzeEfficiencyBatch } from "@/lib/agent/analyze-efficiency";
import { getUserEmailCollectionRef } from "@/lib/firebase";

// Firebase Admin SDK requires Node.js runtime
export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const prompt = body.prompt || "나는 뷰티 인플루언서야";

    const userId = user.id;
    const inboxCollection = await getUserEmailCollectionRef(userId);
    
    // Fetch all emails
    const snapshot = await inboxCollection.get();
    const emails = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    if (emails.length === 0) {
      return NextResponse.json({ 
        success: true, 
        scores: {},
        message: "No emails to analyze" 
      });
    }

    // Analyze efficiency
    const efficiencyMap = await analyzeEfficiencyBatch(emails, prompt);
    
    // Convert Map to object for JSON response
    const scores: Record<string, { efficiency: number; laborEstimate: number; rewardEstimate: number }> = {};
    efficiencyMap.forEach((score, emailId) => {
      scores[emailId] = {
        efficiency: score.efficiency,
        laborEstimate: score.laborEstimate,
        rewardEstimate: score.rewardEstimate,
      };
    });

    return NextResponse.json({
      success: true,
      scores,
      analyzed: emails.length,
    });
  } catch (error: any) {
    console.error("[AnalyzeEfficiency] Error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to analyze efficiency",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

