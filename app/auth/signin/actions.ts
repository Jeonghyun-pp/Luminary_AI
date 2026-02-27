"use server";

import { signIn } from "@/auth";

export async function signInWithCredentials(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  await signIn("credentials", { email, password, redirectTo: "/inbox" });
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/inbox" });
}
