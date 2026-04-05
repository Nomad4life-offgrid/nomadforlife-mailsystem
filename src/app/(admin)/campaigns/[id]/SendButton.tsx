'use client'

export function SendButton({
  action,
  recipientCount,
  isAdmin,
}: {
  action:         () => Promise<void>
  recipientCount: number
  isAdmin:        boolean
}) {
  if (!isAdmin) {
    return (
      <div title="Alleen admins kunnen een campagne versturen.">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-400 cursor-not-allowed select-none"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Nu versturen
          <span className="ml-1 text-xs text-zinc-400">(admin only)</span>
        </button>
      </div>
    )
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Je staat op het punt deze campagne te verzenden aan ${recipientCount.toLocaleString(
              'nl-NL'
            )} leverbare contacten. Doorgaan?`
          )
        ) {
          e.preventDefault()
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Nu versturen
        {recipientCount > 0 && (
          <span className="ml-1 rounded-full bg-green-500 px-1.5 text-xs">
            {recipientCount.toLocaleString('nl-NL')}
          </span>
        )}
      </button>
    </form>
  )
}
