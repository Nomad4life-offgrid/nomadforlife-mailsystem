-- ============================================================
-- NOMAD FOR LIFE — Phase 13: Extended seed data
-- Migration: 20260404000008_phase13_seed_extended
--
-- Uitbreiding van de development seed (20260403000005) met:
--   1. Phase 5-velden invullen op bestaande campagnes
--      (campaign_type, subject, template_id, audience_type, audience_group_id)
--   2. Phase 6-velden op funnel-stappen
--      (subject per stap, preview_text, send_condition)
--   3. Eenmalige (one_off) campagne met doelgroep en template
--   4. contact_type invullen op seed-contacten
--   5. Bounced contact ter testdoeleinden
--   6. opt_in_token voor pending contact
--   7. Unsubscribe event voor afgemeld contact
--   8. Activity logs (admin audit trail)
--   9. Extra mail_log varianten (failed, skipped)
--
-- NIET uitvoeren op productie.
-- ============================================================


-- ============================================================
-- 1. BESTAANDE CAMPAGNES — Phase 5-velden invullen
-- ============================================================

-- Campagne 1: funnel (Campings Outreach 2026)
-- Koppel aan doelgroep "Campings & camperplaatsen"
UPDATE campaigns
SET
  campaign_type       = 'funnel',
  subject             = NULL,          -- funnels gebruiken subject per stap
  template_id         = NULL,          -- funnels gebruiken template per stap
  audience_type       = 'group',
  audience_group_id   = (SELECT id FROM contact_groups WHERE name = 'Campings & camperplaatsen'),
  audience_segment_id = NULL
WHERE id = '22222222-0000-0000-0000-000000000001';

-- Campagne 2: één sponsormail — wordt one_off campagne
-- (was 'draft', blijft 'draft' totdat admin markeert als ready)
UPDATE campaigns
SET
  campaign_type       = 'one_off',
  subject             = 'Ontdek onze sponsormogelijkheden voor {{company}}',
  preview_text        = 'Vergroot uw zichtbaarheid bij de Nomad For Life community',
  template_id         = '11111111-0000-0000-0000-000000000004',
  audience_type       = 'group',
  audience_group_id   = (SELECT id FROM contact_groups WHERE name = 'Sponsors'),
  audience_segment_id = NULL
WHERE id = '22222222-0000-0000-0000-000000000002';

-- Campagne 3: ledennieuwsbrief — one_off, aan Leden
UPDATE campaigns
SET
  campaign_type       = 'one_off',
  subject             = 'Ledennieuwsbrief Q2 2026 — Wat er allemaal speelt',
  preview_text        = 'Updates, evenementen en ledenvoordelen voor het tweede kwartaal',
  template_id         = (SELECT id FROM templates WHERE name = 'Basis e-mailtemplate' LIMIT 1),
  audience_type       = 'group',
  audience_group_id   = (SELECT id FROM contact_groups WHERE name = 'Leden'),
  audience_segment_id = NULL
WHERE id = '22222222-0000-0000-0000-000000000003';


-- ============================================================
-- 2. FUNNEL-STAPPEN — Phase 6-velden invullen
-- ============================================================

-- Stap 1: welkomstmail — altijd verzenden
UPDATE campaign_steps
SET
  subject        = 'Welkom bij Nomad For Life, {{first_name}}!',
  preview_text   = 'We zijn blij dat je erbij bent.',
  send_condition = '{"type":"always"}'::jsonb,
  status         = 'active'
WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
  AND step_order  = 1;

-- Stap 2: follow-up dag 3 — alleen als stap 1 geopend is
UPDATE campaign_steps
SET
  subject        = 'Hoe bevalt Nomad For Life, {{first_name}}?',
  preview_text   = 'We willen graag weten hoe het gaat.',
  send_condition = '{"type":"opened_previous"}'::jsonb,
  status         = 'active'
WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
  AND step_order  = 2;

-- Stap 3: slotmail dag 7 — altijd verzenden (ook zonder open)
UPDATE campaign_steps
SET
  subject        = 'Ons laatste bericht in deze reeks, {{first_name}}',
  preview_text   = 'Bedankt voor je aandacht — we hopen je te ontmoeten.',
  send_condition = '{"type":"always"}'::jsonb,
  status         = 'active'
WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
  AND step_order  = 3;


