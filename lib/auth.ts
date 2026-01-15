import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@/lib/errors/handler";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) {
    throw new AuthenticationError("로그인이 필요합니다.");
  }
  return session.user;
}

/**
 * Verify that the resource belongs to the user
 */
export async function verifyUserOwnership(
  userId: string,
  resourceUserId: string
) {
  if (userId !== resourceUserId) {
    throw new AuthorizationError("이 리소스에 대한 권한이 없습니다.");
  }
}

