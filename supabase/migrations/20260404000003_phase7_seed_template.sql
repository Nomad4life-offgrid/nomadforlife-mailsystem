-- Phase 7: seed professioneel basis e-mailtemplate voor Nomad For Life
-- Wordt overgeslagen als er al een template met deze naam bestaat.

INSERT INTO templates (name, subject, preview_text, category, html_body, text_body)
SELECT
  'Basis e-mailtemplate',
  'Bericht van {{company_name}}',
  NULL,
  'general',
  $html$<!DOCTYPE html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>{{company_name}}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f4f4f5; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; }
      .mobile-padding { padding: 24px 20px !important; }
      .btn-full { width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Preview-tekst (verborgen, zichtbaar in inbox-overzicht) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f4f5;">
    Bericht van {{company_name}}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- Buitenste wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- E-mailkaart (max 600px) -->
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background-color:#18181b;padding:28px 40px;text-align:center;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.03em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                {{company_name}}
              </p>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td class="mobile-padding" style="padding:40px 48px 32px;">

              <!-- Aanhef -->
              <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Hoi {{first_name}},
              </p>

              <!-- Hoofdtekst — vervang dit door uw bericht -->
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Schrijf hier uw bericht. U kunt meerdere alinea's gebruiken en variabelen zoals
                <strong>{{first_name}}</strong> en <strong>{{company_name}}</strong> inzetten voor personalisatie.
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:#3f3f46;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Voeg hier eventueel een tweede alinea toe met meer informatie voor de ontvanger.
              </p>

              <!-- CTA-knop -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:0 0 28px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="#" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" stroke="f" fillcolor="#18181b">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:700;">Meer informatie</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="#"
                       style="background-color:#18181b;border-radius:6px;color:#ffffff;display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;line-height:44px;text-align:center;text-decoration:none;padding:0 28px;-webkit-text-size-adjust:none;">
                      Meer informatie &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Afsluiting -->
              <p style="margin:0;font-size:15px;color:#3f3f46;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Met vriendelijke groet,<br>
                Het {{company_name}}-team
              </p>

            </td>
          </tr>

          <!-- ── SCHEIDINGSLIJN ── -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top:1px solid #e4e4e7;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td class="mobile-padding" style="padding:24px 48px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#a1a1aa;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                {{company_name}} &bull; Nomad For Life Community
              </p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                U ontvangt dit bericht omdat u zich heeft ingeschreven.
                <a href="{{unsubscribe_url}}" style="color:#a1a1aa;text-decoration:underline;">Afmelden</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /E-mailkaart -->

      </td>
    </tr>
  </table>
  <!-- /Wrapper -->

</body>
</html>$html$,
  -- Tekstversie (plain text)
  $text$Hoi {{first_name}},

Schrijf hier uw bericht. U kunt variabelen zoals {{first_name}} en {{company_name}} gebruiken voor personalisatie.

Voeg hier eventueel een tweede alinea toe met meer informatie voor de ontvanger.

→ Meer informatie: [voeg URL in]

Met vriendelijke groet,
Het {{company_name}}-team

---
{{company_name}} · Nomad For Life Community
U ontvangt dit bericht omdat u zich heeft ingeschreven.
Afmelden: {{unsubscribe_url}}$text$
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE name = 'Basis e-mailtemplate' AND deleted_at IS NULL
);
