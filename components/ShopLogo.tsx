import Image from "next/image";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function ShopLogo({ src, alt, size, className, priority }: { src: string; alt: string; size: number; className?: string; priority?: boolean }) {
  if (src) return <Image src={src} alt={alt} width={size} height={size} priority={priority} className={cn("rounded-full", className)} />;
  return (
    <span
      role="img"
      aria-label={alt}
      className={cn("grid shrink-0 place-items-center rounded-full border bg-muted text-muted-foreground", className)}
      style={{ width: size, height: size }}
    >
      <Store className="size-[45%]" strokeWidth={1.75} aria-hidden />
    </span>
  );
}
