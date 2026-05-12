#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: c } = await supabase.from('campaigns').select('id').eq('name', 'Founding Partners').single()
const { data: step } = await supabase.from('campaign_steps').select('id').eq('campaign_id', c.id).single()

// 1. Campagne terug op sending
await supabase.from('campaigns').update({ status: 'sending' }).eq('id', c.id)
console.log('Campagne "Founding Partners" terug op sending')

// 2. Skipped mail_logs naar pending
const now = new Date().toISOString()
const { data: updated } = await supabase
  .from('mail_logs')
  .update({ status: 'pending', scheduled_at: now, retry_count: 0, sent_at: null, error_message: null })
  .eq('campaign_step_id', step.id)
  .eq('status', 'skipped')
  .select('id')

console.log(`${updated.length} skipped mail_logs gereset naar pending`)
console.log('Klik nu "Verwerk wachtrij" op de Founding Partners campagnepagina.')
