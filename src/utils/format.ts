/**
 * Display formatters — pure functions, no side effects.
 */

/** Full name from nullable first/last parts. */
export function fullName(first: string | null, last: string | null, fallback = '—'): string {
  const parts = [first, last].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : fallback
}

/** Initials from first/last name (max 2 chars). */
export function initials(first: string | null, last: string | null): string {
  const f = first?.[0]?.toUpperCase() ?? ''
  const l = last?.[0]?.toUpperCase()  ?? ''
  return (f + l) || '?'
}

/** Human-readable file size. */
export function fileSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024)          return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Format a number with thousands separator (NL locale). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('nl-NL').format(n)
}

/** Format a percentage. */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}
