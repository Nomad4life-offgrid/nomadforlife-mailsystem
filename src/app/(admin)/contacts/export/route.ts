import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireEditor } from '@/lib/auth/guards'

const COLUMNS = [
  'email',
  'first_name',
  'last_name',
  'company',
  'phone',
  'contact_type',
  'source',
  'status',
  'opted_in',
  'opted_in_at',
  'unsubscribed_at',
  'bounced_at',
  'global_opt_out',
  'notes',
  'created_at',
] as const

type Row = Record<(typeof COLUMNS)[number], unknown>

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(rows: Row[]): string {
  const header = COLUMNS.join(',')
  const lines = rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))
  return [header, ...lines].join('\r\n')
}

export async function GET(req: NextRequest) {
  await requireEditor()

  const { searchParams } = req.nextUrl
  const q      = searchParams.get('q')      ?? undefined
  const status = searchParams.get('status') ?? undefined
  const source = searchParams.get('source') ?? undefined

  const supabase = await createClient()

  let query = supabase
    .from('contacts')
    .select(COLUMNS.join(','))
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (q) {
    query = query.or(
      `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%`
    )
  }
  if (status === 'bounced') {
    query = query.not('bounced_at', 'is', null)
  } else if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (source && source !== 'all') {
    query = query.eq('source', source)
  }

  const { data, error } = await query.returns<Row[]>()
  if (error) {
    return new Response(`Export mislukt: ${error.message}`, { status: 500 })
  }

  const csv = toCsv(data ?? [])
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `contacten-${stamp}.csv`

  return new Response('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
