import Link from 'next/link'
import { createTemplate } from '../actions'
import { TemplateEditorForm } from '../TemplateEditorForm'

export const metadata = { title: 'Nieuwe template' }

export default function NewTemplatePage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/templates" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Terug naar templates
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Nieuwe template</h1>
      </div>

      <TemplateEditorForm
        action={createTemplate}
        submitLabel="Template opslaan"
        cancelHref="/templates"
      />
    </div>
  )
}
