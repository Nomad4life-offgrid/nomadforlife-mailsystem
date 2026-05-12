#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const { data } = await supabase.from('templates').select('id, name, subject, updated_at').order('updated_at', { ascending: false })
for (const t of data) {
  console.log(`${t.id}  ${t.name}  |  ${t.subject?.slice(0, 60)}`)
}
