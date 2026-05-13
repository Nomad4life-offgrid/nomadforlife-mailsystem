/**
 * Mail payload assembly — koppelt template-rendering aan verzending.
 * Variabele-substitutie en HTML→tekst-conversie leven in renderer.ts.
 */

import { renderEmail, htmlToText } from './renderer'

/** Subjects moeten platte tekst zijn — strip HTML, flatten whitespace. */
function sanitizeSubject(raw: string): string {
  return htmlToText(raw).replace(/\s+/g, ' ').trim()
}

export type MailPayload = {
  to:                   string
  subject:              string
  html:                 string
  text:                 string
  from_email:           string
  from_name:            string
  /** URL in de e-mail (bevestigingsformulier) */
  unsubscribe_url:      string
  /** URL voor RFC 8058 one-click POST */
  unsubscribe_post_url: string
  /** Optionele CC-ontvangers */
  cc?: string[]
}

export function buildMailPayload(opts: {
  contact:      { email: string; first_name: string | null; last_name: string | null; custom_fields?: Record<string, unknown> | null }
  template:     { subject: string; html_body: string; text_body: string | null }
  campaign:     { from_email: string; from_name: string; name?: string }
  companyName?: string
  unsubscribeUrl:     string
  unsubscribePostUrl: string
}): MailPayload {
  const { contact, template, campaign, companyName, unsubscribeUrl, unsubscribePostUrl } = opts
  const customFields = contact.custom_fields ?? null

  const { html, text } = renderEmail({
    htmlBody:       template.html_body,
    textBody:       template.text_body,
    contact,
    campaignName:   campaign.name,
    companyName,
    unsubscribeUrl,
    customFields,
  })

  // Subject kan ook variabelen bevatten — substitueer apart (geen footer)
  const { html: subjectHtml } = renderEmail({
    htmlBody:       template.subject,
    textBody:       null,
    contact,
    campaignName:   campaign.name,
    companyName,
    unsubscribeUrl,
    appendFooter:   false,
    customFields,
  })

  const subject = sanitizeSubject(subjectHtml)

  return {
    to:                   contact.email,
    subject,
    html,
    text,
    from_email:           campaign.from_email,
    from_name:            campaign.from_name,
    unsubscribe_url:      unsubscribeUrl,
    unsubscribe_post_url: unsubscribePostUrl,
  }
}
