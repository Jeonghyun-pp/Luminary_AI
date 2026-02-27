import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function Home() {
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    // Auth failed (e.g., database connection issue), fall through to signin redirect
  }

  if (session?.user) {
    redirect("/inbox");
  } else {
    redirect("/auth/signin");
  }
}

