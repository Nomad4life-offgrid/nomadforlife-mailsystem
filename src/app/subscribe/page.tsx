import { subscribePublic } from './actions'

export const metadata = { title: 'Subscribe' }

export default function SubscribePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Stay in the loop</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Enter your details below. You&apos;ll receive a confirmation email to activate your subscription.
          </p>

          <form action={subscribePublic} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first_name" className="block text-xs font-medium text-zinc-600">
                  First name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  autoComplete="given-name"
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-xs font-medium text-zinc-600">
                  Last name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  autoComplete="family-name"
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-600">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Subscribe
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-zinc-400">
            We&apos;ll send you one confirmation email. No spam, unsubscribe at any time.
          </p>
        </div>
      </div>
    </div>
  )
}
