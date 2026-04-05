import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactForm } from '@/components/contacts/ContactForm'
import { ContactStatusBadge } from '@/components/ui/Badge'
import { updateContact, archiveContact } from '../../actions'

export const metadata = { title: 'Contact bewerken' }

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!contact) notFound()

  // Bind id so the action receives (prevState, formData)
  const boundUpdate  = updateContact.bind(null, contact.id)
  const archiveFn    = archiveContact.bind(null, contact.id)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href={`/contacts/${id}`} className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Terug naar contact
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">Contact bewerken</h1>
          <ContactStatusBadge status={contact.status} />
        </div>
        <p className="mt-1 text-sm text-zinc-400 font-mono">{contact.email}</p>
      </div>

      <ContactForm
        action={boundUpdate}
        defaultValues={contact}
        cancelHref={`/contacts/${id}`}
      />

      {/* Danger zone */}
      <div className="mt-10 rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-sm font-semibold text-red-700">Gevarenzone</h2>
        <p className="mt-1 text-sm text-red-600">
          Het archiveren van een contact stopt alle actieve campagnes voor dit contact.
          De data blijft bewaard en het contact kan worden hersteld.
        </p>
        <form action={archiveFn} className="mt-4">
          <button
            type="submit"
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
          >
            Contact archiveren
          </button>
        </form>
      </div>
    </div>
  )
}
