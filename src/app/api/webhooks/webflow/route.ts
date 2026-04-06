/**
 * POST /api/webhooks/webflow
 *
 * Ontvangt Webflow form-submission webhooks en schrijft de bezoeker
 * in op de Nieuwsbrief-groep via de bestaande double opt-in flow.
 *
 * Beveiliging:
 *   Stel WEBFLOW_WEBHOOK_SECRET in als omgevingsvariabele en voeg
 *   `?secret=<waarde>` toe aan de webhook-URL in Webflow.
 *   Zonder ingesteld secret logt de handler een waarschuwing maar
 *   weigert het verzoek NIET — handig tijdens eerste setup.
 *
 * Verwacht Webflow-payload (form submission):
 *   {
 *     "name": "Formuliernaam",
 *     "data": {
 *       "email":      "jan@example.com",   // of "Email"
 *       "name":       "Jan",               // of "first_name" / "Name"
 *       "last_name":  "Jansen"             // of "Last Name" / "lastName"
 *     },
 *     "site":    "...",
 *     "country": "NL"
 *   }
 *
 * Veldnamen in `data` zijn case-insensitief — het maakt niet uit hoe
 * het veld in Webflow heet (Email / email / E-mail werken allemaal).
 *
 * Responses:
 *   200  { status: 'ok', outcome: string }
 *   400  { status: 'error', message: string }
 *   401  { status: 'unauthorized' }
 *   422  { status: 'validation_error', errors: [...] }
 *   429  { status: 'rate_limited' }
 *   500  { status: 'error', message: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { checkRateLimit }            from '@/lib/utils/rate-limit'
import { validateSubscribeDTO }      from '@/lib/signup/validate'
import { processSubscribe }          from '@/lib/signup/process'
import { sendEmail }                 from '@/lib/email/sendgrid'

// Vaste UUID van de "Nieuwsbrief" contact_group (zie migratie 20260406000001).
const NEWSLETTER_GROUP_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

// ── Secretvalidatie ───────────────────────────────────────────────────────────

function validateSecret(req: NextRequest): boolean {
  const configured = process.env.WEBFLOW_WEBHOOK_SECRET
  if (!configured) {
    console.warn('[webflow-webhook] WEBFLOW_WEBHOOK_SECRET is niet ingesteld — verzoek niet geweigerd maar onveilig.')
    return true
  }
  const provided = req.nextUrl.searchParams.get('secret')
  return provided === configured
}

// ── Veld extraheren uit Webflow data-object ───────────────────────────────────

function getField(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  // Bouw een case-insensitieve index
  const lower: Record<string, string> = {}
  for (const k of Object.keys(data)) {
    lower[k.toLowerCase().replace(/[\s_-]+/g, '')] = k
  }

  for (const key of keys) {
    const normalized = key.toLowerCase().replace(/[\s_-]+/g, '')
    const original   = lower[normalized]
    if (original !== undefined) {
      const val = data[original]
      if (typeof val === 'string' && val.trim()) return val.trim()
    }
  }
  return undefined
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Secretvalidatie ────────────────────────────────────────────────────────
  if (!validateSecret(req)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }

  // ── Rate limiting (dezelfde limiet als /api/public/subscribe) ──────────────
  const forwarded = req.headers.get('x-forwarded-for')
  const ip        = forwarded
    ? forwarded.split(',')[0].trim()
    : (req.headers.get('x-real-ip') ?? 'unknown')

  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    const retryAfterSeconds = Math.ceil(rl.retryAfterMs / 1000)
    return NextResponse.json(
      { status: 'rate_limited', retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  // ── Body parsen ────────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Ongeldige JSON.' },
      { status: 400 },
    )
  }

  // Webflow stuurt twee mogelijke formaten:
  //   Legacy / "Send to": { name, data: { ... }, site, country }
  //   API v2 webhook:     { triggerType, payload: { name, data: { ... }, siteId, ... } }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { status: 'error', message: 'Onverwacht payload-formaat.' },
      { status: 400 },
    )
  }

  const root = body as Record<string, unknown>

  // Normaliseer naar { formName, formData }
  let formData: Record<string, unknown>
  let formName: string

  if (root.triggerType === 'form_submission' && typeof root.payload === 'object' && root.payload !== null) {
    // API v2 formaat
    const p = root.payload as Record<string, unknown>
    if (typeof p.data !== 'object' || p.data === null) {
      return NextResponse.json(
        { status: 'error', message: 'Onverwacht payload-formaat — data-object ontbreekt.' },
        { status: 400 },
      )
    }
    formData = p.data as Record<string, unknown>
    formName = typeof p.name === 'string' ? p.name : 'webflow_form'
  } else {
    // Legacy / "Send to" formaat
    if (typeof root.data !== 'object' || root.data === null) {
      return NextResponse.json(
        { status: 'error', message: 'Onverwacht payload-formaat — data-object ontbreekt.' },
        { status: 400 },
      )
    }
    formData = root.data as Record<string, unknown>
    formName = typeof root.name === 'string' ? root.name : 'webflow_form'
  }

  // ── Velden mappen ──────────────────────────────────────────────────────────
  const email      = getField(formData, 'email', 'e-mail', 'emailadres')
  const first_name = getField(formData, 'first_name', 'firstname', 'name', 'naam', 'voornaam')
  const last_name  = getField(formData, 'last_name', 'lastname', 'surname', 'achternaam')

  if (!email) {
    return NextResponse.json(
      { status: 'error', message: 'Geen e-mailadres gevonden in het formulier.' },
      { status: 400 },
    )
  }

  // ── DTO-validatie ──────────────────────────────────────────────────────────
  const { data: dto, errors } = validateSubscribeDTO({
    email,
    first_name,
    last_name,
    group_id:    NEWSLETTER_GROUP_ID,
    form_source: `webflow:${formName}`,
  })

  if (!dto) {
    return NextResponse.json(
      { status: 'validation_error', errors },
      { status: 422 },
    )
  }

  // ── Verwerken ──────────────────────────────────────────────────────────────
  try {
    const supabase  = createServiceClient()
    const userAgent = req.headers.get('user-agent') ?? undefined

    const result = await processSubscribe(supabase, dto, { ip, userAgent })

    // Stuur bevestigingsmail bij nieuwe inschrijving of herhaalverzoek
    if (
      result.token &&
      (result.outcome === 'created' || result.outcome === 'restored' || result.outcome === 'confirmation_resent')
    ) {
      const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const confirmUrl = `${appUrl}/optin/${result.token}`
      const firstName  = first_name ?? 'daar'

      await sendEmail({
        to:              dto.email,
        subject:         'Bevestig je inschrijving voor Nomad For Life',
        html: `
          <p>Hoi ${firstName},</p>
          <p>Klik op de knop hieronder om je inschrijving te bevestigen.</p>
          <p style="margin:24px 0">
            <a href="${confirmUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Inschrijving bevestigen
            </a>
          </p>
          <p style="color:#71717a;font-size:13px">
            Heb je je niet aangemeld? Dan kun je deze mail negeren.<br>
            Deze link werkt eenmalig.
          </p>
        `.trim(),
        text:            `Hoi ${firstName},\n\nBevestig je inschrijving via:\n${confirmUrl}\n\nHeb je je niet aangemeld? Negeer deze mail dan.`,
        from_email:      process.env.DEFAULT_FROM_EMAIL ?? '',
        from_name:       process.env.DEFAULT_FROM_NAME  ?? '',
        unsubscribe_url:      `${appUrl}/unsubscribe`,
        unsubscribe_post_url: `${appUrl}/api/unsubscribe`,
      }).catch(err => {
        console.error('[webflow-webhook] bevestigingsmail mislukt:', err instanceof Error ? err.message : err)
      })
    }

    console.log(
      `[webflow-webhook] outcome:${result.outcome} contact:${result.contactId ?? '?'} ` +
      `form:"${formName}" ip:${ip}`,
    )

    return NextResponse.json({ status: 'ok', outcome: result.outcome })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[webflow-webhook] fout:', message)
    return NextResponse.json(
      { status: 'error', message: 'Interne fout. Probeer het later opnieuw.' },
      { status: 500 },
    )
  }
}
