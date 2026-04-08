'use client'

import { useActionState, useRef, useState } from 'react'
import { importContacts, type ImportResult } from '../actions'

type ParsedRow = {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  contact_type?: string
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  // Detect separator
  const sep = lines[0].includes(';') ? ';' : ','

  const firstLine = lines[0].toLowerCase()
  const knownHeaders = ['email', 'e-mail', 'first_name', 'voornaam', 'last_name', 'achternaam', 'company', 'bedrijf', 'contact_type', 'type']
  const hasHeader = knownHeaders.some((h) => firstLine.includes(h))

  let headers: string[] = []
  let dataLines: string[]

  if (hasHeader) {
    headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
    dataLines = lines.slice(1)
  } else {
    // Assume single column = email only
    headers = ['email']
    dataLines = lines
  }

  // Normalize header names
  const normalizeHeader = (h: string): string => {
    if (h === 'e-mail' || h === 'mail') return 'email'
    if (h === 'voornaam' || h === 'firstname' || h === 'first name') return 'first_name'
    if (h === 'achternaam' || h === 'lastname' || h === 'last name') return 'last_name'
    if (h === 'bedrijf' || h === 'organisation' || h === 'organization') return 'company'
    if (h === 'type') return 'contact_type'
    return h
  }
  const normalizedHeaders = headers.map(normalizeHeader)

  const rows: ParsedRow[] = []
  for (const line of dataLines) {
    if (!line) continue
    const cells = line.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ''))
    const row: Record<string, string> = {}
    normalizedHeaders.forEach((h, i) => {
      if (cells[i]) row[h] = cells[i]
    })
    if (row.email) rows.push(row as ParsedRow)
  }

  return rows
}

const VALID_TYPES = ['camping', 'sponsor', 'adverteerder', 'lid', 'partner', 'prospect', 'overig']

export function ImportForm() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState<ImportResult, FormData>(importContacts, null)

  const hasResult = state !== null && !isPending

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    setRows([])
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'text/plain') {
      setFileError('Alleen CSV-bestanden zijn toegestaan.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setFileError('Geen geldige e-mailadressen gevonden in het bestand.')
        return
      }
      setRows(parsed)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function reset() {
    setRows([])
    setFileError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const previewRows = rows.slice(0, 10)
  const hasMore     = rows.length > 10
  const hasNames    = rows.some((r) => r.first_name || r.last_name)
  const hasCompany  = rows.some((r) => r.company)

  // Batch info
  const BATCH = 100
  const batches = Math.ceil(rows.length / BATCH)

  return (
    <div className="space-y-6">

      {/* Upload */}
      {!hasResult && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">CSV-bestand</h2>

          <p className="text-sm text-zinc-500">
            Verwacht formaat: kolommen gescheiden door komma of puntkomma. De eerste kolom (of kolom met header <code className="font-mono bg-zinc-100 px-1 rounded">email</code>) bevat het e-mailadres.
            Optionele extra kolommen: <code className="font-mono bg-zinc-100 px-1 rounded">first_name</code>, <code className="font-mono bg-zinc-100 px-1 rounded">last_name</code>, <code className="font-mono bg-zinc-100 px-1 rounded">company</code>, <code className="font-mono bg-zinc-100 px-1 rounded">contact_type</code>.
          </p>

          <div>
            <label
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
              htmlFor="csv-file"
            >
              <svg className="w-8 h-8 text-zinc-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm text-zinc-500">Klik om een CSV-bestand te selecteren</span>
              <span className="text-xs text-zinc-400 mt-1">.csv — max. 5.000 rijen</span>
            </label>
            <input
              ref={fileRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileChange}
              className="sr-only"
            />
            {fileError && (
              <p className="mt-2 text-sm text-red-600">{fileError}</p>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && !hasResult && (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-700">Voorbeeld — {rows.length} rijen</h2>
              {batches > 1 && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  Wordt verstuurd in {batches} batches van {BATCH} contacten
                </p>
              )}
            </div>
            <button type="button" onClick={reset} className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
              Ander bestand
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">E-mail</th>
                  {hasNames && <>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Voornaam</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Achternaam</th>
                  </>}
                  {hasCompany && <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Bedrijf</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {previewRows.map((row, i) => {
                  const isInvalidType = row.contact_type && !VALID_TYPES.includes(row.contact_type)
                  return (
                    <tr key={i} className={isInvalidType ? 'bg-yellow-50' : ''}>
                      <td className="px-5 py-2.5 font-mono text-xs text-zinc-600">{row.email}</td>
                      {hasNames && <>
                        <td className="px-5 py-2.5 text-xs text-zinc-500">{row.first_name || <span className="text-zinc-300">—</span>}</td>
                        <td className="px-5 py-2.5 text-xs text-zinc-500">{row.last_name  || <span className="text-zinc-300">—</span>}</td>
                      </>}
                      {hasCompany && <td className="px-5 py-2.5 text-xs text-zinc-500">{row.company || <span className="text-zinc-300">—</span>}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <p className="px-5 py-3 text-xs text-zinc-400 border-t border-zinc-100">
              … en nog {rows.length - 10} rijen (worden alle geïmporteerd)
            </p>
          )}
        </div>
      )}

      {/* Submit form */}
      {rows.length > 0 && !hasResult && (
        <form action={formAction}>
          <input type="hidden" name="rows" value={JSON.stringify(rows)} />

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 mb-4">
            <strong>Let op:</strong> alle {rows.length} contacten worden direct als <strong>actief en opted-in</strong> geregistreerd (bron: Import).
            Zorg dat je toestemming hebt om deze adressen te mailen.
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {isPending && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {isPending ? `Importeren… (${rows.length} contacten)` : `${rows.length} contacten importeren`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Annuleren
            </button>
          </div>
        </form>
      )}

      {/* Results */}
      {hasResult && state && (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">Importresultaat</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 text-center">
                <p className="text-2xl font-bold text-green-700">{state.imported}</p>
                <p className="text-xs text-green-600 mt-1">Geïmporteerd</p>
              </div>
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-4 text-center">
                <p className="text-2xl font-bold text-zinc-500">{state.skipped}</p>
                <p className="text-xs text-zinc-400 mt-1">Overgeslagen (al bestaand)</p>
              </div>
              <div className={`rounded-lg px-4 py-4 text-center border ${state.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-zinc-50 border-zinc-200'}`}>
                <p className={`text-2xl font-bold ${state.failed > 0 ? 'text-red-600' : 'text-zinc-400'}`}>{state.failed}</p>
                <p className={`text-xs mt-1 ${state.failed > 0 ? 'text-red-500' : 'text-zinc-400'}`}>Mislukt</p>
              </div>
            </div>

            {state.errors.length > 0 && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
                <p className="text-xs font-semibold text-red-700 mb-2">Fouten:</p>
                <ul className="space-y-1">
                  {state.errors.slice(0, 10).map((err, i) => (
                    <li key={i} className="text-xs text-red-600 font-mono">{err}</li>
                  ))}
                  {state.errors.length > 10 && (
                    <li className="text-xs text-red-400">… en nog {state.errors.length - 10} fouten</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/contacts"
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Terug naar contacten
            </a>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Nieuwe import
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
