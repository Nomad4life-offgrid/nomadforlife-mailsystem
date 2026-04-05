import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { findUnsubscribeEvent, processUnsubscribe } from '@/lib/unsubscribe/process'

/**
 * POST /api/unsubscribe/[token]
 *
 * RFC 8058 one-click unsubscribe endpoint.
 * Email clients that support List-Unsubscribe-Post call this automatically
 * when the user clicks "Unsubscribe" in their email client.
 *
 * Must return 2xx for the email client to register the unsubscribe.
 * No redirect — this is a machine-to-machine call.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token) {
    return NextResponse.json({ error: 'Token ontbreekt.' }, { status: 400 })
  }

  // RFC 8058 requires the body to contain "List-Unsubscribe=One-Click"
  const body = await req.text()
  if (!body.includes('List-Unsubscribe=One-Click')) {
    return NextResponse.json({ error: 'Ongeldige one-click payload.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const event    = await findUnsubscribeEvent(supabase, token)

  if (!event) {
    // Return 200 to prevent email clients from retrying with an invalid token
    return NextResponse.json({ status: 'not_found' }, { status: 200 })
  }

  if (event.used_at) {
    return NextResponse.json({ status: 'already_unsubscribed' }, { status: 200 })
  }

  // Collect context from request headers
  const forwarded = req.headers.get('x-forwarded-for')
  const ip        = forwarded ? forwarded.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? undefined)
  const userAgent = req.headers.get('user-agent') ?? undefined

  const result = await processUnsubscribe(supabase, event, {
    ip,
    userAgent,
    reason: 'One-click unsubscribe (RFC 8058)',
  })

  console.log(`[unsubscribe] one-click processed — outcome:${result.outcome} token:${token}`)

  return NextResponse.json({ status: result.outcome }, { status: 200 })
}
