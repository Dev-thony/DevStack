"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "border border-border bg-surface text-text-primary",
          description: "text-text-secondary",
        },
      }}
    />
  );
}
