import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }      from '@/lib/supabase/service'
import { processBatch }             from '@/lib/mail/processor'
import { planAllFunnelSteps }       from '@/lib/services/funnel'

/**
 * POST /api/internal/process-queue
 *
 * 1. Planfase: zet contacten die klaar zijn voor de volgende funnel-stap in de wachtrij.
 * 2. Verzendfase: verwerkt tot 100 pending mail_logs waarvan scheduled_at <= nu.
 *
 * Beschermd via INTERNAL_API_SECRET header (handmatig/lokaal) of
 * Authorization: Bearer CRON_SECRET (Vercel Cron).
 * Draait elke 5 minuten via vercel.json crons.
 *
 * Optionele body-parameters (JSON):
 *   campaignId  — verwerk alleen logs voor deze campagne
 *   stepId      — verwerk alleen logs voor deze stap
 *   limit       — maximum aantal logs (default 100, max 500)
 *
 * Response JSON:
 *   { queued, processed, sent, failed, skipped, campaignsCompleted }
 */
export async function POST(req: NextRequest) {
  // ── Authenticatie ─────────────────────────────────────────────────────────
  const internalSecret = req.headers.get('x-internal-secret')
  const cronSecret     = req.headers.get('authorization')?.replace('Bearer ', '')

  const validInternal = internalSecret && internalSecret === process.env.INTERNAL_API_SECRET
  const validCron     = cronSecret     && cronSecret     === process.env.CRON_SECRET

  if (!validInternal && !validCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Optionele filter-parameters ───────────────────────────────────────────
  const body       = await req.json().catch(() => ({})) as Record<string, unknown>
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId : undefined
  const stepId     = typeof body.stepId     === 'string' ? body.stepId     : undefined
  const limit      = typeof body.limit === 'number' ? Math.min(body.limit, 500) : undefined

  try {
    const supabase = createServiceClient()

    // ── Stap 1: funnel-planner (alleen bij globale run, niet bij gefilterde aanroep) ──
    let queued = 0
    if (!campaignId && !stepId) {
      const planResult = await planAllFunnelSteps(supabase)
      queued = planResult.queued
    }

    // ── Stap 2: wachtrij verwerken ────────────────────────────────────────────
    const result = await processBatch(supabase, { campaignId, stepId, limit })

    return NextResponse.json({ queued, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[process-queue] fout:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
