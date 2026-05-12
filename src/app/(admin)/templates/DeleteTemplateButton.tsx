'use client'

interface Props {
  action: () => Promise<void>
  name: string
}

export function DeleteTemplateButton({ action, name }: Props) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
        onClick={(e) => {
          const msg = `Template "${name}" verwijderen?\n\nAls deze template gebruikt wordt in funnel-stappen, worden die stappen én hun verzendlogs ook gewist. Dit kan niet ongedaan gemaakt worden.`
          if (!confirm(msg)) e.preventDefault()
        }}
      >
        Verwijderen
      </button>
    </form>
  )
}
