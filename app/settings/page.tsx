"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { handleSignOut } from "./actions";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, User, Link2, Crown, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";

type ConnectionStatus = {
  gmail: "connected" | "disconnected" | "error";
  calendar: "connected" | "disconnected" | "error";
};

export default function SettingsPage() {
  const [status, setStatus] = useState<ConnectionStatus>({
    gmail: "disconnected",
    calendar: "disconnected",
  });
  const [loading, setLoading] = useState(false);
  const [refreshingGoogle, setRefreshingGoogle] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email?: string; name?: string } | null>(null);

  useEffect(() => {
    checkConnections();
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const res = await fetch("/api/auth/test");
      if (res.ok) {
        const data = await res.json();
        if (data.session?.user) {
          setUserInfo({
            email: data.session.user.email,
            name: data.session.user.name || undefined,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch user info:", error);
    }
  };

  const checkConnections = async () => {
    setLoading(true);
    try {
      // Check Gmail connection
      try {
        const gmailRes = await fetch("/api/emails?limit=1");
        if (gmailRes.ok) {
          setStatus((prev) => ({ ...prev, gmail: "connected" }));
        } else {
          setStatus((prev) => ({ ...prev, gmail: "error" }));
        }
      } catch {
        setStatus((prev) => ({ ...prev, gmail: "disconnected" }));
      }

      // Check Calendar connection
      try {
        const calendarRes = await fetch("/api/calendar/events?maxResults=1");
        if (calendarRes.ok) {
          setStatus((prev) => ({ ...prev, calendar: "connected" }));
        } else {
          setStatus((prev) => ({ ...prev, calendar: "error" }));
        }
      } catch {
        setStatus((prev) => ({ ...prev, calendar: "disconnected" }));
      }
    } catch (error) {
      console.error("Failed to check connections:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
      case "configured":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "연결됨";
      case "configured":
        return "설정됨";
      case "error":
        return "오류";
      default:
        return "연결 안 됨";
    }
  };

  const handleRefreshGoogleAccount = async () => {
    if (!confirm("Google 계정을 재연결하시겠습니까? 로그아웃 후 다시 로그인해야 합니다.")) {
      return;
    }

    setRefreshingGoogle(true);
    try {
      const res = await fetch("/api/auth/refresh-google-account", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Google 계정이 삭제되었습니다. 로그아웃 후 다시 로그인해주세요.");
        // Redirect to sign out after a short delay
        setTimeout(() => {
          handleSignOut();
        }, 2000);
      } else {
        toast.error(data.error || "Google 계정 재연결 실패");
      }
    } catch (error) {
      console.error("Failed to refresh Google account:", error);
      toast.error("Google 계정 재연결 실패");
    } finally {
      setRefreshingGoogle(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-[#f7f7f5] p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">설정</h1>
            <p className="mt-2 text-gray-600">계정 및 연동 설정을 관리하세요</p>
          </div>

          <div className="space-y-6">
            {/* Connection Status */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>연동 상태</CardTitle>
                    <CardDescription>
                      서비스 연동 상태를 확인하고 관리하세요
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkConnections}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    새로고침
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Gmail */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status.gmail)}
                    <div>
                      <div className="font-medium">Gmail</div>
                      <div className="text-sm text-gray-500">
                        이메일 동기화
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">
                      {getStatusText(status.gmail)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshGoogleAccount}
                      disabled={refreshingGoogle}
                      title="새로운 권한을 적용하기 위해 Google 계정을 재연결합니다"
                    >
                      <Link2 className={`h-4 w-4 mr-1 ${refreshingGoogle ? "animate-spin" : ""}`} />
                      재연결
                    </Button>
                  </div>
                </div>

                {/* Google Calendar */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status.calendar)}
                    <div>
                      <div className="font-medium">Google Calendar</div>
                      <div className="text-sm text-gray-500">
                        일정 관리
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {getStatusText(status.calendar)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Settings */}
            <Card>
              <CardHeader>
                <CardTitle>계정</CardTitle>
                <CardDescription>계정 설정을 관리하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {userInfo && (
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-gray-50">
                    <User className="h-5 w-5 text-gray-500" />
                    <div className="flex-1">
                      {userInfo.name && (
                        <div className="font-medium text-gray-900">{userInfo.name}</div>
                      )}
                      <div className="text-sm text-gray-600">{userInfo.email}</div>
                    </div>
                  </div>
                )}
                <form action={handleSignOut}>
                  <Button type="submit" variant="outline">
                    로그아웃
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Subscription Services */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  <CardTitle>구독 서비스</CardTitle>
                </div>
                <CardDescription>
                  다양한 AI 서비스를 구독하고 더 많은 기능을 이용하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Free Plan */}
                  <div className="border rounded-lg p-6 bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Free</h3>
                      <div className="text-2xl font-bold">무료</div>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-600 mb-6">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        기본 이메일 관리
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        일정 관리
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        기본 템플릿
                      </li>
                    </ul>
                    <Button variant="outline" className="w-full" disabled>
                      현재 플랜
                    </Button>
                  </div>

                  {/* Pro Plan */}
                  <div className="border-2 border-yellow-400 rounded-lg p-6 bg-gradient-to-br from-yellow-50 to-white hover:shadow-lg transition-shadow relative">
                    <div className="absolute top-4 right-4">
                      <Sparkles className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Pro</h3>
                      <div>
                        <div className="text-2xl font-bold">월 9,900원</div>
                        <div className="text-xs text-gray-500">Liner 기준</div>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-600 mb-6">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        모든 Free 기능
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        고급 AI 분석
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        무제한 템플릿
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        우선 지원
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        고급 자동화 규칙
                      </li>
                    </ul>
                    <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white">
                      업그레이드
                    </Button>
                  </div>

                  {/* Enterprise Plan */}
                  <div className="border rounded-lg p-6 bg-gradient-to-br from-purple-50 to-white hover:shadow-md transition-shadow md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Crown className="h-5 w-5 text-purple-500" />
                          Enterprise
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">팀 및 기업용</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">문의</div>
                        <div className="text-xs text-gray-500">맞춤 가격</div>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-600 mb-6 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        모든 Pro 기능
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        팀 협업 도구
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        전담 지원
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        맞춤형 통합
                      </li>
                    </ul>
                    <Button variant="outline" className="w-full">
                      문의하기
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle>정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>Luminary v0.1.0</div>
                  <div>AI 기반 이메일 관리 및 통합 일정 관리 시스템</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
