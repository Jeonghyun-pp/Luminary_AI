import { signInWithCredentials, signInWithGoogle } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

function SignInForm({ error }: { error?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Luminary</CardTitle>
          <CardDescription>
            AI 기반 이메일 관리 및 통합 일정 관리 시스템에 로그인하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === "CredentialsSignin" && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm font-semibold text-red-800">
                이메일 또는 비밀번호가 올바르지 않습니다.
              </p>
            </div>
          )}
          {error === "OAuthAccountNotLinked" && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-yellow-800">
                계정 연결 오류가 발생했습니다.
              </p>
              <div className="text-xs text-yellow-700 space-y-1">
                <p className="font-semibold">해결 방법:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Google 계정 설정에서 이 앱의 권한을 취소하세요:
                    <br />
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      https://myaccount.google.com/permissions
                    </a>
                  </li>
                  <li>브라우저 캐시 및 쿠키 삭제 (F12 → Application → Cookies → localhost:3000 삭제)</li>
                  <li>시크릿 모드에서 다시 시도</li>
                </ol>
              </div>
            </div>
          )}
          {error && error !== "OAuthAccountNotLinked" && error !== "CredentialsSignin" && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">
                로그인 중 오류가 발생했습니다: {error}
              </p>
              <div className="text-xs text-red-700 space-y-1">
                <p className="font-semibold">다음 사항을 확인해주세요:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Google Cloud Console에서 <strong>승인된 리디렉션 URI</strong>에 <code className="bg-red-100 px-1 rounded">http://localhost:3000/api/auth/callback/google</code>가 정확히 등록되어 있는지 확인</li>
                  <li>OAuth 동의 화면의 <strong>테스트 사용자</strong>에 로그인하려는 Google 이메일이 등록되어 있는지 확인</li>
                  <li>OAuth 동의 화면의 <strong>범위(Scopes)</strong>에 필요한 권한이 모두 등록되어 있는지 확인</li>
                  <li>브라우저 캐시 및 쿠키 삭제 후 다시 시도 (또는 시크릿 모드 사용)</li>
                  <li>개발 서버를 재시작했는지 확인</li>
                </ul>
              </div>
            </div>
          )}

          <form action={signInWithCredentials} className="space-y-3">
            <Input name="email" type="email" placeholder="이메일" required className="h-11" />
            <Input name="password" type="password" placeholder="비밀번호" required className="h-11" />
            <Button type="submit" className="w-full" size="lg">
              이메일로 로그인
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">또는</span>
            </div>
          </div>

          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" className="w-full" size="lg">
              Google로 로그인
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            계정이 없으신가요?{" "}
            <Link href="/auth/signup" className="font-medium text-primary underline underline-offset-4">
              회원가입
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <SignInForm error={params?.error} />;
}
