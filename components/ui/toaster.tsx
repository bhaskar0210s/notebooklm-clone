"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton={false}
      toastOptions={{
        duration: 5000,
        style: {
          width: "fit-content",
          minWidth: "auto",
          maxWidth: "fit-content",
        },
      }}
    />
  );
}
