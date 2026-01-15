import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const session = await auth();
    
    console.log("Home page - Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      email: session?.user?.email,
    });
    
    if (session?.user) {
      redirect("/inbox");
    } else {
      redirect("/auth/signin");
    }
  } catch (error) {
    console.error("Auth error:", error);
    // If auth fails (e.g., database connection issue), redirect to signin
    redirect("/auth/signin");
  }
}

