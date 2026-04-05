/**
 * Segment service — read-only queries + dynamic contact resolution.
 * Mutations live in app/(admin)/segments/actions.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Segment, SegmentFilter, SegmentCondition, Contact } from '@/types'

// ── CRUD reads ────────────────────────────────────────────────────────────────

export async function getSegments(supabase: SupabaseClient): Promise<Segment[]> {
  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .order('name')

  if (error) throw new Error(error.message)
  return data as Segment[]
}

export async function getSegment(supabase: SupabaseClient, id: string): Promise<Segment | null> {
  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Segment | null
}

// ── Dynamic contact resolution ────────────────────────────────────────────────

/**
 * Resolve the active contacts that match a segment's filter_json.
 * Evaluated server-side (not pre-materialized).
 *
 * Supports top-level AND/OR with eq, neq, contains, gte, lte, is_null, is_not_null.
 * Fields must be scalar columns on the contacts table.
 */
export async function resolveSegmentContacts(
  supabase: SupabaseClient,
  segment: Pick<Segment, 'filter_json'>
): Promise<Contact[]> {
  const filter = segment.filter_json

  let query = supabase
    .from('contacts')
    .select('*')
    .is('deleted_at', null)
    .eq('status', 'active')
    .eq('opted_in', true)

  if (filter.operator === 'AND') {
    for (const cond of filter.conditions) {
      query = applyCondition(query, cond)
    }
  } else {
    // OR: build a PostgREST or() filter string
    const orParts = filter.conditions.map(condToOrString).filter(Boolean).join(',')
    if (orParts) query = query.or(orParts)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Contact[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyCondition(query: any, cond: SegmentCondition): any {
  const { field, op, value } = cond
  switch (op) {
    case 'eq':           return query.eq(field, value)
    case 'neq':          return query.neq(field, value)
    case 'contains':     return query.ilike(field, `%${value}%`)
    case 'not_contains': return query.not(field, 'ilike', `%${value}%`)
    case 'gte':          return query.gte(field, value)
    case 'lte':          return query.lte(field, value)
    case 'is_null':      return query.is(field, null)
    case 'is_not_null':  return query.not(field, 'is', null)
    default:             return query
  }
}

function condToOrString(cond: SegmentCondition): string {
  const { field, op, value } = cond
  switch (op) {
    case 'eq':           return `${field}.eq.${value}`
    case 'neq':          return `${field}.neq.${value}`
    case 'contains':     return `${field}.ilike.%${value}%`
    case 'not_contains': return `${field}.not.ilike.%${value}%`
    case 'gte':          return `${field}.gte.${value}`
    case 'lte':          return `${field}.lte.${value}`
    case 'is_null':      return `${field}.is.null`
    case 'is_not_null':  return `${field}.not.is.null`
    default:             return ''
  }
}
