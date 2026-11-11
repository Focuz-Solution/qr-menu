"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PROVINCES } from "@/lib/provinces";
import { pick } from "@/lib/shop";
import { cn } from "@/lib/utils";

// Phnom Penh first (most orders), then the rest in the usual order
const LIST = [...PROVINCES.filter((p) => p.code === "12"), ...PROVINCES.filter((p) => p.code !== "12")];

/** province with a search box (Khmer or English name) and a short scrolling list */
export function ProvincePicker({ id, value, onChange, invalid }: { id: string; value: string; onChange: (code: string) => void; invalid?: boolean }) {
  const t = useTranslations("checkout");
  const lang = useLocale();
  const [open, setOpen] = useState(false);
  const selected = PROVINCES.find((p) => p.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-required
          aria-invalid={invalid || undefined}
          className={cn(
            // same look as the other inputs
            "flex h-11 w-full items-center justify-between gap-2 rounded-4xl border border-input bg-input/30 px-3 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selected ? pick(selected, lang) : t("provincePlaceholder")}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent id={`${id}-list`} align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder={t("provinceSearch")} />
          <CommandList className="max-h-64">
            <CommandEmpty>{t("provinceNone")}</CommandEmpty>
            {LIST.map((p) => (
              <CommandItem
                key={p.code}
                // search matches both names
                value={`${p.km} ${p.en}`}
                data-checked={p.code === value}
                onSelect={() => {
                  onChange(p.code);
                  setOpen(false);
                }}
              >
                {pick(p, lang)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
