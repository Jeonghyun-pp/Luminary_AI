import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    // Auth failed, redirect to signin
  }

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return <>{children}</>;
}

