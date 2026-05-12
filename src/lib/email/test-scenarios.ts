/**
 * Test-scenario's voor de Founding Partners outreach-template.
 * Vult contact.custom_fields voor testmails zodat {{branche_zin}},
 * {{categorie_url}} en {{ps_offgrid}} herkenbaar gerenderd worden.
 */

const PS_OFFGRID =
  "P.S. Specifiek voor off-grid: deze categorie blijkt onze meest gevraagde, en we houden het aantal vermeldingen per sub-categorie (stroom, water, accu's, zonnepanelen, accessoires) bewust beperkt. Op die manier valt iedere partner op in plaats van te verdrinken in een rij logo's. Een paar plekken zijn inmiddels toegezegd, fijn als we elkaar snel kunnen spreken om te kijken of er voor jullie nog een goede positie tussen zit."

const SUBJ_FOUNDING = 'Founding Partner van Nomad4Life, eerste jaar kosteloos'
const SUBJ_SAMENW   = 'Samenwerking Nomad4Life: nieuw platform voor camperaars'
const SUBJ_VOORSTEL = 'Voorstel partnerprogramma, Nomad4Life (camper- en vanlife-platform)'

const ZIN: Record<string, string> = {
  'off-grid':     "autonoom reizen, stroom, water, accu's, zonnepanelen en alles wat je nodig hebt om los te komen van het net. Dat is precies waar onze community de hele dag mee bezig is.",
  inbouw:         'professionele camperinbouw. Vakwerk dat een leven lang meegaat is voor onze leden geen luxe maar het uitgangspunt, en daar passen jullie precies bij.',
  verhuur:        'het huren van een camper of bus. Veel van onze leden beginnen hun reis met huren voordat ze investeren, en goede verhuurders zijn dan goud waard.',
  aanschaf:       'het kopen van hun eerste of volgende camper. Dat is voor de meesten een serieuze investering, en betrouwbare aanbieders maken het verschil.',
  keuring:        'APK en camperkeuring. Onze leden willen veilig op pad, en goede keuringsbedrijven die de camperwereld kennen zijn schaarser dan je zou denken.',
  verzekeringen:  'verzekeringen voor onderweg. Een passende, eerlijke camperverzekering is niet vanzelfsprekend, onze leden vragen er regelmatig naar.',
  multi:          'camper- en vanlife-oplossingen die meerdere kanten op gaan. Dat brede aanbod is precies wat onze veelzijdige community waardeert, onze leden hebben aan één partij vaak meer dan genoeg.',
}

const CAT = (slug: string) => `https://www.nomad4life.com/campers-vans/${slug}`

