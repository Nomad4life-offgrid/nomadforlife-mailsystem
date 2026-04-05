/**
 * API request / response types.
 * Used by Route Handlers (/api/*) and server actions where typed responses matter.
 */

// ── Generic response envelope ─────────────────────────────────────────────────

export type ApiSuccess<T = void> = T extends void
  ? { ok: true }
  : { ok: true; data: T }

export type ApiError = {
  ok:      false
  error:   string
  code?:   string   // machine-readable: "DUPLICATE_EMAIL", "NOT_FOUND", etc.
  detail?: string   // extra context for debugging (never expose in prod UI)
}

export type ApiResponse<T = void> = ApiSuccess<T> | ApiError

// ── Process queue ─────────────────────────────────────────────────────────────

export type ProcessQueueResponse = {
  processed: number
  sent:      number
  failed:    number
  skipped:   number
}

// ── Unsubscribe (RFC 8058 one-click) ──────────────────────────────────────────

export type UnsubscribeApiResponse = {
  status: 'ok' | 'already_unsubscribed' | 'not_found' | 'global' | 'campaign'
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

/** SendGrid Inbound Parse / Event Webhook event types */
export type SendGridEventType =
  | 'delivered'
  | 'open'
  | 'click'
  | 'bounce'
  | 'dropped'
  | 'spamreport'
  | 'unsubscribe'
  | 'group_unsubscribe'
  | 'deferred'

export type SendGridWebhookEvent = {
  email:        string
  timestamp:    number
  event:        SendGridEventType
  sg_message_id: string
  useragent?:   string
  ip?:          string
  url?:         string           // bij click-events
  reason?:      string           // bij bounce/drop
  status?:      string           // bounce status code
  type?:        'bounce' | 'blocked'
  category?:    string | string[]
  [key: string]: unknown
}

// ── Pagination ────────────────────────────────────────────────────────────────

export type PaginationParams = {
  page:  number
  limit: number
}

export type PaginatedResponse<T> = {
  data:  T[]
  total: number
  page:  number
  limit: number
  pages: number
}

// ── Server Action results ─────────────────────────────────────────────────────
// Server actions redirect op succes — bij fout gooien ze een Error.
// Voor gevallen waar je expliciet een resultaat terug wilt:

export type ActionResult<T = void> =
  | { success: true;  data?: T }
  | { success: false; error: string }
