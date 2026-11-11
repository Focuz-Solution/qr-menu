"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// Set when a product card is tapped. Module state survives client navigation but
// resets on a full page load (e.g. opened from a QR code or a shared link).
let cameFromList = false;
export function markFromList() {
  cameFromList = true;
}

export function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 rounded-full bg-background hover:bg-background/90"
      aria-label={label}
      // back to the list keeps its search/filter + scroll; otherwise go to home
      onClick={() => (cameFromList ? router.back() : router.push("/"))}
    >
      <ArrowLeft className="size-4" aria-hidden />
    </Button>
  );
}
