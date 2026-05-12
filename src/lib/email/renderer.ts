/**
 * Template renderer — variabele-substitutie, HTML→tekst conversie en validatie.
 *
 * Ondersteunde variabelen:
 *   {{first_name}}      Voornaam van de ontvanger  (fallback: leeg)
 *   {{last_name}}       Achternaam                 (fallback: leeg)
 *   {{full_name}}       Voor + achternaam           (fallback: e-mailadres)
 *   {{email}}           E-mailadres van de ontvanger
 *   {{company_name}}    Bedrijf/merk                (fallback: 'Nomad For Life')
 *   {{campaign_name}}   Naam van de campagne        (fallback: leeg)
 *   {{unsubscribe_url}} Afmeldlink — VERPLICHT in elke template
 */

// ── Variabelen ────────────────────────────────────────────────────────────────

export type TemplateVarMap = {
  first_name:      string
  last_name:       string
  full_name:       string
  email:           string
  company_name:    string
  campaign_name:   string
  unsubscribe_url: string
}

/** Beschrijving + voorbeeldwaarde per variabele — gebruikt in de preview UI. */
export const TEMPLATE_VAR_REFERENCE: Array<{
  variable:    string
  description: string
  example:     string
  required:    boolean
}> = [
  { variable: '{{first_name}}',      description: 'Voornaam ontvanger',       example: 'Anna',                        required: false },
  { variable: '{{last_name}}',       description: 'Achternaam ontvanger',      example: 'de Vries',                    required: false },
  { variable: '{{full_name}}',       description: 'Voor- en achternaam',       example: 'Anna de Vries',               required: false },
  { variable: '{{email}}',           description: 'E-mailadres ontvanger',     example: 'anna@example.com',            required: false },
  { variable: '{{company_name}}',    description: 'Bedrijfs- of merknaam',     example: 'Nomad For Life',              required: false },
  { variable: '{{campaign_name}}',   description: 'Naam van de campagne',      example: 'Welkomstcampagne',            required: false },
  { variable: '{{unsubscribe_url}}', description: 'Afmeldlink (URL)',          example: 'https://…/unsubscribe/TOKEN', required: true  },
  // ── Founding Partners outreach (per-contact custom_fields) ─────────────
  { variable: '{{bedrijfsnaam}}',    description: 'Bedrijfsnaam contact (custom_fields)',           example: '12Volt Expert',                 required: false },
  { variable: '{{aanhef}}',          description: 'Aanhef, bv. "Hallo X,"',                          example: 'Hallo 12Volt Expert,',          required: false },
  { variable: '{{onderwerp}}',       description: 'Onderwerpregel per branche',                      example: 'Founding Partner van Nomad…',   required: false },
  { variable: '{{preheader}}',       description: 'Verborgen preview-tekst bovenaan',                example: 'Geen kleine lettertjes.',       required: false },
  { variable: '{{branche}}',         description: 'Branche-key (off-grid, inbouw, …)',               example: 'off-grid',                      required: false },
  { variable: '{{branche_zin}}',     description: 'Branche-specifieke zin in body',                  example: "autonoom reizen, stroom…",      required: false },
  { variable: '{{categorie_url}}',   description: 'Link naar categoriepagina',                       example: 'https://…/campers-vans/off-grid', required: false },
  { variable: '{{ps_offgrid}}',      description: 'PS-blok (alleen voor off-grid)',                  example: 'P.S. Specifiek voor off-grid…', required: false },
]

/** Voorbeeldwaarden voor preview-rendering. */
export const SAMPLE_VARS: TemplateVarMap = {
  first_name:      'Anna',
  last_name:       'de Vries',
  full_name:       'Anna de Vries',
  email:           'anna@example.com',
  company_name:    'Nomad For Life',
  campaign_name:   'Welkomstcampagne',
  unsubscribe_url: '#preview-unsubscribe',
}

// ── Substitutie ───────────────────────────────────────────────────────────────

/**
 * Vervangt alle {{key}} placeholders in de string.
 * Onbekende of ontbrekende keys worden vervangen door een lege string.
 */
export function substituteVars(
  template: string,
  vars: Partial<TemplateVarMap>,
  customFields?: Record<string, unknown> | null,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const builtIn = vars[key as keyof TemplateVarMap]
    if (builtIn !== undefined) return builtIn
    if (customFields && Object.prototype.hasOwnProperty.call(customFields, key)) {
      const v = customFields[key]
      return v == null ? '' : String(v)
    }
    return ''
  })
}

// ── HTML → tekst ──────────────────────────────────────────────────────────────

/**
 * Converteert HTML naar een leesbare platte-tekst versie.
 * Geschikt als automatische text_body als de template er geen heeft.
 */
