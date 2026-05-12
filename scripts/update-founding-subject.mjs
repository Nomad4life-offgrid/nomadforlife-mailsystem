#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const { error } = await supabase
  .from('templates')
  .update({ subject: '{{onderwerp}}' })
  .eq('id', '564e38f1-d466-4420-a3a1-8196fda24e52')
if (error) { console.error(error); process.exit(1) }
console.log('Subject geüpdatet naar {{onderwerp}}')
