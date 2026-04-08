import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ImportForm } from './ImportForm'

export const metadata = { title: 'Contacten importeren' }

export default async function ImportContactsPage() {
  const supabase = await createClient()

  const { data: groups } = await supabase
    .from('contact_groups')
    .select('id, name, color, list_type')
    .order('name', { ascending: true })

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/contacts" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Terug naar contacten
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Contacten importeren</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload een CSV-bestand met e-mailadressen. Geïmporteerde contacten worden direct als actief en opted-in geregistreerd.
          Bestaande adressen worden overgeslagen maar wel aan het segment toegevoegd.
        </p>
      </div>

      <ImportForm groups={groups ?? []} />
    </div>
  )
}
