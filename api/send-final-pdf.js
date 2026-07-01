// api/send-final-pdf.js — Vercel Serverless Function
// Reenvía el contrato en PDF (ya regenerado en el admin) por email a
// la clienta, y marca la fila correspondiente como "PDF enviado" en
// el Google Sheet. Protegido por password de admin.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  var adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return res.status(500).json({ error: 'ADMIN_PASSWORD no configurada en Vercel' });
  if (req.headers['x-admin-password'] !== adminPassword) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY no configurada en Vercel' });

  var FROM = 'Inés Sánchez Beauty Concept <novias@dydescuelasuperior.es>';
  var REPLY_TO = 'inesanchezbeautyconcept@gmail.com';

  var d = req.body || {};
  if (!d.email || !d.nombre || !d.pdfBase64 || !d.filename || !d.rowId) {
    return res.status(400).json({ error: 'Datos incompletos (email, nombre, pdfBase64, filename, rowId son obligatorios)' });
  }

  try {
    var nombrePila = String(d.nombre).split(' ')[0];
    var html = '<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#1a1410;margin:0;padding:0;background:#f5f0e4;">'
      + '<div style="max-width:560px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'
      + '<div style="text-align:center;padding:32px 24px 20px;border-bottom:2px solid #1a1410;">'
      + '<div style="font-size:22px;letter-spacing:0.15em;font-weight:300;color:#1a1410;">INÉS SÁNCHEZ</div>'
      + '<div style="font-size:10px;letter-spacing:0.25em;color:#b8972a;margin-top:4px;">BEAUTY CONCEPT</div>'
      + '</div>'
      + '<div style="padding:28px 32px;">'
      + '<p style="font-size:16px;line-height:1.7;margin:0 0 16px;">¡Hola ' + nombrePila + '!</p>'
      + '<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">Adjuntamos el contrato definitivo de tus servicios de belleza para la boda. Guárdalo, incluye todos los detalles acordados.</p>'
      + '<p style="font-size:14px;line-height:1.7;margin:0 0 24px;">Cualquier duda, no dudes en escribirnos.</p>'
      + '<div style="background:#faf7f2;border-radius:6px;padding:16px 20px;margin-bottom:20px;">'
      + '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#7a6f65;margin-bottom:8px;">Contacto</div>'
      + '<div style="font-size:14px;margin-bottom:4px;">📧 inesanchezbeautyconcept@gmail.com</div>'
      + '<div style="font-size:14px;">📍 C/ Obispo Hurtado 17, Granada</div>'
      + '</div>'
      + '<p style="font-size:14px;line-height:1.7;margin:0;">Un abrazo,</p>'
      + '<p style="font-size:14px;font-weight:600;margin:8px 0 0;">Inés Sánchez</p>'
      + '</div>'
      + '<div style="text-align:center;padding:16px;background:#faf7f2;font-size:11px;color:#aaa;letter-spacing:0.06em;">'
      + 'INÉS SÁNCHEZ BEAUTY CONCEPT · ORIGAMI COSMETICS S.L. · CIF B19707660'
      + '</div>'
      + '</div></body></html>';

    var rResend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [d.email], reply_to: REPLY_TO,
        subject: 'Tu contrato firmado — Inés Sánchez Beauty Concept',
        html: html,
        attachments: [{ filename: d.filename, content: d.pdfBase64 }]
      })
    });
    var jResend = await rResend.json();
    if (!rResend.ok) {
      console.error('Resend send-final-pdf error:', jResend);
      return res.status(500).json({ error: 'Error enviando el email', detail: jResend });
    }

    var sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
    var token = process.env.APPS_SCRIPT_TOKEN;
    var sheetResult = null;
    if (sheetUrl && token) {
      try {
        var rSheet = await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'markPdfSent', token: token,
            rowId: d.rowId, timestampValor: d.timestampValor, checkColumn: 'Fecha registro'
          }),
          redirect: 'follow'
        });
        sheetResult = await rSheet.json();
        if (!sheetResult.ok) console.error('markPdfSent no ok:', sheetResult);
      } catch (sheetErr) {
        console.error('markPdfSent error:', sheetErr);
        // No bloqueante: el email ya se envió, solo falla el marcado en el Sheet
      }
    }

    return res.status(200).json({ ok: true, resend: jResend, sheet: sheetResult });
  } catch (err) {
    console.error('send-final-pdf error:', err);
    return res.status(500).json({ error: err.message });
  }
};
