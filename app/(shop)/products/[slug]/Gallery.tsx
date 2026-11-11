"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Expand, ImageOff, X, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Img } from "@/components/Img";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { thumbUrl } from "@/lib/shop";
import { cn } from "@/lib/utils";

// true on md+ screens (desktop layout), false on phones and during static render
const desktopQuery = "(min-width: 768px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(desktopQuery);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(desktopQuery).matches,
    () => false,
  );
}

// Phones: swipeable photo + dots. Desktop: vertical thumbnail column + photo that slides up/down.
// `focus` = image to jump to.
export function Gallery({
  images,
  alt,
  focus,
  onIndexChange,
  jump,
}: {
  images: string[];
  alt: string;
  focus?: string;
  /** current photo index, for the thumbnail strip shown next to the title (phones) */
  onIndexChange?: (i: number) => void;
  /** jump to a photo (new object each tap, so tapping the same thumbnail again still works) */
  jump?: { i: number };
}) {
  const t = useTranslations("product");
  // desktop slides up/down to match the vertical thumbnail column; phones swipe sideways
  const vertical = useIsDesktop();
  const listRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [viewing, setViewing] = useState(false);
  // shape (height / width) of each loaded photo; the box follows the photo on screen, so none looks zoomed in
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const ratio = Math.min(1.5, Math.max(0.75, ratios[current] ?? ratios[0] ?? 1)); // clamped; square until loaded

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
      onIndexChange?.(api.selectedScrollSnap());
    };
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onIndexChange]);

  useEffect(() => {
    const i = focus ? images.indexOf(focus) : -1;
    if (api && i >= 0) api.scrollTo(i);
  }, [api, focus, images]);

  useEffect(() => {
    if (api && jump) api.scrollTo(jump.i);
  }, [api, jump]);

  // desktop: keep the selected thumbnail in view inside the scrolling column (without scrolling the page)
  useEffect(() => {
    const list = listRef.current;
    const el = list?.children[current] as HTMLElement | undefined;
    if (list && el) list.scrollTo({ top: el.offsetTop - (list.clientHeight - el.clientHeight) / 2, behavior: "smooth" });
  }, [current]);

  const fallback = <ImageOff className="absolute inset-0 m-auto size-12 text-muted-foreground/40" aria-hidden />;
  const many = images.length > 1;

  return (
    <div className="relative md:flex md:gap-4">
      {/* desktop: vertical thumbnail column with up/down arrows */}
      {many && (
        // absolute column: as tall as the photo, thumbnails scroll inside it
        <div className="relative hidden w-20 shrink-0 md:block">
          <div className="absolute inset-0 flex flex-col items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-full"
              aria-label={t("prevPhoto")}
              onClick={() => api?.scrollPrev()}
              disabled={current === 0}
            >
              <ChevronUp className="size-5" aria-hidden />
            </Button>
            <div
              ref={listRef}
              className="relative flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`${i + 1} / ${images.length}`}
                  aria-current={i === current}
                  onClick={() => api?.scrollTo(i)}
                  className={cn(
                    "aspect-square w-full shrink-0 overflow-hidden rounded-lg border-2 bg-background transition-colors",
                    i === current ? "border-foreground" : "border-border hover:border-muted-foreground",
                  )}
                >
                  <Img src={thumbUrl(src)} alt="" sizes="80px" className="size-full bg-muted" />
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-full"
              aria-label={t("nextPhoto")}
              onClick={() => api?.scrollNext()}
              disabled={current === images.length - 1}
            >
              <ChevronDown className="size-5" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      <Carousel
        setApi={setApi}
        orientation={vertical ? "vertical" : "horizontal"}
        // lower duration = quicker, snappier settle after a swipe
        opts={{ duration: 20 }}
        // phones: full width; vertical (md) needs a fixed-height square viewport
        className="overflow-hidden md:aspect-square md:flex-1 md:self-start md:rounded-lg md:[&>[data-slot=carousel-content]]:h-full"
        style={{ "--photo-ratio": `1 / ${ratio}` } as React.CSSProperties}
      >
        <CarouselContent className="mt-0 ml-0 md:h-full">
          {images.map((src, i) => (
            <CarouselItem key={src} className="pt-0 pl-0 md:h-full">
              <Img
                src={src}
                alt={many ? `${alt} (${i + 1}/${images.length})` : alt}
                sizes="(min-width: 768px) 440px, 100vw"
                priority={i === 0}
                // fills the box (one look everywhere); the box takes the current photo's shape, so only photos
                // outside 3:4–2:3 get trimmed — the full-screen viewer always shows the whole photo
                className="aspect-(--photo-ratio) bg-background md:aspect-auto md:h-full"
                fallback={fallback}
                onLoad={(img) => setRatios((r) => ({ ...r, [i]: img.naturalHeight / img.naturalWidth }))}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* "view full" button: phones bottom-left above the white sheet; desktop bottom-right of the photo */}
      <button
        type="button"
        onClick={() => setViewing(true)}
        // small pill (24px); the invisible ::after ring grows the tap area to 44px
        className="absolute bottom-8 left-4 flex h-6 md:right-3 md:bottom-3 md:left-auto items-center gap-1 rounded-full bg-background/80 px-2.5 text-[11px] font-medium text-foreground shadow-md ring-1 ring-foreground/5 backdrop-blur-md after:absolute after:-inset-2.5 after:content-[''] hover:bg-background"
      >
        <Expand className="size-3 text-primary" strokeWidth={2} aria-hidden />
        {t("viewPhoto")}
      </button>
      {viewing && (
        <Lightbox
          images={images}
          alt={alt}
          start={current}
          onClose={(last) => {
            setViewing(false);
            api?.scrollTo(last, true); // gallery lands on the photo the viewer was showing
          }}
        />
      )}
    </div>
  );
}

// Full-screen photo viewer: swipe (or arrows on desktop) through every photo; ✕ or Esc closes
function Lightbox({
  images,
  alt,
  start,
  onClose,
}: {
  images: string[];
  alt: string;
  start: number;
  onClose: (last: number) => void;
}) {
  const t = useTranslations("product");
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(start);
  const [zoom, setZoom] = useState(1);
  const panRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
      setZoom(1); // new photo starts un-zoomed
    };
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // zoomed: dragging pans the photo instead of swiping (reInit keeps the current slide)
  useEffect(() => {
    api?.reInit({ watchDrag: zoom === 1 });
  }, [api, zoom]);

  // start each zoom level centred on the photo
  useEffect(() => {
    const el = panRef.current;
    if (el) el.scrollTo({ left: (el.scrollWidth - el.clientWidth) / 2, top: (el.scrollHeight - el.clientHeight) / 2 });
  }, [zoom]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(current)}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 block h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none bg-foreground p-0 text-background ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>

        <Carousel
          setApi={setApi}
          opts={{ startIndex: start, duration: 20 }}
          className="h-full [&>[data-slot=carousel-content]]:h-full"
        >
          <CarouselContent className="ml-0 h-full">
            {images.map((src, i) => (
              <CarouselItem key={src} className="h-full pl-0">
                {i === current && zoom > 1 ? (
                  // zoomed: photo box is zoom× the screen; native scrolling pans it
                  <div ref={panRef} className="size-full overflow-auto overscroll-contain">
                    <div className="relative" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
                      <Img src={src} alt={alt} sizes={`${zoom * 100}vw`} contain className="size-full bg-transparent" />
                    </div>
                  </div>
                ) : (
                  <Img
                    src={src}
                    alt={images.length > 1 ? `${alt} (${i + 1}/${images.length})` : alt}
                    sizes="100vw"
                    contain
                    className="size-full bg-transparent"
                  />
                )}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* top bar: counter + close */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-full bg-background/15 px-3 py-1.5 text-sm tabular-nums backdrop-blur-md" aria-hidden>
            <span className="font-semibold">{current + 1}</span>
            <span className="text-background/70"> / {images.length}</span>
          </span>
          <div className="flex items-center gap-2">
            {/* zoom steps 1× → 2× → 3× */}
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 1))}
              disabled={zoom === 1}
              aria-label={t("zoomOut")}
              className="grid size-11 place-items-center rounded-full bg-background/15 backdrop-blur-md hover:bg-background/25 disabled:opacity-30"
            >
              <ZoomOut className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 1))}
              disabled={zoom === 3}
              aria-label={t("zoomIn")}
              className="grid size-11 place-items-center rounded-full bg-background/15 backdrop-blur-md hover:bg-background/25 disabled:opacity-30"
            >
              <ZoomIn className="size-5" aria-hidden />
            </button>
          <DialogClose
            aria-label={t("close")}
            className="grid size-11 place-items-center rounded-full bg-background/15 backdrop-blur-md hover:bg-background/25"
          >
            <X className="size-5" aria-hidden />
          </DialogClose>
          </div>
        </div>

        {/* desktop: previous / next arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => api?.scrollPrev()}
              disabled={current === 0}
              aria-label={t("prevPhoto")}
              className="absolute top-1/2 left-4 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-background/15 backdrop-blur-md hover:bg-background/25 disabled:opacity-30 md:grid"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => api?.scrollNext()}
              disabled={current === images.length - 1}
              aria-label={t("nextPhoto")}
              className="absolute top-1/2 right-4 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-background/15 backdrop-blur-md hover:bg-background/25 disabled:opacity-30 md:grid"
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
