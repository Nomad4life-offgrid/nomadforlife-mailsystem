export const metadata = { title: 'Already subscribed' }

export default function SubscribeConfirmedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-zinc-900">Already subscribed</h1>
        <p className="mt-2 text-sm text-zinc-500">
          This email address is already confirmed and active. No further action needed.
        </p>
      </div>
    </div>
  )
}
