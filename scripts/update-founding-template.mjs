#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const TEMPLATE_ID = '564e38f1-d466-4420-a3a1-8196fda24e52'

// Heading: dubbele color (op tag + op span) + -webkit-text-fill-color forceren
// dat email-clients (Gmail/Outlook) de oranje kleur niet overschrijven.
const ORANGE = '#f85d1b'
const headingStyle = `color:${ORANGE};-webkit-text-fill-color:${ORANGE};`

const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Nomad4life</title>
<style>
@media screen and (max-width:620px){
  .mobile-padding{padding-left:20px !important;padding-right:20px !important;}
  .mobile-h1{padding-top:24px !important;font-size:38px !important;line-height:1.1 !important;}
  .mobile-h2{font-size:22px !important;line-height:1.3 !important;}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
{{preheader}}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr>
<td class="mobile-padding" style="font-family:'Rubik',Arial,sans-serif;color:#090e08;font-size:14px;line-height:1.6;font-weight:400;">

<h1 class="mobile-h1" style="margin:0 0 12px 0;padding-top:60px;font-family:'Rubik',Arial,sans-serif;font-size:46px;line-height:1.1;font-weight:700;${headingStyle}">
<span style="${headingStyle}">Word Founding Partner van Nomad4Life</span>
</h1>

<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;font-weight:400;">
{{aanhef}}
</p>

<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;font-weight:400;">
Ik ben Pim Faassen, oprichter van Nomad4Life, een nieuw Nederlandstalig platform voor camperaars en vanlifers in Nederland en België, met uitbreiding naar Duitsland en het Verenigd Koninkrijk op de planning. We bouwen aan wat het meest complete camper- en vanlife-platform van Europa moet worden: community, content, evenementen, routes, camperplaatsen én een eigen app.
</p>

<p style="margin:0 0 28px 0;font-size:14px;line-height:1.6;font-weight:400;">
Ik schrijf jullie omdat <strong>{{bedrijfsnaam}}</strong> in mijn ogen precies past bij wat onze leden zoeken op het gebied van {{branche_zin}}
</p>

<h2 class="mobile-h2" style="margin:0 0 12px 0;font-family:'Rubik',Arial,sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#090e08;-webkit-text-fill-color:#090e08;">
<span style="color:#090e08;-webkit-text-fill-color:#090e08;">Eerlijk verhaal: we zijn net gestart.</span>
</h2>

<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;font-weight:400;">
Een nieuw platform heeft altijd de kip-en-ei-uitdaging: eerst leden, dan partners, of andersom? Wij draaien die vraag om. We zoeken een beperkt aantal Founding Partners die met ons meegroeien vanaf dag één. En om dat aantrekkelijk te maken:
</p>

<h2 class="mobile-h2" style="margin:0 0 12px 0;font-family:'Rubik',Arial,sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#090e08;-webkit-text-fill-color:#090e08;">
<span style="color:#090e08;-webkit-text-fill-color:#090e08;">Het hele eerste jaar is volledig kosteloos. Geen kleine lettertjes.</span>
</h2>

<p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;font-weight:400;">
Wat dat het eerste jaar concreet oplevert:
</p>

<ul style="margin:0 0 24px 20px;padding:0;font-size:14px;line-height:1.6;font-weight:400;">
<li style="margin-bottom:8px;font-size:14px;line-height:1.6;">Permanente vermelding op de relevante <a href="{{categorie_url}}" style="color:${ORANGE};text-decoration:underline;">categoriepagina</a></li>
<li style="margin-bottom:8px;font-size:14px;line-height:1.6;">Exposure in onze app, nieuwsbrief en op events die we bezoeken</li>
<li style="margin-bottom:8px;font-size:14px;line-height:1.6;">Maandelijks analyserapport: bezoekers, clickgedrag, doorklikken naar je site</li>
<li style="margin-bottom:8px;font-size:14px;line-height:1.6;">Een team dat actief landingspages en social campagnes bouwt om verkeer aan te jagen</li>
<li style="margin-bottom:0;font-size:14px;line-height:1.6;">Optioneel: jullie product verkopen via onze webshop (accessoires &amp; merchandise)</li>
</ul>

<h2 class="mobile-h2" style="margin:0 0 12px 0;font-family:'Rubik',Arial,sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#090e08;-webkit-text-fill-color:#090e08;">
<span style="color:#090e08;-webkit-text-fill-color:#090e08;">Na dat eerste jaar kies jíj.</span>
</h2>

<p style="margin:0 0 28px 0;font-size:14px;line-height:1.6;font-weight:400;">
We laten de cijfers zien (bezoekers, leads, conversie) en dan beslissen jullie rustig of je doorgaat. Geen automatische verlenging, geen verrassingen. Het risico om nu in te stappen is nul.
</p>

<h2 class="mobile-h2" style="margin:0 0 12px 0;font-family:'Rubik',Arial,sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#090e08;-webkit-text-fill-color:#090e08;">
<span style="color:#090e08;-webkit-text-fill-color:#090e08;">Wat wij beloven te doen</span>
</h2>

<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;font-weight:400;">
We zijn niet van plan stil te zitten. We bezoeken vanlife- en camperevenementen door heel Nederland en België, bouwen actief aan SEO-landingspages voor elke provincie en elk Europees land, en onze ledencommunity krijgt exclusieve content waar ze écht voor terugkomen. Eerst Nederlandse reuring, dan snel over de grens.
</p>

<p style="margin:0 0 28px 0;font-size:14px;line-height:1.6;font-weight:400;">
Sluit je aan en ik neem binnen twee werkdagen persoonlijk contact op.
</p>

<p style="margin:0 0 32px 0;text-align:center;">
<a href="https://www.nomad4life.com/samenwerken/aanmeldformulier"
style="display:inline-block;background-color:${ORANGE};color:#ffffff;-webkit-text-fill-color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 20px;font-family:'Rubik',Arial,sans-serif;font-size:13px;line-height:1.4;font-weight:700;text-transform:uppercase;">
Ja, ik word Founding Partner
</a>
</p>

<p style="margin:0 0 4px 0;font-size:14px;line-height:1.6;font-weight:400;">
Hartelijke groet,
</p>
<p style="margin:0 0 4px 0;font-size:14px;line-height:1.6;font-weight:700;">
Pim Faassen
</p>
<p style="margin:0 0 28px 0;font-size:14px;line-height:1.6;font-weight:400;color:#494A19;">
Oprichter Nomad4Life<br/>
+31 (0)6 579 158 60 · info@nomad4life.com<br/>
nomad4life.com
</p>

<p style="margin:0;font-size:14px;line-height:1.6;font-weight:400;color:#6b7280;font-style:italic;">
{{ps_offgrid}}
</p>

</td>
</tr>
<tr>
<td style="padding:32px 0 40px 0;text-align:center;font-family:'Rubik',Arial,sans-serif;">
<div style="padding-top:24px;border-top:1px solid #212121;color:#6b7280;font-size:12px;line-height:1.6;font-weight:400;">
<img src="https://cdn.prod.website-files.com/6963912f728a23f003e55b49/69d2140dbd9d0b0ab56fe8fa_Nomad-for-life.webp"
alt="Nomad For Life" width="120"
style="display:block;margin:0 auto 12px auto;height:auto;border:0;" />
<p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;">
Nomad For Life &bull; <a href="https://www.nomad4life.com" style="color:#6b7280;text-decoration:underline;">nomad4life.com</a> &bull; Freedom is a lifestyle
</p>
<p style="margin:0 0 6px 0;font-size:11px;line-height:1.6;">
Je ontvangt deze e-mail omdat je mogelijk diensten en/of producten aanbiedt, of deze in de toekomst zou kunnen aanbieden. Geen interesse? Dan kun je deze mail negeren.
</p>
<p style="margin:0;font-size:11px;line-height:1.6;">
<a href="{{unsubscribe_url}}" target="_blank" style="color:#6b7280;text-decoration:underline;">Afmelden</a>
</p>
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`

const { error } = await supabase.from('templates').update({ html_body: html }).eq('id', TEMPLATE_ID)
if (error) { console.error(error); process.exit(1) }
console.log('Template bijgewerkt.')
