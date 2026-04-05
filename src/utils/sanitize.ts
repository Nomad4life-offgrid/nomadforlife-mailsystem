/**
 * Input sanitizers — strip dangerous content before storing or rendering.
 */

/** Trim and collapse internal whitespace. */
export function cleanText(val: string): string {
  return val.trim().replace(/\s+/g, ' ')
}

/** Lowercase + trim — for email normalization. */
export function normalizeEmail(val: string): string {
  return val.trim().toLowerCase()
}

/** Strip HTML tags entirely — for generating plain-text previews. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Truncate a string with an ellipsis. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

/** Parse a comma/newline separated list of emails — deduped and lowercased. */
export function parseEmailList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,;]+/)
        .map(s => s.trim().toLowerCase())
        .filter(s => s.includes('@'))
    ),
  ]
}
