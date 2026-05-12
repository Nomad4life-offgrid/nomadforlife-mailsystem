-- ============================================================
-- BRANCHE_TEXTS
-- Per-branche merge-tekst (zin, onderwerp, categoriepagina, PS-blok)
-- Editable via /settings/branche-texts.
-- ============================================================

CREATE TABLE IF NOT EXISTS branche_texts (
  branche    text        PRIMARY KEY,
  zin        text        NOT NULL,
  subject    text        NOT NULL,
  url_slug   text        NOT NULL,
  ps_block   text        NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed met de 7 branches (idempotent: bestaande rijen worden niet overschreven)
INSERT INTO branche_texts (branche, zin, subject, url_slug, ps_block) VALUES
  (
    'off-grid',
    'autonoom reizen, stroom, water, accu''s, zonnepanelen en alles wat je nodig hebt om los te komen van het net. Dat is precies waar onze community de hele dag mee bezig is.',
    'Founding Partner van Nomad4Life, eerste jaar kosteloos',
    'off-grid',
    'P.S. Specifiek voor off-grid: deze categorie blijkt onze meest gevraagde, en we houden het aantal vermeldingen per sub-categorie (stroom, water, accu''s, zonnepanelen, accessoires) bewust beperkt. Op die manier valt iedere partner op in plaats van te verdrinken in een rij logo''s. Een paar plekken zijn inmiddels toegezegd, fijn als we elkaar snel kunnen spreken om te kijken of er voor jullie nog een goede positie tussen zit.'
  ),
  (
    'inbouw',
    'professionele camperinbouw. Vakwerk dat een leven lang meegaat is voor onze leden geen luxe maar het uitgangspunt, en daar passen jullie precies bij.',
    'Founding Partner van Nomad4Life, eerste jaar kosteloos',
    'inbouw',
    ''
  ),
  (
    'verhuur',
    'het huren van een camper of bus. Veel van onze leden beginnen hun reis met huren voordat ze investeren, en goede verhuurders zijn dan goud waard.',
    'Founding Partner van Nomad4Life, eerste jaar kosteloos',
    'verhuur',
    ''
  ),
  (
    'aanschaf',
    'het kopen van hun eerste of volgende camper. Dat is voor de meesten een serieuze investering, en betrouwbare aanbieders maken het verschil.',
    'Samenwerking Nomad4Life: nieuw platform voor camperaars',
    'aanschaf',
    ''
  ),
  (
    'keuring',
    'APK en camperkeuring. Onze leden willen veilig op pad, en goede keuringsbedrijven die de camperwereld kennen zijn schaarser dan je zou denken.',
    'Samenwerking Nomad4Life: nieuw platform voor camperaars',
    'keuring',
    ''
  ),
  (
    'verzekeringen',
    'verzekeringen voor onderweg. Een passende, eerlijke camperverzekering is niet vanzelfsprekend, onze leden vragen er regelmatig naar.',
    'Voorstel partnerprogramma, Nomad4Life (camper- en vanlife-platform)',
    'verzekeringen',
    ''
  ),
  (
    'multi',
    'camper- en vanlife-oplossingen die meerdere kanten op gaan. Dat brede aanbod is precies wat onze veelzijdige community waardeert, onze leden hebben aan één partij vaak meer dan genoeg.',
    'Samenwerking Nomad4Life: nieuw platform voor camperaars',
    'inbouw',
    ''
  )
ON CONFLICT (branche) DO NOTHING;
