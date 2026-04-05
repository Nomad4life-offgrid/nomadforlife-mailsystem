'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { findUnsubscribeEvent, processUnsubscribe } from '@/lib/unsubscribe/process'

const VALID_REASONS = [
  'Too many emails',
  'Content not relevant',
  'Did not subscribe',
  'Other',
] as const

export async function confirmUnsubscribe(token: string, formData: FormData) {
  if (!token) redirect('/unsubscribe/invalid')

  const supabase = createServiceClient()
  const event    = await findUnsubscribeEvent(supabase, token)

  if (!event) redirect('/unsubscribe/invalid')

  if (event.used_at) redirect(`/unsubscribe/${token}/done`)

  // Collect request context for logging
  const reqHeaders  = await headers()
  const forwarded   = reqHeaders.get('x-forwarded-for')
  const ip          = forwarded ? forwarded.split(',')[0].trim() : (reqHeaders.get('x-real-ip') ?? undefined)
  const userAgent   = reqHeaders.get('user-agent') ?? undefined

  const rawReason = (formData.get('reason') as string | null)?.trim() || undefined
  const reason    = rawReason && (VALID_REASONS as readonly string[]).includes(rawReason)
    ? rawReason
    : undefined

  await processUnsubscribe(supabase, event, { ip, userAgent, reason })

  redirect(`/unsubscribe/${token}/done`)
}
