-- ============================================================
-- NOMAD FOR LIFE — Development seed data
-- Migration: 20260403000005_seed_development
--
-- Alleen voor lokale development en staging.
-- Bevat realistische testdata voor alle tabellen.
-- NIET uitvoeren op productie.
-- ============================================================

-- ============================================================
-- TEMPLATES
-- ============================================================
INSERT INTO templates (id, name, subject, preview_text, category, html_body, text_body) VALUES

  ('11111111-0000-0000-0000-000000000001',
   'Welkomstmail — Campings',
   'Welkom bij Nomad For Life, {{first_name}}!',
   'We zijn blij dat je erbij bent.',
   'onboarding',
   '<p>Hallo {{first_name}},</p>
    <p>Welkom bij Nomad For Life! We zijn blij dat je erbij bent.</p>
    <p>In de komende dagen sturen we je meer informatie over onze diensten.</p>
    <p style="margin-top:24px">
      <a href="{{unsubscribe_url}}" style="color:#71717a;font-size:12px">Afmelden</a>
    </p>',
   'Hallo {{first_name}},

Welkom bij Nomad For Life! We zijn blij dat je erbij bent.

In de komende dagen sturen we je meer informatie over onze diensten.

Afmelden: {{unsubscribe_url}}'),

  ('11111111-0000-0000-0000-000000000002',
   'Follow-up dag 3 — Campings',
   'Nog een vraag, {{first_name}}?',
   'We willen graag weten hoe het gaat.',
   'followup',
   '<p>Hallo {{first_name}},</p>
    <p>Hoe bevalt het tot nu toe? We staan klaar als je vragen hebt.</p>
    <p>
      <a href="{{unsubscribe_url}}" style="color:#71717a;font-size:12px">Afmelden</a>
    </p>',
   'Hallo {{first_name}},

Hoe bevalt het tot nu toe? We staan klaar als je vragen hebt.

Afmelden: {{unsubscribe_url}}'),

  ('11111111-0000-0000-0000-000000000003',
   'Slotmail — Campings',
   'Laatste bericht van ons, {{first_name}}',
   'Dit is ons laatste bericht in deze reeks.',
   'followup',
   '<p>Hallo {{first_name}},</p>
    <p>Dit is het laatste bericht in onze reeks. Bedankt voor je aandacht!</p>
    <p>
      <a href="{{unsubscribe_url}}" style="color:#71717a;font-size:12px">Afmelden</a>
    </p>',
   'Hallo {{first_name}},

Dit is het laatste bericht in onze reeks. Bedankt voor je aandacht!

Afmelden: {{unsubscribe_url}}'),

  ('11111111-0000-0000-0000-000000000004',
   'Sponsorpakket introductie',
   'Onze sponsormogelijkheden voor {{company}}',
   'Ontdek wat Nomad For Life voor jou kan betekenen.',
   'general',
   '<p>Beste {{first_name}},</p>
    <p>We willen u graag informeren over onze sponsormogelijkheden bij Nomad For Life.</p>
    <p>
      <a href="{{unsubscribe_url}}" style="color:#71717a;font-size:12px">Afmelden</a>
    </p>',
   'Beste {{first_name}},

We willen u graag informeren over onze sponsormogelijkheden bij Nomad For Life.

Afmelden: {{unsubscribe_url}}');


-- ============================================================
-- CAMPAIGNS
-- ============================================================
INSERT INTO campaigns (id, name, description, status, from_email, from_name, reply_to_email, track_opens, track_clicks) VALUES

  ('22222222-0000-0000-0000-000000000001',
   'Campings Outreach 2026',
   'Drip-campagne voor campings en camperplaatsen — 3 stappen over 7 dagen.',
   'active',
   'info@nomadforlife.nl',
   'Nomad For Life',
   'info@nomadforlife.nl',
   true,
   true),

  ('22222222-0000-0000-0000-000000000002',
   'Sponsorpakket Introductie',
   'Eenmalige introductiemail voor potentiële sponsors.',
   'draft',
   'info@nomadforlife.nl',
   'Nomad For Life',
   null,
   true,
   true),

  ('22222222-0000-0000-0000-000000000003',
   'Ledennieuwsbrief Q2 2026',
   'Kwartaalupdate voor betalende leden.',
   'draft',
   'leden@nomadforlife.nl',
   'Nomad For Life — Ledenservice',
   null,
   true,
   false);


-- ============================================================
-- CAMPAIGN STEPS (funnel voor campagne 1)
-- ============================================================
INSERT INTO campaign_steps (campaign_id, template_id, step_order, delay_days, delay_hours) VALUES

  -- Stap 1: direct bij inschrijving
  ('22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   1, 0, 0),

  -- Stap 2: na 3 dagen
  ('22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000002',
   2, 3, 0),

  -- Stap 3: na 7 dagen (cumulatief = dag 7 na inschrijving)
  ('22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000003',
   3, 4, 0),   -- 3 + 4 = 7 dagen cumulatief

  -- Sponsorcampagne: 1 stap
  ('22222222-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000004',
   1, 0, 0);


-- ============================================================
-- CONTACTS
-- ============================================================
INSERT INTO contacts (id, email, first_name, last_name, company, source, status, opted_in, opted_in_at, tags) VALUES

  ('33333333-0000-0000-0000-000000000001',
   'jan.devries@kampeerparadijs.nl', 'Jan', 'de Vries', 'Kampeerparadijs Drenthe',
   'import', 'active', true, now() - interval '30 days',
   ARRAY['camping', 'nl', 'drenthe']),

  ('33333333-0000-0000-0000-000000000002',
   'maria.smit@camperplaats-zeeland.nl', 'Maria', 'Smit', 'Camperplaats Zeeland',
   'import', 'active', true, now() - interval '25 days',
   ARRAY['camping', 'nl', 'zeeland']),

  ('33333333-0000-0000-0000-000000000003',
   'piet.bakker@naturecamping.be', 'Piet', 'Bakker', 'Nature Camping België',
   'manual', 'active', true, now() - interval '15 days',
   ARRAY['camping', 'be']),

  ('33333333-0000-0000-0000-000000000004',
   'lisa.jansen@outdoorshop.nl', 'Lisa', 'Jansen', 'OutdoorShop Nederland',
   'website', 'active', true, now() - interval '10 days',
   ARRAY['sponsor', 'nl']),

  ('33333333-0000-0000-0000-000000000005',
   'tom.vandenberg@camperworks.nl', 'Tom', 'van den Berg', 'CamperWorks',
   'import', 'active', true, now() - interval '5 days',
   ARRAY['adverteerder', 'nl']),

  ('33333333-0000-0000-0000-000000000006',
   'sarah.mol@nomadlid.nl', 'Sarah', 'Mol', null,
   'website', 'active', true, now() - interval '60 days',
   ARRAY['lid']),

  ('33333333-0000-0000-0000-000000000007',
   'kees.oud@prospect.nl', 'Kees', 'Oud', 'Outdoor Events BV',
   'manual', 'pending', false, null,
   ARRAY['prospect']),

  ('33333333-0000-0000-0000-000000000008',
   'afgemeld@example.nl', 'Test', 'Afgemeld', null,
   'manual', 'opted_out', false, null,
   ARRAY[]::text[]);

-- Zet opted-out contact ook juist
UPDATE contacts
SET global_opt_out = true, unsubscribed_at = now() - interval '3 days'
WHERE id = '33333333-0000-0000-0000-000000000008';


-- ============================================================
-- CONTACT GROUPS (doelgroepen — seed al in migratie 3)
-- Voeg dev-contacten toe aan groepen
-- ============================================================
-- Haal groep-IDs op via subquery (naam is stabiel)
INSERT INTO contact_group_members (contact_id, group_id)
SELECT c.id, g.id
FROM (VALUES
  ('33333333-0000-0000-0000-000000000001', 'Campings & camperplaatsen'),
  ('33333333-0000-0000-0000-000000000002', 'Campings & camperplaatsen'),
  ('33333333-0000-0000-0000-000000000003', 'Campings & camperplaatsen'),
  ('33333333-0000-0000-0000-000000000004', 'Sponsors'),
  ('33333333-0000-0000-0000-000000000005', 'Adverteerders'),
  ('33333333-0000-0000-0000-000000000006', 'Leden'),
  ('33333333-0000-0000-0000-000000000007', 'Prospects')
) AS v(contact_id, group_name)
JOIN contacts       c ON c.id = v.contact_id::uuid
JOIN contact_groups g ON g.name = v.group_name
ON CONFLICT DO NOTHING;


-- ============================================================
-- CONTACT LISTS (formele importlijsten)
-- ============================================================
INSERT INTO contact_lists (id, name, description, source) VALUES
  ('44444444-0000-0000-0000-000000000001',
   'Import campings april 2026',
   'CSV-import van 3 campings uit de prospectlijst april 2026.',
   'import'),
  ('44444444-0000-0000-0000-000000000002',
   'Handmatige selectie sponsors Q2',
   'Handmatig samengestelde lijst voor sponsorpitch Q2.',
   'manual');

-- Voeg contacten toe aan lijsten
INSERT INTO contact_list_items (list_id, contact_id) VALUES
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001'),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002'),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003'),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004'),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000005');


-- ============================================================
-- SEGMENTS (dynamische filterscenario's)
-- ============================================================
INSERT INTO segments (name, description, filter_json) VALUES

  ('Actieve campings NL',
   'Alle actieve campings in Nederland op basis van tags.',
   '{"operator":"AND","conditions":[
     {"field":"status","op":"eq","value":"active"},
     {"field":"tags","op":"contains","value":"camping"},
     {"field":"tags","op":"contains","value":"nl"}
   ]}'::jsonb),

  ('Alle opted-in zonder actieve campagne',
   'Contacten die opted-in zijn maar nog geen actieve campaign_run hebben.',
   '{"operator":"AND","conditions":[
     {"field":"status","op":"eq","value":"active"},
     {"field":"opted_in","op":"eq","value":true}
   ]}'::jsonb),

  ('Prospects ouder dan 14 dagen',
   'Prospects die al meer dan 14 dagen pending zijn.',
   '{"operator":"AND","conditions":[
     {"field":"status","op":"eq","value":"pending"},
     {"field":"created_at","op":"lte","value":"-14 days"}
   ]}'::jsonb);


-- ============================================================
-- IMPORT JOBS (één afgeronde importrun)
-- ============================================================
INSERT INTO import_jobs (
  id, status, file_name, file_size_bytes,
  total_rows, processed_rows, imported_rows, skipped_rows, failed_rows,
  target_list_id, column_mapping, started_at, completed_at
) VALUES (
  '55555555-0000-0000-0000-000000000001',
  'completed',
  'campings_april_2026.csv',
  4820,
  3, 3, 3, 0, 0,
  '44444444-0000-0000-0000-000000000001',
  '{"email":"E-mailadres","first_name":"Voornaam","last_name":"Achternaam","company":"Bedrijfsnaam"}'::jsonb,
  now() - interval '2 hours',
  now() - interval '2 hours' + interval '4 seconds'
);

-- Koppel lijst aan import job
UPDATE contact_lists
SET import_job_id = '55555555-0000-0000-0000-000000000001'
WHERE id = '44444444-0000-0000-0000-000000000001';


-- ============================================================
-- CONSENT LOGS (audit trail voor dev-contacten)
-- ============================================================
INSERT INTO consent_logs (contact_id, event_type, channel, notes, metadata) VALUES

  ('33333333-0000-0000-0000-000000000001', 'imported',         'import', 'Import campings april 2026', '{"import_job_id":"55555555-0000-0000-0000-000000000001"}'::jsonb),
  ('33333333-0000-0000-0000-000000000001', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),

  ('33333333-0000-0000-0000-000000000002', 'imported',         'import', 'Import campings april 2026', '{"import_job_id":"55555555-0000-0000-0000-000000000001"}'::jsonb),
  ('33333333-0000-0000-0000-000000000002', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),

  ('33333333-0000-0000-0000-000000000003', 'manually_added',   'admin',  'Handmatig toegevoegd na telefonisch contact', '{}'::jsonb),
  ('33333333-0000-0000-0000-000000000003', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),

  ('33333333-0000-0000-0000-000000000006', 'opt_in',           'web',    null, '{"form":"website_inschrijfformulier"}'::jsonb),
  ('33333333-0000-0000-0000-000000000006', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),

  ('33333333-0000-0000-0000-000000000008', 'opt_in',           'web',    null, '{}'::jsonb),
  ('33333333-0000-0000-0000-000000000008', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),
  ('33333333-0000-0000-0000-000000000008', 'opt_out_global',   'email',  'Afgemeld via unsubscribe-link', '{}'::jsonb);


-- ============================================================
-- CAMPAIGN RUNS + MAIL LOGS (actieve funnel voor 3 campings)
-- ============================================================
DO $$
DECLARE
  run_id   uuid;
  step1_id uuid;
  step2_id uuid;
  step3_id uuid;
  contacts uuid[] := ARRAY[
    '33333333-0000-0000-0000-000000000001'::uuid,
    '33333333-0000-0000-0000-000000000002'::uuid,
    '33333333-0000-0000-0000-000000000003'::uuid
  ];
  c uuid;
BEGIN
  -- Haal step IDs op
  SELECT id INTO step1_id FROM campaign_steps
    WHERE campaign_id = '22222222-0000-0000-0000-000000000001' AND step_order = 1;
  SELECT id INTO step2_id FROM campaign_steps
    WHERE campaign_id = '22222222-0000-0000-0000-000000000001' AND step_order = 2;
  SELECT id INTO step3_id FROM campaign_steps
    WHERE campaign_id = '22222222-0000-0000-0000-000000000001' AND step_order = 3;

  FOREACH c IN ARRAY contacts LOOP
    -- Campaign run
    INSERT INTO campaign_runs (id, campaign_id, contact_id, status, subscribed_at)
    VALUES (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', c, 'active', now() - interval '1 day')
    RETURNING id INTO run_id;

    -- Mail log stap 1: gisteren verzonden
    INSERT INTO mail_logs (campaign_run_id, campaign_step_id, contact_id, status, scheduled_at, sent_at)
    VALUES (run_id, step1_id, c, 'sent', now() - interval '1 day', now() - interval '23 hours');

    -- Mail log stap 2: over 2 dagen gepland (pending)
    INSERT INTO mail_logs (campaign_run_id, campaign_step_id, contact_id, status, scheduled_at)
    VALUES (run_id, step2_id, c, 'pending', now() + interval '2 days');

    -- Mail log stap 3: over 6 dagen gepland (pending)
    INSERT INTO mail_logs (campaign_run_id, campaign_step_id, contact_id, status, scheduled_at)
    VALUES (run_id, step3_id, c, 'pending', now() + interval '6 days');
  END LOOP;
END $$;

-- Simuleer één geopende mail
UPDATE mail_logs SET opened_at = now() - interval '20 hours'
WHERE contact_id = '33333333-0000-0000-0000-000000000001'
  AND status = 'sent';

-- Simuleer één geklikte mail
UPDATE mail_logs SET clicked_at = now() - interval '19 hours'
WHERE contact_id = '33333333-0000-0000-0000-000000000001'
  AND status = 'sent';
