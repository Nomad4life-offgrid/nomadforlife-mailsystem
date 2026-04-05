import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactStatusBadge, MailLogStatusBadge } from '@/components/ui/Badge'
import { formatDate, formatDateTime } from '@/utils/date'
import { fullName, initials } from '@/utils/format'
import { optInContact, optOutContact, restoreContact } from '../actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('email, first_name, last_name').eq('id', id).maybeSingle()
  const name = data ? fullName(data.first_name, data.last_name) : null
  return { title: name !== '—' ? name : data?.email ?? 'Contact' }
}

const TYPE_LABELS: Record<string, string> = {
  camping: 'Camping', sponsor: 'Sponsor', adverteerder: 'Adverteerder',
  lid: 'Lid', partner: 'Partner', prospect: 'Prospect', overig: 'Overig',
}
const SOURCE_LABELS: Record<string, string> = {
  manual: 'Handmatig', import: 'Import', api: 'API', website: 'Website', admin: 'Admin',
}
const CONSENT_EVENT_LABELS: Record<string, string> = {
  opt_in: 'Opt-in', opt_in_confirmed: 'Opt-in bevestigd', opt_out: 'Opt-out',
  opt_out_global: 'Globale opt-out', consent_withdrawn: 'Consent ingetrokken',
  consent_renewed: 'Consent vernieuwd', imported: 'Geïmporteerd', manually_added: 'Handmatig toegevoegd',
}
const RUN_STATUS_LABELS: Record<string, string> = {
  active: 'Actief', completed: 'Voltooid', opted_out: 'Afgemeld', bounced: 'Bounced',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-400 shrink-0">{label}</span>
      <span className="text-sm text-zinc-900 text-right">{value ?? <span className="text-zinc-300 italic">—</span>}</span>
    </div>
  )
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch contact (including archived)
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!contact) notFound()

  // Parallel data fetching
  const [groupsRes, runsRes, mailLogsRes, consentRes] = await Promise.all([
    supabase
      .from('contact_group_members')
      .select('contact_groups(id, name, color)')
      .eq('contact_id', id),
    supabase
      .from('campaign_runs')
      .select('id, status, subscribed_at, opted_out_at, completed_at, campaigns(id, name, status)')
      .eq('contact_id', id)
      .order('subscribed_at', { ascending: false })
      .limit(10),
    supabase
      .from('mail_logs')
      .select('id, status, scheduled_at, sent_at, opened_at, clicked_at, campaign_steps(campaign_id, step_order, templates(name))')
      .eq('contact_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(10),
    supabase
      .from('consent_logs')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const groups     = (groupsRes.data ?? []).flatMap((r: any) => r.contact_groups ? [r.contact_groups] : [])
  const runs       = (runsRes.data ?? []) as any[]
  const mailLogs   = (mailLogsRes.data ?? []) as any[]
  const consentLog = (consentRes.data ?? []) as any[]

  const name    = fullName(contact.first_name, contact.last_name)
  const ini     = initials(contact.first_name, contact.last_name) || contact.email[0].toUpperCase()
  const isArchived = !!contact.deleted_at
  const isBounced  = !!contact.bounced_at

  const optInFn     = optInContact.bind(null, contact.id)
  const optOutFn    = optOutContact.bind(null, contact.id)
  const restoreFn   = restoreContact.bind(null, contact.id)

  return (
    <div className="p-8 max-w-6xl">

      {/* Breadcrumb */}
      <Link href="/contacts" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
        ← Terug naar contacten
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg font-bold text-zinc-600">
            {ini}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold text-zinc-900">
                {name !== '—' ? name : <span className="italic text-zinc-400">Geen naam</span>}
              </h1>
              {isArchived
                ? <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500">Gearchiveerd</span>
                : isBounced
                  ? <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-50 text-orange-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />Bounced
                    </span>
                  : <ContactStatusBadge status={contact.status} />}
            </div>
            <p className="mt-0.5 text-sm font-mono text-zinc-400">{contact.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isArchived ? (
            <form action={restoreFn}>
              <button type="submit" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
                Herstellen
              </button>
            </form>
          ) : (
            <Link
              href={`/contacts/${id}/edit`}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Bewerken
            </Link>
          )}
        </div>
      </div>

      {/* Archived banner */}
      {isArchived && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Dit contact is gearchiveerd op {formatDateTime(contact.deleted_at)}. Gegevens zijn bewaard maar het contact ontvangt geen e-mails meer.
        </div>
      )}

      {/* Bounced banner */}
      {isBounced && !isArchived && (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Bounce geregistreerd op {formatDateTime(contact.bounced_at)} ({contact.bounce_type ?? 'onbekend'}). E-mails worden niet meer bezorgd.
        </div>
      )}

      {/* Content grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* LEFT: contact info + consent */}
        <div className="space-y-6 lg:col-span-1">

          {/* Contact info */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Contactgegevens</h2>
            <InfoRow label="E-mail"   value={<span className="font-mono text-xs">{contact.email}</span>} />
            <InfoRow label="Voornaam" value={contact.first_name} />
            <InfoRow label="Achternaam" value={contact.last_name} />
            <InfoRow label="Telefoon"   value={contact.phone} />
            <InfoRow label="Bedrijf"    value={contact.company} />
            <InfoRow label="Type"       value={contact.contact_type ? TYPE_LABELS[contact.contact_type] : null} />
            <InfoRow label="Bron"       value={SOURCE_LABELS[contact.source] ?? contact.source} />
            <InfoRow label="Aangemeld"  value={formatDate(contact.created_at)} />
            {contact.notes && (
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <p className="text-xs font-medium text-zinc-400 mb-1">Notities</p>
                <p className="text-sm text-zinc-600 whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </div>

          {/* Consent & status */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Consent & status</h2>
            <InfoRow label="Opt-in"
              value={contact.opted_in
                ? <span className="text-green-700 font-medium">Ja — {formatDate(contact.opted_in_at)}</span>
                : <span className="text-zinc-400">Nee</span>}
            />
            <InfoRow label="Afgemeld"
              value={contact.unsubscribed_at
                ? <span className="text-red-600">{formatDate(contact.unsubscribed_at)}</span>
                : null}
            />
            <InfoRow label="Globale opt-out"
              value={contact.global_opt_out
                ? <span className="text-red-600 font-medium">Ja</span>
                : <span className="text-zinc-400">Nee</span>}
            />

            {!isArchived && (
              <div className="mt-4 flex gap-2 flex-wrap">
                {contact.status !== 'active' && (
                  <form action={optInFn}>
                    <button type="submit" className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors">
                      Opt-in zetten
                    </button>
                  </form>
                )}
                {contact.status !== 'opted_out' && (
                  <form action={optOutFn}>
                    <button type="submit" className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                      Globale opt-out
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Groepen */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Groepen</h2>
            {groups.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">Niet in een groep</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.map((g: any) => (
                  <span
                    key={g.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                    style={{ backgroundColor: `${g.color}18`, color: g.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: g.color }} />
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: campaigns + mails + consent log */}
        <div className="space-y-6 lg:col-span-2">

          {/* Campagnes */}
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-700">Campagnes</h2>
            </div>
            {runs.length === 0 ? (
              <p className="px-5 py-8 text-sm text-zinc-400 italic text-center">Geen campagnes gevonden</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Campagne</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Ingeschreven</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {runs.map((run: any) => (
                    <tr key={run.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/campaigns/${run.campaigns?.id}`}
                          className="font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
                        >
                          {run.campaigns?.name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          run.status === 'active'    ? 'bg-green-50 text-green-700' :
                          run.status === 'completed' ? 'bg-blue-50 text-blue-700'  :
                          run.status === 'opted_out' ? 'bg-red-50 text-red-600'    :
                          'bg-zinc-100 text-zinc-500'
                        }`}>
                          {RUN_STATUS_LABELS[run.status] ?? run.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-400 tabular-nums">
                        {formatDate(run.subscribed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recente e-mails */}
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-700">Recente e-mails</h2>
            </div>
            {mailLogs.length === 0 ? (
              <p className="px-5 py-8 text-sm text-zinc-400 italic text-center">Geen e-mails gevonden</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Template</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Gepland</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Geopend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {mailLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3 text-zinc-700">
                        {log.campaign_steps?.templates?.name ?? '—'}
                        <span className="ml-2 text-xs text-zinc-400">stap {log.campaign_steps?.step_order}</span>
                      </td>
                      <td className="px-5 py-3">
                        <MailLogStatusBadge status={log.status} />
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-400 tabular-nums">
                        {formatDate(log.scheduled_at)}
                      </td>
                      <td className="px-5 py-3 text-xs tabular-nums">
                        {log.opened_at
                          ? <span className="text-green-600">{formatDate(log.opened_at)}</span>
                          : <span className="text-zinc-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Consent log */}
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-700">Consent geschiedenis</h2>
            </div>
            {consentLog.length === 0 ? (
              <p className="px-5 py-8 text-sm text-zinc-400 italic text-center">Geen consent logs</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {consentLog.map((log: any) => (
                  <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {CONSENT_EVENT_LABELS[log.event_type] ?? log.event_type}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        via {log.channel}
                        {log.ip_address && ` · ${log.ip_address}`}
                        {log.notes && ` · ${log.notes}`}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-400 whitespace-nowrap tabular-nums shrink-0">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
