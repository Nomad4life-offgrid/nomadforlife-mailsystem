/**
 * Template service — read-only queries.
 * Mutations live in app/(admin)/templates/actions.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Template, TemplateSummary } from '@/types'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

export async function getTemplates(
  supabase: SupabaseClient,
  opts: Partial<PaginationParams> & { category?: string; search?: string } = {}
): Promise<PaginatedResponse<TemplateSummary>> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 50
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  let query = supabase
    .from('templates')
    .select('id, name, subject, category, created_at, updated_at', { count: 'exact' })
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (opts.category) {
    query = query.eq('category', opts.category)
  }
  if (opts.search) {
    query = query.or(`name.ilike.%${opts.search}%,subject.ilike.%${opts.search}%`)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    data:  data as TemplateSummary[],
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

export async function getTemplate(supabase: SupabaseClient, id: string): Promise<Template | null> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Template | null
}

/** All templates as a flat list — used for dropdowns in campaign steps. */
export async function getTemplateOptions(supabase: SupabaseClient): Promise<Pick<Template, 'id' | 'name' | 'subject'>[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, subject')
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)
  return data as Pick<Template, 'id' | 'name' | 'subject'>[]
}
