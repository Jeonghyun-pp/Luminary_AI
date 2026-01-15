"use client";

import { Email, PriorityLabel, AnalysisDisplayField } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale/ko";
import { cn } from "@/lib/utils";
import { Package, Tag, Calendar, Clock, DollarSign, X, Bookmark, Trash2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

interface EmailListProps {
  emails: Email[];
  selectedEmailId?: string;
  onSelectEmail: (email: Email) => void;
  displayFields: AnalysisDisplayField[];
  onToggleBookmark?: (emailId: string, isStarred: boolean, removeFromTrash?: boolean) => void;
  onDelete?: (emailId: string) => void;
  onRestore?: (emailId: string) => void;
  onEmptyTrash?: () => void;
  showEmptyTrash?: boolean;
}

const priorityIcons: Record<PriorityLabel, string> = {
  HIGH: "🔥",
  MEDIUM: "⭐",
  LOW: "💤",
};


const fieldIcons: Record<AnalysisDisplayField, typeof Package> = {
  product: Package,
  type: Tag,
  requirements: Calendar,
  schedule: Clock,
  reward: DollarSign,
};

const fieldLabels: Record<AnalysisDisplayField, string> = {
  product: "제품",
  type: "유형",
  requirements: "요구조건",
  schedule: "일정",
  reward: "보상",
};

/**
 * Format reward: Convert numbers to 만원 단위 while preserving other text
 * Remove incorrect "원" usage and format currency amounts
 * Examples:
 * - "250,000원 및 제품 제공" → "250만원 및 제품 제공"
 * - "100만원 + 샘플" → "100만원 + 샘플"
 * - "조회수 1원회당 1원" → "조회수 1회당 1원"
 * - "판매 금액의 15원%" → "판매 금액의 15%"
 * - "30원일 기준" → "30일 기준"
 * - "기본 제작비 150만원" → "기본 제작비 150만원"
 */
function formatReward(reward: string | null | undefined): string {
  if (!reward || reward === "정보 없음") {
    return "정보 없음";
  }

  // First, remove incorrect "원" usage in non-currency contexts
  // Patterns like: "1원회당", "15원%", "30원일", "1원개" etc.
  let result = reward.replace(/(\d+)원(회|%|일|개|번|회당|회\/|회당|회\/|회\/당)/g, (match, number, suffix) => {
    return `${number}${suffix}`; // Remove "원" but keep the number and following text
  });

  // Also handle cases like "1원회당" (without space)
  result = result.replace(/(\d+)원(회당|회\/당)/g, (match, number) => {
    return `${number}회당`;
  });

  // Handle currency amounts: numbers followed by "원" (actual currency)
  // Match patterns like: "250,000원", "100000원", "50,000원", "100만원"
  result = result.replace(/([\d,]+)(만원|원)/g, (match, numberStr, suffix) => {
    // Remove commas and convert to number
    const cleanNumber = numberStr.replace(/,/g, "");
    const amount = parseInt(cleanNumber, 10);

    if (isNaN(amount)) {
      return match; // Return original if not a valid number
    }

    // If already has 만원 suffix, return as is
    if (suffix === "만원") {
      return match;
    }

    // Convert to 만원 단위
    const manwon = amount / 10000;

    if (manwon >= 1) {
      // Remove decimal if it's a whole number
      if (manwon % 1 === 0) {
        return `${manwon}만원`;
      } else {
        // Round to 1 decimal place
        return `${Math.round(manwon * 10) / 10}만원`;
      }
    } else {
      // Less than 10,000원, keep with 원
      return `${amount.toLocaleString()}원`;
    }
  });

  return result;
}

export function EmailList({ emails, selectedEmailId, onSelectEmail, displayFields, onToggleBookmark, onDelete, onRestore, onEmptyTrash, showEmptyTrash }: EmailListProps) {
  const [openDialog, setOpenDialog] = useState<{ field: AnalysisDisplayField; value: string; label: string } | null>(null);

  const handleFieldClick = (e: React.MouseEvent, field: AnalysisDisplayField, value: string) => {
    e.stopPropagation(); // Prevent email selection
    if (selectedEmailId) {
      setOpenDialog({ field, value, label: fieldLabels[field] });
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent, emailId: string, currentIsStarred: boolean, isTrashed: boolean) => {
    e.stopPropagation(); // Prevent email selection
    if (onToggleBookmark) {
      const newIsStarred = !currentIsStarred;
      // If unbookmarking a trashed email, also remove from trash
      const removeFromTrash = isTrashed && !newIsStarred;
      onToggleBookmark(emailId, newIsStarred, removeFromTrash);
    }
  };

  const handleTrashClick = (e: React.MouseEvent, emailId: string) => {
    e.stopPropagation(); // Prevent email selection
    if (onDelete) {
      onDelete(emailId);
    }
  };

  const handleRestoreClick = (e: React.MouseEvent, emailId: string) => {
    e.stopPropagation(); // Prevent email selection
    if (onRestore) {
      onRestore(emailId);
    }
  };

  return (
    <div className="flex h-full flex-col border-r bg-white w-full">
      <div className="border-b p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">이메일</h2>
            <p className="text-sm text-gray-500">{emails.length}개</p>
          </div>
          {showEmptyTrash && onEmptyTrash && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("정말로 휴지통의 모든 이메일을 영구 삭제하시겠습니까?")) {
                  onEmptyTrash();
                }
              }}
              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded transition-colors"
            >
              휴지통 비우기
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-scroll min-w-0">
        {emails.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            이메일이 없습니다
          </div>
        ) : (
          <div className="divide-y">
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => onSelectEmail(email)}
                className={cn(
                  "w-full p-4 text-left transition-colors hover:bg-gray-50 border-b min-w-0",
                  selectedEmailId === email.id && "bg-blue-50 border-blue-200"
                )}
              >
                <div className="flex flex-col gap-2 relative min-w-0">
                  {/* 제목 (가장 위) */}
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1 min-w-0 break-words pr-16">
                      {email.subject}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {email.priorityLabel && (
                        <span className="text-base">
                          {priorityIcons[email.priorityLabel as PriorityLabel]}
                        </span>
                      )}
                      {!email.isRead && (
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                      )}
                      {/* 북마크, 복구하기, 휴지통 버튼 (우측 상단) */}
                      <div className="flex items-center gap-1.5 ml-1">
                        {email.isTrashed ? (
                          // 휴지통에 있는 이메일: 복구하기 버튼
                          onRestore && (
                            <button
                              onClick={(e) => handleRestoreClick(e, email.id)}
                              className="p-1.5 rounded transition-colors hover:bg-gray-100 text-blue-600 hover:text-blue-700"
                              title="복구하기"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )
                        ) : (
                          // 일반 이메일: 북마크 및 휴지통 버튼
                          <>
                            {onToggleBookmark && (
                              <button
                                onClick={(e) => handleBookmarkClick(e, email.id, email.isStarred || false, email.isTrashed || false)}
                                className={cn(
                                  "p-1.5 rounded transition-colors hover:bg-gray-100",
                                  email.isStarred && "text-yellow-600"
                                )}
                                title={email.isStarred ? "북마크 해제" : "북마크"}
                              >
                                <Bookmark className={cn("h-4 w-4", email.isStarred && "fill-current")} />
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={(e) => handleTrashClick(e, email.id)}
                                className="p-1.5 rounded transition-colors hover:bg-gray-100 text-gray-400 hover:text-red-600"
                                title="휴지통으로 보내기"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 선택된 항목들 표시 (가운데) */}
                  {(email.emailAnalysis || email.sponsorshipInfo) ? (
                    <div className={`grid gap-2 mt-2 ${displayFields.length === 1 ? "grid-cols-1" : displayFields.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {displayFields.map((field) => {
                        const Icon = fieldIcons[field];
                        let value = "정보 없음";
                        let rawValue = "정보 없음";
                        
                        // reward는 sponsorshipInfo에서 가져오고 만원 단위로 포맷팅
                        if (field === "reward") {
                          rawValue = email.sponsorshipInfo?.reward || "정보 없음";
                          value = formatReward(rawValue);
                        } else {
                          rawValue = email.emailAnalysis?.[field] || "정보 없음";
                          value = rawValue;
                        }
                        
                        const isSelected = selectedEmailId === email.id;
                        const isClickable = isSelected && value !== "정보 없음";
                        
                        return (
                          <div
                            key={field}
                            className={cn(
                              "flex items-start gap-2 p-2.5 bg-gray-50 rounded-md",
                              isClickable && "cursor-pointer hover:bg-gray-100 transition-colors"
                            )}
                            onClick={isClickable ? (e) => handleFieldClick(e, field, rawValue) : undefined}
                            title={isClickable ? "클릭하여 전체 내용 보기" : undefined}
                          >
                            <Icon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div className="text-xs text-gray-500 mb-1 font-medium">{fieldLabels[field]}</div>
                              <div className={cn(
                                "text-sm font-medium text-gray-900 leading-relaxed break-words",
                                isClickable ? "line-clamp-2" : "line-clamp-2"
                              )}>
                                {value}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // 분석 결과가 없을 때는 요약이나 본문 스니펫 표시
                    (email.summary || email.bodySnippet) && (
                      <div className="text-xs text-gray-500 line-clamp-2 mt-1 break-words min-w-0">
                        {email.summary || email.bodySnippet}
                      </div>
                    )
                  )}

                  {/* 보내는 사람, 날짜 (가장 아래) */}
                  <div className="flex items-center justify-between mt-1 min-w-0">
                    <span className="text-xs text-gray-500 truncate min-w-0 flex-1">
                      {email.from.split("<")[0].trim() || email.from}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {format(new Date(email.receivedAt), "MM월 dd일", {
                        locale: ko,
                      })}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Detail Dialog */}
      <Dialog open={!!openDialog} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openDialog && (
                <>
                  {(() => {
                    const Icon = fieldIcons[openDialog.field];
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {openDialog.label}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {openDialog && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                {openDialog.field === "reward" && openDialog.value !== "정보 없음"
                  ? formatReward(openDialog.value)
                  : openDialog.value}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

