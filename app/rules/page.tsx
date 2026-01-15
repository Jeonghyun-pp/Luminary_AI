"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { InboxRule } from "@/types";
import { Sparkles, Edit, Trash2, Power, PowerOff } from "lucide-react";
import { toast } from "@/lib/toast";

export default function RulesPage() {
  const [rules, setRules] = useState<InboxRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ruleText, setRuleText] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rules");
      const data = await res.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error("Failed to load rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!ruleText.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naturalLanguageText: ruleText }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("규칙이 생성되었습니다.");
        setDialogOpen(false);
        setRuleText("");
        await loadRules();
      } else {
        toast.error(data.error || "규칙 생성 실패");
      }
    } catch (error: any) {
      console.error("Failed to create rule:", error);
      toast.error(error.message || "규칙 생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`규칙이 ${!currentStatus ? "활성화" : "비활성화"}되었습니다.`);
        await loadRules();
      } else {
        toast.error("규칙 상태 변경 실패");
      }
    } catch (error) {
      console.error("Failed to toggle rule:", error);
      toast.error("규칙 상태 변경 실패");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("정말 이 규칙을 삭제하시겠습니까?")) return;
    
    try {
      const res = await fetch(`/api/rules/${ruleId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("규칙이 삭제되었습니다.");
        await loadRules();
      } else {
        toast.error("규칙 삭제 실패");
      }
    } catch (error) {
      console.error("Failed to delete rule:", error);
      toast.error("규칙 삭제 실패");
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-[#f7f7f5] p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">규칙 관리</h1>
              <p className="mt-2 text-gray-600">
                자연어로 규칙을 설명하면 AI가 자동으로 구조화된 규칙으로 변환합니다
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              새 규칙 만들기
            </Button>
          </div>

          <div className="space-y-4">
            {rules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  규칙이 없습니다. 새 규칙을 만들어보세요.
                </CardContent>
              </Card>
            ) : (
              rules.map((rule) => (
                <Card key={rule.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle>{rule.name}</CardTitle>
                          <Badge variant={rule.isActive ? "success" : "secondary"}>
                            {rule.isActive ? "활성" : "비활성"}
                          </Badge>
                        </div>
                        {rule.description && (
                          <CardDescription>{rule.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(rule.id, rule.isActive)}
                          title={rule.isActive ? "비활성화" : "활성화"}
                        >
                          {rule.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">조건:</span>
                        <pre className="mt-1 rounded bg-gray-50 p-2 text-xs overflow-x-auto">
                          {JSON.stringify(rule.conditions, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="font-medium">액션:</span>
                        <pre className="mt-1 rounded bg-gray-50 p-2 text-xs overflow-x-auto">
                          {JSON.stringify(rule.actions, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>자연어 규칙 생성</DialogTitle>
            <DialogDescription>
              규칙을 자연어로 설명해주세요. 예: &quot;인보이스, 청구, 결제 관련 메일은 모두
              WORK/FINANCE로 분류하고, 우선순위를 높음으로 설정해줘.&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="예: 인보이스, 청구, 결제 관련 메일은 모두 WORK/FINANCE로 분류하고, 우선순위를 높음으로 설정해줘."
              value={ruleText}
              onChange={(e) => setRuleText(e.target.value)}
              rows={6}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleCreateRule} disabled={creating}>
                {creating ? "생성 중..." : "규칙 생성"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

