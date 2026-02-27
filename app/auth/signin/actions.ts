"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export async function signInWithCredentials(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  try {
    await signIn("credentials", { email, password, redirectTo: "/inbox" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/auth/signin?error=${error.type}`);
    }
    throw error; // Re-throw NEXT_REDIRECT (successful sign-in redirect)
  }
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/inbox" });
}
