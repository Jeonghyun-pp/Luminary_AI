import { signUpWithCredentials } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Luminary 회원가입</CardTitle>
          <CardDescription>
            이메일과 비밀번호로 계정을 만들고, 나중에 Google 등을 연동할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm font-semibold text-red-800">{decodeURIComponent(error)}</p>
            </div>
          )}
          <form action={signUpWithCredentials} className="space-y-3">
            <Input name="email" type="email" placeholder="이메일" required className="h-11" />
            <Input name="name" type="text" placeholder="이름 (선택)" className="h-11" />
            <Input name="password" type="password" placeholder="비밀번호 (8자 이상)" required minLength={8} className="h-11" />
            <Button type="submit" className="w-full" size="lg">
              회원가입
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/auth/signin" className="font-medium text-primary underline underline-offset-4">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
