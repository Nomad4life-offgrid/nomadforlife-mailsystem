import { requireEditor } from '@/lib/auth/guards'

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  await requireEditor()
  return (
    <div className="min-h-screen bg-zinc-50">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      {children}
    </div>
  )
}
