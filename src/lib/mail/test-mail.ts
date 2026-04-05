/**
 * Test-mail service — stuurt een voorbeeld-e-mail met sample-data.
 *
 * Geen mail_log record — test-mails worden niet getrackt.
 * Unsubscribe-link verwijst naar een ongeldige preview-URL zodat de link
 * zichtbaar is maar niets doet bij klikken.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail }          from '@/lib/email/sendgrid'
import { renderEmail, SAMPLE_VARS } from '@/lib/email/renderer'
import type { SendResult }    from '@/lib/email/sendgrid'

export type TestMailOptions = {
  supabase:    SupabaseClient
  templateId:  string
  toEmail:     string
  fromEmail:   string
  fromName:    string
  /** Override onderwerpregel — gebruikt template-onderwerp als weggelaten. */
  subject?:    string | null
  appUrl:      string
}

export async function sendTestEmail(opts: TestMailOptions): Promise<SendResult> {
  const { data: template } = await opts.supabase
    .from('templates')
    .select('subject, html_body, text_body')
    .eq('id', opts.templateId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!template) {
    return { ok: false, retryable: false, error: 'Template niet gevonden.' }
  }

  // Gebruik een niet-werkende preview-URL zodat de unsubscribe-link zichtbaar
  // maar niet functioneel is in testmails.
  const previewUnsubUrl = `${opts.appUrl}/unsubscribe/preview-not-real`

  const sampleContact = {
    first_name: SAMPLE_VARS.first_name,
    last_name:  SAMPLE_VARS.last_name,
    email:      opts.toEmail,
  }

  const { html, text } = renderEmail({
    htmlBody:       template.html_body,
    textBody:       template.text_body,
    contact:        sampleContact,
    campaignName:   SAMPLE_VARS.campaign_name,
    companyName:    SAMPLE_VARS.company_name,
    unsubscribeUrl: previewUnsubUrl,
  })

  // Subject: kies prioriteit en substitueer variabelen
  const rawSubject = opts.subject ?? template.subject
  const { html: renderedSubject } = renderEmail({
    htmlBody:       rawSubject,
    textBody:       null,
    contact:        sampleContact,
    campaignName:   SAMPLE_VARS.campaign_name,
    companyName:    SAMPLE_VARS.company_name,
    unsubscribeUrl: previewUnsubUrl,
    appendFooter:   false,
  })

  return sendEmail({
    to:                   opts.toEmail,
    subject:              `[TESTMAIL] ${renderedSubject}`,
    html,
    text,
    from_email:           opts.fromEmail,
    from_name:            opts.fromName,
    unsubscribe_url:      previewUnsubUrl,
    unsubscribe_post_url: previewUnsubUrl,
  })
}
