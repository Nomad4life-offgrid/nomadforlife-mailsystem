/**
 * UserMenu — server component.
 *
 * Toont de ingelogde gebruiker met rol-badge onderaan de sidebar.
 * Geeft de logout-knop een eigen formulier (bestaande NavLinks heeft ook logout,
 * maar dit component vervangt de footersectie in de layout).
 */

import { getCurrentUserWithRole } from '@/lib/auth/guards'
import { ROLE_LABELS }            from '@/lib/auth/roles'
import { logout }                 from '@/app/login/actions'

export async function UserMenu() {
  const user = await getCurrentUserWithRole()

  if (!user) return null

  const roleLabel = ROLE_LABELS[user.role]
  const initial   = (user.email[0] ?? '?').toUpperCase()

  return (
    <div className="px-3 py-3 border-t border-zinc-100 space-y-2">
      {/* Gebruikersinfo */}
      <div className="flex items-center gap-2.5 px-1">
        <div className="h-7 w-7 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-zinc-600">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-zinc-800">{user.email}</p>
          <span className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
            user.role === 'admin'
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-600'
          }`}>
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Uitloggen */}
      <form action={logout}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Uitloggen
        </button>
      </form>
    </div>
  )
}