export function htmlToText(html: string): string {
  return html
    // Style-blokken verwijderen
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Koppen → UPPERCASE + newline
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner) =>
      `\n${stripTags(inner).trim().toUpperCase()}\n`
    )
    // Links → tekst (URL)
    .replace(/<a[^>]+href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
      const label = stripTags(inner).trim()
      return label ? `${label} (${href})` : href
    })
    // <br> → newline
    .replace(/<br\s*\/?>/gi, '\n')
    // Blok-elementen → newlines
    .replace(/<\/(p|div|tr|li|blockquote|td)>/gi, '\n')
    // Resterende tags verwijderen
    .replace(/<[^>]+>/g, '')
    // HTML-entiteiten decoderen
    .replace(/&nbsp;/gi,  ' ')
    .replace(/&amp;/gi,   '&')
    .replace(/&lt;/gi,    '<')
    .replace(/&gt;/gi,    '>')
    .replace(/&quot;/gi,  '"')
    .replace(/&#39;/gi,   "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&zwnj;/gi,  '')
    // Whitespace opruimen
    .replace(/[ \t]+/g, ' ')
    .replace(/ \n/g, '\n')
    .replace(/\n /g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

// ── Validatie ─────────────────────────────────────────────────────────────────

/**
 * Valideert de HTML-body van een template.
 * Geeft een array van foutmeldingen terug. Lege array = geldig.
 */
export function validateTemplateHtml(html: string): string[] {
  const errors: string[] = []
  if (!html.includes('{{unsubscribe_url}}')) {
    errors.push(
      'De template bevat geen {{unsubscribe_url}}. ' +
      'Deze variabele is verplicht voor CAN-SPAM / AVG-compliance.'
    )
  }
  return errors
}

// ── Render ────────────────────────────────────────────────────────────────────

/**
 * Rendert een template voor een specifiek contact + campagne.
 * Geeft de definitieve HTML én plaintext terug.
 */
export function renderEmail(opts: {
  htmlBody:       string
  textBody:       string | null
  contact:        { first_name: string | null; last_name: string | null; email: string }
  campaignName?:  string
  companyName?:   string
  unsubscribeUrl: string
  /** Zet op false om de footer weg te laten (bijv. bij subject-rendering). Default: true. */
  appendFooter?:  boolean
  /** Extra per-contact merge-velden uit contacts.custom_fields. Built-in vars hebben voorrang. */
  customFields?:  Record<string, unknown> | null
}): { html: string; text: string } {
  const firstName = opts.contact.first_name?.trim() ?? ''
  const lastName  = opts.contact.last_name?.trim()  ?? ''

  const vars: TemplateVarMap = {
    first_name:      firstName,
    last_name:       lastName,
    full_name:       [firstName, lastName].filter(Boolean).join(' ') || opts.contact.email,
    email:           opts.contact.email,
    company_name:    opts.companyName  ?? 'Nomad For Life',
    campaign_name:   opts.campaignName ?? '',
    unsubscribe_url: opts.unsubscribeUrl,
  }

  const withFooter = opts.appendFooter !== false

  const FOOTER_HTML = ``

  const FOOTER_TEXT = `\n\n--\nTeam Nomad For Life\nhttps://nomad4life.com`

  const bodyHtml = substituteVars(opts.htmlBody, vars, opts.customFields) + (withFooter ? FOOTER_HTML : '')

  // Buttons: alle <a>-tags met background(-color) in hun style krijgen geforceerde
  // kernstijlen. De tekst wordt in een <span> gewikkeld zodat e-mailclients
  // (Gmail, Outlook) de linkkleur en underline niet kunnen overschrijven.
  const BUTTON_CORE = 'background-color:#f85d1b;color:#ffffff;-webkit-text-fill-color:#ffffff;padding:9px 15px;border-radius:8px;display:inline-block;text-decoration:none'
  const SPAN_STYLE  = 'color:#ffffff;-webkit-text-fill-color:#ffffff;text-decoration:none'
  const styledBody = bodyHtml.replace(
    /<a(\b[^>]*\bstyle="([^"]*)"[^>]*)>([\s\S]*?)<\/a>/gi,
    (match, _attrs, styleVal: string, content: string) => {
      if (!/background/i.test(styleVal)) return match
      const cleaned = styleVal
        .replace(/\bbackground(-color)?\s*:[^;]+;?/gi,  '')
        .replace(/\bcolor\s*:[^;]+;?/gi,                '')
        .replace(/\bpadding\s*:[^;]+;?/gi,              '')
        .replace(/\bborder-radius\s*:[^;]+;?/gi,        '')
        .replace(/\bdisplay\s*:[^;]+;?/gi,              '')
        .replace(/\btext-decoration\s*:[^;]+;?/gi,      '')
        .replace(/\s{2,}/g, ' ').trim().replace(/;$/, '')
      const newStyle = `${cleaned ? cleaned + ';' : ''}${BUTTON_CORE}`
      const openTag  = match.replace(/style="[^"]*"/, `style="${newStyle}"`)
        .replace(/>[\s\S]*$/, '>')
      return `${openTag}<span style="${SPAN_STYLE}">${content}</span></a>`
    },
  )

  // Volledig HTML-document: geen wrapper toevoegen — de template heeft eigen <html>/<body>.
  // Snippet-template: wikkel in een basis-div met zwarte achtergrond en padding.
  const isFullDocument = /^\s*<!doctype\b|^\s*<html\b/i.test(styledBody)
  const html = isFullDocument
    ? styledBody
    : `<div style="background-color:#000000;color:#ffffff;text-align:left;padding:40px 0">${styledBody}</div>`
  const rawText = opts.textBody ? opts.textBody : htmlToText(opts.htmlBody)
  const text    = substituteVars(rawText, vars, opts.customFields) + (withFooter ? FOOTER_TEXT : '')

  return { html, text }
}
