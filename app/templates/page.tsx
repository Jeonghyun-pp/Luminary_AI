"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Edit, Trash2, Plus } from "lucide-react";
import { toast } from "@/lib/toast";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      } else {
        toast.error("템플릿을 불러오는데 실패했습니다.");
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("템플릿을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateName(template.name || "");
      setTemplateSubject(template.subject || "");
      setTemplateBody(template.body || "");
    } else {
      setEditingTemplate(null);
      setTemplateName("");
      setTemplateSubject("");
      setTemplateBody("");
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateSubject("");
    setTemplateBody("");
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !templateSubject.trim() || !templateBody.trim()) {
      toast.error("템플릿 이름, 제목, 본문을 모두 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const url = editingTemplate 
        ? `/api/templates/${editingTemplate.id}`
        : "/api/templates";
      const method = editingTemplate ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          subject: templateSubject.trim(),
          body: templateBody.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingTemplate ? "템플릿이 수정되었습니다." : "템플릿이 생성되었습니다.");
        handleCloseDialog();
        await loadTemplates();
      } else {
        toast.error(data.error || "템플릿 저장 실패");
      }
    } catch (error: any) {
      console.error("Failed to save template:", error);
      toast.error(error.message || "템플릿 저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("정말 이 템플릿을 삭제하시겠습니까?")) return;
    
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("템플릿이 삭제되었습니다.");
        await loadTemplates();
      } else {
        toast.error("템플릿 삭제 실패");
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("템플릿 삭제 실패");
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-[#f7f7f5] p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">템플릿 관리</h1>
              <p className="mt-2 text-gray-600">
                원클릭 회신에 사용할 이메일 템플릿을 관리합니다
              </p>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              새 템플릿 만들기
            </Button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  템플릿을 불러오는 중...
                </CardContent>
              </Card>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  템플릿이 없습니다. 새 템플릿을 만들어보세요.
                </CardContent>
              </Card>
            ) : (
              templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{template.name}</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(template)}
                          title="수정"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-600">제목:</span>
                        <p className="mt-1 text-sm">{template.subject}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">본문:</span>
                        <p className="mt-1 text-sm whitespace-pre-wrap text-gray-700">
                          {template.body}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="!max-w-[50vw] w-[50vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "템플릿 수정" : "새 템플릿 만들기"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">템플릿 이름</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="예: 협찬 수락 템플릿"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">제목</label>
              <Input
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
                placeholder="예: Re: 협찬 제안에 대한 답변"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">본문</label>
              <Textarea
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                placeholder="이메일 본문을 입력하세요..."
                rows={10}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCloseDialog}>
                취소
              </Button>
              <Button onClick={handleSaveTemplate} disabled={saving}>
                {saving ? "저장 중..." : editingTemplate ? "수정" : "생성"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

