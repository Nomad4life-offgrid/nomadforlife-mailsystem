'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/guards'
import type { UserRole } from '@/lib/auth/roles'

/**
 * Verleent een rol aan een gebruiker. Als de gebruiker al een rol heeft,
 * wordt deze overschreven.
 *
 * Vereist: admin.
 * Bescherming: een admin kan zijn eigen rol niet verwijderen (zie guard onderaan).
 */
export async function grantRole(formData: FormData) {
  const { userId: actingAdminId } = await requireAdmin()

  const targetUserId = (formData.get('user_id') as string)?.trim()
  const role         = (formData.get('role')    as string)?.trim() as UserRole

  if (!targetUserId || !role) throw new Error('user_id en role zijn verplicht.')
  if (!['admin', 'editor'].includes(role)) throw new Error(`Ongeldige rol: ${role}`)

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('user_roles')
    .upsert(
      { user_id: targetUserId, role, granted_by: actingAdminId },
      { onConflict: 'user_id' },
    )

  if (error) throw new Error(error.message)

  revalidatePath('/settings/users')
}

/**
 * Verwijdert de rol van een gebruiker (trekt toegang in).
 *
 * Vereist: admin.
 * Bescherming: een admin kan zijn eigen rol niet intrekken.
 */
export async function revokeRole(formData: FormData) {
  const { userId: actingAdminId } = await requireAdmin()

  const targetUserId = (formData.get('user_id') as string)?.trim()
  if (!targetUserId) throw new Error('user_id is verplicht.')

  // Eigen rol intrekken is niet toegestaan
  if (targetUserId === actingAdminId) {
    throw new Error('Je kunt je eigen beheerdersrol niet intrekken.')
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId)

  if (error) throw new Error(error.message)

  revalidatePath('/settings/users')
}
