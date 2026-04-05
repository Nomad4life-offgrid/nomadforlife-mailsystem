'use client'

interface Props {
  action: (formData: FormData) => Promise<void>
  userId: string
  email: string
}

export function RevokeRoleButton({ action, userId, email }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="user_id" value={userId} />
      <button
        type="submit"
        className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
        onClick={(e) => {
          if (!confirm(`Toegang intrekken voor ${email}?`)) e.preventDefault()
        }}
      >
        Intrekken
      </button>
    </form>
  )
}
