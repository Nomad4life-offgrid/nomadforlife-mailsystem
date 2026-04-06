import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CampaignForm } from '../CampaignForm'
import { createCampaign } from '../actions'

export const metadata = { title: 'Nieuwe campagne' }

export default async function NewCampaignPage() {
  const supabase = await createClient()

  const [
    { data: templates },
    { data: groups },
    { data: segments },
  ] = await Promise.all([
    supabase
      .from('templates')
      .select('id, name, subject')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('contact_groups')
      .select('id, name, description, color, list_type, is_locked, created_by, created_at, updated_at')
      .order('name'),
    supabase
      .from('segments')
      .select('id, name, description, filter_json, preview_count, refreshed_at, created_by, created_at, updated_at')
      .order('name'),
  ])

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/campaigns" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Campagnes
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Nieuwe campagne</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Kies het type, vul de instellingen in en sla op als concept.
        </p>
      </div>

      <CampaignForm
        mode="new"
        action={createCampaign}
        templates={templates ?? []}
        groups={(groups ?? []) as any}
        segments={(segments ?? []) as any}
        defaultValues={{
          from_name:      process.env.DEFAULT_FROM_NAME  ?? '',
          from_email:     process.env.DEFAULT_FROM_EMAIL ?? '',
          reply_to_email: process.env.DEFAULT_FROM_EMAIL ?? '',
        }}
      />
    </div>
  )
}
