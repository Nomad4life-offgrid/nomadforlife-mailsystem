'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { GroupSchema, UpdateGroupSchema, SegmentSchema } from '@/lib/validations/segment'
import { resolveSegmentContacts } from '@/lib/services/segments'
import { requireAdmin, requireEditor } from '@/lib/auth/guards'
import type { Segment } from '@/types'

// ── Shared form state type ────────────────────────────────────────────────────

export type FormState = {
  errors?: Partial<Record<string, string[]>>
  message?: string
} | null

// ── Static groups / lijsten ───────────────────────────────────────────────────

export async function createGroup(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireEditor()
  const raw = {
    name:        formData.get('name'),
    description: formData.get('description') || null,
    color:       formData.get('color') || '#71717a',
    list_type:   formData.get('list_type') || 'group',
  }

  const parsed = GroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('contact_groups').insert(parsed.data)

  if (error) {
    if (error.code === '23505') {
      return { errors: { name: [`De naam "${parsed.data.name}" is al in gebruik.`] } }
    }
    return { message: error.message }
  }

  redirect('/segments')
}

export async function updateGroup(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireEditor()
  const raw = {
    name:        formData.get('name'),
    description: formData.get('description') || null,
    color:       formData.get('color') || '#71717a',
    list_type:   formData.get('list_type') || 'group',
  }

  const parsed = UpdateGroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('contact_groups')
    .update(parsed.data)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { errors: { name: [`De naam "${parsed.data.name}" is al in gebruik.`] } }
    }
    return { message: error.message }
  }

  redirect(`/segments/${id}`)
}

export async function deleteGroup(id: string) {
  await requireAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.from('contact_groups').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/segments')
}

// ── Group members ─────────────────────────────────────────────────────────────

export async function addContactToGroup(
  groupId: string,
  formData: FormData
): Promise<FormState> {
  await requireEditor()
  const contactId = (formData.get('contact_id') as string)?.trim()
  if (!contactId) return { message: 'Selecteer een contact.' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('contact_group_members')
    .insert({ group_id: groupId, contact_id: contactId })

  if (error) {
    if (error.code === '23505') return { message: 'Dit contact zit al in de lijst.' }
    return { message: error.message }
  }

  revalidatePath(`/segments/${groupId}`)
  return null
}

export async function removeContactFromGroup(groupId: string, contactId: string) {
  await requireEditor()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('contact_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('contact_id', contactId)

  if (error) throw new Error(error.message)
  revalidatePath(`/segments/${groupId}`)
}

// ── Dynamic segments ──────────────────────────────────────────────────────────

export async function createSegment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireEditor()
  const filterJsonStr = formData.get('filter_json') as string

  let filterJson: unknown
  try {
    filterJson = JSON.parse(filterJsonStr)
  } catch {
    return { message: 'Ongeldig filterformaat. Voeg minimaal één conditie toe.' }
  }

  const parsed = SegmentSchema.safeParse({
    name:        formData.get('name'),
    description: formData.get('description') || null,
    filter_json: filterJson,
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = createServiceClient()
  const { data: inserted, error } = await supabase
    .from('segments')
    .insert(parsed.data)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { errors: { name: [`De naam "${parsed.data.name}" is al in gebruik.`] } }
    }
    return { message: error.message }
  }

  redirect(`/segments/dynamic/${inserted.id}`)
}

export async function updateSegment(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireEditor()
  const filterJsonStr = formData.get('filter_json') as string

  let filterJson: unknown
  try {
    filterJson = JSON.parse(filterJsonStr)
  } catch {
    return { message: 'Ongeldig filterformaat. Voeg minimaal één conditie toe.' }
  }

  const parsed = SegmentSchema.safeParse({
    name:        formData.get('name'),
    description: formData.get('description') || null,
    filter_json: filterJson,
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('segments')
    .update({ ...parsed.data, preview_count: null, refreshed_at: null })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { errors: { name: [`De naam "${parsed.data.name}" is al in gebruik.`] } }
    }
    return { message: error.message }
  }

  redirect(`/segments/dynamic/${id}`)
}

export async function deleteSegment(id: string) {
  await requireAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.from('segments').delete().eq('id', id)
  if (error) throw new Error(error.message)
  redirect('/segments?tab=segmenten')
}

/**
 * Re-compute the cached preview_count for a dynamic segment.
 * Uses the read client (anon) to resolve contacts, then service client to update.
 */
export async function refreshSegmentPreview(id: string) {
  await requireEditor()
  const readClient = await createClient()

  const { data: seg, error: fetchErr } = await readClient
    .from('segments')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !seg) throw new Error(fetchErr?.message ?? 'Segment niet gevonden.')

  const contacts     = await resolveSegmentContacts(readClient, seg as Segment)
  const previewCount = contacts.length

  const writeClient = createServiceClient()
  const { error: updateErr } = await writeClient
    .from('segments')
    .update({ preview_count: previewCount, refreshed_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) throw new Error(updateErr.message)
  revalidatePath(`/segments/dynamic/${id}`)
}
