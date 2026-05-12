#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const id = process.argv[2]
const { data } = await supabase.from('templates').select('html_body').eq('id', id).single()
console.log(data.html_body)
