"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
  duration?: number;
  onClose?: () => void;
}

export function Toast({
  id,
  title,
  description,
  variant = "default",
  duration = 5000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // Wait for animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!isVisible) return null;

  const variantStyles = {
    default: "bg-white border-gray-200",
    success: "bg-green-50 border-green-200",
    error: "bg-red-50 border-red-200",
    warning: "bg-yellow-50 border-yellow-200",
  };

  const textStyles = {
    default: "text-gray-900",
    success: "text-green-900",
    error: "text-red-900",
    warning: "text-yellow-900",
  };

  return (
    <div
      className={cn(
        "min-w-[300px] max-w-[500px] rounded-lg border p-4 shadow-lg transition-all",
        variantStyles[variant],
        isVisible ? "animate-in slide-in-from-top-5" : "animate-out slide-out-to-top-5"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {title && (
            <div className={cn("font-semibold text-sm", textStyles[variant])}>
              {title}
            </div>
          )}
          {description && (
            <div className={cn("text-sm mt-1", textStyles[variant])}>
              {description}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose?.(), 300);
          }}
          className={cn(
            "flex-shrink-0 rounded-md p-1 hover:bg-black/5 transition-colors",
            textStyles[variant]
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }: { toasts: ToastProps[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

