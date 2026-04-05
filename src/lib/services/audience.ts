/**
 * Audience service — resolves the final deliverable contact list for a send operation.
 *
 * Combines contacts from static groups and/or dynamic segments, deduplicates,
 * and enforces all opt-out / unsubscribe / bounce guards so that no non-deliverable
 * contact ever reaches the send queue.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact, Segment } from '@/types'
import { resolveSegmentContacts } from './segments'

// ── Deliverability guard ──────────────────────────────────────────────────────

/**
 * Returns true only when it is safe to send email to this contact.
 *
 * A contact is NOT deliverable when:
 * - Soft-deleted (deleted_at is set)
 * - Status is opted_out
 * - opted_in flag is false (never confirmed, or revoked)
 * - global_opt_out is true (unsubscribed globally)
 * - bounced_at is set (hard or soft bounce — do not retry without manual review)
 */
export function isDeliverable(contact: Contact): boolean {
  return (
    contact.deleted_at === null &&
    contact.status === 'active' &&
    contact.opted_in === true &&
    contact.global_opt_out === false &&
    contact.bounced_at === null
  )
}

// ── Audience resolution ───────────────────────────────────────────────────────

export type AudienceInput = {
  /** IDs of contact_groups to include */
  groupIds?: string[]
  /** IDs of dynamic segments to include */
  segmentIds?: string[]
}

export type AudienceResult = {
  contacts:      Contact[]
  total:         number
  /** Contacts excluded due to opt-out / bounce / deletion */
  excluded:      number
  groupCount:    number
  segmentCount:  number
}

/**
 * Resolve the final deduplicated, deliverable contact list for a send.
 *
 * Steps:
 *   1. Load raw contacts from each group (via contact_group_members)
 *   2. Load raw contacts from each dynamic segment (via resolveSegmentContacts)
 *   3. Deduplicate by contact id
 *   4. Apply isDeliverable guard
 *   5. Return result with stats
 */
export async function resolveAudienceContacts(
  supabase: SupabaseClient,
  { groupIds = [], segmentIds = [] }: AudienceInput
): Promise<AudienceResult> {
  const seen    = new Map<string, Contact>()
  let groupCount   = 0
  let segmentCount = 0

  // 1. Contacts from static groups
  if (groupIds.length > 0) {
    const { data, error } = await supabase
      .from('contact_group_members')
      .select('contacts(*)')
      .in('group_id', groupIds)

    if (error) throw new Error(error.message)

    for (const row of data ?? []) {
      const c = (row as unknown as { contacts: Contact | null }).contacts
      if (c && !seen.has(c.id)) {
        seen.set(c.id, c)
        groupCount++
      }
    }
  }

  // 2. Contacts from dynamic segments
  if (segmentIds.length > 0) {
    const { data: segs, error: segsErr } = await supabase
      .from('segments')
      .select('*')
      .in('id', segmentIds)

    if (segsErr) throw new Error(segsErr.message)

    for (const seg of (segs ?? []) as Segment[]) {
      const segContacts = await resolveSegmentContacts(supabase, seg)
      for (const c of segContacts) {
        if (!seen.has(c.id)) {
          seen.set(c.id, c)
          segmentCount++
        }
      }
    }
  }

  // 3. Apply deliverability guard
  const all        = Array.from(seen.values())
  const contacts   = all.filter(isDeliverable)
  const excluded   = all.length - contacts.length

  return {
    contacts,
    total:   contacts.length,
    excluded,
    groupCount,
    segmentCount,
  }
}

/**
 * Count how many deliverable contacts a combined audience would yield.
 * Lightweight alternative to resolveAudienceContacts when you only need the number.
 */
export async function countAudienceContacts(
  supabase: SupabaseClient,
  input: AudienceInput
): Promise<number> {
  const result = await resolveAudienceContacts(supabase, input)
  return result.total
}
