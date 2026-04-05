import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TestMailForm } from './TestMailForm'

export const metadata = { title: 'Settings' }

function mask(val: string | undefined, show = 4): string {
  if (!val) return '(niet ingesteld)'
  return '••••••••' + val.slice(-show)
}

function Row({ label, value }: { label: string; value: string }) {
  const missing = value === '(niet ingesteld)'
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <code className="text-xs text-zinc-500">{label}</code>
      <span className={`text-sm font-mono ${missing ? 'text-amber-600' : 'text-zinc-900'}`}>
        {value}
      </span>
    </div>
  )
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL      ?? '(niet ingesteld)'
  const sgKey       = mask(process.env.SENDGRID_API_KEY)
  const internalSec = process.env.INTERNAL_API_SECRET      ? '••••••••' : '(niet ingesteld)'
  const fromEmail   = process.env.DEFAULT_FROM_EMAIL       ?? '(niet ingesteld)'
  const fromName    = process.env.DEFAULT_FROM_NAME        ?? '(niet ingesteld)'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(niet ingesteld)'

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Configuratie wordt beheerd via omgevingsvariabelen in{' '}
        <code className="text-xs">.env.local</code>.
      </p>

      <div className="mt-4">
        <Link
          href="/settings/users"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Gebruikersbeheer &amp; rollen
        </Link>
      </div>

      <div className="mt-8 space-y-6">

        <section>
          <h2 className="text-base font-medium text-zinc-900 mb-3">SendGrid</h2>
          <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
            <Row label="SENDGRID_API_KEY"   value={sgKey} />
            <Row label="DEFAULT_FROM_EMAIL" value={fromEmail} />
            <Row label="DEFAULT_FROM_NAME"  value={fromName} />
          </div>
        </section>

        <section>
          <h2 className="text-base font-medium text-zinc-900 mb-3">Applicatie</h2>
          <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
            <Row label="NEXT_PUBLIC_APP_URL" value={appUrl} />
            <Row label="INTERNAL_API_SECRET" value={internalSec} />
          </div>
        </section>

        <section>
          <h2 className="text-base font-medium text-zinc-900 mb-3">Supabase</h2>
          <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
            <Row label="NEXT_PUBLIC_SUPABASE_URL"      value={supabaseUrl} />
            <Row label="NEXT_PUBLIC_SUPABASE_ANON_KEY" value="••••••••" />
            <Row label="SUPABASE_SERVICE_ROLE_KEY"     value="••••••••" />
          </div>
        </section>

        <section>
          <h2 className="text-base font-medium text-zinc-900 mb-3">Testmail versturen</h2>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            {(!templates || templates.length === 0) ? (
              <p className="text-sm text-zinc-400">Geen templates beschikbaar. Maak eerst een template aan.</p>
            ) : (
              <TestMailForm templates={templates} />
            )}
          </div>
        </section>

        <section>
          <h2 className="text-base font-medium text-zinc-900 mb-3">Queue activeren</h2>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 space-y-2">
            <p>
              Roep elke 5 minuten aan via een externe cron (Vercel Cron, GitHub Actions, pg_cron):
            </p>
            <pre className="rounded bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs overflow-x-auto whitespace-pre-wrap">
              {`curl -X POST ${appUrl}/api/internal/process-queue \\\n  -H "x-internal-secret: $INTERNAL_API_SECRET"`}
            </pre>
          </div>
        </section>

      </div>
    </div>
  )
}
