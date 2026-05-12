#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const { data: t } = await supabase.from('templates').select('html_body').eq('id', '564e38f1-d466-4420-a3a1-8196fda24e52').single()
// Extract H1 + H2 lines
const lines = t.html_body.split('\n')
console.log('--- H1 line ---')
console.log(lines.find((l) => l.includes('<h1')))
console.log('\n--- H2 lines ---')
lines.filter((l) => l.includes('<h2')).forEach((l) => console.log(l))
console.log('\n--- Mobile CSS ---')
console.log(lines.filter((l) => l.includes('mobile-h')).join('\n'))
