import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GroupEditForm } from './GroupEditForm'

export const metadata = { title: 'Lijst bewerken' }

export default async function GroupEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const supabase = await createClient()

  const { data: group } = await supabase
    .from('contact_groups')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!group) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href={`/segments/${id}`} className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Terug naar lijst
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
          <h1 className="text-2xl font-semibold text-zinc-900">Lijst bewerken</h1>
        </div>
      </div>

      <GroupEditForm id={group.id} defaultValues={group} />
    </div>
  )
}
