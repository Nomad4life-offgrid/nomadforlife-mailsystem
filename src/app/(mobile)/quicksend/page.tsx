import { QuickSendForm } from './QuickSendForm'

export const metadata = { title: 'Founding Partner' }

export default function QuickSendPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-5 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Founding Partner</h1>
        <p className="text-sm text-zinc-500 mb-6">Ad-hoc verzending</p>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <QuickSendForm />
        </div>
      </div>
    </div>
  )
}
