"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { EmailList } from "@/components/email-list";
import { EmailDetail } from "@/components/email-detail";
import { Button } from "@/components/ui/button";
import { Email, AnalysisDisplayField } from "@/types";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

export default function TrashPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [emptying, setEmptying] = useState(false);

  useEffect(() => {
    loadTrashedEmails();
  }, []);

  const loadTrashedEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/emails/trash");
      const data = await res.json();
      
      if (res.ok && data.success) {
        setEmails(data.emails || []);
      } else {
        toast.error(data.error || "휴지통 불러오기 실패");
      }
    } catch (error) {
      console.error("Failed to load trashed emails:", error);
      toast.error("휴지통 불러오기 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (emails.length === 0) {
      toast.info("휴지통이 이미 비어있습니다.");
      return;
    }

    if (!confirm(`정말로 휴지통의 모든 이메일(${emails.length}개)을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setEmptying(true);
    try {
      const res = await fetch("/api/emails/trash/empty", { method: "DELETE" });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success(data.message || `${data.deleted}개의 이메일이 영구 삭제되었습니다.`);
        setEmails([]);
        setSelectedEmail(null);
      } else {
        toast.error(data.error || "휴지통 비우기 실패");
      }
    } catch (error) {
      console.error("Failed to empty trash:", error);
      toast.error("휴지통 비우기 실패");
    } finally {
      setEmptying(false);
    }
  };

  const handleDelete = (emailId: string) => {
    setEmails(prev => prev.filter(email => email.id !== emailId));
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
    }
  };

  const handleRestore = (emailId: string) => {
    // Remove from trash list after restore
    handleDelete(emailId);
    // Reload trash list to ensure consistency
    loadTrashedEmails();
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">휴지통</h1>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleEmptyTrash}
                disabled={emptying || emails.length === 0}
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
              >
                {emptying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    비우는 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    휴지통 비우기
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Email List */}
          <div className="w-96 border-r overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Trash2 className="h-12 w-12 mb-4 text-gray-300" />
                <p className="text-sm">휴지통이 비어있습니다.</p>
              </div>
            ) : (
              <EmailList
                emails={emails}
                selectedEmailId={selectedEmail?.id}
                onSelectEmail={setSelectedEmail}
                displayFields={["product", "type", "requirements"]}
              />
            )}
          </div>

          {/* Email Detail */}
          <div className="flex-1 overflow-y-auto">
            {selectedEmail ? (
              <EmailDetail
                email={selectedEmail}
                onDelete={handleRestore}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p className="text-sm">이메일을 선택하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

