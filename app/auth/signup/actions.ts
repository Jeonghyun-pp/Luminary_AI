"use server";

import { createUserWithPassword } from "@/lib/auth-credentials";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";

export async function signUpWithCredentials(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const result = await createUserWithPassword(email, password, name || undefined);
  if ("error" in result) {
    redirect(`/auth/signup?error=${encodeURIComponent(result.error)}`);
  }
  await signIn("credentials", {
    email: result.email,
    password,
    redirectTo: "/inbox",
  });
}
