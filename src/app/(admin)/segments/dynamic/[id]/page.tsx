import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactStatusBadge } from '@/components/ui/Badge'
import { resolveSegmentContacts } from '@/lib/services/segments'
import { isDeliverable } from '@/lib/services/audience'
import { deleteSegment, refreshSegmentPreview } from '../../actions'
import type { Segment, Contact } from '@/types'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('segments').select('name').eq('id', id).maybeSingle()
  return { title: data?.name ?? 'Segment' }
}

// ── Human-readable condition description ─────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  contact_type:  'Contacttype',
  source:        'Bron',
  status:        'Status',
  opted_in:      'Opt-in bevestigd',
  global_opt_out:'Globaal afgemeld',
  unsubscribed_at: 'Uitschrijfdatum',
  bounced_at:    'Bouncedatum',
  email:         'E-mailadres',
  company:       'Bedrijf',
  first_name:    'Voornaam',
  last_name:     'Achternaam',
}

const OP_LABELS: Record<string, string> = {
  eq:           'is',
  neq:          'is niet',
  contains:     'bevat',
  not_contains: 'bevat niet',
  gte:          '≥',
  lte:          '≤',
  is_null:      'is niet ingesteld',
  is_not_null:  'is ingesteld',
}

function conditionSummary(cond: { field: string; op: string; value: unknown }): string {
  const field = FIELD_LABELS[cond.field] ?? cond.field
  const op    = OP_LABELS[cond.op] ?? cond.op
  if (cond.op === 'is_null' || cond.op === 'is_not_null') return `${field} ${op}`
  if (typeof cond.value === 'boolean') return `${field} ${op} ${cond.value ? 'ja' : 'nee'}`
  return `${field} ${op} "${cond.value}"`
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DynamicSegmentPage({
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

  // Live preview — capped at 50 for display; all contacts for count
  const allContacts    = await resolveSegmentContacts(supabase, segment)
  const liveCount      = allContacts.length
  const displaySample  = allContacts.slice(0, 50)
  const excludedCount  = allContacts.filter((c) => !isDeliverable(c)).length

  const deleteFn  = deleteSegment.bind(null, id)
  const refreshFn = refreshSegmentPreview.bind(null, id)

  const filter      = segment.filter_json
  const conditions  = filter?.conditions ?? []
  const opWord      = filter?.operator === 'OR' ? 'MINIMAAL ÉÉN' : 'ALLE'

  const refreshedDate = segment.refreshed_at
    ? new Date(segment.refreshed_at).toLocaleString('nl-NL')
    : null

  return (
    <div className="p-8">
      {/* Back */}
      <Link href="/segments?tab=segmenten" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
        ← Segmenten
      </Link>

      {/* Header */}
      <div className="mt-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{segment.name}</h1>
          {segment.description && (
            <p className="mt-1 text-sm text-zinc-500">{segment.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/segments/dynamic/${id}/edit`}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Bewerken
          </Link>
          <form action={deleteFn}>
            <button
              type="submit"
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Verwijder
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">

        {/* Left column: filters + preview stats */}
        <div className="space-y-5">

          {/* Filter definition */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-3">Filterregels</h2>
            <p className="text-xs text-zinc-400 mb-3">
              Contact moet voldoen aan <strong>{opWord}</strong> van de volgende condities:
            </p>
            <ul className="space-y-1.5">
              {conditions.map((cond, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  {conditionSummary(cond)}
                </li>
              ))}
              {conditions.length === 0 && (
                <li className="text-sm text-zinc-400 italic">Geen condities gedefinieerd.</li>
              )}
            </ul>
            <Link
              href={`/segments/dynamic/${id}/edit`}
              className="mt-4 inline-block text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Filterregels bewerken →
            </Link>
          </div>

          {/* Preview stats */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700">Preview</h2>
              <form action={refreshFn}>
                <button
                  type="submit"
                  className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  Opslaan &amp; vernieuwen
                </button>
              </form>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Overeenkomende contacten</span>
                <span className="text-lg font-semibold tabular-nums text-zinc-900">
                  {liveCount.toLocaleString('nl-NL')}
                </span>
              </div>
              {excludedCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Uitgesloten (opt-out/bounce)</span>
                  <span className="text-sm text-red-500">{excludedCount.toLocaleString('nl-NL')}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Leverbaar</span>
                <span className="text-lg font-semibold tabular-nums text-green-700">
                  {(liveCount - excludedCount).toLocaleString('nl-NL')}
                </span>
              </div>
            </div>

            {/* Cached count */}
            {segment.preview_count !== null && (
              <div className="border-t border-zinc-100 pt-3">
                <p className="text-xs text-zinc-400">
                  Opgeslagen preview: <strong>{segment.preview_count.toLocaleString('nl-NL')}</strong>
                  {refreshedDate && ` (${refreshedDate})`}
                </p>
              </div>
            )}
          </div>

          {/* Send to segment */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-medium text-zinc-600 mb-2">Campagne versturen</p>
            <Link
              href={`/send?segment_id=${id}`}
              className="block w-full rounded-md border border-zinc-300 bg-white py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Verstuur aan dit segment →
            </Link>
          </div>
        </div>

        {/* Right column: contact sample */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-700">
              Overeenkomende contacten
              {liveCount > 50 && (
                <span className="ml-2 text-xs font-normal text-zinc-400">(eerste 50 van {liveCount.toLocaleString('nl-NL')})</span>
              )}
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Leverbaar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {displaySample.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-zinc-400">
                      Geen contacten voldoen aan de huidige filterregels.
                    </td>
                  </tr>
                )}
                {displaySample.map((c: Contact) => {
                  const name        = [c.first_name, c.last_name].filter(Boolean).join(' ')
                  const deliverable = isDeliverable(c)
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/contacts/${c.id}`}
                          className="font-mono text-xs text-zinc-700 hover:underline"
                        >
                          {c.email}
                        </Link>
                        {name && <p className="mt-0.5 text-xs text-zinc-400">{name}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <ContactStatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        {deliverable ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Leverbaar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Uitgesloten
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
