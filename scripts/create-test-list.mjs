#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const NAME = 'Founding Partners — Test'

const { data: existing } = await supabase
  .from('contact_groups')
  .select('id, name')
  .eq('name', NAME)
  .maybeSingle()

if (existing) {
  console.log(`Bestaat al (${existing.id}): ${existing.name}`)
  process.exit(0)
}

const { data, error } = await supabase
  .from('contact_groups')
  .insert({
    name:        NAME,
    description: 'Lege testlijst voor Founding Partners outreach. Vul handmatig met enkele contacten om een proefverzending te doen.',
    list_type:   'list',
    color:       '#10b981',
  })
  .select('id')
  .single()

if (error) { console.error(error); process.exit(1) }
console.log(`Aangemaakt: ${NAME} (${data.id})`)
