/**
 * POST /api/public/subscribe
 *
 * Publiek endpoint voor nieuwsbriefinschrijvingen vanaf externe websiteformulieren.
 * Geen authenticatie vereist — wel rate limiting per IP.
 *
 * Request body (JSON):
 *   email        string  — verplicht
 *   first_name   string  — optioneel
 *   last_name    string  — optioneel
 *   group_id     string  — optioneel UUID van contact_group om aan toe te voegen
 *   form_source  string  — optioneel tag (bijv. 'homepage_footer', 'campingpagina')
 *
 * Responses:
 *   201  { status: 'pending_confirmation'  }  — nieuw contact aangemaakt
 *   201  { status: 'restored'              }  — contact hersteld na verwijdering
 *   200  { status: 'confirmation_resent'   }  — bestaand pending contact, nieuw token
 *   200  { status: 'already_active'        }  — contact al actief
 *   200  { status: 'already_unsubscribed'  }  — contact heeft zich uitgeschreven
 *   422  { status: 'validation_error', errors: [...] }
 *   429  { status: 'rate_limited', retryAfterSeconds: number }
 *   500  { status: 'error', message: string }
 *
 * CORS:
 *   Extern gebruik via het OPTIONS pre-flight verzoek wordt ondersteund.
 *   Pas ALLOWED_ORIGIN aan in .env als je van een specifiek domein wilt filteren.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { checkRateLimit }            from '@/lib/utils/rate-limit'
import { validateSubscribeDTO }      from '@/lib/signup/validate'
import { processSubscribe }          from '@/lib/signup/process'

// Toegestaan CORS-origin. Standaard alles (*) — restrict via SUBSCRIBE_ALLOWED_ORIGIN.
const ALLOWED_ORIGIN = process.env.SUBSCRIBE_ALLOWED_ORIGIN ?? '*'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

// ── Pre-flight ────────────────────────────────────────────────────────────────
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

// ── Inschrijving verwerken ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const forwarded = req.headers.get('x-forwarded-for')
  const ip        = forwarded
    ? forwarded.split(',')[0].trim()
    : (req.headers.get('x-real-ip') ?? 'unknown')

  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    const retryAfterSeconds = Math.ceil(rl.retryAfterMs / 1000)
    return NextResponse.json(
      { status: 'rate_limited', retryAfterSeconds, message: 'Te veel verzoeken. Probeer het later opnieuw.' },
      { status: 429, headers: { ...corsHeaders(), 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  // ── Body parsen ────────────────────────────────────────────────────────────
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json(
      { status: 'validation_error', errors: [{ field: 'body', message: 'Ongeldige JSON.' }] },
      { status: 422, headers: corsHeaders() },
    )
  }

  // ── DTO-validatie ──────────────────────────────────────────────────────────
  const { data: dto, errors } = validateSubscribeDTO(raw)
  if (!dto) {
    return NextResponse.json(
      { status: 'validation_error', errors },
      { status: 422, headers: corsHeaders() },
    )
  }

  // ── Verwerken ──────────────────────────────────────────────────────────────
  try {
    const supabase = createServiceClient()
    const userAgent = req.headers.get('user-agent') ?? undefined

    const result = await processSubscribe(supabase, dto, { ip, userAgent })

    console.log(`[subscribe] outcome:${result.outcome} contact:${result.contactId ?? '?'} ip:${ip}`)

    switch (result.outcome) {
      case 'created':
      case 'restored':
        return NextResponse.json(
          {
            status:  'pending_confirmation',
            message: 'Bedankt voor je aanmelding. Controleer je inbox voor de bevestigingsmail.',
          },
          { status: 201, headers: corsHeaders() },
        )

      case 'confirmation_resent':
        return NextResponse.json(
          {
            status:  'confirmation_resent',
            message: 'Je aanmelding staat al open. We hebben een nieuwe bevestigingsmail gestuurd.',
          },
          { status: 200, headers: corsHeaders() },
        )

      case 'already_active':
        return NextResponse.json(
          {
            status:  'already_active',
            message: 'Dit e-mailadres is al aangemeld.',
          },
          { status: 200, headers: corsHeaders() },
        )

      case 'already_unsubscribed':
        return NextResponse.json(
          {
            status:  'already_unsubscribed',
            message: 'Dit e-mailadres heeft zich eerder uitgeschreven. Neem contact op om je opnieuw aan te melden.',
          },
          { status: 200, headers: corsHeaders() },
        )
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[subscribe] fout:', message)
    return NextResponse.json(
      { status: 'error', message: 'Er is een fout opgetreden. Probeer het later opnieuw.' },
      { status: 500, headers: corsHeaders() },
    )
  }
}
