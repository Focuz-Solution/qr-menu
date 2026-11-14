// Product description written in the Admin editor (TipTap): headings, lists, bold/italic/underline/strike, alignment.
// Saved as TipTap JSON in the `description` text column; old descriptions are plain text and still work.
// Only what's listed here is kept (cleanRich), and the shop draws it with React — never as raw HTML.

export type Align = "left" | "center" | "right";
export type Mark = "bold" | "italic" | "underline" | "strike";
export type RichInline = { type: "text"; text: string; marks?: { type: Mark }[] } | { type: "hardBreak" };
export type RichBlock =
  | { type: "paragraph"; attrs?: { textAlign?: Align }; content?: RichInline[] }
  | { type: "heading"; attrs: { level: 2 | 3; textAlign?: Align }; content?: RichInline[] }
  | { type: "bulletList"; content: RichListItem[] }
  | { type: "orderedList"; content: RichListItem[] };
export type RichListItem = { type: "listItem"; content: RichBlock[] };
export type RichDoc = { type: "doc"; content: RichBlock[] };

const ALIGNS: Align[] = ["left", "center", "right"];
const MARKS: Mark[] = ["bold", "italic", "underline", "strike"];

// what JSON.parse gives us: anything; read fields defensively
type Raw = { type?: unknown; text?: unknown; attrs?: { textAlign?: unknown; level?: unknown }; marks?: unknown; content?: unknown };
const list = (v: unknown, max = 500) => (Array.isArray(v) ? (v.slice(0, max) as Raw[]) : []);

function cleanInline(nodes: unknown): RichInline[] {
  return list(nodes, 2000).flatMap((n): RichInline[] => {
    if (n?.type === "hardBreak") return [{ type: "hardBreak" }];
    if (n?.type !== "text" || typeof n.text !== "string" || !n.text) return [];
    const marks = MARKS.filter((m) => list(n.marks, 10).some((x) => x?.type === m)).map((type) => ({ type }));
    return [marks.length ? { type: "text", text: n.text, marks } : { type: "text", text: n.text }];
  });
}

function cleanBlocks(nodes: unknown, depth = 0): RichBlock[] {
  return list(nodes).flatMap((b): RichBlock[] => {
    const align = ALIGNS.find((a) => a !== "left" && a === b?.attrs?.textAlign);
    const inline = cleanInline(b?.content);
    const content = inline.length ? { content: inline } : {};
    if (b?.type === "paragraph") return [{ type: "paragraph", ...(align && { attrs: { textAlign: align } }), ...content }];
    if (b?.type === "heading") {
      const level = b.attrs?.level === 3 ? 3 : 2;
      return [{ type: "heading", attrs: { level, ...(align && { textAlign: align }) }, ...content }];
    }
    // lists nest at most 3 deep
    if ((b?.type === "bulletList" || b?.type === "orderedList") && depth < 3) {
      const items = list(b.content)
        .filter((i) => i?.type === "listItem")
        .map((i): RichListItem => ({ type: "listItem", content: cleanBlocks(i.content, depth + 1) }));
      return items.length ? [b.type === "bulletList" ? { type: "bulletList", content: items } : { type: "orderedList", content: items }] : [];
    }
    return [];
  });
}

/** keeps only the nodes/marks above; anything else is dropped */
export function cleanRich(value: unknown): RichDoc | null {
  const doc = value as Raw;
  if (!doc || doc.type !== "doc" || !Array.isArray(doc.content)) return null;
  return { type: "doc", content: cleanBlocks(doc.content) };
}

/** the saved description → a clean document, or null when it is old plain text */
export function parseRich(saved: string): RichDoc | null {
  if (!saved.startsWith('{"type":"doc"')) return null;
  try {
    return cleanRich(JSON.parse(saved));
  } catch {
    return null;
  }
}

/** plain text → one paragraph per line (opens old descriptions in the editor) */
export const textToRich = (text: string): RichDoc => ({
  type: "doc",
  content: text.split("\n").map((line) => ({ type: "paragraph", ...(line && { content: [{ type: "text", text: line }] }) })),
});

/** just the words, one line per paragraph / heading / list item (link previews, "is it empty?") */
function blocksText(blocks: RichBlock[]): string[] {
  return blocks.flatMap((b) =>
    b.type === "bulletList" || b.type === "orderedList"
      ? b.content.flatMap((i) => blocksText(i.content))
      : [(b.content ?? []).map((n) => (n.type === "text" ? n.text : " ")).join("")],
  );
}
export function richToText(saved: string) {
  const doc = parseRich(saved);
  return doc ? blocksText(doc.content).join("\n") : saved;
}
export const richHasText = (doc: RichDoc) => blocksText(doc.content).some((line) => line.trim());
