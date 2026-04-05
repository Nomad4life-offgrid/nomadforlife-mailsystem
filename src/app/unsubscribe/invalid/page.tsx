export const metadata = { title: 'Ongeldige afmeldlink' }

export default function UnsubscribeInvalidPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">

        {/* Warning icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
          <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-lg font-semibold text-zinc-900">Ongeldige afmeldlink</h1>

        <p className="mt-2 text-sm text-zinc-500">
          Deze link is ongeldig of al eerder gebruikt. Mogelijk is de link verlopen of beschadigd.
        </p>

        <p className="mt-4 text-xs text-zinc-400">
          Wil je je afmelden? Gebruik de afmeldlink in een recente e-mail van ons,
          of neem contact met ons op.
        </p>
      </div>
    </div>
  )
}
