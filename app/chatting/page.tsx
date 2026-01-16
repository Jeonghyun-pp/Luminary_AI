"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { format } from "date-fns";
import { ko } from "date-fns/locale/ko";
import { MessageSquare, Send, CheckSquare2, Calendar, LogOut, Trash2, Filter, XCircle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface ChatThread {
  emailId: string;
  threadId: string | null;
  subject: string;
  subjectSummary?: string; // 제목 요약
  from: string;
  fromEmail: string;
  lastMessageAt: Date;
  unreadCount: number;
  hasTask?: boolean;
  hasReplied?: boolean; // 원클릭 회신 여부
}

interface ChatMessage {
  id: string;
  subject: string;
  body: string;
  from: string;
  to: string;
  sentAt: Date;
  isSent: boolean; // true if sent by user, false if received
}

export default function ChattingPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [analyzingTask, setAnalyzingTask] = useState(false);
  const [taskAnalysis, setTaskAnalysis] = useState<{
    title: string;
    content: string;
    product?: string;
    requirements?: string;
    reward?: string;
    schedule: string;
    dueAt: string | null;
  } | null>(null);
  const [editingTask, setEditingTask] = useState({
    title: "",
    content: "",
    product: "",
    requirements: "",
    reward: "",
    schedule: "",
    dueAt: "",
  });
  const [savingTask, setSavingTask] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef<number>(0);
  const previousEmailIdRef = useRef<string | null>(null);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [leavingThreads, setLeavingThreads] = useState<Set<string>>(new Set());
  const [taskFilter, setTaskFilter] = useState<"all" | "tasks" | "no-tasks">("all"); // "all" = all, "tasks" = tasks only, "no-tasks" = no tasks only
  const [repliedFilter, setRepliedFilter] = useState<boolean>(false); // false = all, true = replied only
  const selectedThreadRef = useRef<ChatThread | null>(null); // Always keep latest selectedThread

  useEffect(() => {
    loadThreads(true); // Use cache on initial load
    loadTemplates();
    
    // Check for new messages in background every 5 seconds
    // Only reload threads list if there are new messages
    const checkUpdatesInterval = setInterval(() => {
      fetch("/api/chatting/threads/check-updates")
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.hasUpdates) {
              console.log(`[Chatting] New messages detected in ${data.emailIdsWithNewMessages.length} thread(s), reloading list...`);
              loadThreads(false); // Don't use cache when there are updates
            }
          }
        })
        .catch((error) => {
          console.error("[Chatting] Failed to check for updates:", error);
        });
    }, 5000); // 5 seconds
    
    return () => {
      clearInterval(checkUpdatesInterval);
    };
  }, []);

  // Keep selectedThreadRef in sync with selectedThread
  useEffect(() => {
    selectedThreadRef.current = selectedThread;
  }, [selectedThread]);

  useEffect(() => {
    if (selectedThread) {
      setReplySubject(`Re: ${selectedThread.subject}`);
    }
  }, [selectedThread]);

  useEffect(() => {
    if (selectedThread) {
      const isNewThread = previousEmailIdRef.current !== selectedThread.emailId;
      previousEmailIdRef.current = selectedThread.emailId;
      previousMessageCountRef.current = 0; // Reset when switching threads
      
      // Show loading immediately when switching threads
      if (isNewThread) {
        setMessagesLoading(true);
        setMessages([]); // Clear previous messages immediately
      }
      
      // Load messages with loading indicator when switching threads
      loadMessages(selectedThread.emailId, isNewThread);
      
      // Initial sync: Poll Gmail immediately when opening a thread (don't wait 5 seconds)
      if (isNewThread) {
        fetch(`/api/chatting/threads/${selectedThread.emailId}/poll`, {
          method: "POST",
        })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              if (data.syncedCount > 0) {
                console.log(`[Chatting] Initial sync: ${data.syncedCount} messages from Gmail`);
                // Reload messages after sync
                loadMessages(selectedThread.emailId, false);
              }
            }
          })
          .catch((error) => {
            console.error("[Chatting] Initial sync error:", error);
          });
      }
      
      // Mark thread as read when opening (always, not just when unreadCount > 0)
      fetch(`/api/chatting/threads/${selectedThread.emailId}/mark-read`, {
        method: "POST",
      })
        .then(async (res) => {
          if (!res.ok) {
            const error = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(error.error || "Failed to mark thread as read");
          }
          const data = await res.json();
          if (data.success) {
            console.log("[Chatting] Thread marked as read successfully");
            // Only reload threads if unread count changed (avoid unnecessary refresh)
            if (selectedThread.unreadCount > 0) {
              loadThreads(false); // Don't use cache when unread count changes
            }
          } else {
            console.error("[Chatting] Failed to mark thread as read:", data.error);
          }
        })
        .catch((error) => {
          console.error("[Chatting] Failed to mark thread as read:", error);
        });
      
      // Set up Server-Sent Events for real-time updates
      const eventSource = new EventSource(
        `/api/chatting/threads/${selectedThread.emailId}/stream`
      );

      let isFirstMessage = true;
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "update" && data.messages) {
            // Convert ISO strings back to Date objects
            const messages = data.messages.map((msg: any) => ({
              ...msg,
              sentAt: new Date(msg.sentAt),
            }));
            setMessages(messages);
            
            // Hide loading after first SSE message
            if (isFirstMessage) {
              isFirstMessage = false;
              setMessagesLoading(false);
            }
          } else if (data.type === "connected") {
            console.log("[Chatting] SSE connected");
          } else if (data.type === "error") {
            console.error("[Chatting] SSE error:", data.error);
            setMessagesLoading(false);
          }
        } catch (error) {
          console.error("[Chatting] Failed to parse SSE message:", error);
          setMessagesLoading(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error("[Chatting] SSE connection error:", error);
        setMessagesLoading(false);
        // SSE will automatically reconnect
      };
      
      // Set up background polling to sync Gmail → Firebase every 5 seconds
      const pollInterval = setInterval(() => {
        // Poll Gmail API and save to Firebase (background sync)
        fetch(`/api/chatting/threads/${selectedThread.emailId}/poll`, {
          method: "POST",
        })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              if (data.syncedCount > 0) {
                console.log(`[Chatting] Synced ${data.syncedCount} new messages from Gmail`);
              }
            }
          })
          .catch((error) => {
            console.error("[Chatting] Background polling error:", error);
          });
      }, 5000); // 5 seconds
      
      return () => {
        eventSource.close();
        clearInterval(pollInterval);
      };
    } else {
      setMessages([]);
      previousMessageCountRef.current = 0;
      previousEmailIdRef.current = null;
    }
  }, [selectedThread]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current && messagesContainerRef.current) {
      // New messages were added, scroll to bottom
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  const loadThreads = async (useCache: boolean = true) => {
    // Use ref to get the latest selectedThread (avoid closure issues)
    const currentSelectedThread = selectedThreadRef.current;
    const currentSelectedEmailId = currentSelectedThread?.emailId;
    
    // Try to load from cache first
    if (useCache && typeof window !== 'undefined') {
      try {
        const cacheKey = 'chatting_threads_cache';
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
          
          if (cacheAge < CACHE_EXPIRY && data.threads) {
            console.log("[Chatting] Loading from cache:", data.threads.length, "threads");
            const cachedThreads = data.threads || [];
            setThreads(cachedThreads);
            
            // Preserve selection
            if (cachedThreads.length > 0 && !currentSelectedEmailId) {
              const firstThread = cachedThreads[0];
              setSelectedThread(firstThread);
              selectedThreadRef.current = firstThread;
            } else if (currentSelectedEmailId) {
              const updatedThread = cachedThreads.find((t: ChatThread) => t.emailId === currentSelectedEmailId);
              if (updatedThread) {
                setSelectedThread(updatedThread);
                selectedThreadRef.current = updatedThread;
              } else {
                setSelectedThread(null);
                selectedThreadRef.current = null;
              }
            }
            
            // Continue to fetch fresh data in background
          }
        }
      } catch (error) {
        console.error("[Chatting] Failed to load from cache:", error);
      }
    }
    
    try {
      const res = await fetch("/api/chatting/threads");
      const data = await res.json();
      if (data.success) {
        const newThreads = data.threads || [];
        
        // Save to cache
        if (typeof window !== 'undefined') {
          try {
            const cacheKey = 'chatting_threads_cache';
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: { threads: newThreads },
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error("[Chatting] Failed to save to cache:", error);
          }
        }
        
        setThreads(newThreads);
        
        // Only auto-select first thread if no thread is currently selected
        if (newThreads.length > 0 && !currentSelectedEmailId) {
          const firstThread = newThreads[0];
          setSelectedThread(firstThread);
          selectedThreadRef.current = firstThread;
        } else if (currentSelectedEmailId) {
          // Find and update the currently selected thread (don't change selection)
          const updatedThread = newThreads.find((t: ChatThread) => t.emailId === currentSelectedEmailId);
          if (updatedThread) {
            // Update selectedThread with latest data (especially unreadCount) but keep same selection
            setSelectedThread(updatedThread);
            selectedThreadRef.current = updatedThread;
          } else {
            // Selected thread no longer exists, clear selection
            setSelectedThread(null);
            selectedThreadRef.current = null;
          }
        }
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
    }
  };

  // Filter threads based on taskFilter and repliedFilter
  const displayedThreads = (() => {
    let filtered = threads;
    
    // Apply task filter
    if (taskFilter === "tasks") {
      filtered = filtered.filter((thread) => thread.hasTask);
    } else if (taskFilter === "no-tasks") {
      filtered = filtered.filter((thread) => !thread.hasTask);
    }
    
    // Apply replied filter
    if (repliedFilter) {
      filtered = filtered.filter((thread) => thread.hasReplied);
    }
    
    return filtered;
  })();

  const handleLeaveThread = async (emailId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    if (!confirm("정말로 이 채팅방을 나가시겠습니까? 채팅 기록이 삭제됩니다.")) {
      return;
    }

    setLeavingThreads((prev) => new Set(prev).add(emailId));
    try {
      const res = await fetch(`/api/chatting/threads/${emailId}/leave`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "채팅방을 나갔습니다.");
        // Remove from threads list
        setThreads((prev) => prev.filter((t) => t.emailId !== emailId));
        // Clear selection if leaving the selected thread
        if (selectedThread?.emailId === emailId) {
          setSelectedThread(null);
          setMessages([]);
        }
        // Remove from selected threads
        setSelectedThreadIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(emailId);
          return newSet;
        });
      } else {
        toast.error(data.error || "채팅방 나가기 실패");
      }
    } catch (error) {
      console.error("Failed to leave thread:", error);
      toast.error("채팅방 나가기 실패");
    } finally {
      setLeavingThreads((prev) => {
        const newSet = new Set(prev);
        newSet.delete(emailId);
        return newSet;
      });
    }
  };

  const handleLeaveMultipleThreads = async () => {
    if (selectedThreadIds.size === 0) {
      toast.error("선택된 채팅방이 없습니다.");
      return;
    }

    if (!confirm(`정말로 선택한 ${selectedThreadIds.size}개의 채팅방을 나가시겠습니까? 채팅 기록이 삭제됩니다.`)) {
      return;
    }

    const emailIds = Array.from(selectedThreadIds);
    setLeavingThreads(new Set(emailIds));

    try {
      const results = await Promise.allSettled(
        emailIds.map((emailId) =>
          fetch(`/api/chatting/threads/${emailId}/leave`, {
            method: "DELETE",
          })
        )
      );

      let successCount = 0;
      let failCount = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.ok) {
          successCount++;
        } else {
          failCount++;
        }
      });

      if (successCount > 0) {
        toast.success(`${successCount}개의 채팅방을 나갔습니다.`);
        // Remove from threads list
        setThreads((prev) => prev.filter((t) => !selectedThreadIds.has(t.emailId)));
        // Clear selection if leaving the selected thread
        if (selectedThread && selectedThreadIds.has(selectedThread.emailId)) {
          setSelectedThread(null);
          setMessages([]);
        }
        // Clear selection
        setSelectedThreadIds(new Set());
        setIsSelectionMode(false);
      }

      if (failCount > 0) {
        toast.error(`${failCount}개의 채팅방 나가기에 실패했습니다.`);
      }
    } catch (error) {
      console.error("Failed to leave multiple threads:", error);
      toast.error("채팅방 나가기 실패");
    } finally {
      setLeavingThreads(new Set());
    }
  };

  const handleToggleThreadSelection = (emailId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedThreadIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const loadMessages = async (emailId: string, showLoading: boolean = true) => {
    if (showLoading) {
      setMessagesLoading(true);
    }
    try {
      // Load messages from Firebase (fast - only queries one emailId's replies)
      const res = await fetch(`/api/chatting/threads/${emailId}/messages`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        // Hide loading after messages are loaded
        if (showLoading) {
          setMessagesLoading(false);
        }
      } else {
        if (showLoading) {
          setMessagesLoading(false);
        }
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
      if (showLoading) {
        setMessagesLoading(false);
      }
    }
  };

  const getFromEmail = (from: string): string => {
    if (from.includes("<")) {
      return from.split("<")[1].split(">")[0];
    }
    return from;
  };

  const getFromName = (from: string): string => {
    if (from.includes("<")) {
      return from.split("<")[0].trim();
    }
    return from;
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
        if (data.templates && data.templates.length > 0) {
          setSelectedTemplateId(data.templates[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        setReplySubject(template.subject || `Re: ${selectedThread?.subject || ""}`);
        setReplyBody(template.body || "");
      }
    }
  }, [selectedTemplateId, templates, selectedThread]);

  const handleSendReply = async () => {
    if (!selectedThread) return;
    if (!replySubject.trim() || !replyBody.trim()) {
      toast.error("제목과 본문을 입력해주세요.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/emails/${selectedThread.emailId}/reply`, {
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
        toast.success("답변이 전송되었고 채팅방이 생성되었습니다.");
        setReplyBody("");
        // Reload messages to show the sent message (without loading indicator)
        await loadMessages(selectedThread.emailId, false);
        // Reload threads immediately to update unread count and hasReplied status
        await loadThreads(false); // Don't use cache after sending message
        
        // Wait a bit for threads to reload, then move to next thread
        setTimeout(async () => {
          // Reload threads again to get updated hasReplied status
          await loadThreads(false);
          
          // Move to next thread after successful reply
          const currentIndex = displayedThreads.findIndex(t => t.emailId === selectedThread.emailId);
          if (currentIndex !== -1 && currentIndex < displayedThreads.length - 1) {
            // Select next thread
            const nextThread = displayedThreads[currentIndex + 1];
            setSelectedThread(nextThread);
            selectedThreadRef.current = nextThread;
          } else if (displayedThreads.length > 0) {
            // If last thread, select first one
            const firstThread = displayedThreads[0];
            setSelectedThread(firstThread);
            selectedThreadRef.current = firstThread;
          }
        }, 500);
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
  };

  const handleAnalyzeTask = async () => {
    if (!selectedThread || messages.length === 0) return;

    setAnalyzingTask(true);
    try {
      // Build conversation text from displayed messages
      const conversationText = messages
        .map((msg) => {
          const sender = msg.isSent ? "나" : getFromName(msg.from);
          return `[${sender}]\n제목: ${msg.subject || ""}\n본문: ${msg.body}`;
        })
        .join("\n\n---\n\n");

      const res = await fetch(`/api/chatting/threads/${selectedThread.emailId}/analyze-task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationText: conversationText,
          subject: selectedThread.subject,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTaskAnalysis(data.analysis);
          
          // Convert dueAt to datetime-local format if available
          let dueAtLocal = "";
          if (data.analysis.dueAt) {
            try {
              const date = new Date(data.analysis.dueAt);
              // Format as YYYY-MM-DDTHH:mm for datetime-local input
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const day = String(date.getDate()).padStart(2, "0");
              const hours = String(date.getHours()).padStart(2, "0");
              const minutes = String(date.getMinutes()).padStart(2, "0");
              dueAtLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
            } catch (e) {
              console.error("Failed to parse dueAt:", e);
            }
          }
          
          setEditingTask({
            title: data.analysis.title || "",
            content: typeof data.analysis.content === "string" ? data.analysis.content : String(data.analysis.content || ""),
            product: data.analysis.product || "",
            requirements: data.analysis.requirements || "",
            reward: data.analysis.reward || "",
            schedule: data.analysis.schedule || "",
            dueAt: dueAtLocal,
          });
        } else {
          toast.error(data.error || "작업 분석 실패");
        }
      } else {
        const error = await res.json();
        toast.error(error.error || "작업 분석 실패");
      }
    } catch (error) {
      console.error("Failed to analyze task:", error);
      toast.error("작업 분석 실패");
    } finally {
      setAnalyzingTask(false);
    }
  };

  const handleSaveTask = async () => {
    if (!selectedThread || !taskAnalysis) return;

    setSavingTask(true);
    try {
      // Parse dueAt from schedule string or use provided date
      let dueAt: Date | null = null;
      if (editingTask.dueAt) {
        dueAt = new Date(editingTask.dueAt);
      } else if (editingTask.schedule) {
        // Try to parse schedule string
        const dateMatch = editingTask.schedule.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          dueAt = new Date(editingTask.schedule);
        } else {
          const relativeMatch = editingTask.schedule.match(/(\d+)\s*(일|주|개월|달)\s*(후|뒤)/);
          if (relativeMatch) {
            const amount = parseInt(relativeMatch[1]);
            const unit = relativeMatch[2];
            const now = new Date();
            if (unit === "일") {
              now.setDate(now.getDate() + amount);
            } else if (unit === "주") {
              now.setDate(now.getDate() + amount * 7);
            } else if (unit === "개월" || unit === "달") {
              now.setMonth(now.getMonth() + amount);
            }
            dueAt = now;
          }
        }
      }

      const requestBody: any = {
        title: editingTask.title,
        description: `제품: ${editingTask.product || "정보 없음"}\n\n요구사항:\n${editingTask.requirements || "정보 없음"}\n\n보상: ${editingTask.reward || "정보 없음"}`,
      };

      if (selectedThread.emailId) {
        requestBody.emailId = selectedThread.emailId;
      }

      if (dueAt) {
        requestBody.dueAt = dueAt.toISOString();
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        toast.success("협업 작업이 생성되었습니다.");
        setTaskAnalysis(null);
        setEditingTask({ title: "", content: "", product: "", requirements: "", reward: "", schedule: "", dueAt: "" });
        // 자동으로 threads 목록 새로고침 및 협업중 필터 활성화
        await loadThreads(false); // Don't use cache after creating task
        setTaskFilter("tasks");
      } else {
        const error = await res.json();
        toast.error(error.error || "작업 저장 실패");
      }
    } catch (error) {
      console.error("Failed to save task:", error);
      toast.error("작업 저장 실패");
    } finally {
      setSavingTask(false);
    }
  };

  const handleCancelTask = async () => {
    if (!selectedThread || !selectedThread.emailId) return;

    if (!confirm("정말로 이 작업을 취소하시겠습니까? Task에서 제거됩니다.")) {
      return;
    }

    setSavingTask(true);
    try {
      // Get all tasks to find the one with matching emailId
      const tasksRes = await fetch("/api/tasks");
      const tasksData = await tasksRes.json();
      
      if (!tasksData.tasks) {
        toast.error("작업을 찾을 수 없습니다.");
        return;
      }

      // Find task with matching emailId
      const taskToDelete = tasksData.tasks.find(
        (task: any) => task.emailId === selectedThread.emailId
      );

      if (!taskToDelete) {
        toast.error("연결된 작업을 찾을 수 없습니다.");
        return;
      }

      // Delete the task
      const deleteRes = await fetch(`/api/tasks/${taskToDelete.id}`, {
        method: "DELETE",
      });

      if (deleteRes.ok) {
        toast.success("작업이 취소되었습니다.");
        // 자동으로 threads 목록 새로고침
        await loadThreads(false); // Don't use cache after canceling task
      } else {
        const error = await deleteRes.json();
        toast.error(error.error || "작업 취소 실패");
      }
    } catch (error) {
      console.error("Failed to cancel task:", error);
      toast.error("작업 취소 실패");
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Chat list */}
        <div className="w-80 border-r bg-white flex flex-col">
          <div className="border-b p-4">
            <div className="flex items-center justify-between mb-2">
              {!isSelectionMode && (
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                </h2>
              )}
              <div className="flex items-center gap-2 ml-4">
                {!isSelectionMode && (
                  <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (taskFilter === "all") {
                        setTaskFilter("tasks");
                      } else if (taskFilter === "tasks") {
                        setTaskFilter("no-tasks");
                      } else {
                        setTaskFilter("all");
                      }
                    }}
                    className={cn(
                      "h-8 w-8 p-0",
                      taskFilter === "tasks" && "bg-green-50 border-green-300",
                      taskFilter === "no-tasks" && "bg-blue-50 border-blue-300"
                    )}
                    title={
                      taskFilter === "all" 
                        ? "Task로 넘긴 채팅방만 보기" 
                        : taskFilter === "tasks"
                        ? "Task로 넘기지 않은 채팅방만 보기"
                        : "전체 채팅방 보기"
                    }
                  >
                    <Filter className={cn(
                      "h-4 w-4",
                      taskFilter === "tasks" && "text-green-600",
                      taskFilter === "no-tasks" && "text-blue-600",
                      taskFilter === "all" && "text-gray-400"
                    )} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRepliedFilter(!repliedFilter)}
                    className={cn(
                      "h-8 px-3 text-sm font-medium",
                      repliedFilter && "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100",
                      !repliedFilter && "hover:bg-gray-50"
                    )}
                    title={repliedFilter ? "모든 채팅방 보기" : "회신한 채팅방만 보기"}
                  >
                    {repliedFilter ? "회신함" : "전체"}
                  </Button>
                  </>
                )}
                {isSelectionMode ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (selectedThreadIds.size === displayedThreads.length) {
                          setSelectedThreadIds(new Set());
                          setIsSelectionMode(false);
                        } else {
                          setSelectedThreadIds(new Set(displayedThreads.map((t) => t.emailId)));
                        }
                      }}
                    >
                      {selectedThreadIds.size === displayedThreads.length ? "전체 해제" : "전체 선택"}
                    </Button>
                    {selectedThreadIds.size > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleLeaveMultipleThreads}
                        disabled={leavingThreads.size > 0}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                      >
                        <LogOut className="h-4 w-4 mr-1" />
                        나가기 ({selectedThreadIds.size})
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsSelectionMode(true)}
                  >
                    선택
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {repliedFilter
                ? `회신한 채팅방 ${displayedThreads.length}개`
                : taskFilter === "tasks"
                ? `Task로 넘긴 채팅방 ${displayedThreads.length}개`
                : taskFilter === "no-tasks"
                ? `Task로 넘기지 않은 채팅방 ${displayedThreads.length}개`
                : `${displayedThreads.length}개의 대화`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {displayedThreads.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {taskFilter === "tasks"
                  ? "Task로 넘긴 채팅방이 없습니다"
                  : taskFilter === "no-tasks"
                  ? "Task로 넘기지 않은 채팅방이 없습니다"
                  : "답변한 메일이 없습니다"}
              </div>
            ) : (
              <div className="divide-y">
                {displayedThreads.map((thread) => (
                  <div
                    key={thread.emailId}
                    className={cn(
                      "w-full p-4 hover:bg-gray-50 transition-colors relative group",
                      thread.hasTask && selectedThread?.emailId === thread.emailId && "bg-green-50 border-l-4 border-green-500",
                      thread.hasTask && selectedThread?.emailId !== thread.emailId && "bg-green-50/50 border-l-2 border-green-300",
                      !thread.hasTask && selectedThread?.emailId === thread.emailId && "bg-blue-50 border-l-4 border-blue-500",
                      !thread.hasTask && selectedThread?.emailId !== thread.emailId && "bg-blue-50/50 border-l-2 border-blue-300",
                      isSelectionMode && selectedThreadIds.has(thread.emailId) && !thread.hasTask && "bg-blue-100",
                      isSelectionMode && selectedThreadIds.has(thread.emailId) && thread.hasTask && "bg-green-100"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedThreadIds.has(thread.emailId)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleThreadSelection(thread.emailId, e as any);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 cursor-pointer"
                        />
                      )}
                      <button
                        onClick={() => {
                          if (!isSelectionMode) {
                            setSelectedThread(thread);
                          }
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-sm truncate">
                                {thread.subjectSummary || thread.subject}
                              </div>
                              {thread.hasReplied && (
                                <div title="회신한 채팅방">
                                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate mt-1">
                              {getFromName(thread.from)}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {format(new Date(thread.lastMessageAt), "MM월 dd일 HH:mm", { locale: ko })}
                            </div>
                          </div>
                          {thread.unreadCount > 0 && (
                            <div className="flex-shrink-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                              {thread.unreadCount}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Chat messages */}
        <div className="flex-1 flex flex-col bg-[#f7f7f5]">
          {selectedThread ? (
            <>
              {/* Chat header */}
              <div className="border-b bg-white p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{selectedThread.subjectSummary || selectedThread.subject}</div>
                  <div className="text-sm text-gray-500 mt-1">{getFromName(selectedThread.from)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!taskAnalysis ? (
                    selectedThread.hasTask ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelTask}
                        disabled={savingTask}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300"
                        title="Task에서 제거"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {savingTask ? "취소 중..." : "Task 취소"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAnalyzeTask}
                        disabled={analyzingTask}
                        title="Tasks로 넘기기"
                      >
                        <CheckSquare2 className="h-4 w-4 mr-2" />
                        {analyzingTask ? "분석 중..." : "Tasks로 넘기기"}
                      </Button>
                    )
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLeaveThread(selectedThread.emailId)}
                    disabled={leavingThreads.has(selectedThread.emailId)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {leavingThreads.has(selectedThread.emailId) ? "나가는 중..." : "나가기"}
                  </Button>
                </div>
              </div>

              {/* Task Analysis Card */}
              {taskAnalysis && (
                <div className="border-b bg-white p-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">제목</label>
                      <Input
                        value={editingTask.title}
                        onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                        className="w-full"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">제품</label>
                      <Input
                        value={editingTask.product}
                        onChange={(e) => setEditingTask({ ...editingTask, product: e.target.value })}
                        className="w-full"
                        placeholder="예: 스킨케어 제품 - 세럼"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">요구사항</label>
                      <Textarea
                        value={editingTask.requirements}
                        onChange={(e) => setEditingTask({ ...editingTask, requirements: e.target.value })}
                        rows={4}
                        className="w-full"
                        placeholder="예: 최소 3분 이상 영상, 해시태그 필수"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">보상</label>
                      <Input
                        value={editingTask.reward}
                        onChange={(e) => setEditingTask({ ...editingTask, reward: e.target.value })}
                        className="w-full"
                        placeholder="예: 제품 제공 + 50만원"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        마감일 (클릭하여 수정)
                      </label>
                      <div className="space-y-2">
                        <Input
                          type="datetime-local"
                          value={editingTask.dueAt || ""}
                          onChange={(e) => {
                            setEditingTask({ ...editingTask, dueAt: e.target.value });
                          }}
                          className="w-full cursor-pointer"
                        />
                        {editingTask.schedule && !editingTask.dueAt && (
                          <p className="text-xs text-gray-500 italic">
                            AI 추출 마감일: {editingTask.schedule}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setTaskAnalysis(null);
                          setEditingTask({ title: "", content: "", product: "", requirements: "", reward: "", schedule: "", dueAt: "" });
                        }}
                      >
                        취소
                      </Button>
                      <Button
                        onClick={handleSaveTask}
                        disabled={savingTask || !editingTask.title?.trim()}
                      >
                        {savingTask ? "저장 중..." : "확인"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div 
                id="messages-container"
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <div className="text-gray-500 text-sm">메시지를 불러오는 중...</div>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm">메시지가 없습니다</div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.isSent ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg p-3",
                          message.isSent
                            ? "bg-blue-500 text-white"
                            : "bg-white border border-gray-200 text-gray-900"
                        )}
                      >
                        <div className="text-xs opacity-70 mb-1">
                          {format(new Date(message.sentAt), "MM월 dd일 HH:mm", { locale: ko })}
                        </div>
                        {message.subject && message.subject !== message.body && (
                          <div className="font-medium text-sm mb-2">{message.subject}</div>
                        )}
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {message.body}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input area */}
              <div className="border-t bg-white p-4">
                <div className="space-y-3">
                  {templates.length > 0 && (
                    <div>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
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
                    <Input
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="제목을 입력하세요"
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        rows={3}
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                      />
                      <Button
                        onClick={handleSendReply}
                        disabled={sending || !replySubject.trim() || !replyBody.trim()}
                        className="self-end"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Ctrl+Enter 또는 Cmd+Enter로 전송
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              왼쪽에서 대화를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

