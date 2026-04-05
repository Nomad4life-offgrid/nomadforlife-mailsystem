export const metadata = { title: 'Check your inbox' }

export default function SubscribePendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-zinc-900">Check your inbox</h1>
        <p className="mt-2 text-sm text-zinc-500">
          We&apos;ve sent you a confirmation email. Click the link inside to activate your subscription.
        </p>
        <p className="mt-3 text-xs text-zinc-400">
          Didn&apos;t receive it? Check your spam folder.
        </p>
      </div>
    </div>
  )
}
