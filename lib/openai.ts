import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set");
}

if (!apiKey.startsWith("sk-")) {
  console.error("[OpenAI] WARNING: API key does not start with 'sk-'");
}

export const openai = new OpenAI({ apiKey });

