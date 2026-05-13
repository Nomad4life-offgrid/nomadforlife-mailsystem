import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  // Eigen auth-check om de redirect-bestemming te kunnen behouden (i.p.v. dashboard).
  const h = await headers()
  const pathname = h.get('x-invoke-path') || h.get('x-pathname') || '/quicksend'
  const next = encodeURIComponent(pathname)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${next}`)

  const role = await getUserRole(user.id)
  if (!role) {
    redirect(`/login?next=${next}&error=no_access`)
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      {children}
    </div>
  )
}
