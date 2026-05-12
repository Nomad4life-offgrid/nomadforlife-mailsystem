#!/usr/bin/env node
/**
 * Zet alle pending mail_logs op scheduled_at = NOW zodat de wachtrij ze direct kan verwerken.
 */
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const now = new Date().toISOString()
const { data, error } = await supabase
  .from('mail_logs')
  .update({ scheduled_at: now })
  .eq('status', 'pending')
  .select('id')

if (error) { console.error(error); process.exit(1) }
console.log(`${data.length} pending mail_logs gereset naar scheduled_at=${now}`)
