import Link from 'next/link'
import { ContactForm } from '@/components/contacts/ContactForm'
import { createContact } from '../actions'

export const metadata = { title: 'Nieuw contact' }

export default function NewContactPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/contacts" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Terug naar contacten
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Nieuw contact</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Admin-toegevoegde contacten worden direct als actief en opted-in geregistreerd.
        </p>
      </div>

      <ContactForm action={createContact} />
    </div>
  )
}
