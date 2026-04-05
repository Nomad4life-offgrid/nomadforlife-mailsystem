'use client'

import Image from 'next/image'

const LOGO_HTML = `<img
  src="${process.env.NEXT_PUBLIC_APP_URL}/Nomad-for-life.webp"
  alt="Nomad For Life"
  width="200"
  style="display:block;max-width:200px;height:auto;margin-bottom:16px;"
>`

export function LogoSnippet() {
  function insertLogo() {
    const ta = document.getElementById('html_body') as HTMLTextAreaElement | null
    if (!ta) return

    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const before = ta.value.slice(0, start)
    const after  = ta.value.slice(end)

    ta.value = before + LOGO_HTML + '\n' + after
    ta.selectionStart = ta.selectionEnd = start + LOGO_HTML.length + 1
    ta.focus()

    // trigger React's synthetic change so form state picks it up
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, 'value'
    )?.set
    nativeInputValueSetter?.call(ta, ta.value)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  }

  return (
    <div className="flex items-center gap-4 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
      <Image
        src="/Nomad-for-life.webp"
        alt="Nomad For Life logo"
        width={120}
        height={40}
        style={{ objectFit: 'contain', height: 'auto' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-700">Nomad For Life logo</p>
        <p className="text-xs text-zinc-400 truncate font-mono">/Nomad-for-life.webp</p>
      </div>
      <button
        type="button"
        onClick={insertLogo}
        className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        Invoegen op cursor
      </button>
    </div>
  )
}
