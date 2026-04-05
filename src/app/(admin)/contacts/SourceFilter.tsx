'use client'

export function SourceFilter({
  value,
  options,
  hiddenFields,
}: {
  value: string
  options: [string, string][]
  hiddenFields: Record<string, string>
}) {
  return (
    <form method="GET">
      {Object.entries(hiddenFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name="source"
        defaultValue={value}
        onChange={(e) => (e.currentTarget.form as HTMLFormElement)?.submit()}
        className="rounded-md border border-zinc-300 bg-white py-2 pl-3 pr-8 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
      >
        <option value="all">Alle bronnen</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </form>
  )
}
