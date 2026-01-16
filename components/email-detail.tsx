"use client";

import { Email, PriorityLabel } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale/ko";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Mail, MailOpen, Send, Trash2, FileText, Package, Tag, Calendar, Clock, DollarSign, Info, Sparkles, Bookmark, ShoppingBag, Handshake, ClipboardList, Brain, MessageSquare } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import DOMPurify from "isomorphic-dompurify";

interface EmailDetailProps {
  email: Email;
  onToggleRead?: (emailId: string, isRead: boolean) => void;
  onDelete?: (emailId: string) => void;
  onToggleBookmark?: (emailId: string, isStarred: boolean, removeFromTrash?: boolean) => void;
  onOpenReply?: () => void;
}

const priorityIcons: Record<PriorityLabel, string> = {
  HIGH: "🔥",
  MEDIUM: "⭐",
  LOW: "💤",
};

/**
 * Format reward: Convert numbers to 만원 단위 while preserving other text
 */
function formatReward(reward: string | null | undefined): string {
  if (!reward || reward === "정보 없음") {
    return "정보 없음";
  }

  let result = reward.replace(/(\d+)원(회|%|일|개|번|회당|회\/|회당|회\/|회\/당)/g, (match, number, suffix) => {
    return `${number}${suffix}`;
  });

  result = result.replace(/(\d+)원(회당|회\/당)/g, (match, number) => {
    return `${number}회당`;
  });

  result = result.replace(/([\d,]+)(만원|원)/g, (match, numberStr, suffix) => {
    const cleanNumber = numberStr.replace(/,/g, "");
    const amount = parseInt(cleanNumber, 10);

    if (isNaN(amount)) {
      return match;
    }

    if (suffix === "만원") {
      return match;
    }

    const manwon = amount / 10000;

    if (manwon >= 1) {
      if (manwon % 1 === 0) {
        return `${manwon}만원`;
      } else {
        return `${Math.round(manwon * 10) / 10}만원`;
      }
    } else {
      return `${amount.toLocaleString()}원`;
    }
  });

  return result;
}

