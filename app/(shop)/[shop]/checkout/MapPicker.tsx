"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LMap } from "leaflet";
import { MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LatLng = { lat: number; lng: number };
const START: LatLng = { lat: 11.5564, lng: 104.9282 }; // Phnom Penh

/** the picked spot is saved as a Google Maps link (same `mapUrl` field the admin + Telegram already open) */
export const mapLink = (p: LatLng) => `https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/**
 * OpenStreetMap with a pin fixed in the middle: the customer drags/zooms the map (or taps a spot) and the spot under
 * the pin is the location. "" = nothing picked yet (grey pin). `goTo`: the phone's location from checkout's
 * "Use my location" button (next to the province) — the map flies there and that spot becomes the pin.
 */
export function MapPicker({ value, onChange, goTo }: { value: string; onChange: (url: string) => void; goTo?: LatLng | null }) {
  const t = useTranslations("checkout");
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap>(null);
  // a location that arrived before the map finished loading (applied once it has)
  const pending = useRef<LatLng | null>(null);
  // latest onChange without re-creating the map
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let off = false;
    import("leaflet").then((L) => {
      if (off || !box.current) return;
      // ponytail: one-finger drag pans the map on phones; add a two-finger gesture plugin if people get stuck scrolling
      const m = L.map(box.current, { scrollWheelZoom: false }).setView(START, 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      // added after the first setView, so only the customer's moves count
      m.on("moveend", () => onChangeRef.current(mapLink(m.getCenter())));
      m.on("click", (e) => m.panTo(e.latlng));
      map.current = m;
      if (pending.current) m.setView(pending.current, 17);
    });
    return () => {
      off = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // checkout found the phone's location: fly there (→ moveend saves it as the pin)
  useEffect(() => {
    if (!goTo) return;
    pending.current = goTo;
    map.current?.setView(goTo, 17);
  }, [goTo]);

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onChange("")}>
          <X aria-hidden />
          {t("removePin")}
        </Button>
      )}
      {/* isolate: Leaflet's own z-index stays under the header and popovers */}
      <div className="relative isolate h-64 overflow-hidden rounded-xl border bg-muted">
        <div ref={box} role="application" aria-label={t("mapUrl")} className="size-full" />
        {/* the pin: its tip is the map centre; grey until a spot is picked */}
        <MapPin
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 z-[500] size-10 -translate-x-1/2 -translate-y-full fill-current stroke-white drop-shadow-md",
            value ? "text-primary" : "text-muted-foreground",
          )}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t("mapHint")}</p>
    </div>
  );
}
