'use server'

import { requireAdmin }    from '@/lib/auth/guards'
import { createClient }    from '@/lib/supabase/server'
import { sendTestEmail }   from '@/lib/mail/test-mail'
import { sendgrid, app }   from '@/lib/config'
import { getScenario }     from '@/lib/email/test-scenarios'

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
  const subject     = (formData.get('subject')      as string)?.trim() || null
  const scenarioId  = (formData.get('scenario')     as string)?.trim() || null
  const bedrijf     = (formData.get('bedrijfsnaam') as string)?.trim() || null

  if (!toEmail)    return { ok: false, error: 'Vul een ontvanger in.' }
  if (!templateId) return { ok: false, error: 'Kies een template.' }

  const supabase = await createClient()
  const scenario = getScenario(scenarioId)

  // Bouw custom_fields: scenario als basis, daarna handmatige bedrijfsnaam-override
  let customFields: Record<string, unknown> | null = scenario?.customFields ?? null
  if (bedrijf) {
    customFields = {
      ...(customFields ?? {}),
      bedrijfsnaam: bedrijf,
      aanhef:       `Hallo ${bedrijf},`,
    }
  }

  const result = await sendTestEmail({
    supabase,
    templateId,
    toEmail,
    fromEmail: sendgrid.fromEmail,
    fromName:  sendgrid.fromName,
    subject,
    appUrl:    app.url,
    customFields,
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true }
}
