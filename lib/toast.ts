"use client";

import { ToastProps } from "@/components/ui/toast";

type ToastOptions = Omit<ToastProps, "id">;

class ToastManager {
  private toasts: ToastProps[] = [];
  private listeners: Set<(toasts: ToastProps[]) => void> = new Set();
  private idCounter = 0;

  subscribe(listener: (toasts: ToastProps[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  private static readonly MAX_TOASTS = 3;

  show(options: ToastOptions) {
    const id = `toast-${++this.idCounter}`;
    const toast: ToastProps = { ...options, id };
    this.toasts.push(toast);
    if (this.toasts.length > ToastManager.MAX_TOASTS) {
      this.toasts = this.toasts.slice(-ToastManager.MAX_TOASTS);
    }
    this.notify();
    return id;
  }

  remove(id: string) {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
    this.notify();
  }

  success(title: string, description?: string) {
    return this.show({ title, description, variant: "success" });
  }

  error(title: string, description?: string) {
    return this.show({ title, description, variant: "error" });
  }

  warning(title: string, description?: string) {
    return this.show({ title, description, variant: "warning" });
  }

  info(title: string, description?: string) {
    return this.show({ title, description, variant: "default" });
  }

  getToasts() {
    return [...this.toasts];
  }
}

export const toast = new ToastManager();

