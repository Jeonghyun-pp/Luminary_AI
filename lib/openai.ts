import OpenAI from "openai";
import { readFileSync } from "fs";
import { join } from "path";

// .env.local 파일에서 직접 읽기 (시스템 환경 변수보다 우선)
function getEnvLocalValue(key: string): string | undefined {
  try {
    const envLocalPath = join(process.cwd(), ".env.local");
    const envLocalContent = readFileSync(envLocalPath, "utf-8");
    const match = envLocalContent.match(new RegExp(`^${key}=(.+)$`, "m"));
    if (match && match[1]) {
      // 따옴표 제거
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    // .env.local 파일이 없으면 무시
  }
  return undefined;
}

// .env.local에서 우선적으로 읽고, 없으면 환경 변수 사용
const envLocalKey = getEnvLocalValue("OPENAI_API_KEY");
const apiKey = envLocalKey || process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set");
}

// Debug: 실제 키 값 확인
console.log("[OpenAI] API Key loaded:", {
  length: apiKey.length,
  prefix: apiKey.substring(0, 20),
  suffix: apiKey.substring(Math.max(0, apiKey.length - 10)),
  hasHyphen: apiKey.includes("-"),
  hyphenCount: (apiKey.match(/-/g) || []).length,
  // 첫 20자의 각 문자 확인
  first20Chars: apiKey.substring(0, 20).split("").map((c, i) => ({
    pos: i,
    char: c,
    code: c.charCodeAt(0),
  })),
  // JSON.stringify로 실제 문자 확인 (특수문자 포함)
  stringified: JSON.stringify(apiKey.substring(0, 30)),
});

// 키 검증: sk- 또는 sk-proj-로 시작해야 함
if (!apiKey.startsWith("sk-")) {
  console.error("[OpenAI] ⚠️ WARNING: API key does not start with 'sk-'");
  console.error("[OpenAI] Actual prefix:", JSON.stringify(apiKey.substring(0, 10)));
}

export const openai = new OpenAI({
  apiKey: apiKey,
});

