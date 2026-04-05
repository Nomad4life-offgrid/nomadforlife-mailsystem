/**
 * Date helpers — pure functions, all inputs are ISO strings or Date objects.
 */

const NL_DATE = new Intl.DateTimeFormat('nl-NL', {
  day:   '2-digit',
  month: '2-digit',
  year:  'numeric',
})

const NL_DATETIME = new Intl.DateTimeFormat('nl-NL', {
  day:    '2-digit',
  month:  '2-digit',
  year:   'numeric',
  hour:   '2-digit',
  minute: '2-digit',
})

/** "dd-MM-yyyy" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return NL_DATE.format(new Date(iso))
}

/** "dd-MM-yyyy HH:mm" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return NL_DATETIME.format(new Date(iso))
}

/** Relative time: "2 uur geleden", "morgen", etc. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const abs  = Math.abs(diff)
  const sign = diff >= 0 ? -1 : 1  // negative = past

  const rtf = new Intl.RelativeTimeFormat('nl-NL', { numeric: 'auto' })

  if (abs < 60_000)           return rtf.format(sign * Math.round(abs / 1_000),        'second')
  if (abs < 3_600_000)        return rtf.format(sign * Math.round(abs / 60_000),        'minute')
  if (abs < 86_400_000)       return rtf.format(sign * Math.round(abs / 3_600_000),     'hour')
  if (abs < 30 * 86_400_000)  return rtf.format(sign * Math.round(abs / 86_400_000),    'day')
  if (abs < 365 * 86_400_000) return rtf.format(sign * Math.round(abs / 2_592_000_000 * 30), 'month')
  return rtf.format(sign * Math.round(abs / 31_536_000_000), 'year')
}

/** ISO string from a Date or string, or null. */
export function toIso(val: Date | string | null | undefined): string | null {
  if (!val) return null
  return new Date(val).toISOString()
}

/** Future ISO string: now + N hours */
export function inHours(n: number): string {
  return new Date(Date.now() + n * 3_600_000).toISOString()
}
