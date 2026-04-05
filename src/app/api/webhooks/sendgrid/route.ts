/**
 * POST /api/webhooks/sendgrid
 *
 * SendGrid Event Webhook receiver.
 * Verifies the ECDSA signature when SENDGRID_WEBHOOK_VERIFICATION_KEY is set,
 * and records delivery events (delivered, open, click, bounce, spamreport,
 * unsubscribe, etc.) into mail_logs via Supabase.
 *
 * Signature verification:
 *   Set SENDGRID_WEBHOOK_VERIFICATION_KEY to the public key from
 *   SendGrid → Settings → Mail Settings → Event Webhook → Signature Verification.
 *   Without this key, verification is skipped (useful for local dev / staging).
 *
 * SendGrid docs: https://docs.sendgrid.com/for-developers/tracking-events/event
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, createVerify } from 'crypto'
import type { SendGridWebhookEvent } from '@/types/api'
import { createServiceClient } from '@/lib/supabase/service'

// ── Signature verification ────────────────────────────────────────────────────

/**
 * Verifies the SendGrid ECDSA-SHA256 webhook signature.
 * Returns true if verification passes or if no key is configured.
 *
 * SendGrid signs the (raw body + timestamp) with their ECDSA private key.
 * The public key can be obtained from the SendGrid dashboard.
 *
 * Header reference:
 *   X-Twilio-Email-Event-Webhook-Signature — base64 ECDSA signature
 *   X-Twilio-Email-Event-Webhook-Timestamp — unix timestamp as string
 */
function verifySignature(req: NextRequest, rawBody: string): boolean {
  const pubKey    = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY
  if (!pubKey) return true  // no key configured — skip (dev/staging)

  const signature = req.headers.get('x-twilio-email-event-webhook-signature')
  const timestamp = req.headers.get('x-twilio-email-event-webhook-timestamp')

  if (!signature || !timestamp) {
    console.warn('[sendgrid-webhook] Missing signature headers — rejecting request')
    return false
  }

  try {
    // SendGrid signs: timestamp + rawBody
    const payload = timestamp + rawBody

    const verify = createVerify('SHA256')
    verify.update(payload)
    return verify.verify(
      { key: pubKey, format: 'pem' },
      signature,
      'base64',
    )
  } catch (err) {
    console.error('[sendgrid-webhook] Signature verification error:', err)
    return false
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Read raw body first (needed for signature verification)
  const rawBody = await req.text()

  // Verify signature before processing
  if (!verifySignature(req, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let events: SendGridWebhookEvent[]

  try {
    events = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(events)) {
    return NextResponse.json({ error: 'Expected array of events' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const results  = await Promise.allSettled(events.map(evt => handleEvent(supabase, evt)))

  const failed = results.filter(r => r.status === 'rejected').length
  if (failed > 0) {
    console.error(`[sendgrid-webhook] ${failed}/${events.length} events failed`)
  }

  // Always return 200 — SendGrid retries on non-2xx
  return NextResponse.json({ received: events.length, failed })
}

// ── Event handler ─────────────────────────────────────────────────────────────

async function handleEvent(
  supabase: ReturnType<typeof createServiceClient>,
  evt: SendGridWebhookEvent,
): Promise<void> {
  const msgId = evt.sg_message_id?.split('.')[0]  // strip pool suffix
  if (!msgId) return

  const update: Record<string, unknown> = {}

  switch (evt.event) {
    case 'delivered':
      update.status    = 'sent'
      update.sent_at   = new Date(evt.timestamp * 1000).toISOString()
      break
    case 'open':
      update.opened_at = new Date(evt.timestamp * 1000).toISOString()
      break
    case 'click':
      update.clicked_at = new Date(evt.timestamp * 1000).toISOString()
      break
    case 'bounce':
    case 'dropped':
      update.status        = 'failed'
      update.error_message = evt.reason ?? evt.event
      break
    case 'spamreport':
    case 'unsubscribe':
    case 'group_unsubscribe':
      // Handled by the unsubscribe flow — no mail_log change needed here
      break
    default:
      return
  }

  if (Object.keys(update).length === 0) return

  await supabase
    .from('mail_logs')
    .update(update)
    .eq('external_message_id', msgId)
}
