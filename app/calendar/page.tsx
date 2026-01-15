"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ko } from "date-fns/locale/ko";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, Circle } from "lucide-react";

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  taskId?: string | null;
  taskStatus?: string | null;
};

type DayItem = {
  id: string;
  title: string;
  description?: string;
  time: string | null;
  type: "task" | "event";
  status?: string;
  dueAt?: Date | null;
  startTime?: string;
  endTime?: string;
  taskId?: string | null;
  taskStatus?: string | null;
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayItems, setDayItems] = useState<DayItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const timeMin = startOfMonth(currentDate).toISOString();
      const timeMax = endOfMonth(currentDate).toISOString();

      const res = await fetch(
        `/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`
      );
      const data = await res.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error("Failed to load calendar events:", error);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  // 달력 그리드를 위해 해당 월의 첫날이 속한 주의 일요일부터 마지막 날이 속한 주의 토요일까지 계산
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 일요일부터 시작
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // 토요일까지
  const daysInMonth = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventDate = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
        ? new Date(event.start.date)
        : null;

      if (!eventDate) return false;
      return isSameDay(eventDate, day);
    });
  };

  const previousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDialogOpen(true);
    
    // Filter events from local memory instead of API call
    const dayEvents = getEventsForDay(day);
    
    // Convert CalendarEvent to DayItem format
    const items: DayItem[] = dayEvents.map((event) => {
      const eventStart = event.start?.dateTime || event.start?.date;
      const eventEnd = event.end?.dateTime || event.end?.date || eventStart;
      
      return {
        id: event.id,
        title: event.summary || "제목 없음",
        description: event.description || "",
        time: eventStart || null,
        startTime: eventStart || undefined,
        endTime: eventEnd || undefined,
        type: "event",
        taskId: event.taskId || null,
        taskStatus: event.taskStatus || null,
      };
    });
    
    setDayItems(items);
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
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
          // Update the day items to reflect the new status
          setDayItems((prevItems) =>
            prevItems.map((item) =>
              item.taskId === taskId
                ? { ...item, taskStatus: newStatus }
                : item
            )
          );
          // Update the events in local memory
          setEvents((prevEvents) =>
            prevEvents.map((event) =>
              event.taskId === taskId
                ? { ...event, taskStatus: newStatus }
                : event
            )
          );
        } else {
          console.error("Failed to update task:", data.error || "Unknown error");
          alert(`작업 상태 변경 실패: ${data.error || "알 수 없는 오류"}`);
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

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-[#f7f7f5] p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">캘린더</h1>
              <p className="mt-2 text-gray-600">통합 일정 관리</p>
            </div>
            <div className="flex items-center gap-4">
              {/* 색상 범례 */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                  <span className="text-gray-600">일반 일정</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
                  <span className="text-gray-600">진행 중</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                  <span className="text-gray-600">완료</span>
                </div>
              </div>
              <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
              >
                월
              </Button>
              </div>
            </div>
          </div>

          <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    {format(currentDate, "yyyy년 MM월", { locale: ko })}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={previousMonth}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date())}
                    >
                      오늘
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">
                    일정을 불러오는 중...
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1">
                    {/* Week day headers */}
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="p-2 text-center text-sm font-medium text-gray-600"
                      >
                        {day}
                      </div>
                    ))}

                    {/* Calendar days */}
                    {daysInMonth.map((day) => {
                      const dayEvents = getEventsForDay(day);
                      const isToday = isSameDay(day, new Date());

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => handleDayClick(day)}
                          className={`min-h-[100px] border p-2 text-left w-full hover:bg-gray-50 transition-colors ${
                            isSameMonth(day, currentDate)
                              ? "bg-white"
                              : "bg-gray-50"
                          } ${isToday ? "ring-2 ring-blue-500" : ""}`}
                        >
                          <div
                            className={`text-sm font-medium ${
                              isToday ? "text-blue-600" : "text-gray-900"
                            }`}
                          >
                            {format(day, "d")}
                          </div>
                          <div className="mt-1 space-y-1">
                            {dayEvents.slice(0, 3).map((event) => {
                              const isTask = !!event.taskId;
                              const isCompleted = event.taskStatus === "DONE";
                              
                              // 색상 결정: 일반 일정 (연한 빨강) > 진행 중 (파랑) > 완료 (초록)
                              let bgColor = "bg-red-100 text-red-800 border border-red-200"; // 일반 일정 (연한 빨강)
                              if (isTask) {
                                if (isCompleted) {
                                  bgColor = "bg-green-100 text-green-800 border border-green-200"; // 완료 (초록)
                                } else {
                                  bgColor = "bg-blue-100 text-blue-800 border border-blue-200"; // 진행 중 (파랑)
                                }
                              }
                              
                              return (
                                <div
                                  key={event.id}
                                  className={`text-xs rounded px-1 py-0.5 truncate flex items-center gap-1 font-medium ${bgColor}`}
                                  title={event.summary}
                                >
                                  {isTask && (
                                    <span className="flex-shrink-0">
                                      {isCompleted ? (
                                        <CheckCircle2 className="h-3 w-3 text-green-700 fill-current" />
                                      ) : (
                                        <Circle className="h-3 w-3 text-blue-700" />
                                      )}
                                    </span>
                                  )}
                                  <span className={isCompleted ? "line-through opacity-70" : ""}>
                                    {event.summary || "제목 없음"}
                                  </span>
                                </div>
                              );
                            })}
                            {dayEvents.length > 3 && (
                              <div className="text-xs text-gray-500">
                                +{dayEvents.length - 3}개 더
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

        </div>
      </div>

      {/* Day Tasks Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDate
                ? format(selectedDate, "yyyy년 MM월 dd일 EEEE", { locale: ko })
                : "일정"}
            </DialogTitle>
            <DialogDescription>
              해당 날짜의 시간별 일정을 확인하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {dayItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                해당 날짜에 일정이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {dayItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {item.taskId ? (
                          // Task인 경우: 완료 여부에 따라 색상 변경
                          item.taskStatus === "DONE" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 fill-current" />
                          ) : (
                            <Circle className="h-5 w-5 text-blue-600" />
                          )
                        ) : (
                          // 일반 일정인 경우
                          <CalendarIcon className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`font-semibold text-base mb-1 ${
                          item.taskId && item.taskStatus === "DONE" 
                            ? "line-through text-green-700 opacity-70" 
                            : item.taskId 
                            ? "text-blue-900" 
                            : "text-red-700"
                        }`}>
                          {item.title}
                        </div>
                        {item.description && (
                          <div className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">
                            {item.description}
                          </div>
                        )}
                        {item.time && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {format(
                                new Date(item.time),
                                "HH:mm",
                                { locale: ko }
                              )}
                            </span>
                            {item.endTime && item.endTime !== item.time && (
                              <>
                                <span> - </span>
                                <span>
                                  {format(
                                    new Date(item.endTime),
                                    "HH:mm",
                                    { locale: ko }
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        {item.taskId && (
                          <div className="mt-3 flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                item.taskStatus === "DONE"
                                  ? "bg-green-100 text-green-800"
                                  : item.taskStatus === "IN_PROGRESS"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {item.taskStatus === "DONE"
                                ? "완료"
                                : item.taskStatus === "IN_PROGRESS"
                                ? "진행 중"
                                : "대기"}
                            </span>
                            <button
                              onClick={() => handleToggleTaskStatus(item.taskId!, item.taskStatus || "IN_PROGRESS")}
                              className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
                              title={item.taskStatus === "DONE" ? "진행 중으로 변경" : "완료로 표시"}
                            >
                              {item.taskStatus === "DONE" ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <CheckCircle2 className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
