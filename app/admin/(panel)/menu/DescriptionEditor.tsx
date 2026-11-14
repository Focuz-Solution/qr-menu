"use client";

import TextAlign from "@tiptap/extension-text-align";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, FileText, Heading2, Heading3, Italic, List, ListOrdered, Redo2, RemoveFormatting,
  LayoutGrid, Smile, Strikethrough, Underline, Undo2, type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseRich, textToRich } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

// key = its text in admin.menu (button label)
type ToolKey =
  | "undo" | "redo" | "heading2" | "heading3" | "bold" | "italic" | "underline" | "strike"
  | "bulletList" | "orderedList" | "align_left" | "align_center" | "align_right" | "clearFormat";
type Tool = { key: ToolKey; icon: LucideIcon; active?: (e: Editor) => boolean; can?: (e: Editor) => boolean; run: (e: Editor) => void };

// toolbar groups (a thin line between groups); everything here is what lib/rich-text.ts keeps and the shop can show
const GROUPS: Tool[][] = [
  [
    { key: "undo", icon: Undo2, can: (e) => e.can().undo(), run: (e) => e.chain().focus().undo().run() },
    { key: "redo", icon: Redo2, can: (e) => e.can().redo(), run: (e) => e.chain().focus().redo().run() },
  ],
  [
    { key: "heading2", icon: Heading2, active: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "heading3", icon: Heading3, active: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  ],
  [
    { key: "bold", icon: Bold, active: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
    { key: "italic", icon: Italic, active: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
    { key: "underline", icon: Underline, active: (e) => e.isActive("underline"), run: (e) => e.chain().focus().toggleUnderline().run() },
    { key: "strike", icon: Strikethrough, active: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
  ],
  [
    { key: "bulletList", icon: List, active: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { key: "orderedList", icon: ListOrdered, active: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  ],
  (["left", "center", "right"] as const).map((a) => ({
    key: `align_${a}` as const,
    icon: { left: AlignLeft, center: AlignCenter, right: AlignRight }[a],
    // left = no alignment set
    active: (e: Editor) => (a === "left" ? !e.isActive({ textAlign: "center" }) && !e.isActive({ textAlign: "right" }) : e.isActive({ textAlign: a })),
    run: (e: Editor) => e.chain().focus().setTextAlign(a).run(),
  })),
  [{ key: "clearFormat", icon: RemoveFormatting, run: (e) => e.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run() }],
];
const TOOLS = GROUPS.flat();

// icons the admin can drop into the text, in groups (emoji = plain text: saved and shown like any letter)
const ICON_GROUPS = {
  beauty: "✨ 💄 💋 💅 🧴 🧼 🧽 🪞 🪮 💆‍♀️ 💇‍♀️ 🛁 🚿 🧖‍♀️ 💎 👑 👄 👁️ 👀 💁‍♀️ 🙋‍♀️ 👩 👧 🧑 🎀 👗 👜 👠 🕶️ 💍",
  nature: "🌸 🌺 🌹 🌷 🌻 🌼 💐 🪷 🌿 🍃 🌱 🍀 🌾 🌵 🌴 🍂 🌊 💧 💦 ❄️ ☀️ 🌤️ 🌈 🌙 ⭐ 🌟 💫 ⚡ 🔥 🫧",
  food: "🍋 🍊 🍓 🍒 🍑 🍎 🍉 🥭 🍍 🥥 🥑 🥒 🍇 🫐 🍯 🥛 🍵 ☕ 🧃 🍫 🍬 🌰 🫚 🧄",
  feelings: "❤️ 🧡 💛 💚 💙 💜 🤍 🖤 💖 💗 💕 💞 😍 🥰 😊 😘 🤩 😎 🥹 😇 🤗 🙏 👍 👌 👏 🙌 💪 🤝 ✌️ 🫶",
  shop: "💰 💵 💸 💲 🪙 💳 🤑 🎁 🛍️ 🛒 🚚 📦 🏷️ 🧾 📞 📱 💬 📩 📍 🏠 🏪 ⏰ 📅 🔔 📢 🎉 🎊 🥳 🏆 🥇",
  marks: "✅ ✔️ ☑️ ❌ ⭕ ⚠️ ❗ ❓ 💯 🆕 🆓 🆗 🔝 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔶 🔷 ▪️ ▫️ ◾ ◽",
  arrows: "👉 👈 👆 👇 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ 🔄 🔁 ▶️ ⏩ 📌 📍 🔗 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟",
} as const;
type IconGroup = keyof typeof ICON_GROUPS;
const GROUP_KEYS = Object.keys(ICON_GROUPS) as IconGroup[];
// tab icon for each group
const GROUP_TAB: Record<IconGroup, string> = { beauty: "💄", nature: "🌸", food: "🍋", feelings: "❤️", shop: "💰", marks: "✅", arrows: "👉" };

/** 😊 button: a grid of icons; the picked one goes in at the cursor */
function IconPicker({ label, disabled, onPick }: { label: string; disabled: boolean; onPick: (icon: string) => void }) {
  const t = useTranslations("admin.menu");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<IconGroup | "all">("all");
  const shown = filter === "all" ? GROUP_KEYS : [filter];
  return (
    // modal: the picker lives outside the product dialog, which blocks scrolling there; a modal popover lets its own panel scroll
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          title={label}
          className={cn(
            "relative flex size-10 items-center justify-center rounded-md text-muted-foreground outline-none after:absolute after:-inset-0.5 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
            open && "bg-muted text-foreground",
          )}
        >
          <Smile className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      {/* closing must not move focus to the 😊 button: the cursor stays in the text */}
      <PopoverContent align="end" className="w-auto p-2" onCloseAutoFocus={(e) => e.preventDefault()}>
        {/* category tabs: All + one per group (sample icon; name on hover / screen readers) */}
        <div role="tablist" aria-label={label} className="flex justify-between border-b pb-1.5">
          {(["all", ...GROUP_KEYS] as const).map((g) => {
            const name = g === "all" ? t("emoji_all") : t(`emoji_${g}`);
            return (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={filter === g}
                aria-label={name}
                title={name}
                onClick={() => setFilter(g)}
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-md text-lg outline-none after:absolute after:-inset-0.5 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  filter === g ? "bg-muted" : "opacity-60 hover:opacity-100",
                )}
              >
                {g === "all" ? <LayoutGrid className="size-4" aria-hidden /> : GROUP_TAB[g]}
              </button>
            );
          })}
        </div>
        {/* the chosen group(s), each with a small title; the panel scrolls */}
        <div className="max-h-72 overflow-y-auto overscroll-contain">
          {shown.map((group) => (
            <div key={group} role="group" aria-label={t(`emoji_${group}`)}>
              <p className="sticky top-0 z-10 bg-popover px-1 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground">{t(`emoji_${group}`)}</p>
              {/* tight grid like phone emoji keyboards: 36px cells, no gap */}
              <div className="grid grid-cols-9">
                {ICON_GROUPS[group].split(" ").map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => {
                      onPick(icon);
                      setOpen(false);
                    }}
                    className="flex size-9 items-center justify-center rounded-md text-xl outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type Props = { id: string; name: string; label: string; placeholder: string; defaultValue: string };

/** no description yet: one "＋ Add description" button; tapping it opens the editor (cursor inside). Has text: editor straight away. */
export function DescriptionEditor(props: Props) {
  const t = useTranslations("admin.menu");
  const [open, setOpen] = useState(!!props.defaultValue);
  if (open) return <RichEditor {...props} autofocus={!props.defaultValue} />;
  return (
    <button
      type="button"
      id={props.id} // the "Description" label above points here
      onClick={() => setOpen(true)}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-input/30 text-sm font-medium text-muted-foreground outline-none hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <FileText className="size-4" aria-hidden />
      {t("addDescription")}
    </button>
  );
}

/** description box with a full toolbar (undo, headings, bold/italic/underline/strike, lists, alignment, clear). Sends TipTap JSON as `name`. */
function RichEditor({ id, name, label, placeholder, defaultValue, autofocus }: Props & { autofocus: boolean }) {
  const t = useTranslations("admin.menu");
  const [value, setValue] = useState(defaultValue);
  const editor = useEditor({
    immediatelyRender: false, // server render + hydration (Next.js)
    autofocus: autofocus && "end", // opened with "Add description": start typing right away
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, blockquote: false, code: false, codeBlock: false, horizontalRule: false, link: false }),
      TextAlign.configure({ types: ["paragraph", "heading"], alignments: ["left", "center", "right"] }),
    ],
    content: parseRich(defaultValue) ?? textToRich(defaultValue),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        // same look as the shop (ProductView RichDescription)
        class: cn(
          "min-h-32 space-y-1 px-3 py-3 text-base outline-none md:text-sm",
          "[&_p]:min-h-[1lh] [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through",
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
        ),
      },
    },
    onUpdate: ({ editor }) => setValue(editor.isEmpty ? "" : JSON.stringify(editor.getJSON())),
  });
  // which buttons are on / usable follows the cursor
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        empty: e.isEmpty,
        ...Object.fromEntries(TOOLS.map((tool) => [tool.key, { on: tool.active?.(e) ?? false, can: tool.can?.(e) ?? true }])),
      },
  });

  return (
    // looks like the other text boxes: rounded border, ring on focus
    <div className="overflow-hidden rounded-xl border border-input bg-input/30 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {/* wraps to two rows on phones */}
      <div role="toolbar" aria-label={label} className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1">
        {GROUPS.map((group, g) => (
          <Fragment key={g}>
            {g > 0 && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
            {group.map(({ key, icon: Icon, active, run }) => {
              const s = state?.[key as keyof typeof state] as { on: boolean; can: boolean } | undefined;
              return (
                <button
                  key={key}
                  type="button"
                  // keep the text selection: don't move focus to the button on mouse down
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor && run(editor)}
                  disabled={!editor || s?.can === false}
                  aria-label={t(key)}
                  aria-pressed={active ? !!s?.on : undefined}
                  title={t(key)}
                  className={cn(
                    // 40px square + 2px invisible edge = 44px tap area
                    "relative flex size-10 items-center justify-center rounded-md text-muted-foreground outline-none after:absolute after:-inset-0.5 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
                    s?.on && "bg-muted text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              );
            })}
          </Fragment>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <IconPicker label={t("emoji")} disabled={!editor} onPick={(icon) => editor?.chain().focus().insertContent(icon).run()} />
      </div>
      <div className="relative">
        {state?.empty && (
          <span className="pointer-events-none absolute top-3 left-3 text-base text-muted-foreground md:text-sm" aria-hidden>
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
