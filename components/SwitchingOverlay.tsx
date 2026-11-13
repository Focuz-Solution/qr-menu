"use client";

import { Loader2 } from "lucide-react";
/** full-page cover with a spinner + `text` while the page changes (another shop opens, the language switches) */
export function SwitchingOverlay({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-background px-8 py-6">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium">{text}</p>
      </div>
    </div>
  );
}
