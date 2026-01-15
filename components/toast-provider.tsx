"use client";

import { useEffect, useState } from "react";
import { ToastContainer, ToastProps } from "@/components/ui/toast";
import { toast } from "@/lib/toast";

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToasts) => {
      setToasts(newToasts);
    });

    return unsubscribe;
  }, []);

  return <ToastContainer toasts={toasts} onRemove={(id) => toast.remove(id)} />;
}

