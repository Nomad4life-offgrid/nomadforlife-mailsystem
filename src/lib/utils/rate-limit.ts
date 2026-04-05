/**
 * Eenvoudige in-memory IP-gebaseerde rate limiter.
 *
 * Geschikt voor eerste versie van het publieke subscribe-endpoint.
 * Gebruik bij schaling een externe store (Redis, Upstash) als vervanger.
 *
 * Gedrag:
 *   - Max LIMIT verzoeken per IP per WINDOW_MS milliseconden
 *   - Teller reset automatisch na het verstrijken van het tijdvenster
 *   - Verouderde entries worden periodiek opgeschoond om geheugenlek te voorkomen
 */

const LIMIT     = 5
const WINDOW_MS = 10 * 60 * 1000 // 10 minuten

type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

// Schoon verouderde entries op maximaal elke 5 minuten
let lastCleanup = Date.now()
function maybeCleanup(now: number) {
  if (now - lastCleanup < 5 * 60 * 1000) return
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
  lastCleanup = now
}

export type RateLimitResult =
  | { allowed: true;  remaining: number }
  | { allowed: false; retryAfterMs: number }

/**
 * Controleert of de gegeven sleutel (IP-adres) het limiet heeft bereikt.
 * Elke aanroep telt als één verzoek.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now()
  maybeCleanup(now)

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: LIMIT - 1 }
  }

  if (entry.count >= LIMIT) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, remaining: LIMIT - entry.count }
}
