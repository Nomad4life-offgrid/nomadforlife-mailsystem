import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateTemplate } from '../../actions'
import { TemplateEditorForm } from '../../TemplateEditorForm'

export const metadata = { title: 'Template bewerken' }

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: template } = await supabase
    .from('templates')
    .select('id, name, subject, preview_text, html_body, text_body, category')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!template) notFound()

  const updateFn = updateTemplate.bind(null, template.id)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/templates" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Terug naar templates
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Template bewerken</h1>
      </div>

      <TemplateEditorForm
        action={updateFn}
        submitLabel="Wijzigingen opslaan"
        cancelHref="/templates"
        template={template}
      />
    </div>
  )
}
