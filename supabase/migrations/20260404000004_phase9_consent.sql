-- ============================================================
-- NOMAD FOR LIFE — Fase 9: Compliance, Unsubscribe & Consent
-- Migration: 20260404000004_phase9_consent
--
-- Wat dit doet:
--   1. Aanvullende indexes op consent_logs voor audit-queries
--   2. Samengestelde index voor snel filteren per contact + type
--   3. Index op unsubscribe_events.used_at voor query op actieve tokens
--
-- AVG (GDPR) datastrategie en wording — zie onderaan dit bestand
-- ============================================================


-- ── 1. Consent logs: samengestelde index per contact + type ─────────────────
-- Versnelt de per-contact consent-history query in het admin-contactscherm.
CREATE INDEX IF NOT EXISTS idx_consent_logs_contact_event
  ON consent_logs (contact_id, event_type, created_at DESC);

-- ── 2. Consent logs: index per kanaal ──────────────────────────────────────
-- Versnelt filter op channel in de audit-pagina (/consent).
CREATE INDEX IF NOT EXISTS idx_consent_logs_channel
  ON consent_logs (channel, created_at DESC);

-- ── 3. Unsubscribe events: samengestelde index voor actieve tokens ──────────
-- Versnelt opzoeking van ongebruikte tokens per contact.
CREATE INDEX IF NOT EXISTS idx_unsubscribe_events_contact_active
  ON unsubscribe_events (contact_id, used_at)
  WHERE used_at IS NULL;


-- ============================================================
-- AVG-PROOF DATASTRATEGIE — AANBEVELINGEN VOOR NOMAD FOR LIFE
-- ============================================================
--
-- BASIS: AVG ARTIKEL 6 (RECHTSGROND) & ARTIKEL 7 (AANTOONBARE TOESTEMMING)
-- ----------------------------------------------------------------------
--
-- 1. RECHTSGROND
--    Gebruik uitsluitend "toestemming" (art. 6 lid 1 sub a) als grondslag
--    voor marketing-e-mails. Leg de grondslag vast in consent_logs.channel
--    en metadata. Transactionele mails (bevestigingen, facturen) vallen
--    onder "uitvoering overeenkomst" en zijn vrijgesteld van opt-in-vereiste.
--
-- 2. BEWIJSLAST (art. 7 lid 1)
--    De verwerkingsverantwoordelijke moet kunnen aantonen dat het datasubject
--    toestemming heeft gegeven. Dit systeem voldoet hieraan via:
--      - consent_logs: tijdstip, kanaal, IP-adres, user-agent per event
--      - unsubscribe_events: tijdstip en IP bij intrekking
--      - Append-only tabel (nooit UPDATE of DELETE op consent_logs)
--
-- 3. BEWAARTERMIJN
--    Bewaar consent_logs minimaal 3 jaar na het laatste contact.
--    Contactgegevens zelf: verwijder of anonimiseer na het verzoek van
--    het datasubject (art. 17 — recht op vergetelheid). Consent_logs
--    mogen als geanonimiseerde audit-trail bewaard blijven.
--
-- 4. WORDING E-MAIL VOETTEKST (AVG-proof)
--    Minimale vereiste tekst onderaan elke marketing-e-mail:
--
--    NL:
--      "Je ontvangt deze e-mail omdat je je hebt aangemeld bij [Bedrijfsnaam].
--       Je kunt je op elk moment afmelden via de link hieronder.
--       [Afmelden] | [Bedrijfsnaam] · [Adres] · [KVK-nummer]"
--
--    Zorg dat {{unsubscribe_url}} altijd een werkende, eenmalig bruikbare
--    link is. De List-Unsubscribe en List-Unsubscribe-Post headers worden
--    automatisch toegevoegd via de SendGrid-integratie.
--
-- 5. DUBBELE OPT-IN
--    Het systeem verplicht dubbele bevestiging voor alle publieks-aanmeldingen
--    (opt_in → opt_in_confirmed). Dit is de sterkste bewijsvorm.
--    Bewaar opt_in_tokens.used_at als tijdstempel van bevestiging.
--
-- 6. RECHT OP INZAGE (art. 15) & OVERDRAAGBAARHEID (art. 20)
--    Implementatie-aanbeveling: bouw een data-export route waarmee een
--    admin de volledige consent- en mailhistorie van één contact kan
--    downloaden als JSON of CSV.
--
-- 7. MINDERJARIGEN
--    Als de doelgroep minderjarigen kan bevatten (<16 jaar): vereis
--    toestemming van de wettelijk vertegenwoordiger (art. 8). Voeg
--    dan een geboortedatum-veld en extra consent-check toe.
--
-- 8. GEGEVENSMINIMALISATIE (art. 5 lid 1 sub c)
--    Bewaar in mail_logs geen onnodige persoonlijke data.
--    IP-adressen in consent_logs zijn noodzakelijk voor bewijslast,
--    maar hashes volstaan als privacy-by-design maatregel.
--
-- 9. VERWERKINGSREGISTER (art. 30)
--    Documenteer deze verwerking in het verwerkingsregister van
--    Nomad For Life:
--      Doel: direct-marketing via e-mail
--      Rechtsgrond: toestemming (art. 6 lid 1 sub a)
--      Datasubjecten: prospects, klanten, leden
--      Doorgifte buiten EER: SendGrid (VS) — Standard Contractual Clauses
--      Bewaartermijn: zie punt 3
-- ============================================================
