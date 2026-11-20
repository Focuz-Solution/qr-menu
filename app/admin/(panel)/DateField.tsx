"use client";

import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { enUS, km } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Values are "YYYY-MM-DD" strings (what the server reads in ?from=…&to=…); always shown as dd/mm/yyyy,
// whatever language the computer uses (the browser's own date box follows the computer: mm/dd/yyyy in the US).
const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (v?: string) => (v ? new Date(`${v}T00:00:00`) : undefined);
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const show = (v: string) => v.split("-").reverse().join("/");

/** a day picker: a small pill showing dd/mm/yyyy that opens a calendar; `min` / `max` grey out days outside them */
export function DateField({ value, onChange, label, min, max }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: string;
  max?: string;
}) {
  const t = useTranslations("admin.orders");
  const lang = useLocale();
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={value ? `${label}: ${show(value)}` : label}
          className="flex h-8 items-center gap-2 rounded-4xl border border-input bg-input/30 px-3 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className={cn(!value && "text-muted-foreground")}>{value ? show(value) : t("datePlaceholder")}</span>
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(toValue(d));
            setOpen(false);
          }}
          disabled={[...(min ? [{ before: toDate(min)! }] : []), ...(max ? [{ after: toDate(max)! }] : [])]}
          locale={lang === "en" ? enUS : km}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  );
}
