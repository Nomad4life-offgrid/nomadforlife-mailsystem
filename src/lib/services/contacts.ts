/**
 * Contact service — read-only queries used by Server Components and Route Handlers.
 * Mutations live in the relevant app/(admin)/[section]/actions.ts files.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact, ContactSummary, ContactGroup } from '@/types'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function getContacts(
  supabase: SupabaseClient,
  opts: Partial<PaginationParams> & { search?: string; status?: string } = {}
): Promise<PaginatedResponse<ContactSummary>> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 50
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  let query = supabase
    .from('contacts')
    .select('id, email, first_name, last_name, company, status, opted_in, opted_in_at, created_at', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (opts.search) {
    query = query.or(`email.ilike.%${opts.search}%,first_name.ilike.%${opts.search}%,last_name.ilike.%${opts.search}%`)
  }
  if (opts.status) {
    query = query.eq('status', opts.status)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    data:  data as ContactSummary[],
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

export async function getContact(supabase: SupabaseClient, id: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Contact | null
}

export async function getContactByEmail(supabase: SupabaseClient, email: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Contact | null
}

// ── Groups ────────────────────────────────────────────────────────────────────

export async function getGroups(supabase: SupabaseClient): Promise<ContactGroup[]> {
  const { data, error } = await supabase
    .from('contact_groups')
    .select('*')
    .order('name')

  if (error) throw new Error(error.message)
  return data as ContactGroup[]
}

export async function getGroup(supabase: SupabaseClient, id: string): Promise<ContactGroup | null> {
  const { data, error } = await supabase
    .from('contact_groups')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as ContactGroup | null
}

export async function getGroupContacts(
  supabase: SupabaseClient,
  groupId: string
): Promise<ContactSummary[]> {
  const { data, error } = await supabase
    .from('contact_group_members')
    .select('contacts(id, email, first_name, last_name, company, status, opted_in, opted_in_at, created_at)')
    .eq('group_id', groupId)

  if (error) throw new Error(error.message)
  return (data ?? []).flatMap((row: any) => row.contacts ? [row.contacts] : []) as ContactSummary[]
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getContactStats(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('contacts')
    .select('status', { count: 'exact' })
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const rows = data as { status: string }[]
  return {
    total:     rows.length,
    active:    rows.filter(r => r.status === 'active').length,
    pending:   rows.filter(r => r.status === 'pending').length,
    opted_out: rows.filter(r => r.status === 'opted_out').length,
  }
}