export function EmailDetail({
  email,
  onToggleRead,
  onDelete,
  onToggleBookmark,
  onOpenReply,
}: EmailDetailProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const emailBody = email.bodyFullText || email.bodySnippet || "본문 없음";
  const isHtmlBody = useMemo(() => /<\/?[a-z][\s\S]*>/i.test(emailBody), [emailBody]);
  const sanitizedHtml = useMemo(() => (isHtmlBody ? DOMPurify.sanitize(emailBody) : ""), [isHtmlBody, emailBody]);
  
  // Check if email is in replied folder
  const hasReplied = (email as any).hasReplied === true;


  const handleTrash = async () => {
    // Optimistic update: Update local state immediately (like bookmark)
    const emailIdToTrash = email.id;
    if (onDelete) {
      onDelete(emailIdToTrash);
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/emails/${emailIdToTrash}/delete`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("이메일이 휴지통으로 이동되었습니다.");
      } else {
        const error = await res.json();
        toast.error(error.error || "휴지통 이동 실패");
        // Revert optimistic update on error
        // Note: We would need an onRestore callback to revert, but for now just show error
      }
    } catch (error) {
      console.error("Failed to trash email:", error);
      toast.error("휴지통 이동 실패");
      // Revert optimistic update on error
      // Note: We would need an onRestore callback to revert, but for now just show error
    } finally {
      setDeleting(false);
    }
  };


  const handleToggleBookmark = async () => {
    // Optimistic update: Update local state immediately (like trash)
    const currentIsStarred = email.isStarred || false;
    const newIsStarred = !currentIsStarred;
    
    // Update local state immediately
    if (onToggleBookmark) {
      onToggleBookmark(email.id, newIsStarred);
    }

    setBookmarking(true);
    try {
      const res = await fetch(`/api/emails/${email.id}/favorite`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.isStarred ? "북마크에 추가되었습니다." : "북마크에서 제거되었습니다.");
      } else {
        const error = await res.json();
        toast.error(error.error || "북마크 실패");
        // Revert optimistic update on error
        if (onToggleBookmark) {
          onToggleBookmark(email.id, currentIsStarred);
        }
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
      toast.error("북마크 실패");
      // Revert optimistic update on error
      if (onToggleBookmark) {
        onToggleBookmark(email.id, currentIsStarred);
      }
    } finally {
      setBookmarking(false);
    }
  };

  const handleAnalyzeEmail = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/emails/${email.id}/summarize`, {
        method: "POST",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("[EmailDetail] Analysis failed:", errorData);
        toast.error(errorData.error || "이메일 분석 실패");
        return;
      }
      
      const data = await res.json();
      if (data.success) {
        toast.success("이메일 분석이 완료되었습니다.");
        // Reload page to show updated summary
        window.location.reload();
      }
    } catch (error) {
      console.error("[EmailDetail] Failed to analyze email:", error);
      toast.error("이메일 분석 실패");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f7f7f5]">
      {/* 상단: 현상 유지 */}
      <div className="border-b bg-white p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-semibold">{email.subject}</h1>
            {email.priorityLabel && (
              <span className="text-2xl">
                {priorityIcons[email.priorityLabel as PriorityLabel]}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600">
            <div>From: {email.from}</div>
            <div>To: {email.to}</div>
            {email.cc && <div>CC: {email.cc}</div>}
            <div className="mt-2">
              {format(new Date(email.receivedAt), "yyyy년 MM월 dd일 HH:mm", {
                locale: ko,
              })}
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2">
          {hasReplied ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                router.push(`/chatting?emailId=${email.id}`);
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              채팅으로 이동
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenReply?.()}
            >
              <Send className="h-4 w-4 mr-2" />
              원클릭 회신
            </Button>
          )}
          {onToggleRead && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const newIsRead = !email.isRead;
                try {
                  const res = await fetch(`/api/emails/${email.id}/read`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ isRead: newIsRead }),
                  });
                  if (res.ok) {
                    onToggleRead(email.id, newIsRead);
                    toast.success(newIsRead ? "읽음으로 표시되었습니다." : "읽지 않음으로 표시되었습니다.");
                  } else {
                    toast.error("상태 변경 실패");
                  }
                } catch (error) {
                  console.error("Failed to toggle read status:", error);
                  toast.error("상태 변경 실패");
                }
              }}
            >
              {email.isRead ? (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  읽지 않음으로 표시
                </>
              ) : (
                <>
                  <MailOpen className="h-4 w-4 mr-2" />
                  읽음으로 표시
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 본문: AI 요약 블록 + 원본 메일 내용 */}
      <div className="flex-1 p-6 space-y-4">
        {/* AI 요약 블록 (항목화) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              AI 요약
            </CardTitle>
          </CardHeader>
          <CardContent>
            {email.emailAnalysis?.summary ? (
              <div className="text-base text-gray-900 leading-relaxed space-y-2">
                {email.emailAnalysis.summary.split('\n').map((line, index) => {
                  const trimmedLine = line.trim();
                  if (!trimmedLine || !trimmedLine.startsWith('•')) return null;
                  
                  // Extract field name and value
                  const match = trimmedLine.match(/^•\s*([^:]+):\s*(.+)$/);
                  if (!match) return <div key={index}>{trimmedLine}</div>;
                  
                  const [, fieldName, value] = match;
                  const fieldNameTrimmed = fieldName.trim();
                  
                  // Determine icon based on field name
                  let IconComponent = Package; // default
                  if (fieldNameTrimmed.includes('제품')) {
                    IconComponent = ShoppingBag;
                  } else if (fieldNameTrimmed.includes('협찬') || fieldNameTrimmed.includes('유형')) {
                    IconComponent = Handshake;
                  } else if (fieldNameTrimmed.includes('요구사항') || fieldNameTrimmed.includes('요구조건')) {
                    IconComponent = ClipboardList;
                  } else if (fieldNameTrimmed.includes('마감일') || fieldNameTrimmed.includes('일정')) {
                    IconComponent = Calendar;
                  } else if (fieldNameTrimmed.includes('보상')) {
                    IconComponent = DollarSign;
                  }
                  
                  return (
                    <div key={index} className="flex items-start gap-2">
                      <IconComponent className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <span className="font-medium">{fieldNameTrimmed}:</span> {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-4">
                  AI 요약이 없습니다. 분석을 시작하시겠습니까?
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAnalyzeEmail}
                  disabled={analyzing}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {analyzing ? "분석 중..." : "분석하기"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 원본 메일 내용 */}
        <Card className="flex flex-col max-h-[60vh]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              원본 메일
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {isHtmlBody ? (
              <div className="prose max-w-none text-sm break-words email-html-content">
                <div
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              </div>
            ) : (
              <div className="prose max-w-none text-sm whitespace-pre-wrap break-words">
                {emailBody}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
