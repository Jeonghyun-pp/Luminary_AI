"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { EmailList } from "@/components/email-list";
import { EmailDetail } from "@/components/email-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Email } from "@/types";
import {
  Download,
  Search,
  X,
  Sparkles,
  Settings,
  ArrowUpDown,
  Filter,
  Brain,
  ChevronDown,
  Check,
  Send,
  Loader2,
  Mail,
  Trash2,
  Bookmark,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Select } from "@/components/ui/select";
import { AnalysisDisplayField } from "@/types";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [allEmails, setAllEmails] = useState<Email[]>([]); // Store all emails for filtering
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);
  const [logQueue, setLogQueue] = useState<Array<{ subject: string; reason: string; status: "skipped" | "accepted" }>>([]);
  const [currentLog, setCurrentLog] = useState<{ subject: string; reason: string; status: "skipped" | "accepted" } | null>(null);
  const logQueueRef = useRef<Array<{ subject: string; reason: string; status: "skipped" | "accepted" }>>([]);
  const lastLogTimeRef = useRef<number>(0);
  
  // Reply mode state
  const [replyMode, setReplyMode] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [sending, setSending] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  
  // Filter and sort state
  const [sortBy, setSortBy] = useState<"receivedAt" | "deadline" | "reward" | "priority" | "ai">("receivedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [deadlineFilter, setDeadlineFilter] = useState<("thisWeek" | "thisMonth" | "overdue")[]>([]);
  const [unreadFilter, setUnreadFilter] = useState<boolean>(false); // false = all, true = unread only
  const [bookmarkFilter, setBookmarkFilter] = useState<boolean>(false); // false = all, true = bookmark only
  const [trashFilter, setTrashFilter] = useState<boolean>(false); // false = all, true = trash only
  const [repliedFilter, setRepliedFilter] = useState<boolean>(false); // false = all, true = replied only
  
  // Dropdown open states
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [deadlineDropdownOpen, setDeadlineDropdownOpen] = useState(false);
  
  // AI sorting
  const [aiSortedOrder, setAiSortedOrder] = useState<string[]>([]);
  const [analyzingEfficiency, setAnalyzingEfficiency] = useState(false);
  const [hasRequestedAnalysis, setHasRequestedAnalysis] = useState(false);
  const [aiSortPrompt, setAiSortPrompt] = useState<string>("시간 투입 대비 보상이 높은 순으로 정렬");
  
  // Extract available categories and types from all emails (not filtered)
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    allEmails.forEach((email) => {
      const product = email.emailAnalysis?.product;
      if (product && product !== "정보 없음") {
        // Extract category from "제품 유형 - 제품명" format
        const category = product.split(" - ")[0].trim();
        if (category && category !== "정보 없음") {
          categories.add(category);
        }
      }
    });
    return Array.from(categories).sort();
  }, [allEmails]);
  
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    allEmails.forEach((email) => {
      const type = email.emailAnalysis?.type;
      if (type && type !== "정보 없음") {
        types.add(type);
      }
    });
    return Array.from(types).sort();
  }, [allEmails]);
  
  // Apply filters to emails when filters change
  useEffect(() => {
    if (allEmails.length === 0) return;
    
    let filtered = [...allEmails];
    
    // Apply search query
    const effectiveQuery = appliedSearchQuery.trim();
    if (effectiveQuery) {
      const query = effectiveQuery.toLowerCase();
      filtered = filtered.filter(
        (email: Email) =>
          email.subject.toLowerCase().includes(query) ||
          email.from.toLowerCase().includes(query) ||
          email.bodySnippet?.toLowerCase().includes(query) ||
          email.bodyFullText?.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter (multiple selection)
    if (categoryFilter.length > 0) {
      filtered = filtered.filter((email: Email) => {
        const product = email.emailAnalysis?.product || "";
        const category = product.split(" - ")[0].trim();
        return categoryFilter.includes(category);
      });
    }
    
    // Apply type filter (multiple selection)
    if (typeFilter.length > 0) {
      filtered = filtered.filter((email: Email) => {
        const type = email.emailAnalysis?.type || "";
        return typeFilter.includes(type);
      });
    }
    
    // Apply deadline filter (multiple selection)
    if (deadlineFilter.length > 0) {
      const now = new Date();
      filtered = filtered.filter((email: Email) => {
        const schedule = email.emailAnalysis?.schedule || email.sponsorshipInfo?.deadline || null;
        if (!schedule || schedule === "정보 없음") return false;
        
        const deadlineDate = extractDeadlineDate(schedule);
        if (!deadlineDate) return false;
        
        const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        return deadlineFilter.some(filter => {
          if (filter === "thisWeek") {
            return daysDiff >= 0 && daysDiff <= 7;
          } else if (filter === "thisMonth") {
            return daysDiff >= 0 && daysDiff <= 30;
          } else if (filter === "overdue") {
            return daysDiff < 0;
          }
          return false;
        });
      });
    }
    
    // Apply filters: trash filter takes priority, then bookmark filter, then replied filter
    if (trashFilter) {
      // Show only trashed emails (regardless of bookmark/replied status)
      filtered = filtered.filter((email: Email) => {
        return email.isTrashed === true;
      });
    } else if (bookmarkFilter) {
      // Show only bookmarked emails (but not trashed ones)
      filtered = filtered.filter((email: Email) => {
        return email.isStarred === true && email.isTrashed !== true;
      });
    } else if (repliedFilter) {
      // Show only replied emails (but not trashed/bookmarked ones)
      filtered = filtered.filter((email: Email) => {
        return (email as any).hasReplied === true && email.isTrashed !== true && email.isStarred !== true;
      });
    } else {
      // Show all emails except trashed, bookmarked, and replied ones
      filtered = filtered.filter((email: Email) => {
        return email.isTrashed !== true && email.isStarred !== true && (email as any).hasReplied !== true;
      });
    }
    
    // Apply unread filter
    if (unreadFilter) {
      filtered = filtered.filter((email: Email) => {
        return !email.isRead;
      });
    }
    
    // Apply sorting
    filtered = sortEmails(filtered, sortBy, sortOrder);
    
    setEmails(filtered);
  }, [allEmails, appliedSearchQuery, categoryFilter, typeFilter, deadlineFilter, unreadFilter, bookmarkFilter, trashFilter, repliedFilter, sortBy, sortOrder, aiSortedOrder]);
  
  // Auto-select next email if current selection is no longer in the filtered list
  useEffect(() => {
    if (selectedEmail && !emails.find(e => e.id === selectedEmail.id)) {
      if (emails.length > 0) {
        setSelectedEmail(emails[0]);
      } else {
        setSelectedEmail(null);
      }
    }
  }, [emails, selectedEmail]);
  
  // Field labels and options (defined before state to use in useEffect)
  const fieldLabels: Record<AnalysisDisplayField, string> = {
    product: "제품",
    type: "유형",
    requirements: "요구조건",
    schedule: "일정",
    reward: "보상",
  };

  const allFields: AnalysisDisplayField[] = ["product", "type", "requirements", "schedule", "reward"];

  // Helper function to extract deadline date
  const extractDeadlineDate = (schedule: string | null): Date | null => {
    if (!schedule || schedule === "정보 없음") return null;
    
    const datePatterns = [
      /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,
      /(\d{1,2})월\s*(\d{1,2})일/,
      /(\d{1,2})\/(\d{1,2})/,
      /마감[:\s]*(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/,
    ];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    for (const pattern of datePatterns) {
      const match = schedule.match(pattern);
      if (match) {
        try {
          if (match.length === 4) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const day = parseInt(match[3]);
            return new Date(year, month, day);
          } else if (match.length === 3) {
            const month = parseInt(match[1]) - 1;
            const day = parseInt(match[2]);
            const date = new Date(currentYear, month, day);
            if (date < now) {
              return new Date(currentYear + 1, month, day);
            }
            return date;
          }
        } catch {
          continue;
        }
      }
    }
    return null;
  };

  // Helper function to extract reward amount
  const extractRewardAmount = (reward: string | null | undefined): number => {
    if (!reward || reward === "정보 없음") return 0;
    const match = reward.match(/([\d,]+)(만원|원)/);
    if (match) {
      const numberStr = match[1].replace(/,/g, "");
      const amount = parseInt(numberStr, 10);
      if (!isNaN(amount)) {
        if (match[2] === "만원") {
          return amount;
        } else {
          return amount / 10000;
        }
      }
    }
    return 0;
  };

  // Sort by AI order
  const sortByAiOrder = (emails: Email[], order: "asc" | "desc"): Email[] => {
    if (aiSortedOrder.length === 0) {
      return emails; // No AI sort order yet, return as-is
    }

    // Create a map of email ID to index in sorted order
    const orderMap = new Map<string, number>();
    aiSortedOrder.forEach((id, index) => {
      orderMap.set(id, index);
    });

    // Sort emails based on AI order
    return [...emails].sort((a, b) => {
      const indexA = orderMap.get(a.id) ?? Infinity;
      const indexB = orderMap.get(b.id) ?? Infinity;
      
      if (order === "desc") {
        // Descending: lower index (earlier in sorted list) comes first
        return indexA - indexB;
      } else {
        // Ascending: higher index (later in sorted list) comes first
        return indexB - indexA;
      }
    });
  };

  // Sort emails function
  const sortEmails = (emails: Email[], sortBy: string, order: "asc" | "desc"): Email[] => {
    // Use AI sort order
    if (sortBy === "ai") {
      return sortByAiOrder(emails, order);
    }
    
    return [...emails].sort((a, b) => {
      let valueA: any;
      let valueB: any;
      
      switch (sortBy) {
        case "deadline":
          const scheduleA = a.emailAnalysis?.schedule || a.sponsorshipInfo?.deadline || null;
          const scheduleB = b.emailAnalysis?.schedule || b.sponsorshipInfo?.deadline || null;
          valueA = extractDeadlineDate(scheduleA);
          valueB = extractDeadlineDate(scheduleB);
          if (!valueA && !valueB) return 0;
          if (!valueA) return 1;
          if (!valueB) return -1;
          valueA = valueA.getTime();
          valueB = valueB.getTime();
          break;
          
        case "reward":
          valueA = extractRewardAmount(a.sponsorshipInfo?.reward);
          valueB = extractRewardAmount(b.sponsorshipInfo?.reward);
          break;
          
        case "priority":
          const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          valueA = priorityOrder[a.priorityLabel || "LOW"] || 0;
          valueB = priorityOrder[b.priorityLabel || "LOW"] || 0;
          break;
          
        case "receivedAt":
        default:
          valueA = new Date(a.receivedAt).getTime();
          valueB = new Date(b.receivedAt).getTime();
          break;
      }
      
      if (valueA < valueB) return order === "asc" ? -1 : 1;
      if (valueA > valueB) return order === "asc" ? 1 : -1;
      return 0;
    });
  };
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown')) {
        setCategoryDropdownOpen(false);
        setTypeDropdownOpen(false);
        setDeadlineDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset analysis flag when sort changes away from AI
  useEffect(() => {
    if (sortBy !== "ai") {
      setHasRequestedAnalysis(false);
      setAiSortedOrder([]);
    }
  }, [sortBy]);

  // Manual analysis trigger function
  const handleAnalyzeWithPrompt = () => {
    if (!aiSortPrompt.trim()) {
      toast.error("정렬 기준을 입력해주세요.");
      return;
    }
    if (analyzingEfficiency) {
      return;
    }

    // Get filtered emails before sorting (to send to AI)
    let emailsToSort = allEmails;
    
    // Apply all filters except sorting
    if (appliedSearchQuery) {
      const query = appliedSearchQuery.toLowerCase();
      emailsToSort = emailsToSort.filter((email: Email) => {
        const subject = (email.subject || "").toLowerCase();
        const from = (email.from || "").toLowerCase();
        const product = (email.emailAnalysis?.product || "").toLowerCase();
        return subject.includes(query) || from.includes(query) || product.includes(query);
      });
    }

    if (categoryFilter.length > 0) {
      emailsToSort = emailsToSort.filter((email: Email) => {
        const product = email.emailAnalysis?.product || "";
        return categoryFilter.some(cat => product.toLowerCase().includes(cat.toLowerCase()));
      });
    }

    if (typeFilter.length > 0) {
      emailsToSort = emailsToSort.filter((email: Email) => {
        const type = email.emailAnalysis?.type || "";
        return typeFilter.includes(type);
      });
    }

    if (deadlineFilter.length > 0) {
      const now = new Date();
      emailsToSort = emailsToSort.filter((email: Email) => {
        const schedule = email.emailAnalysis?.schedule || email.sponsorshipInfo?.deadline || null;
        if (!schedule || schedule === "정보 없음") return false;
        
        const deadlineDate = extractDeadlineDate(schedule);
        if (!deadlineDate) return false;
        
        const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        return deadlineFilter.some(filter => {
          if (filter === "thisWeek") {
            return daysDiff >= 0 && daysDiff <= 7;
          } else if (filter === "thisMonth") {
            return daysDiff >= 0 && daysDiff <= 30;
          } else if (filter === "overdue") {
            return daysDiff < 0;
          }
          return false;
        });
      });
    }

    if (trashFilter) {
      emailsToSort = emailsToSort.filter((email: Email) => email.isTrashed === true);
    } else if (bookmarkFilter) {
      emailsToSort = emailsToSort.filter((email: Email) => email.isStarred === true && email.isTrashed !== true);
    } else if (repliedFilter) {
      emailsToSort = emailsToSort.filter((email: Email) => (email as any).hasReplied === true && email.isTrashed !== true && email.isStarred !== true);
    } else {
      emailsToSort = emailsToSort.filter((email: Email) => email.isTrashed !== true && email.isStarred !== true && (email as any).hasReplied !== true);
    }

    if (unreadFilter) {
      emailsToSort = emailsToSort.filter((email: Email) => !email.isRead);
    }

    if (emailsToSort.length === 0) {
      toast.error("정렬할 이메일이 없습니다.");
      return;
    }

    setHasRequestedAnalysis(true);
    setAnalyzingEfficiency(true);
    toast.info("AI 정렬을 시작합니다...");
    
    fetch("/api/emails/sort-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emails: emailsToSort,
        prompt: aiSortPrompt.trim(),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.error || "Failed to sort emails");
        }
        return res.json();
      })
      .then(async (data) => {
        if (!data.success) {
          throw new Error(data.error || "Invalid response from server");
        }
        if (data.sortedEmailIds && Array.isArray(data.sortedEmailIds)) {
          setAiSortedOrder(data.sortedEmailIds);
          toast.success(`${data.total || emailsToSort.length}개 이메일의 AI 정렬이 완료되었습니다.`);
        } else {
          throw new Error("No sorted order returned from server");
        }
      })
      .catch((error) => {
        console.error("[Inbox] Failed to sort emails:", error);
        toast.error("AI 정렬에 실패했습니다.");
        setHasRequestedAnalysis(false);
      })
      .finally(() => {
        setAnalyzingEfficiency(false);
      });
  };
  
  // Display fields selection (max 3: product, type, requirements, schedule, reward)
  // Initialize with default values to avoid hydration mismatch
  const [displayFields, setDisplayFields] = useState<AnalysisDisplayField[]>([
    "product",
    "type",
    "requirements",
  ]);
  
  // Load from localStorage on client side only
  useEffect(() => {
    const saved = localStorage.getItem("emailAnalysisDisplayFields");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 3) {
          // Validate that all fields are valid
          const validFields = parsed.filter((field: string) => 
            allFields.includes(field as AnalysisDisplayField)
          );
          if (validFields.length > 0) {
            setDisplayFields(validFields.slice(0, 3) as AnalysisDisplayField[]);
          }
        }
      } catch {
        // Invalid JSON, keep default
      }
    }
  }, []);

  const loadEmails = useCallback(
    async (queryOverride?: string, preserveSelection: boolean = true, useCache: boolean = true) => {
      // Try to load from cache first
      if (useCache && typeof window !== 'undefined') {
        try {
          const cacheKey = 'inbox_cache';
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const cacheAge = Date.now() - timestamp;
            const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
            
            if (cacheAge < CACHE_EXPIRY && data.emails) {
              console.log("[Inbox] Loading from cache:", data.emails.length, "emails");
              setAllEmails(data.emails);
              
              // Preserve selection if available
              if (preserveSelection && data.emails.length > 0) {
                setSelectedEmail((current) => {
                  if (current) {
                    const stillInList = data.emails.find((e: Email) => e.id === current.id);
                    if (stillInList) return stillInList;
                  }
                  return data.emails[0];
                });
              } else if (!preserveSelection && data.emails.length > 0) {
                setSelectedEmail(data.emails[0]);
              }
              
              // Continue to fetch fresh data in background
            }
          }
        } catch (error) {
          console.error("[Inbox] Failed to load from cache:", error);
        }
      }
      
      setLoading(true);
      try {
        const url = `/api/emails`;
        console.log("[Inbox] Loading emails:", url);
        
        const res = await fetch(url);
        
        if (res.status === 401) {
          router.push("/auth/signin");
          return;
        }
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error("[Inbox] Failed to load emails:", res.status, errorData);
          // Silently fail - don't show error toast
          return;
        }
        
        const data = await res.json();
        console.log("[Inbox] Received emails:", data.emails?.length || 0);
        
        // Save to cache
        if (typeof window !== 'undefined') {
          try {
            const cacheKey = 'inbox_cache';
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: { emails: data.emails || [] },
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error("[Inbox] Failed to save to cache:", error);
          }
        }
        
        let filteredEmails = data.emails || [];
        const effectiveQuery = (queryOverride ?? appliedSearchQuery).trim();
        
        // Store all emails (filtering will be done in useEffect)
        setAllEmails(data.emails || []);
        
        // Update selected email only if needed (avoid infinite loop)
        if (preserveSelection && filteredEmails.length > 0) {
          setSelectedEmail((current) => {
            // If current selection is still in the list, keep it
            if (current) {
              const stillInList = filteredEmails.find((e: Email) => e.id === current.id);
              if (stillInList) {
                return stillInList; // Update with fresh data
              }
            }
            // Otherwise, select first email
            return filteredEmails[0];
          });
        } else if (!preserveSelection && filteredEmails.length > 0) {
          setSelectedEmail(filteredEmails[0]);
        } else if (filteredEmails.length === 0) {
          setSelectedEmail(null);
        }
      } catch (error) {
        console.error("[Inbox] Failed to load emails:", error);
        // Silently fail - don't show error toast
      } finally {
        setLoading(false);
      }
    },
    [router, appliedSearchQuery]
  );

  // Load emails only on mount and when search query changes
  useEffect(() => {
    loadEmails(undefined, false); // Don't preserve selection on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearchQuery]); // Only depend on appliedSearchQuery

  // logQueue가 업데이트될 때마다 ref도 업데이트
  useEffect(() => {
    logQueueRef.current = logQueue;
    
    // 첫 번째 로그는 즉시 표시
    if (isFetchingEmails && logQueue.length > 0 && !currentLog) {
      const next = logQueue[0];
      setCurrentLog(next);
      setLogQueue((prev) => prev.slice(1));
      lastLogTimeRef.current = Date.now();
    }
  }, [logQueue, isFetchingEmails, currentLog]);

  // 1초마다 큐에서 다음 로그 표시
  useEffect(() => {
    if (!isFetchingEmails) {
      setCurrentLog(null);
      lastLogTimeRef.current = 0;
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      // 마지막 로그 표시 후 1초가 지났는지 확인
      if (now - lastLogTimeRef.current >= 1000) {
        if (logQueueRef.current.length > 0) {
          const next = logQueueRef.current[0];
          setCurrentLog(next);
          setLogQueue((prev) => prev.slice(1));
          lastLogTimeRef.current = now;
        }
      }
    }, 100); // 100ms마다 체크

    return () => clearInterval(interval);
  }, [isFetchingEmails]);

  const handleFetchEmails = async () => {
    setFetching(true);
    setIsFetchingEmails(true);
    setCurrentLog(null);
    setLogQueue([]);
    try {
      const res = await fetch("/api/emails/fetch", { method: "POST" });

      if (res.status === 401) {
        router.push("/auth/signin");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "이메일 가져오기 실패");
      }

      if (!res.body) {
        throw new Error("서버 응답을 읽을 수 없습니다.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let summaryCount: number | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;
          let event: any;
          try {
            event = JSON.parse(line);
          } catch (error) {
            console.error("[Inbox] Failed to parse fetch log:", error, line);
            continue;
          }

          if (event.type === "log") {
            setLogQueue((prev) => [...prev, event]);
          } else if (event.type === "summary") {
            summaryCount = event.count ?? 0;
          } else if (event.type === "error") {
            throw new Error(event.message || "이메일 가져오기 실패");
          }
        }
      }

      if (summaryCount !== null) {
        toast.success(`${summaryCount}개의 새 이메일을 가져왔습니다.`);
        await loadEmails();
      } else {
        throw new Error("이메일 가져오기 결과를 확인할 수 없습니다.");
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
      toast.error(error instanceof Error ? error.message : "이메일 가져오기 실패");
    } finally {
      setFetching(false);
      setIsFetchingEmails(false);
      // 큐에 남은 로그가 모두 표시될 때까지 기다린 후 정리
      setTimeout(() => {
        setCurrentLog(null);
        setLogQueue([]);
      }, 2000);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setAppliedSearchQuery("");
    loadEmails("");
  };


  const handleCreateTask = async () => {
    if (!selectedEmail) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: selectedEmail.id,
          title: `답장: ${selectedEmail.subject}`,
          description: `이메일 관련 작업: ${selectedEmail.from}`,
        }),
      });
      if (res.ok) {
        toast.success("작업이 생성되었습니다!");
      } else {
        toast.error("작업 생성 실패");
      }
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error("작업 생성 실패");
    }
  };

  const handleTrashAllEmails = async () => {
    if (allEmails.length === 0) {
      toast.info("휴지통으로 보낼 이메일이 없습니다.");
      return;
    }

    if (!confirm(`정말로 모든 이메일(${allEmails.length}개)을 휴지통으로 보내시겠습니까?`)) {
      return;
    }

    setFetching(true);
    try {
      const res = await fetch("/api/emails/clear", { method: "DELETE" });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success(data.message || `${data.trashed}개의 이메일이 휴지통으로 이동되었습니다.`);
        setAllEmails([]);
        setEmails([]);
        setSelectedEmail(null);
      } else {
        toast.error(data.error || "이메일 휴지통 이동 실패");
      }
    } catch (error) {
      console.error("Failed to trash emails:", error);
      toast.error("이메일 휴지통 이동 실패");
    } finally {
      setFetching(false);
    }
  };

  const handleFieldToggle = (field: AnalysisDisplayField) => {
    const isSelected = displayFields.includes(field);
    
    if (isSelected) {
      // Deselect: remove from array
      const newFields = displayFields.filter((f) => f !== field);
      // Must have at least 1 field selected
      if (newFields.length > 0) {
        setDisplayFields(newFields);
        if (typeof window !== "undefined") {
          localStorage.setItem("emailAnalysisDisplayFields", JSON.stringify(newFields));
        }
      }
    } else {
      // Select: add to array (max 3)
      if (displayFields.length < 3) {
        const newFields = [...displayFields, field];
        setDisplayFields(newFields);
        if (typeof window !== "undefined") {
          localStorage.setItem("emailAnalysisDisplayFields", JSON.stringify(newFields));
        }
      } else {
        toast.error("최대 3개까지만 선택할 수 있습니다.");
      }
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <div className="border-b bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Inbox</h2>
            <div className="flex gap-2">
              <Button
                onClick={handleFetchEmails}
                disabled={fetching}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                {fetching ? "가져오는 중..." : "이메일 가져오기"}
              </Button>
              <Button
                onClick={handleTrashAllEmails}
                disabled={fetching || allEmails.length === 0}
                size="sm"
                variant="outline"
                className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 border-gray-300"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                목록 비우기
              </Button>
            </div>
          </div>
          
          {/* Search and Filters */}
          <div className="space-y-3">
            {/* Display Fields Selection */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">표시 항목 (최대 3개):</span>
              </div>
              {allFields.map((field) => {
                const isSelected = displayFields.includes(field);
                return (
                  <Button
                    key={field}
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => handleFieldToggle(field)}
                    className="h-8"
                  >
                    {fieldLabels[field]}
                    {isSelected && " ✓"}
                  </Button>
                );
              })}
            </div>
            
            {/* Filter and Sort Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">필터:</span>
                
                {/* Category Filter - Multi-select Dropdown */}
                <div className="relative filter-dropdown">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCategoryDropdownOpen(!categoryDropdownOpen);
                      setTypeDropdownOpen(false);
                      setDeadlineDropdownOpen(false);
                    }}
                    className="w-40 h-10 justify-between"
                  >
                    <span className="text-sm">
                      {categoryFilter.length === 0 
                        ? "카테고리" 
                        : categoryFilter.length === 1 
                        ? categoryFilter[0] 
                        : `${categoryFilter.length}개 선택`}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", categoryDropdownOpen && "rotate-180")} />
                  </Button>
                  {categoryFilter.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {categoryFilter.length}
                    </span>
                  )}
                  {categoryDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                      {availableCategories.map((category) => {
                        const isSelected = categoryFilter.includes(category);
                        return (
                          <div
                            key={category}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                              if (isSelected) {
                                setCategoryFilter(categoryFilter.filter(c => c !== category));
                              } else {
                                setCategoryFilter([...categoryFilter, category]);
                              }
                            }}
                          >
                            <div className={cn(
                              "w-4 h-4 border-2 rounded flex items-center justify-center",
                              isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
                            )}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className="text-sm">{category}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Type Filter - Multi-select Dropdown */}
                <div className="relative filter-dropdown">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTypeDropdownOpen(!typeDropdownOpen);
                      setCategoryDropdownOpen(false);
                      setDeadlineDropdownOpen(false);
                    }}
                    className="w-40 h-10 justify-between"
                  >
                    <span className="text-sm">
                      {typeFilter.length === 0 
                        ? "유형" 
                        : typeFilter.length === 1 
                        ? typeFilter[0] 
                        : `${typeFilter.length}개 선택`}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", typeDropdownOpen && "rotate-180")} />
                  </Button>
                  {typeFilter.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {typeFilter.length}
                    </span>
                  )}
                  {typeDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                      {availableTypes.map((type) => {
                        const isSelected = typeFilter.includes(type);
                        return (
                          <div
                            key={type}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                              if (isSelected) {
                                setTypeFilter(typeFilter.filter(t => t !== type));
                              } else {
                                setTypeFilter([...typeFilter, type]);
                              }
                            }}
                          >
                            <div className={cn(
                              "w-4 h-4 border-2 rounded flex items-center justify-center",
                              isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
                            )}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className="text-sm">{type}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Deadline Filter - Multi-select Dropdown */}
                <div className="relative filter-dropdown">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeadlineDropdownOpen(!deadlineDropdownOpen);
                      setCategoryDropdownOpen(false);
                      setTypeDropdownOpen(false);
                    }}
                    className="w-32 h-10 justify-between"
                  >
                    <span className="text-sm">
                      {deadlineFilter.length === 0 
                        ? "마감일" 
                        : deadlineFilter.length === 1 
                        ? (deadlineFilter[0] === "thisWeek" ? "이번 주" : deadlineFilter[0] === "thisMonth" ? "이번 달" : "마감 지남")
                        : `${deadlineFilter.length}개 선택`}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", deadlineDropdownOpen && "rotate-180")} />
                  </Button>
                  {deadlineFilter.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {deadlineFilter.length}
                    </span>
                  )}
                  {deadlineDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-gray-300 rounded-md shadow-lg z-50">
                      {[
                        { value: "thisWeek", label: "이번 주" },
                        { value: "thisMonth", label: "이번 달" },
                        { value: "overdue", label: "마감 지남" },
                      ].map(({ value, label }) => {
                        const isSelected = deadlineFilter.includes(value as any);
                        return (
                          <div
                            key={value}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                              if (isSelected) {
                                setDeadlineFilter(deadlineFilter.filter(d => d !== value));
                              } else {
                                setDeadlineFilter([...deadlineFilter, value as any]);
                              }
                            }}
                          >
                            <div className={cn(
                              "w-4 h-4 border-2 rounded flex items-center justify-center",
                              isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
                            )}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className="text-sm">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                
                {/* Unread Filter - Mail Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setUnreadFilter(!unreadFilter);
                    if (!unreadFilter) {
                      setBookmarkFilter(false); // Unread filter on, bookmark filter off
                      setTrashFilter(false); // Unread filter on, trash filter off
                      setRepliedFilter(false); // Unread filter on, replied filter off
                    }
                  }}
                  className={cn(
                    "h-10 w-10 p-0",
                    unreadFilter && "bg-blue-50 border-blue-300"
                  )}
                  title={unreadFilter ? "전체 메일 보기" : "읽지 않은 메일만 보기"}
                >
                  {unreadFilter ? (
                    <Mail className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Mail className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
                
                {/* Bookmark Filter - Bookmark Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBookmarkFilter(!bookmarkFilter);
                    if (!bookmarkFilter) {
                      setUnreadFilter(false); // Bookmark filter on, unread filter off
                      setTrashFilter(false); // Bookmark filter on, trash filter off
                      setRepliedFilter(false); // Bookmark filter on, replied filter off
                    }
                  }}
                  className={cn(
                    "h-10 w-10 p-0",
                    bookmarkFilter && "bg-yellow-50 border-yellow-300"
                  )}
                  title={bookmarkFilter ? "전체 메일 보기" : "북마크 메일 보기"}
                >
                  {bookmarkFilter ? (
                    <Bookmark className="h-4 w-4 text-yellow-600 fill-current" />
                  ) : (
                    <Bookmark className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
                
                {/* Replied Filter - Send Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRepliedFilter(!repliedFilter);
                    if (!repliedFilter) {
                      setUnreadFilter(false); // Replied filter on, unread filter off
                      setBookmarkFilter(false); // Replied filter on, bookmark filter off
                      setTrashFilter(false); // Replied filter on, trash filter off
                    }
                  }}
                  className={cn(
                    "h-10 w-10 p-0",
                    repliedFilter && "bg-purple-50 border-purple-300"
                  )}
                  title={repliedFilter ? "전체 메일 보기" : "회신한 메일 보기"}
                >
                  {repliedFilter ? (
                    <Send className="h-4 w-4 text-purple-600" />
                  ) : (
                    <Send className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
                
                {/* Trash Filter - Trash Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTrashFilter(!trashFilter);
                    if (!trashFilter) {
                      setUnreadFilter(false); // Trash filter on, unread filter off
                      setBookmarkFilter(false); // Trash filter on, bookmark filter off
                      setRepliedFilter(false); // Trash filter on, replied filter off
                    }
                  }}
                  className={cn(
                    "h-10 w-10 p-0",
                    trashFilter && "bg-red-50 border-red-300"
                  )}
                  title={trashFilter ? "전체 메일 보기" : "휴지통 메일 보기"}
                >
                  {trashFilter ? (
                    <Trash2 className="h-4 w-4 text-red-600" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              
              <div className="flex items-center gap-2 ml-2">
                <ArrowUpDown className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">정렬:</span>
                <div className="relative">
                  <Select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as any);
                    }}
                    className={cn(
                      "w-32",
                      sortBy === "ai" && "border-purple-400 bg-gradient-to-r from-purple-50 to-purple-100 shadow-sm"
                    )}
                  >
                    <option value="receivedAt">받은 날짜</option>
                    <option value="deadline">마감일</option>
                    <option value="reward">보상</option>
                    <option value="ai">AI 기반</option>
                  </Select>
                  {sortBy === "ai" && (
                    <Brain className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-600 pointer-events-none animate-pulse" />
                  )}
                </div>
                {sortBy === "ai" && (
                  <>
                    {analyzingEfficiency && (
                      <span className="text-xs text-purple-600 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 animate-spin" />
                        분석 중...
                      </span>
                    )}
                    <Input
                      type="text"
                      placeholder="정렬 기준을 한문장으로 입력하세요 "
                      value={aiSortPrompt}
                      onChange={(e) => setAiSortPrompt(e.target.value)}
                      className="w-80 h-8 text-sm border-purple-300 focus:border-purple-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !analyzingEfficiency) {
                          handleAnalyzeWithPrompt();
                        }
                      }}
                      disabled={analyzingEfficiency}
                    />
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  }}
                  className={sortBy === "ai" ? "h-8 w-20 border-purple-300" : "h-8 w-20"}
                >
                  {sortOrder === "asc" ? "↑ 오름차순" : "↓ 내림차순"}
                </Button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="이메일 검색 (제목, 발신자, 본문)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setAppliedSearchQuery(searchQuery);
                    loadEmails(searchQuery);
                  }
                }}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setAppliedSearchQuery("");
                    loadEmails("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden relative">
          {/* 이메일 가져오기 로딩 모달 */}
          {isFetchingEmails && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
              <div className="bg-white rounded-lg shadow-2xl border border-gray-300 p-8 w-full max-w-md mx-4">
                <div className="flex flex-col items-center gap-6">
                  {/* 중앙 스피너 */}
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                  
                  {/* 현재 로그 텍스트 */}
                  <div className="w-full text-center min-h-[80px] flex items-center justify-center">
                    {currentLog ? (
                      <div className="space-y-2 w-full transition-opacity duration-300 animate-in fade-in">
                        <p className="text-sm font-medium text-gray-900">
                          {currentLog.subject || "제목 없음"}
                        </p>
                        <p className={cn(
                          "text-xs font-medium",
                          currentLog.status === "accepted" ? "text-green-600" : "text-yellow-600"
                        )}>
                          {currentLog.status === "accepted" ? "✓ 협업 요청으로 수락됨" : "⊘ 협업 요청이 아니어서 건너뜀"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">이메일을 확인하는 중...(최대 50개)</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {!replyMode && (
            <div className="w-[500px] min-w-[500px] max-w-[500px] flex-shrink-0">
              <EmailList
              emails={emails}
              selectedEmailId={selectedEmail?.id}
              onSelectEmail={async (email: Email) => {
                setSelectedEmail(email);
                // Mark as read when email is selected
                if (!email.isRead) {
                  try {
                    const res = await fetch(`/api/emails/${email.id}/read`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ isRead: true }),
                    });
                    if (res.ok) {
                      // Update email in state
                      setAllEmails(prev => prev.map(e => 
                        e.id === email.id 
                          ? { ...e, isRead: true }
                          : e
                      ));
                    }
                  } catch (error) {
                    console.error("Failed to mark as read:", error);
                  }
                }
              }}
              onToggleBookmark={async (emailId: string, isStarred: boolean, removeFromTrash?: boolean) => {
                // Find the email to check if it's trashed
                const email = allEmails.find(e => e.id === emailId);
                const isTrashed = email?.isTrashed || false;
                const shouldRemoveFromTrash = removeFromTrash || (isTrashed && !isStarred);
                
                // Optimistic update
                setAllEmails(prev => prev.map(email => 
                  email.id === emailId 
                    ? { 
                        ...email, 
                        isStarred,
                        ...(shouldRemoveFromTrash ? { isTrashed: false, trashedAt: undefined } : {})
                      }
                    : email
                ));
                
                // Check if email will be hidden from current view
                const willBeHidden = (!bookmarkFilter && !isStarred && isStarred) || 
                                    (bookmarkFilter && isStarred !== true) ||
                                    (!trashFilter && shouldRemoveFromTrash);
                
                // Update selected email if it's the same
                if (selectedEmail?.id === emailId) {
                  if (willBeHidden) {
                    // Email will be hidden, select next email after state update
                    setTimeout(() => {
                      const filtered = emails.filter(e => e.id !== emailId);
                      if (filtered.length > 0) {
                        setSelectedEmail(filtered[0]);
                      } else {
                        setSelectedEmail(null);
                      }
                    }, 0);
                  } else {
                    setSelectedEmail(prev => prev ? { 
                      ...prev, 
                      isStarred,
                      ...(shouldRemoveFromTrash ? { isTrashed: false, trashedAt: undefined } : {})
                    } : null);
                  }
                }
                // Call API
                try {
                  const res = await fetch(`/api/emails/${emailId}/favorite`, {
                    method: "POST",
                  });
                  if (res.ok) {
                    const data = await res.json();
                    toast.success(data.isStarred ? "북마크에 추가되었습니다." : "북마크에서 제거되었습니다.");
                    
                    // If unbookmarking a trashed email, also restore it
                    if (shouldRemoveFromTrash) {
                      try {
                        await fetch(`/api/emails/${emailId}/restore`, {
                          method: "POST",
                        });
                      } catch (error) {
                        console.error("Failed to restore email:", error);
                      }
                    }
                  } else {
                    // Revert on error
                    setAllEmails(prev => prev.map(email => 
                      email.id === emailId 
                        ? { ...email, isStarred: !isStarred }
                        : email
                    ));
                    if (selectedEmail?.id === emailId) {
                      setSelectedEmail(prev => prev ? { ...prev, isStarred: !isStarred } : null);
                    }
                    toast.error("북마크 실패");
                  }
                } catch (error) {
                  // Revert on error
                  setAllEmails(prev => prev.map(email => 
                    email.id === emailId 
                      ? { ...email, isStarred: !isStarred }
                      : email
                  ));
                  if (selectedEmail?.id === emailId) {
                    setSelectedEmail(prev => prev ? { ...prev, isStarred: !isStarred } : null);
                  }
                  console.error("Failed to toggle bookmark:", error);
                  toast.error("북마크 실패");
                }
              }}
              onDelete={async (emailId: string) => {
                // Optimistic update
                setAllEmails(prev => prev.map(email => 
                  email.id === emailId 
                    ? { ...email, isTrashed: true, trashedAt: new Date() }
                    : email
                ));
                // Update selected email if it's the same
                // Note: Auto-selection of next email will be handled by useEffect when emails list updates
                if (selectedEmail?.id === emailId) {
                  setSelectedEmail(prev => prev ? { ...prev, isTrashed: true, trashedAt: new Date() } : null);
                }
                // Call API
                try {
                  const res = await fetch(`/api/emails/${emailId}/delete`, {
                    method: "DELETE",
                  });
                  if (res.ok) {
                    toast.success("이메일이 휴지통으로 이동되었습니다.");
                  } else {
                    // Revert on error
                    setAllEmails(prev => prev.map(email => 
                      email.id === emailId 
                        ? { ...email, isTrashed: false, trashedAt: undefined }
                        : email
                    ));
                    if (selectedEmail?.id === emailId) {
                      setSelectedEmail(prev => prev ? { ...prev, isTrashed: false, trashedAt: undefined } : null);
                    }
                    toast.error("휴지통 이동 실패");
                  }
                } catch (error) {
                  // Revert on error
                  setAllEmails(prev => prev.map(email => 
                    email.id === emailId 
                      ? { ...email, isTrashed: false, trashedAt: undefined }
                      : email
                  ));
                  if (selectedEmail?.id === emailId) {
                    setSelectedEmail(prev => prev ? { ...prev, isTrashed: false, trashedAt: undefined } : null);
                  }
                  console.error("Failed to trash email:", error);
                  toast.error("휴지통 이동 실패");
                }
              }}
              onRestore={async (emailId: string) => {
                // Optimistic update: Remove from trash immediately (like bookmark)
                setAllEmails(prev => prev.map(email => 
                  email.id === emailId 
                    ? { ...email, isTrashed: false, trashedAt: undefined }
                    : email
                ));
                // Update selected email if it's the same
                if (selectedEmail?.id === emailId) {
                  setSelectedEmail(prev => prev ? { ...prev, isTrashed: false, trashedAt: undefined } : null);
                }
                // Call API
                try {
                  const res = await fetch(`/api/emails/${emailId}/restore`, {
                    method: "POST",
                  });
                  if (res.ok) {
                    toast.success("이메일이 복구되었습니다.");
                  } else {
                    // Revert on error
                    setAllEmails(prev => prev.map(email => 
                      email.id === emailId 
                        ? { ...email, isTrashed: true, trashedAt: new Date() }
                        : email
                    ));
                    if (selectedEmail?.id === emailId) {
                      setSelectedEmail(prev => prev ? { ...prev, isTrashed: true, trashedAt: new Date() } : null);
                    }
                    toast.error("복구 실패");
                  }
                } catch (error) {
                  // Revert on error
                  setAllEmails(prev => prev.map(email => 
                    email.id === emailId 
                      ? { ...email, isTrashed: true, trashedAt: new Date() }
                      : email
                  ));
                  if (selectedEmail?.id === emailId) {
                    setSelectedEmail(prev => prev ? { ...prev, isTrashed: true, trashedAt: new Date() } : null);
                  }
                  console.error("Failed to restore email:", error);
                  toast.error("복구 실패");
                }
              }}
              onEmptyTrash={async () => {
                try {
                  const res = await fetch("/api/emails/trash/empty", {
                    method: "DELETE",
                  });
                  
                  if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    toast.error(errorData.error || errorData.message || "휴지통 비우기 실패");
                    return;
                  }
                  
                  const data = await res.json();
                  
                  // Check if operation was successful
                  if (data.success !== false) {
                    // Success - data.success is true or undefined (treat as success)
                    toast.success("휴지통을 비웠습니다.");
                    // Remove deleted emails from state
                    setAllEmails(prev => prev.filter(email => email.isTrashed !== true));
                    setEmails(prev => prev.filter(email => email.isTrashed !== true));
                    setSelectedEmail(null);
                  } else {
                    // API explicitly returned success: false
                    toast.error(data.error || data.message || "휴지통 비우기 실패");
                  }
                } catch (error) {
                  console.error("Failed to empty trash:", error);
                  toast.error("휴지통 비우기 실패");
                }
              }}
              showEmptyTrash={trashFilter}
              displayFields={displayFields}
            />
            </div>
          )}
          <div
            className={cn(
              "transition-all duration-300 relative",
              replyMode ? "w-1/2" : "flex-1"
            )}
          >
            {selectedEmail ? (
              <EmailDetail
                email={selectedEmail}
                onToggleRead={async (emailId: string, isRead: boolean) => {
                  // Update email in state
                  setAllEmails(prev => prev.map(email => 
                    email.id === emailId 
                      ? { ...email, isRead }
                      : email
                  ));
                  // Update selected email if it's the same
                  if (selectedEmail?.id === emailId) {
                    setSelectedEmail({ ...selectedEmail, isRead });
                  }
                }}
                onToggleBookmark={async (emailId: string, isStarred: boolean, removeFromTrash?: boolean) => {
                  // Find the email to check if it's trashed
                  const email = allEmails.find(e => e.id === emailId);
                  const isTrashed = email?.isTrashed || false;
                  const shouldRemoveFromTrash = removeFromTrash || (isTrashed && !isStarred);
                  
                  // Optimistic update
                  setAllEmails(prev => prev.map(email => 
                    email.id === emailId 
                      ? { 
                          ...email, 
                          isStarred,
                          ...(shouldRemoveFromTrash ? { isTrashed: false, trashedAt: undefined } : {})
                        }
                      : email
                  ));
                  // Update selected email if it's the same
                  if (selectedEmail?.id === emailId) {
                    setSelectedEmail(prev => prev ? { 
                      ...prev, 
                      isStarred,
                      ...(shouldRemoveFromTrash ? { isTrashed: false, trashedAt: undefined } : {})
                    } : null);
                  }
                  
                  // Call API
                  try {
                    const res = await fetch(`/api/emails/${emailId}/favorite`, {
                      method: "POST",
                    });
                    if (res.ok) {
                      const data = await res.json();
                      toast.success(data.isStarred ? "북마크에 추가되었습니다." : "북마크에서 제거되었습니다.");
                      
                      // If unbookmarking a trashed email, also restore it
                      if (shouldRemoveFromTrash) {
                        try {
                          await fetch(`/api/emails/${emailId}/restore`, {
                            method: "POST",
                          });
                        } catch (error) {
                          console.error("Failed to restore email:", error);
                        }
                      }
                    } else {
                      // Revert on error
                      setAllEmails(prev => prev.map(email => 
                        email.id === emailId 
                          ? { ...email, isStarred: !isStarred }
                          : email
                      ));
                      if (selectedEmail?.id === emailId) {
                        setSelectedEmail(prev => prev ? { ...prev, isStarred: !isStarred } : null);
                      }
                      toast.error("북마크 실패");
                    }
                  } catch (error) {
                    // Revert on error
                    setAllEmails(prev => prev.map(email => 
                      email.id === emailId 
                        ? { ...email, isStarred: !isStarred }
                        : email
                    ));
                    if (selectedEmail?.id === emailId) {
                      setSelectedEmail(prev => prev ? { ...prev, isStarred: !isStarred } : null);
                    }
                    console.error("Failed to toggle bookmark:", error);
                    toast.error("북마크 실패");
                  }
                }}
                onDelete={(emailId: string) => {
                  // Update email to trashed state immediately (optimistic update)
                  setAllEmails(prev => prev.map(email => 
                    email.id === emailId 
                      ? { ...email, isTrashed: true, trashedAt: new Date() }
                      : email
                  ));
                  // Update selected email if it's the same
                  if (selectedEmail?.id === emailId) {
                    setSelectedEmail(prev => prev ? { ...prev, isTrashed: true, trashedAt: new Date() } : null);
                  }
                }}
                onOpenReply={() => {
                  setReplyMode(true);
                  if (selectedEmail) {
                    setReplySubject(`Re: ${selectedEmail.subject}`);
                  }
                  // Load templates
                  fetch("/api/templates")
                    .then((res) => res.json())
                    .then((data) => {
                      if (data.success) {
                        setTemplates(data.templates || []);
                        if (data.templates && data.templates.length > 0) {
                          const firstTemplate = data.templates[0];
                          setSelectedTemplateId(firstTemplate.id);
                          setReplySubject(firstTemplate.subject || `Re: ${selectedEmail?.subject || ""}`);
                          setReplyBody(firstTemplate.body || "");
                        }
                      }
                    })
                    .catch((error) => {
                      console.error("Failed to load templates:", error);
                    });
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                이메일을 선택하세요
              </div>
            )}
          </div>
          {replyMode && (
            <div className="w-1/2 border-l bg-white flex flex-col animate-in slide-in-from-right duration-300">
              <div className="border-b p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  원클릭 회신
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplyMode(false);
                    setReplySubject("");
                    setReplyBody("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {templates.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">템플릿 선택</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        const template = templates.find((t) => t.id === e.target.value);
                        if (template) {
                          setReplySubject(template.subject || `Re: ${selectedEmail?.subject || ""}`);
                          setReplyBody(template.body || "");
                        }
                      }}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name || template.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-2 block">제목</label>
                  <Input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder="제목을 입력하세요"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="text-sm font-medium mb-2 block">본문</label>
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="본문을 입력하세요"
                    className="flex-1 min-h-[400px]"
                  />
                </div>
              </div>
              <div className="border-t p-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReplyMode(false);
                    setReplySubject("");
                    setReplyBody("");
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedEmail || !replySubject.trim() || !replyBody.trim()) {
                      toast.error("제목과 본문을 입력해주세요.");
                      return;
                    }

                    setSending(true);
                    try {
                      const res = await fetch(`/api/emails/${selectedEmail.id}/reply`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          subject: replySubject,
                          body: replyBody,
                        }),
                      });

                      if (res.ok) {
                        toast.success("답변이 전송되었고 채팅방이 생성되었습니다. 채팅 탭에서 확인하세요.");
                        
                        // Update email to mark as replied (like bookmark)
                        const currentEmailId = selectedEmail?.id;
                        if (currentEmailId) {
                          setAllEmails(prev => prev.map(email => 
                            email.id === currentEmailId 
                              ? { ...email, hasReplied: true as any }
                              : email
                          ));
                          
                          // Update selected email if it's the same
                          if (selectedEmail?.id === currentEmailId) {
                            setSelectedEmail(prev => prev ? { ...prev, hasReplied: true as any } : null);
                          }
                        }
                        
                        // Reload emails to get updated hasReplied status
                        await loadEmails(undefined, true, false);
                        
                        // Move to next email
                        setTimeout(() => {
                          const currentIndex = emails.findIndex(e => e.id === currentEmailId);
                          if (currentIndex !== -1 && currentIndex < emails.length - 1) {
                            // Select next email
                            setSelectedEmail(emails[currentIndex + 1]);
                          } else if (emails.length > 0) {
                            // If last email, select first one
                            setSelectedEmail(emails[0]);
                          }
                        }, 100);
                        
                        setReplyMode(false);
                        setReplySubject("");
                        setReplyBody("");
                      } else {
                        const error = await res.json();
                        if (error.requiresReauth) {
                          toast.show({
                            title: error.error || "Gmail 전송 권한이 필요합니다. 로그아웃 후 다시 로그인해주세요.",
                            variant: "error",
                            duration: 5000,
                          });
                        } else {
                          toast.error(error.error || "답변 전송 실패");
                        }
                      }
                    } catch (error) {
                      console.error("Failed to send reply:", error);
                      toast.error("답변 전송 실패");
                    } finally {
                      setSending(false);
                    }
                  }}
                  disabled={sending}
                >
                  {sending ? "전송 중..." : "전송"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

