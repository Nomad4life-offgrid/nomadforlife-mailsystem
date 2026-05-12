/**
 * Branche-data voor Founding Partners outreach.
 * Eén bron voor branche_zin, onderwerp, categorie_url en ps_offgrid
 * zodat zowel het contactformulier als de testscenarios consistent zijn.
 */

export const BRANCHES = [
  'off-grid',
  'inbouw',
  'verhuur',
  'aanschaf',
  'keuring',
  'verzekeringen',
  'multi',
] as const

export type Branche = (typeof BRANCHES)[number]

export const BRANCHE_LABELS: Record<Branche, string> = {
  'off-grid':    'Off-grid',
  inbouw:        'Inbouw',
  verhuur:       'Verhuur',
  aanschaf:      'Aanschaf',
  keuring:       'Keuring',
  verzekeringen: 'Verzekeringen',
  multi:         'Multi (meerdere diensten)',
}

export const PS_OFFGRID =
  "P.S. Specifiek voor off-grid: deze categorie blijkt onze meest gevraagde, en we houden het aantal vermeldingen per sub-categorie (stroom, water, accu's, zonnepanelen, accessoires) bewust beperkt. Op die manier valt iedere partner op in plaats van te verdrinken in een rij logo's. Een paar plekken zijn inmiddels toegezegd, fijn als we elkaar snel kunnen spreken om te kijken of er voor jullie nog een goede positie tussen zit."

export const BRANCHE_ZIN: Record<Branche, string> = {
  'off-grid':    "autonoom reizen, stroom, water, accu's, zonnepanelen en alles wat je nodig hebt om los te komen van het net. Dat is precies waar onze community de hele dag mee bezig is.",
  inbouw:        'professionele camperinbouw. Vakwerk dat een leven lang meegaat is voor onze leden geen luxe maar het uitgangspunt, en daar passen jullie precies bij.',
  verhuur:       'het huren van een camper of bus. Veel van onze leden beginnen hun reis met huren voordat ze investeren, en goede verhuurders zijn dan goud waard.',
  aanschaf:      'het kopen van hun eerste of volgende camper. Dat is voor de meesten een serieuze investering, en betrouwbare aanbieders maken het verschil.',
  keuring:       'APK en camperkeuring. Onze leden willen veilig op pad, en goede keuringsbedrijven die de camperwereld kennen zijn schaarser dan je zou denken.',
  verzekeringen: 'verzekeringen voor onderweg. Een passende, eerlijke camperverzekering is niet vanzelfsprekend, onze leden vragen er regelmatig naar.',
  multi:         'camper- en vanlife-oplossingen die meerdere kanten op gaan. Dat brede aanbod is precies wat onze veelzijdige community waardeert, onze leden hebben aan één partij vaak meer dan genoeg.',
}

export const BRANCHE_SUBJECT: Record<Branche, string> = {
  'off-grid':    'Founding Partner van Nomad4Life, eerste jaar kosteloos',
  inbouw:        'Founding Partner van Nomad4Life, eerste jaar kosteloos',
  verhuur:       'Founding Partner van Nomad4Life, eerste jaar kosteloos',
  aanschaf:      'Samenwerking Nomad4Life: nieuw platform voor camperaars',
  keuring:       'Samenwerking Nomad4Life: nieuw platform voor camperaars',
  verzekeringen: 'Voorstel partnerprogramma, Nomad4Life (camper- en vanlife-platform)',
  multi:         'Samenwerking Nomad4Life: nieuw platform voor camperaars',
}

const URL_SLUG: Record<Branche, string> = {
  'off-grid':    'off-grid',
  inbouw:        'inbouw',
  verhuur:       'verhuur',
  aanschaf:      'aanschaf',
  keuring:       'keuring',
  verzekeringen: 'verzekeringen',
  multi:         'inbouw', // multi-cases linken naar inbouw als default
}

/**
 * Bouw merge-velden voor een contact gegeven branche + bedrijfsnaam.
 * Resultaat gaat in contacts.custom_fields.
 */
export function customFieldsForBranche(
  branche: Branche,
  bedrijfsnaam: string,
): Record<string, string | boolean> {
  return {
    aanhef:        `Hallo ${bedrijfsnaam},`,
    bedrijfsnaam,
    branche,
    branche_zin:   BRANCHE_ZIN[branche],
    onderwerp:     BRANCHE_SUBJECT[branche],
    categorie_url: `https://www.nomad4life.com/campers-vans/${URL_SLUG[branche]}`,
    ps_offgrid:    branche === 'off-grid' ? PS_OFFGRID : '',
    is_multi:      branche === 'multi',
  }
}

// ── Override-loader (DB) ──────────────────────────────────────────────────────

export type BrancheTextRow = {
  branche:  Branche
  zin:      string
  subject:  string
  url_slug: string
  ps_block: string
}

/**
 * Laadt branche-overrides uit de DB (tabel `branche_texts`).
 * Faalt stilletjes wanneer de tabel nog niet bestaat — fallback op hardcoded defaults.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadBrancheTexts(supabase: any): Promise<Partial<Record<Branche, BrancheTextRow>>> {
  try {
    const { data } = await supabase
      .from('branche_texts')
      .select('branche, zin, subject, url_slug, ps_block')
    if (!data) return {}
    const out: Partial<Record<Branche, BrancheTextRow>> = {}
    for (const row of data as BrancheTextRow[]) {
      if ((BRANCHES as readonly string[]).includes(row.branche)) out[row.branche] = row
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Variant van customFieldsForBranche die DB-overrides gebruikt waar aanwezig.
 */
export function customFieldsFromTexts(
  branche: Branche,
  bedrijfsnaam: string,
  texts: Partial<Record<Branche, BrancheTextRow>>,
): Record<string, string | boolean> {
  const t = texts[branche]
  const zin     = t?.zin      ?? BRANCHE_ZIN[branche]
  const subject = t?.subject  ?? BRANCHE_SUBJECT[branche]
  const slug    = t?.url_slug ?? URL_SLUG[branche]
  const psBlock = t?.ps_block ?? (branche === 'off-grid' ? PS_OFFGRID : '')

  return {
    aanhef:        `Hallo ${bedrijfsnaam},`,
    bedrijfsnaam,
    branche,
    branche_zin:   zin,
    onderwerp:     subject,
    categorie_url: `https://www.nomad4life.com/campers-vans/${slug}`,
    ps_offgrid:    psBlock,
    is_multi:      branche === 'multi',
  }
}

export function isBranche(v: unknown): v is Branche {
  return typeof v === 'string' && (BRANCHES as readonly string[]).includes(v)
}
