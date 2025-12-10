"use client";

import { toast } from "sonner";

interface ToastOptions {
  duration?: number;
  [key: string]: unknown;
}

interface ToastMethods {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

export function useToast(): ToastMethods {
  const showToast: ToastMethods = {
    success: (message: string, options?: ToastOptions) => {
      toast.success(message, { ...options, icon: null });
    },
    error: (message: string, options?: ToastOptions) => {
      toast.error(message, { ...options, icon: null });
    },
    info: (message: string, options?: ToastOptions) => {
      toast.info(message, { ...options, icon: null });
    },
  };

  return showToast;
}
