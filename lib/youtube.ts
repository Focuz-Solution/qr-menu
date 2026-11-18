/**
 * The 11-character video id from what the admin pastes: a watch / youtu.be / shorts / embed / live link, or the id itself.
 * null when it isn't a YouTube video. Only the id is saved; the shop builds the embed address from it.
 */
export function youtubeId(input: string): string | null {
  const v = input.trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  const id =
    host === "youtu.be" ? url.pathname.split("/")[1]
    : host === "youtube.com" || host === "youtube-nocookie.com"
      ? url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1]
      : undefined;
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
