/**
 * Autorisatie-guards voor server actions en server components.
 *
 * Gebruik:
 *   - In een server action: aanroepen bovenaan de functie
 *   - Bij onvoldoende rechten: redirect naar /dashboard met foutmelding
 *   - Bij niet-ingelogd: redirect naar /login
 *
 * De guards gooien nooit — ze redirecten altijd.
 * `redirect()` in Next.js gooit intern een NEXT_REDIRECT error die door
 * het framework wordt afgehandeld. Roep-code hoeft dit niet te cachen.
 *
 * Volgorde van checks (snel-fail):
 *   1. Supabase session aanwezig? → anders /login
 *   2. Rol in user_roles tabel? → anders /dashboard?error=...
 *   3. Rol voldoende? → anders /dashboard?error=...
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole, type UserRole } from './roles'

export type AuthContext = {
  userId: string
  email:  string
  role:   UserRole
}

// ── Basischeck: authenticatie ─────────────────────────────────────────────────

/**
 * Vereist een actieve Supabase-sessie.
 * Redirectt naar /login als er geen sessie is.
 */
export async function requireAuth(): Promise<{ userId: string; email: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return { userId: user.id, email: user.email ?? '' }
}

// ── Rol-checks ────────────────────────────────────────────────────────────────

/**
 * Vereist dat de ingelogde gebruiker de rol 'editor' of 'admin' heeft.
 * Gebruik voor: aanmaken/bewerken van contacten, templates, campagnes.
 */
export async function requireEditor(): Promise<AuthContext> {
  const { userId, email } = await requireAuth()

  const role = await getUserRole(userId)

  if (!role) {
    const msg = encodeURIComponent('Je account heeft geen toegang tot het mailsysteem. Neem contact op met een admin.')
    redirect(`/dashboard?error=${msg}`)
  }

  return { userId, email, role }
}

/**
 * Vereist dat de ingelogde gebruiker de rol 'admin' heeft.
 * Gebruik voor: verzenden, verwijderen, rolbeheer.
 */
export async function requireAdmin(): Promise<AuthContext> {
  const { userId, email } = await requireAuth()

  const role = await getUserRole(userId)

  if (role !== 'admin') {
    const msg = encodeURIComponent('Alleen admins kunnen deze actie uitvoeren.')
    redirect(`/dashboard?error=${msg}`)
  }

  return { userId, email, role: 'admin' }
}

// ── Hulpfunctie voor server components ───────────────────────────────────────

/**
 * Geeft de huidige gebruiker + rol terug zonder te redirectten.
 * Geschikt voor server components die de rol willen tonen of UI aanpassen,
 * maar waar de middleware al de auth-check heeft gedaan.
 *
 * Geeft null terug als er geen sessie of geen rol is.
 */
export async function getCurrentUserWithRole(): Promise<AuthContext | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const role = await getUserRole(user.id)
    if (!role) return null

    return { userId: user.id, email: user.email ?? '', role }
  } catch {
    return null
  }
}
