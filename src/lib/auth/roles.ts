/**
 * Rollen en rechten — kernmodule voor fase 12.
 *
 * Rolhiërarchie:
 *   admin  — volledige toegang: verzenden, verwijderen, rolbeheer
 *   editor — kan alles voorbereiden: contacten, templates, campagnes
 *            maar NIET: live verzenden, verwijderen, rolbeheer
 *
 * Implementatienote:
 *   getUserRole() doet een directe DB-query via de service client.
 *   Dit is bewust: het bypast RLS en is niet manipuleerbaar door de client.
 *   Bij hoge traffic: vervang door JWT custom claims (zie migration-opmerkingen).
 */

import { createServiceClient } from '@/lib/supabase/service'

export type UserRole = 'admin' | 'editor'

/**
 * Haalt de rol op van een gebruiker vanuit de user_roles tabel.
 * Geeft null terug als de gebruiker geen rol heeft (geen toegang).
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[auth] getUserRole mislukt voor', userId, error.message)
    return null
  }

  if (!data) return null
  return data.role as UserRole
}

/** Admin heeft alle rechten. */
export function isAdmin(role: UserRole | null): role is 'admin' {
  return role === 'admin'
}

/** Editor en admin mogen muteren (aanmaken, bewerken). */
export function canEdit(role: UserRole | null): boolean {
  return role === 'admin' || role === 'editor'
}

/** Alleen admin mag verzenden of onomkeerbare acties uitvoeren. */
export function canSend(role: UserRole | null): boolean {
  return role === 'admin'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:  'Admin',
  editor: 'Editor',
}
