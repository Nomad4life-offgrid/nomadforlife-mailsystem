import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SegmentEditForm } from './SegmentEditForm'
import type { Segment } from '@/types'

export const metadata = { title: 'Segment bewerken' }

export default async function EditSegmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const supabase = await createClient()

  const { data: seg } = await supabase
    .from('segments')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!seg) notFound()

  const segment = seg as Segment

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/segments/dynamic/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          ← Terug naar segment
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Segment bewerken</h1>
        <p className="mt-1 text-sm text-zinc-400 font-mono">{segment.name}</p>
      </div>

      <SegmentEditForm id={id} defaultValues={segment} />
    </div>
  )
}
