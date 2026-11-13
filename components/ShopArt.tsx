import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

/** shop icon popping up on a loop (soft ring pulsing behind it) + a short line under it — login page, app.com/ (404) */
export function ShopArt({ text, small = false, className }: { text?: string; small?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", className)}>
      <span className={cn("relative grid place-items-center", small ? "size-16" : "size-28")} aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/15 [animation-duration:2.4s] motion-reduce:hidden" />
        <span className={cn("relative grid animate-pop place-items-center rounded-full bg-primary text-primary-foreground shadow-lg", small ? "size-14" : "size-24")}>
          <Store className={small ? "size-7" : "size-11"} strokeWidth={1.75} />
        </span>
      </span>
      {text && <p className={cn("max-w-xs text-balance text-muted-foreground", small ? "text-xs" : "text-sm")}>{text}</p>}
    </div>
  );
}
