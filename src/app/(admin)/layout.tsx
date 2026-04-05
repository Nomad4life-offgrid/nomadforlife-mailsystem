import { NavLinks } from '@/components/admin/NavLinks'
import { UserMenu }  from '@/components/admin/UserMenu'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white flex flex-col fixed inset-y-0 left-0 z-10">
        {/* Brand */}
        <div className="px-5 py-4 border-b border-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://cdn.prod.website-files.com/6963912f728a23f003e55b49/69d2140dbd9d0b0ab56fe8fa_Nomad-for-life.webp"
            alt="Nomad For Life"
            style={{ width: '140px', height: 'auto' }}
          />
          <p className="text-xs text-zinc-400 mt-1.5">Mail System</p>
        </div>

        {/* Navigation */}
        <NavLinks />

        {/* Gebruiker + uitloggen */}
        <UserMenu />
      </aside>

      {/* Content — offset for fixed sidebar */}
      <main className="flex-1 ml-60 min-h-screen">{children}</main>
    </div>
  )
}