export type TestScenario = {
  key:           string
  label:         string
  customFields:  Record<string, string | boolean>
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    key:   'off-grid',
    label: 'Off-grid',
    customFields: {
      bedrijfsnaam:  '12Volt Expert',
      aanhef:        'Hallo 12Volt Expert,',
      onderwerp:     SUBJ_FOUNDING,
      branche:       'off-grid',
      branches_alle: 'off-grid',
      is_multi:      false,
      sub_types:     'service off-grid',
      branche_zin:   ZIN['off-grid'],
      categorie_url: CAT('off-grid'),
      ps_offgrid:    PS_OFFGRID,
      preheader:     'Geen kleine lettertjes, geen automatische verlenging.',
    },
  },
  {
    key:   'inbouw',
    label: 'Inbouw',
    customFields: {
      bedrijfsnaam:  '4WD Specialist (Vanlife)',
      aanhef:        'Hallo 4WD Specialist,',
      onderwerp:     SUBJ_FOUNDING,
      branche:       'inbouw',
      branches_alle: 'inbouw',
      is_multi:      false,
      sub_types:     'inbouw',
      branche_zin:   ZIN.inbouw,
      categorie_url: CAT('inbouw'),
      ps_offgrid:    '',
      preheader:     'Geen kleine lettertjes, geen automatische verlenging.',
    },
  },
  {
    key:   'verhuur',
    label: 'Verhuur',
    customFields: {
      bedrijfsnaam:  'Camper Together',
      aanhef:        'Hallo Camper Together,',
      onderwerp:     SUBJ_FOUNDING,
      branche:       'verhuur',
      branches_alle: 'verhuur',
      is_multi:      false,
      sub_types:     'verhuur',
      branche_zin:   ZIN.verhuur,
      categorie_url: CAT('verhuur'),
      ps_offgrid:    '',
      preheader:     'Geen kleine lettertjes, geen automatische verlenging.',
    },
  },
  {
    key:   'aanschaf',
    label: 'Aanschaf',
    customFields: {
      bedrijfsnaam:  'All Campers',
      aanhef:        'Hallo All Campers,',
      onderwerp:     SUBJ_SAMENW,
      branche:       'aanschaf',
      branches_alle: 'aanschaf',
      is_multi:      false,
      sub_types:     'aanschaf',
      branche_zin:   ZIN.aanschaf,
      categorie_url: CAT('aanschaf'),
      ps_offgrid:    '',
      preheader:     'Een platform met leden die actief op zoek zijn naar hun volgende camper.',
    },
  },
  {
    key:   'keuring',
    label: 'Keuring',
    customFields: {
      bedrijfsnaam:  'ACT Glerum',
      aanhef:        'Hallo ACT Glerum,',
      onderwerp:     SUBJ_SAMENW,
      branche:       'keuring',
      branches_alle: 'keuring',
      is_multi:      false,
      sub_types:     'keuring',
      branche_zin:   ZIN.keuring,
      categorie_url: CAT('keuring'),
      ps_offgrid:    '',
      preheader:     'Camperaars zoeken keuringsbedrijven die de campermarkt kennen.',
    },
  },
  {
    key:   'verzekeringen',
    label: 'Verzekeringen',
    customFields: {
      bedrijfsnaam:  'ACSI Verzekeringen',
      aanhef:        'Hallo ACSI Verzekeringen,',
      onderwerp:     SUBJ_VOORSTEL,
      branche:       'verzekeringen',
      branches_alle: 'verzekeringen',
      is_multi:      false,
      sub_types:     'verzekeringen',
      branche_zin:   ZIN.verzekeringen,
      categorie_url: CAT('verzekeringen'),
      ps_offgrid:    '',
      preheader:     'Onze leden vragen actief naar passende camperverzekeringen.',
    },
  },
  {
    key:   'multi-inbouw-offgrid',
    label: 'Multi, Inbouw + Off-grid',
    customFields: {
      bedrijfsnaam:  'Aart Camperinbouw',
      aanhef:        'Hallo Aart Camperinbouw,',
      onderwerp:     SUBJ_SAMENW,
      branche:       'multi',
      branches_alle: 'inbouw, off-grid',
      is_multi:      true,
      sub_types:     'inbouw, service off-grid',
      branche_zin:   ZIN.multi,
      categorie_url: CAT('inbouw'),
      ps_offgrid:    PS_OFFGRID,
      preheader:     'Brede expertise, precies wat onze veelzijdige community zoekt.',
    },
  },
  {
    key:   'multi-keuring-verzekeringen',
    label: 'Multi, Keuring + Verzekeringen',
    customFields: {
      bedrijfsnaam:  'Camperverzekerd',
      aanhef:        'Hallo Camperverzekerd,',
      onderwerp:     SUBJ_SAMENW,
      branche:       'multi',
      branches_alle: 'keuring, verzekeringen',
      is_multi:      true,
      sub_types:     'keuring, verzekeringen',
      branche_zin:   ZIN.multi,
      categorie_url: CAT('keuring'),
      ps_offgrid:    '',
      preheader:     'Brede expertise, precies wat onze veelzijdige community zoekt.',
    },
  },
  {
    key:   'multi-aanschaf-verhuur',
    label: 'Multi, Aanschaf + Verhuur',
    customFields: {
      bedrijfsnaam:  'Dicar Motorhomes',
      aanhef:        'Hallo Dicar Motorhomes,',
      onderwerp:     SUBJ_SAMENW,
      branche:       'multi',
      branches_alle: 'aanschaf, verhuur',
      is_multi:      true,
      sub_types:     'aanschaf, verhuur',
      branche_zin:   ZIN.multi,
      categorie_url: CAT('aanschaf'),
      ps_offgrid:    '',
      preheader:     'Brede expertise, precies wat onze veelzijdige community zoekt.',
    },
  },
  {
    key:   'multi-inbouw-keuring',
    label: 'Multi, Inbouw + Keuring',
    customFields: {
      bedrijfsnaam:  'Mees Camper Center',
      aanhef:        'Hallo Mees Camper Center,',
      onderwerp:     SUBJ_SAMENW,
      branche:       'multi',
      branches_alle: 'inbouw, keuring',
      is_multi:      true,
      sub_types:     'inbouw, keuring',
      branche_zin:   ZIN.multi,
      categorie_url: CAT('inbouw'),
      ps_offgrid:    '',
      preheader:     'Brede expertise, precies wat onze veelzijdige community zoekt.',
    },
  },
]

export function getScenario(key: string | null | undefined): TestScenario | null {
  if (!key) return null
  return TEST_SCENARIOS.find((s) => s.key === key) ?? null
}