-- ============================================================
-- 3. NIEUWE ONE_OFF CAMPAGNE — "Campings prospectmailing mei 2026"
--    Status: ready (klaar om verstuurd te worden)
-- ============================================================

INSERT INTO campaigns (
  id, name, description, status,
  campaign_type, subject, preview_text,
  template_id,
  audience_type, audience_group_id,
  from_email, from_name,
  track_opens, track_clicks,
  planned_send_at
) VALUES (
  '22222222-0000-0000-0000-000000000004',
  'Campings prospectmailing mei 2026',
  'Eerste contact met nieuwe campings en camperplaatsen uit de meidatabase.',
  'ready',

  'one_off',
  'Nomad For Life zoekt samenwerking met {{company}}',
  'Ontdek wat lidmaatschap voor uw camping betekent',

  '11111111-0000-0000-0000-000000000001',  -- Welkomstmail template

  'group',
  (SELECT id FROM contact_groups WHERE name = 'Prospects'),

  'info@nomadforlife.nl',
  'Nomad For Life',
  true,
  true,

  now() + interval '2 days'  -- gepland voor overmorgen
);


-- ============================================================
-- 4. CONTACT_TYPE INVULLEN OP BESTAANDE SEED-CONTACTEN
-- ============================================================

UPDATE contacts SET contact_type = 'camping'
WHERE id IN (
  '33333333-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000002',
  '33333333-0000-0000-0000-000000000003'
);

UPDATE contacts SET contact_type = 'sponsor'
WHERE id = '33333333-0000-0000-0000-000000000004';

UPDATE contacts SET contact_type = 'adverteerder'
WHERE id = '33333333-0000-0000-0000-000000000005';

UPDATE contacts SET contact_type = 'lid'
WHERE id = '33333333-0000-0000-0000-000000000006';

UPDATE contacts SET contact_type = 'prospect'
WHERE id = '33333333-0000-0000-0000-000000000007';


-- ============================================================
-- 5. BOUNCED CONTACT
--    Simuleert een hard-bounce zodat de UI deze status toont
-- ============================================================

INSERT INTO contacts (
  id, email, first_name, last_name, company,
  source, status, contact_type,
  opted_in, opted_in_at,
  bounced_at, bounce_type,
  tags
) VALUES (
  '33333333-0000-0000-0000-000000000009',
  'bounced@campingdehoeve.nl', 'Hans', 'Hoeve', 'Camping de Hoeve',
  'import', 'active', 'camping',
  true, now() - interval '20 days',
  now() - interval '5 days', 'hard',
  ARRAY['camping', 'nl', 'bounced']
);

INSERT INTO contact_group_members (contact_id, group_id)
SELECT '33333333-0000-0000-0000-000000000009', id
FROM contact_groups WHERE name = 'Campings & camperplaatsen'
ON CONFLICT DO NOTHING;

INSERT INTO consent_logs (contact_id, event_type, channel, notes, metadata) VALUES
  ('33333333-0000-0000-0000-000000000009', 'imported', 'import',
   'Import campings april 2026', '{"import_job_id":"55555555-0000-0000-0000-000000000001"}'::jsonb);


-- ============================================================
-- 6. OPT-IN TOKEN voor pending contact (Kees Oud)
--    Simuleert een verstuurd double opt-in bevestigingsverzoek
-- ============================================================

INSERT INTO opt_in_tokens (
  id, contact_id, token, used_at, created_at
) VALUES (
  gen_random_uuid(),
  '33333333-0000-0000-0000-000000000007',
  'dev-test-optin-token-kees-oud-0000000000000001',
  NULL,
  now() - interval '2 hours'
);


-- ============================================================
-- 7. UNSUBSCRIBE EVENT voor afgemeld contact
--    Bevestigt de opt-out die al in de contactstatus staat
-- ============================================================

INSERT INTO unsubscribe_events (
  id, contact_id, campaign_id, token, reason, used_at, ip_address, created_at
) VALUES (
  gen_random_uuid(),
  '33333333-0000-0000-0000-000000000008',
  '22222222-0000-0000-0000-000000000001',
  'dev-test-unsub-token-afgemeld-000000000000001',
  'Te veel e-mails',
  now() - interval '3 days',
  '145.22.100.55',
  now() - interval '3 days'
);


