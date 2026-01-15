"use client";

import { useEffect, useState, useMemo } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Task } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale/ko";
import { CheckCircle2, Circle, Trash2, Calendar, Clock, Edit, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type SortType = "dueAt" | "createdAt" | null;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortType>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [editingDescription, setEditingDescription] = useState<string>("");
  const [editingDueAt, setEditingDueAt] = useState<string>("");
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (taskId: string, currentStatus: string) => {
    // DONE 상태면 IN_PROGRESS로, 그 외(TODO, IN_PROGRESS)는 DONE으로 변경
    const newStatus = currentStatus === "DONE" ? "IN_PROGRESS" : "DONE";
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          await loadTasks();
        } else {
          console.error("Failed to update task:", data.error || "Unknown error");
        }
      } else {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to update task:", error);
        alert(`작업 상태 변경 실패: ${error.error || error.message || "알 수 없는 오류"}`);
      }
    } catch (error: any) {
      console.error("Failed to update task:", error);
      alert(`작업 상태 변경 실패: ${error.message || "알 수 없는 오류"}`);
    }
  };

  const inProgressRaw = useMemo(
    () => tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "TODO"),
    [tasks]
  );
  const done = useMemo(
    () => tasks.filter((t) => t.status === "DONE"),
    [tasks]
  );

  // 정렬된 진행 중인 협업
  const inProgress = useMemo(() => {
    if (!sortBy) return inProgressRaw;
    
    const sorted = [...inProgressRaw].sort((a, b) => {
      if (sortBy === "dueAt") {
        // 마감일 순 (마감일이 없는 것은 뒤로)
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        const aDate = a.dueAt instanceof Date ? a.dueAt : new Date(a.dueAt);
        const bDate = b.dueAt instanceof Date ? b.dueAt : new Date(b.dueAt);
        return aDate.getTime() - bDate.getTime();
      }
      
      // 생성일 순 (최신순)
      const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return bDate.getTime() - aDate.getTime(); // 최신순이므로 역순
    });
    return sorted;
  }, [inProgressRaw, sortBy]);

  const handleClearDone = async () => {
    if (done.length === 0) return;
    
    if (!confirm(`완료된 협업 ${done.length}개를 모두 삭제하시겠습니까?`)) {
      return;
    }

    try {
      // 모든 완료된 작업 삭제
      const deletePromises = done.map((task) =>
        fetch(`/api/tasks/${task.id}`, {
          method: "DELETE",
        })
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter((res) => !res.ok);

      if (failed.length > 0) {
        alert(`일부 작업 삭제에 실패했습니다. (${failed.length}개)`);
      } else {
        await loadTasks();
      }
    } catch (error) {
      console.error("Failed to clear done tasks:", error);
      alert("완료된 협업 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditingTitle(task.title || "");
    setEditingDescription(task.description || "");
    if (task.dueAt) {
      const date = new Date(task.dueAt);
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setEditingDueAt(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      // Set default to current date/time
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setEditingDueAt(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  };

  const handleSaveTask = async () => {
    if (!editingTask) return;

    if (!editingTitle.trim()) {
      toast.error("작업 제목을 입력해주세요.");
      return;
    }

    setSavingTask(true);
    try {
      const dueAt = editingDueAt ? new Date(editingDueAt).toISOString() : null;
      
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingTitle.trim(),
          description: editingDescription.trim() || null,
          dueAt,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success("협업 작업이 수정되었습니다.");
          setEditingTask(null);
          setEditingTitle("");
          setEditingDescription("");
          setEditingDueAt("");
          await loadTasks();
        } else {
          toast.error(data.error || "작업 수정 실패");
        }
      } else {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(error.error || error.message || "작업 수정 실패");
      }
    } catch (error: any) {
      console.error("Failed to update task:", error);
      toast.error(error.message || "작업 수정 실패");
    } finally {
      setSavingTask(false);
    }
  };

  const handleRemoveDueAt = async () => {
    if (!editingTask) return;

    setSavingTask(true);
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: null }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success("협업 일정이 제거되었습니다.");
          setEditingDueAt("");
          // Update the editing task state
          setEditingTask({ ...editingTask, dueAt: null });
          await loadTasks();
        } else {
          toast.error(data.error || "일정 제거 실패");
        }
      } else {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(error.error || error.message || "일정 제거 실패");
      }
    } catch (error: any) {
      console.error("Failed to remove dueAt:", error);
      toast.error(error.message || "일정 제거 실패");
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-[#f7f7f5]">
        <div className="mx-auto max-w-4xl p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">협업 관리</h1>
            <p className="mt-2 text-gray-600">진행 중인 협업과 완료된 협업을 관리하세요</p>
          </div>

          {/* 진행중인 협업 */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">진행중인 협업</h2>
              {inProgressRaw.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortBy(sortBy === "dueAt" ? null : "dueAt")}
                    className={cn(
                      "flex items-center gap-2",
                      sortBy === "dueAt" && "bg-blue-50 border-blue-300 text-blue-700"
                    )}
                  >
                    <Calendar className="h-4 w-4" />
                    마감일 순
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortBy(sortBy === "createdAt" ? null : "createdAt")}
                    className={cn(
                      "flex items-center gap-2",
                      sortBy === "createdAt" && "bg-blue-50 border-blue-300 text-blue-700"
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    생성일 순
                  </Button>
                </div>
              )}
            </div>
            {loading ? (
              <div className="text-center text-gray-500 text-sm py-8">로딩 중...</div>
            ) : inProgress.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                진행 중인 협업이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {inProgress.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-base mb-2">{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">
                            {task.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span className="font-medium">마감일:</span>
                            {task.dueAt ? (
                              <span className="text-gray-700">
                                {format(new Date(task.dueAt), "yyyy년 MM월 dd일 EEEE HH:mm", { locale: ko })}
                              </span>
                            ) : (
                              <span className="text-gray-400">설정되지 않음</span>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTask(task)}
                            className="h-6 px-2 text-xs"
                            title="작업 수정"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            수정
                          </Button>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleStatus(task.id, task.status)}
                        className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        title="완료로 표시"
                      >
                        <Circle className="h-5 w-5 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 완료된 협업 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">완료된 협업</h2>
              {done.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearDone}
                  className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  비우기
                </Button>
              )}
            </div>
            {done.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                완료된 협업이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {done.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm opacity-60"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-base mb-2 line-through">
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-sm text-gray-600 mb-3 whitespace-pre-wrap line-through">
                            {task.description}
                          </div>
                        )}
                        {task.dueAt && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <span className="font-medium">마감일:</span>
                            <span>
                              {format(new Date(task.dueAt), "yyyy년 MM월 dd일 EEEE HH:mm", { locale: ko })}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleStatus(task.id, task.status)}
                        className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-green-500 bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors"
                        title="진행중으로 되돌리기"
                      >
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Task Sidebar - TODO LIST Style */}
      {editingTask && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => {
              setEditingTask(null);
              setEditingTitle("");
              setEditingDescription("");
              setEditingDueAt("");
            }}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-white border-l shadow-xl z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">작업 수정</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingTask(null);
                  setEditingTitle("");
                  setEditingDescription("");
                  setEditingDueAt("");
                }}
                className="h-8 w-8 p-0"
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">작업 제목</label>
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  placeholder="작업 제목을 입력하세요"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">작업 설명</label>
                <Textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  placeholder="작업 설명을 입력하세요"
                  rows={6}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  마감일
                </label>
                <Input
                  type="datetime-local"
                  value={editingDueAt}
                  onChange={(e) => setEditingDueAt(e.target.value)}
                  className="w-full"
                />
                {editingTask.dueAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveDueAt}
                    disabled={savingTask}
                    className="mt-2 w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    일정 제거
                  </Button>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingTask(null);
                    setEditingTitle("");
                    setEditingDescription("");
                    setEditingDueAt("");
                  }}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveTask}
                  disabled={savingTask}
                  className="flex-1"
                >
                  {savingTask ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
