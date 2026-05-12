import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BRANCHES, BRANCHE_ZIN, BRANCHE_SUBJECT, PS_OFFGRID, type Branche } from '@/lib/email/branche-data'
import { BrancheTextsForm } from './BrancheTextsForm'

export const metadata = { title: 'Branche-teksten' }

const URL_SLUG_DEFAULTS: Record<Branche, string> = {
  'off-grid':    'off-grid',
  inbouw:        'inbouw',
  verhuur:       'verhuur',
  aanschaf:      'aanschaf',
  keuring:       'keuring',
  verzekeringen: 'verzekeringen',
  multi:         'inbouw',
}

export default async function BrancheTextsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('branche_texts')
    .select('branche, zin, subject, url_slug, ps_block')

  const tableMissing = error?.message?.includes('relation') && error.message.includes('branche_texts')
  const byBranche = new Map((data ?? []).map((r) => [r.branche, r]))

  const initialRows = BRANCHES.map((b) => {
    const existing = byBranche.get(b)
    return {
      branche:  b,
      zin:      existing?.zin      ?? BRANCHE_ZIN[b],
      subject:  existing?.subject  ?? BRANCHE_SUBJECT[b],
      url_slug: existing?.url_slug ?? URL_SLUG_DEFAULTS[b],
      ps_block: existing?.ps_block ?? (b === 'off-grid' ? PS_OFFGRID : ''),
    }
  })

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/settings" className="text-sm text-zinc-500 hover:text-zinc-900">← Settings</Link>
      <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Branche-teksten</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Centraal beheer van de merge-velden per branche. Deze teksten worden geïnjecteerd in <code className="font-mono bg-zinc-100 px-1 rounded">custom_fields</code> bij het aanmaken/wijzigen van een contact met een branche.
      </p>

      {tableMissing ? (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 space-y-2">
          <p className="font-medium">Database-tabel ontbreekt nog</p>
          <p>
            De tabel <code className="font-mono bg-white border border-amber-200 px-1 rounded">branche_texts</code> bestaat nog niet. Pas eerst de migratie toe:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>
              Open de <a className="underline font-medium" href="https://supabase.com/dashboard/project/sgwydbhghfglsnbgexgw/sql/new" target="_blank" rel="noreferrer">Supabase SQL editor</a>
            </li>
            <li>
              Plak de inhoud van het bestand <code className="font-mono bg-white border border-amber-200 px-1 rounded">supabase/migrations/20260512000001_branche_texts.sql</code>
            </li>
            <li>Klik &quot;Run&quot;</li>
            <li>Refresh deze pagina</li>
          </ol>
        </div>
      ) : (
        <div className="mt-6">
          <BrancheTextsForm initialRows={initialRows} />
        </div>
      )}
    </div>
  )
}
