import { ShopArt } from "@/components/ShopArt";

/** 404 look: popping shop icon, small "404", title, one short helpful line, optional button under it */
export function NotFoundView({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <ShopArt />
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-semibold tracking-widest text-primary tabular-nums">404</p>
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="max-w-sm text-sm text-balance text-muted-foreground">{text}</p>
      </div>
      {children}
    </div>
  );
}
