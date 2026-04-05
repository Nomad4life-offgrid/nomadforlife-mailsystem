/**
 * Consent logging — writes append-only events to `consent_logs`.
 *
 * AVG (GDPR) art. 7 vereist dat de verwerkingsverantwoordelijke kan aantonen
 * dat het datasubject toestemming heeft gegeven. Elke wijziging van de
 * consentstatus wordt hier vastgelegd met tijdstip, kanaal en optionele context.
 *
 * Regels:
 *   - Nooit UPDATE of DELETE op consent_logs uitvoeren.
 *   - Gebruik altijd de service client (bypast RLS).
 *   - Fouten worden gelogd maar gooien niet — een gefaalde log mag een
 *     succesvolle opt-out niet blokkeren.
 *
 * Ondersteunde event types:
 *   opt_in            — contact heeft zich aangemeld (nog niet bevestigd)
 *   opt_in_confirmed  — double opt-in bevestigingslink geklikt
 *   opt_out           — uitgeschreven van specifieke campagne
 *   opt_out_global    — globale opt-out via unsubscribe-link of admin
 *   consent_withdrawn — actieve intrekking via admin
 *   consent_renewed   — opnieuw opt-in gezet door admin
 *   imported          — contact geïmporteerd (consent elders gedocumenteerd)
 *   manually_added    — admin heeft contact handmatig aangemaakt
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { ConsentEventType, ConsentChannel } from '@/types'

export type { ConsentEventType, ConsentChannel }

type SupabaseClient = ReturnType<typeof createServiceClient>

export type LogConsentOptions = {
  supabase:     SupabaseClient
  contactId:    string
  eventType:    ConsentEventType
  channel:      ConsentChannel
  /** IP-adres van de gebruiker of het systeem dat de actie initieerde */
  ipAddress?:   string | null
  userAgent?:   string | null
  /** Vrije tekst voor extra context, bijv. "via telefoon verkregen" */
  notes?:       string | null
  /** UUID van de admin die de actie heeft uitgevoerd — null = systeem/contact */
  performedBy?: string | null
  /** Extra metadata als JSON, bijv. { campaign_id: "..." } */
  metadata?:    Record<string, unknown>
}

/**
 * Schrijft een consent-event naar de audit trail.
 *
 * Gooit nooit een error — eventuele databasefouten worden gelogd.
 * Retourneert true bij succes, false bij mislukking.
 */
export async function logConsent(opts: LogConsentOptions): Promise<boolean> {
  const {
    supabase,
    contactId,
    eventType,
    channel,
    ipAddress   = null,
    userAgent   = null,
    notes       = null,
    performedBy = null,
    metadata    = {},
  } = opts

  const { error } = await supabase.from('consent_logs').insert({
    contact_id:   contactId,
    event_type:   eventType,
    channel,
    ip_address:   ipAddress,
    user_agent:   userAgent,
    notes,
    performed_by: performedBy,
    metadata,
  })

  if (error) {
    console.error(
      `[consent] logConsent mislukt voor contact ${contactId} (${eventType}):`,
      error.message,
    )
    return false
  }

  return true
}
