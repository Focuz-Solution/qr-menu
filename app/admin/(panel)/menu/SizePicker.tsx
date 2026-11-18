"use client";

import { ChevronDown, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ErrorCode } from "@/lib/result";
import { cn } from "@/lib/utils";
import { createSize } from "../sizes/actions";
import type { AdminSize } from "./types";

/** sizes of a product: search box on top, tick several; a name not in the list is added right here (also listed in Admin → Sizes) */
export function SizePicker({ id, sizes, value, onToggle, onCreated, invalid }: {
  id: string;
  sizes: AdminSize[];
  /** ticked size ids */
  value: string[];
  onToggle: (id: string, on: boolean) => void;
  onCreated: (size: AdminSize) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("admin.menu");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState<ErrorCode>();
  const [adding, start] = useTransition();
  const picked = sizes.filter((z) => value.includes(z.id));
  const name = q.trim();
  // "Add …" only for a new name (same name in another case = the existing size)
  const canAdd = !!name && !sizes.some((z) => z.name.toLowerCase() === name.toLowerCase());

  const add = () =>
    start(async () => {
      setError(undefined);
      const r = await createSize(name);
      if (!r.ok) return setError(r.fields?.name ?? r.error);
      onCreated(r.data!);
      onToggle(r.data!.id, true);
      setQ("");
    });

  return (
    // modal: the list scrolls with the mouse wheel inside the product dialog
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-invalid={invalid || undefined}
          className="flex h-11 w-full min-w-0 items-center justify-between gap-1.5 rounded-4xl border border-input bg-input/30 px-3 py-2 text-left text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20"
        >
          <span className={cn("truncate", !picked.length && "text-muted-foreground")}>
            {picked.length ? picked.map((z) => z.name).join(", ") : t("none")}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent id={`${id}-list`} align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-0">
        <Command>
          <CommandInput
            value={q}
            onValueChange={(v) => {
              setQ(v);
              setError(undefined);
            }}
            maxLength={40}
            placeholder={t("sizeSearch")}
            // Enter on a new name adds it (cmdk would otherwise pick the highlighted row)
            onKeyDown={(e) => {
              if (e.key === "Enter" && canAdd && !adding) {
                e.preventDefault();
                add();
              }
            }}
          />
          {/* gap under the search box; rows inset from the edges */}
          <CommandList className="max-h-64 p-1 pt-2">
            <CommandEmpty>{t("noSizes")}</CommandEmpty>
            {sizes.map((z) => {
              const on = value.includes(z.id);
              return (
                // stays open to tick several
                <CommandItem key={z.id} value={z.name} data-checked={on} onSelect={() => onToggle(z.id, !on)}>
                  {z.name}
                </CommandItem>
              );
            })}
            {canAdd && (
              <CommandItem forceMount value={`+${name}`} onSelect={add} disabled={adding} className="text-primary">
                {adding ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
                {t("addSize", { name })}
              </CommandItem>
            )}
          </CommandList>
          {error && <p role="alert" className="px-3 pb-2 text-xs text-destructive">{te(error)}</p>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
