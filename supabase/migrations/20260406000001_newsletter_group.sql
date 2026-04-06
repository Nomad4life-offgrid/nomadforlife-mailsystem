-- ============================================================
-- NOMAD FOR LIFE — Nieuwsbrief groep
-- Migration: 20260406000001_newsletter_group
--
-- Maakt een vaste contact_group aan voor nieuwsbriefinschrijvingen
-- via de Webflow website. De UUID is stabiel zodat de Webflow
-- webhook er hard naar kan verwijzen.
-- ============================================================

INSERT INTO contact_groups (id, name, description, list_type, is_locked)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Nieuwsbrief',
  'Inschrijvingen via de Webflow website — dubbele opt-in vereist.',
  'list',
  false
)
ON CONFLICT (id) DO NOTHING;
