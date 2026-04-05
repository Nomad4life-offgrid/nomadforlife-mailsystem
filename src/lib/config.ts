/**
 * Central configuration — all env vars read and validated here.
 * Import from this module instead of reading process.env directly.
 *
 * Throws at module load time if a required variable is missing,
 * so misconfigured deployments fail loudly at startup.
 */

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

// ── SendGrid ──────────────────────────────────────────────────────────────────

export const sendgrid = {
  apiKey:    required('SENDGRID_API_KEY'),
  fromEmail: required('DEFAULT_FROM_EMAIL'),
  fromName:  optional('DEFAULT_FROM_NAME', 'Nomad For Life'),
} as const

// ── Supabase ──────────────────────────────────────────────────────────────────

export const supabase = {
  url:            required('NEXT_PUBLIC_SUPABASE_URL'),
  anonKey:        required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
} as const

// ── Application ───────────────────────────────────────────────────────────────

export const app = {
  url:             required('NEXT_PUBLIC_APP_URL'),
  internalSecret:  required('INTERNAL_API_SECRET'),
} as const

// ── Queue ─────────────────────────────────────────────────────────────────────

export const queue = {
  batchSize:  Number(optional('QUEUE_BATCH_SIZE',  '100')),
  maxRetries: Number(optional('QUEUE_MAX_RETRIES', '3')),
} as const

// ── Convenience re-export ─────────────────────────────────────────────────────

const config = { sendgrid, supabase, app, queue } as const
export default config
