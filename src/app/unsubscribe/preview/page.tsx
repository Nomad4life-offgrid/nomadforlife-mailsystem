export const metadata = { title: 'Afmelden — voorbeeld' }

export default function UnsubscribePreviewPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
          <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
        </div>

        <h1 className="text-lg font-semibold text-zinc-900">Testmail — geen echte afmelding</h1>

        <p className="mt-2 text-sm text-zinc-500">
          Dit is de afmeldpagina zoals ontvangers die zien. In echte mails wordt deze link vervangen door een persoonlijke afmeldlink.
        </p>

      </div>
    </div>
  )
}
