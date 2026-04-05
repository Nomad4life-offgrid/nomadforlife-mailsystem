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
          if (!confirm(`Delete template "${name}"?`)) e.preventDefault()
        }}
      >
        Verwijderen
      </button>
    </form>
  )
}
