'use server'

import { requireAdmin }    from '@/lib/auth/guards'
import { createClient }    from '@/lib/supabase/server'
import { sendTestEmail }   from '@/lib/mail/test-mail'
import { sendgrid, app }   from '@/lib/config'

export type TestMailResult =
  | { ok: true }
  | { ok: false; error: string }

export async function sendTestMail(
  _prev: TestMailResult | null,
  formData: FormData,
): Promise<TestMailResult> {
  await requireAdmin()

  const toEmail    = (formData.get('to_email')    as string)?.trim()
  const templateId = (formData.get('template_id') as string)?.trim()
  const subject    = (formData.get('subject')     as string)?.trim() || null

  if (!toEmail)    return { ok: false, error: 'Vul een ontvanger in.' }
  if (!templateId) return { ok: false, error: 'Kies een template.' }

  const supabase = await createClient()

  const result = await sendTestEmail({
    supabase,
    templateId,
    toEmail,
    fromEmail: sendgrid.fromEmail,
    fromName:  sendgrid.fromName,
    subject,
    appUrl:    app.url,
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true }
}
