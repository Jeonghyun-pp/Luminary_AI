"use client";

import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { handleSignOut } from "./actions";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, User, Link2, Crown, Sparkles, Camera, Plus, Circle, Pencil, Check, X } from "lucide-react";
// CheckCircle2 is used in subscription plans, Link2/Camera in account list
import { toast } from "@/lib/toast";

type LinkedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  email?: string | null;
  scope?: string | null;
  nickname?: string | null;
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [userInfo, setUserInfo] = useState<{ email?: string; name?: string } | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [settingActive, setSettingActive] = useState(false);
  const [editingNicknameId, setEditingNicknameId] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");

  useEffect(() => {
    fetchUserInfo();
    fetchAccounts();
  }, []);

  useEffect(() => {
    const linkError = searchParams.get("link_error");
    if (linkError) {
      if (linkError === "session_expired") toast.error("연동 세션이 만료되었습니다. 다시 시도해주세요.");
      else if (linkError === "no_tokens") toast.error("Google 토큰을 받지 못했습니다. 다시 시도해주세요.");
      else toast.error("연동 중 오류가 발생했습니다.");
    }
  }, [searchParams]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        setLinkedAccounts(data.accounts ?? []);
        setActiveAccountIdState(data.activeAccountId ?? null);
      }
    } catch (e) {
      console.error("Failed to fetch accounts:", e);
    }
  };

  const saveNickname = async (accountId: string, nickname: string) => {
    try {
      const res = await fetch("/api/accounts/nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, nickname: nickname || null }),
      });
      if (res.ok) {
        setLinkedAccounts((prev) =>
          prev.map((acc) =>
            acc.id === accountId ? { ...acc, nickname: nickname || null } : acc
          )
        );
        toast.success("별명이 저장되었습니다.");
      } else {
        toast.error("별명 저장에 실패했습니다.");
      }
    } catch {
      toast.error("별명 저장에 실패했습니다.");
    }
    setEditingNicknameId(null);
  };

  const setActiveAccount = async (accountId: string | null) => {
    setSettingActive(true);
    try {
      const res = await fetch("/api/accounts/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (res.ok) {
        setActiveAccountIdState(accountId);
        toast.success(accountId ? "계정이 변경되었습니다." : "계정이 해제되었습니다.");
      } else {
        toast.error("활성 계정 변경에 실패했습니다.");
      }
    } catch (e) {
      toast.error("활성 계정 변경에 실패했습니다.");
    } finally {
      setSettingActive(false);
    }
  };

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
            {/* Account Settings */}
            <Card>
              <CardHeader>
                <CardTitle>계정</CardTitle>
                <CardDescription>Google 계정을 추가하고 전환하세요. 선택된 계정의 Inbox, Chatting, Task가 표시됩니다.</CardDescription>
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

                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700">연결된 계정</div>
                  {linkedAccounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">연결된 계정이 없습니다. Google 계정을 추가하면 Gmail과 캘린더를 사용할 수 있습니다.</p>
                  ) : (
                    <ul className="space-y-2">
                      {linkedAccounts.map((acc) => {
                        const isActive = activeAccountId === acc.id;
                        const isEditing = editingNicknameId === acc.id;
                        const displayName = acc.nickname || acc.email || acc.providerAccountId;
                        return (
                          <li
                            key={acc.id}
                            className={`flex items-center gap-3 p-4 border rounded-lg transition-colors ${
                              isActive
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            } ${settingActive ? "opacity-50 pointer-events-none" : ""}`}
                          >
                            <div
                              className="flex-shrink-0 cursor-pointer"
                              onClick={() => setActiveAccount(isActive ? null : acc.id)}
                            >
                              {isActive ? (
                                <div className="h-5 w-5 rounded-full border-2 border-blue-500 bg-blue-500 flex items-center justify-center">
                                  <div className="h-2 w-2 rounded-full bg-white" />
                                </div>
                              ) : (
                                <Circle className="h-5 w-5 text-gray-300" />
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              {acc.provider === "google" ? (
                                <GoogleIcon className="h-5 w-5" />
                              ) : acc.provider === "instagram" ? (
                                <Camera className="h-5 w-5 text-pink-500" />
                              ) : (
                                <Link2 className="h-5 w-5 text-gray-500" />
                              )}
                            </div>
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => setActiveAccount(isActive ? null : acc.id)}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={nicknameInput}
                                    onChange={(e) => setNicknameInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveNickname(acc.id, nicknameInput);
                                      if (e.key === "Escape") setEditingNicknameId(null);
                                    }}
                                    autoFocus
                                    placeholder={acc.email || acc.providerAccountId}
                                  />
                                  <button
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    onClick={() => saveNickname(acc.id, nicknameInput)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                    onClick={() => setEditingNicknameId(null)}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                                    {displayName}
                                    <button
                                      className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingNicknameId(acc.id);
                                        setNicknameInput(acc.nickname || "");
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="text-xs text-gray-500">{acc.email || acc.providerAccountId}</div>
                                </>
                              )}
                            </div>
                            {isActive && !isEditing && (
                              <span className="flex-shrink-0 text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                사용 중
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" asChild>
                      <a href="/api/auth/link/google" className="flex items-center gap-1.5">
                        <Plus className="h-4 w-4" />
                        Google 계정 추가
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" disabled title="준비 중">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Instagram (준비 중)
                    </Button>
                  </div>
                </div>

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
                        이메일 가져오기: 최대 50개
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
                        AI 기반 자동 회신
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        우선 지원
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        개인화 Agent
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        이메일 가져오기: 최대 200개
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
