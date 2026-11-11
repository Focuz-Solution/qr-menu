"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Image on top of a muted box. If the file is missing (not uploaded yet),
// the image hides and `fallback` shows instead of a broken-image icon.
export function Img({
  src,
  alt,
  sizes,
  className,
  fallback,
  priority,
  contain,
  onLoad,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  fallback?: React.ReactNode;
  priority?: boolean;
  /** show the whole photo (letterboxed) instead of cropping it to fill the box */
  contain?: boolean;
  /** called with the loaded <img>, e.g. to read its natural size */
  onLoad?: (img: HTMLImageElement) => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  // one state per src: swapping the photo (carousel, variant) shows its skeleton again
  const [loaded, setLoaded] = useState<string | null>(null);

  // no photo yet (uploads come in P4): only the muted box + fallback icon
  if (!src) return <div className={cn("relative overflow-hidden bg-muted", className)}>{fallback}</div>;

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {fallback}
      {/* skeleton: pulses *behind* the photo (never on top), so a photo is never hidden by it */}
      {loaded !== src && failed !== src && (
        <div className="absolute inset-0 animate-pulse bg-linear-to-br from-muted via-secondary/40 to-muted" aria-hidden />
      )}
      {failed !== src && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={contain ? "object-contain" : "object-cover"}
          // a cached photo can finish before React hydrates, so onLoad never fires — catch it here
          ref={(el) => {
            if (el?.complete) setLoaded(src);
          }}
          onError={() => setFailed(src)}
          onLoad={(e) => {
            setLoaded(src);
            onLoad?.(e.currentTarget);
          }}
        />
      )}
    </div>
  );
}