-- ============================================================
-- 8. ACTIVITY LOGS
--    Realistische admin-acties voor de activiteitshistorie
-- ============================================================

INSERT INTO activity_logs (action, entity_type, entity_id, description, metadata) VALUES

  ('campaign.created',
   'campaign', '22222222-0000-0000-0000-000000000001',
   'Campagne "Campings Outreach 2026" aangemaakt',
   '{"campaign_type":"funnel"}'::jsonb),

  ('campaign.activated',
   'campaign', '22222222-0000-0000-0000-000000000001',
   'Campagne geactiveerd — funnelstappen actief',
   '{}'::jsonb),

  ('contact.created',
   'contact', '33333333-0000-0000-0000-000000000001',
   'Contact jan.devries@kampeerparadijs.nl aangemaakt via import',
   '{"source":"import"}'::jsonb),

  ('contact.created',
   'contact', '33333333-0000-0000-0000-000000000006',
   'Contact sarah.mol@nomadlid.nl aangemaakt via website',
   '{"source":"website"}'::jsonb),

  ('contact.opted_out',
   'contact', '33333333-0000-0000-0000-000000000008',
   'Contact afgemeld@example.nl heeft zich globaal afgemeld',
   '{"reason":"Te veel e-mails"}'::jsonb),

  ('import.completed',
   'import_job', '55555555-0000-0000-0000-000000000001',
   'Import "campings_april_2026.csv" voltooid: 3/3 rijen geïmporteerd',
   '{"imported_rows":3,"skipped_rows":0,"failed_rows":0}'::jsonb),

  ('template.created',
   'template', '11111111-0000-0000-0000-000000000001',
   'Template "Welkomstmail — Campings" aangemaakt',
   '{}'::jsonb),

  ('campaign.ready',
   'campaign', '22222222-0000-0000-0000-000000000004',
   'Campagne "Campings prospectmailing mei 2026" gemarkeerd als ready',
   jsonb_build_object('planned_send_at', (now() + interval '2 days')::date)),

  ('contact.bounced',
   'contact', '33333333-0000-0000-0000-000000000009',
   'Hard bounce geregistreerd voor bounced@campingdehoeve.nl',
   '{"bounce_type":"hard"}'::jsonb);


-- ============================================================
-- 9. EXTRA MAIL LOG VARIANTEN
--    Voeg toe aan bestaande campaign runs: één failed, één skipped
-- ============================================================

DO $$
DECLARE
  run_id_jan   uuid;
  run_id_maria uuid;
  step2_id     uuid;
BEGIN
  -- Haal run IDs op
  SELECT id INTO run_id_jan
  FROM campaign_runs
  WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
    AND contact_id  = '33333333-0000-0000-0000-000000000001';

  SELECT id INTO run_id_maria
  FROM campaign_runs
  WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
    AND contact_id  = '33333333-0000-0000-0000-000000000002';

  SELECT id INTO step2_id
  FROM campaign_steps
  WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
    AND step_order  = 2;

  -- Simuleer: Jan heeft stap 2 geopend maar stap 2 log is al pending — update naar een historisch failed log
  -- (aparte extra run voor een bounced contact)

  -- Voeg een campaign run toe voor het bounced contact
  INSERT INTO campaign_runs (campaign_id, contact_id, status, subscribed_at)
  VALUES ('22222222-0000-0000-0000-000000000001',
          '33333333-0000-0000-0000-000000000009',
          'bounced', now() - interval '5 days');

  -- Haal die run op en voeg een failed mail log toe
  INSERT INTO mail_logs (
    campaign_run_id, campaign_step_id, contact_id,
    status, scheduled_at, sent_at, error_message
  )
  SELECT
    cr.id, step2_id, cr.contact_id,
    'failed',
    now() - interval '5 days',
    now() - interval '5 days',
    'Permanent delivery failure: mailbox does not exist (550 5.1.1)'
  FROM campaign_runs cr
  WHERE cr.campaign_id = '22222222-0000-0000-0000-000000000001'
    AND cr.contact_id  = '33333333-0000-0000-0000-000000000009';

  -- Maria: stap 2 overgeslagen (send_condition not met — stap 1 niet geopend)
  UPDATE mail_logs
  SET status = 'skipped'
  WHERE campaign_run_id = run_id_maria
    AND campaign_step_id = step2_id
    AND status = 'pending';

END $$;
