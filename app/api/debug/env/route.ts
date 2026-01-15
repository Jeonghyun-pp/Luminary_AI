import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  
  return NextResponse.json({
    keyExists: !!key,
    keyLength: key?.length || 0,
    keyPrefix: key?.substring(0, 20) || "N/A",
    keySuffix: key?.substring(Math.max(0, (key?.length || 0) - 20)) || "N/A",
    // JSON.stringify로 실제 문자 확인 (특수문자 포함)
    keyStringified: JSON.stringify(key),
    // 각 문자를 확인
    keyChars: key?.split("").slice(0, 20).map((c, i) => ({
      index: i,
      char: c,
      code: c.charCodeAt(0),
      hex: c.charCodeAt(0).toString(16),
    })) || [],
    // 하이픈 위치 확인
    hyphenPositions: key?.split("").map((c, i) => c === "-" ? i : -1).filter(i => i !== -1) || [],
  });
}

