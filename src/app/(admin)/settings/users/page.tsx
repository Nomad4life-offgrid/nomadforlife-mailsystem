/**
 * /settings/users — Gebruikers- en rolbeheer
 *
 * Alleen toegankelijk voor admins. Editors worden doorgestuurd via requireAdmin()
 * in de grantRole/revokeRole actions, maar voor correcte UX controleren we
 * ook server-side in dit page component.
 */

import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUserWithRole } from '@/lib/auth/guards'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { grantRole, revokeRole } from './actions'
import { RevokeRoleButton } from './RevokeRoleButton'

export const metadata = { title: 'Gebruikersbeheer — Nomad For Life' }

type UserWithRole = {
  id:         string
  email:      string
  created_at: string
  role:       string | null
}

export default async function UsersPage() {
  const currentUser = await getCurrentUserWithRole()

  // Editors zien deze pagina niet
  if (currentUser?.role !== 'admin') notFound()

  const supabase = createServiceClient()

  // Haal alle auth-gebruikers op
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr) throw new Error(authErr.message)

  // Haal alle rollen op
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id, role')

  const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role]))

  const users: UserWithRole[] = (authData.users ?? []).map(u => ({
    id:         u.id,
    email:      u.email ?? '(geen e-mail)',
    created_at: u.created_at,
    role:       roleMap.get(u.id) ?? null,
  }))

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Gebruikersbeheer</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Beheer welke Supabase-gebruikers toegang hebben tot het mailsysteem en welke rol ze hebben.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-4 py-3 text-left font-medium text-zinc-500 text-xs uppercase tracking-wide">Gebruiker</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 text-xs uppercase tracking-wide">Rol</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500 text-xs uppercase tracking-wide">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">{user.email}</p>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">{user.id}</p>
                </td>
                <td className="px-4 py-3">
                  {user.role ? (
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                      user.role === 'admin'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">Geen toegang</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {/* Rol toewijzen / wijzigen */}
                    <form action={grantRole} className="flex items-center gap-1">
                      <input type="hidden" name="user_id" value={user.id} />
                      <select
                        name="role"
                        defaultValue={user.role ?? ''}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:border-zinc-400"
                      >
                        <option value="" disabled>Kies rol</option>
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
                      >
                        Opslaan
                      </button>
                    </form>

                    {/* Toegang intrekken (niet voor jezelf) */}
                    {user.role && user.id !== currentUser.userId && (
                      <RevokeRoleButton action={revokeRole} userId={user.id} email={user.email} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">
            Geen gebruikers gevonden in Supabase Auth.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Eerste admin instellen</p>
        <p className="mt-1 text-xs">
          Als er nog geen admin bestaat, voer je dit eenmalig uit in de Supabase SQL Editor:
        </p>
        <pre className="mt-2 rounded bg-amber-100 px-3 py-2 text-xs font-mono overflow-x-auto">
          {`INSERT INTO user_roles (user_id, role)\nVALUES ('<uid-uit-auth.users>', 'admin');`}
        </pre>
      </div>
    </div>
  )
}
