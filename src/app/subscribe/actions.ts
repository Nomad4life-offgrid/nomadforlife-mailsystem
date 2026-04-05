'use server'

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email/sendgrid'
import { logConsent } from '@/lib/consent/log'

export async function subscribePublic(formData: FormData) {
  const email      = (formData.get('email') as string).trim().toLowerCase()
  const first_name = (formData.get('first_name') as string | null)?.trim() || null
  const last_name  = (formData.get('last_name')  as string | null)?.trim() || null
  const campaignId = (formData.get('campaign_id') as string | null) || null

  if (!email) throw new Error('Email is required.')

  const supabase = createServiceClient()

  // Upsert contact — keep existing data if already present
  const { data: contact, error: upsertErr } = await supabase
    .from('contacts')
    .upsert(
      { email, first_name, last_name },
      { onConflict: 'email', ignoreDuplicates: false }
    )
    .select('id, email, first_name, status, opted_in')
    .single()

  if (upsertErr || !contact) throw new Error(upsertErr?.message ?? 'Could not save contact.')

  // Already active — no need to send a new confirmation
  if (contact.status === 'active' && contact.opted_in) {
    redirect('/subscribe/confirmed')
  }

  // Opted out globally — do not re-subscribe without explicit action
  if (contact.status === 'opted_out') {
    redirect('/subscribe/opted-out')
  }

  // Create a double opt-in token
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('opt_in_tokens')
    .insert({ contact_id: contact.id, campaign_id: campaignId })
    .select('token')
    .single()

  if (tokenErr || !tokenRow) throw new Error('Could not create confirmation token.')

  // Consent audit: aanmelding ontvangen, bevestiging nog in afwachting
  await logConsent({
    supabase,
    contactId: contact.id,
    eventType: 'opt_in',
    channel:   'web',
    notes:     'Aanmelding via publiek formulier — dubbele bevestiging verstuurd',
    metadata:  campaignId ? { campaign_id: campaignId } : {},
  })

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const confirmUrl = `${appUrl}/optin/${tokenRow.token}`
  const firstName  = contact.first_name ?? 'there'

  // Send confirmation email directly (not via queue)
  await sendEmail({
    to:              contact.email,
    subject:         'Please confirm your subscription',
    html: `
      <p>Hi ${firstName},</p>
      <p>Click the button below to confirm your subscription.</p>
      <p style="margin:24px 0">
        <a href="${confirmUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Confirm subscription
        </a>
      </p>
      <p style="color:#71717a;font-size:13px">
        If you didn't request this, you can safely ignore this email.<br>
        This link expires after one use.
      </p>
    `.trim(),
    text:            `Hi ${firstName},\n\nConfirm your subscription by visiting:\n${confirmUrl}\n\nIf you didn't request this, ignore this email.`,
    from_email:      process.env.DEFAULT_FROM_EMAIL ?? '',
    from_name:       process.env.DEFAULT_FROM_NAME  ?? '',
    unsubscribe_url:      `${appUrl}/unsubscribe`,
    unsubscribe_post_url: `${appUrl}/api/unsubscribe`,
  })

  redirect('/subscribe/pending')
}
