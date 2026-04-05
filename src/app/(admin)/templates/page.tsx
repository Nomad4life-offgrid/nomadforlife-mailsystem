import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { deleteTemplate } from './actions'
import { DeleteTemplateButton } from './DeleteTemplateButton'

export const metadata = { title: 'Templates' }

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, subject, created_at, updated_at')
    .order('updated_at', { ascending: false })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Templates</h1>
          <p className="mt-1 text-sm text-zinc-500">{templates?.length ?? 0} template{templates?.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/templates/new"
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </Link>
      </div>

      {/* Empty state */}
      {templates?.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-20 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-700">No templates yet</p>
          <p className="mt-1 text-xs text-zinc-400">Templates define the content of each funnel step.</p>
          <Link
            href="/templates/new"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Create your first template
          </Link>
        </div>
      )}

      {/* Card grid */}
      {templates && templates.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const deleteFn = deleteTemplate.bind(null, t.id)
            const updatedAgo = Math.floor((Date.now() - new Date(t.updated_at).getTime()) / 86_400_000)

            return (
              <div
                key={t.id}
                className="group relative flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden hover:border-zinc-300 hover:shadow-sm transition-all"
              >
                {/* Preview strip */}
                <div className="h-24 bg-gradient-to-br from-zinc-50 to-zinc-100 border-b border-zinc-200 flex items-center justify-center px-6">
                  <div className="w-full space-y-1.5 opacity-50">
                    <div className="h-2 w-3/4 rounded bg-zinc-300" />
                    <div className="h-2 w-full rounded bg-zinc-200" />
                    <div className="h-2 w-5/6 rounded bg-zinc-200" />
                    <div className="h-2 w-2/3 rounded bg-zinc-200" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-medium text-zinc-900 truncate">{t.name}</p>
                  <p className="mt-1 text-sm text-zinc-500 truncate">
                    <span className="text-zinc-400">Subject: </span>
                    {t.subject}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    {updatedAgo === 0 ? 'Updated today' : `Updated ${updatedAgo}d ago`}
                  </p>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-zinc-100">
                    <Link
                      href={`/templates/${t.id}/edit`}
                      className="flex-1 rounded-md border border-zinc-200 px-3 py-1.5 text-center text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                    >
                      Bewerken
                    </Link>
                    <Link
                      href={`/templates/${t.id}/preview`}
                      className="flex-1 rounded-md border border-zinc-200 px-3 py-1.5 text-center text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                    >
                      Voorbeeld
                    </Link>
                    <DeleteTemplateButton action={deleteFn} name={t.name} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
