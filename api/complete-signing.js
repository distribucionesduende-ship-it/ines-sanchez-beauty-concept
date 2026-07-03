// api/complete-signing.js — Vercel Serverless Function
// Se llama desde firmar.html justo después de que /api/send-email haya
// confirmado que el contrato quedó registrado. Envía el PDF ya firmado
// a Inés (algo que ningún otro flujo hace automáticamente) y borra el
// pendiente para que el enlace no se pueda reutilizar. Público: solo
// hace falta conocer el pendingToken exacto (el mismo token del enlace,
// que en este punto la novia ya tiene en su navegador).

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  var d = req.body || {};
  if (!d.pendingToken || !d.pdfBase64 || !d.filename) {
    return res.status(400).json({ ok: false, error: 'Datos incompletos (pendingToken, pdfBase64, filename son obligatorios)' });
  }

  var apiKey = process.env.RESEND_API_KEY;
  var DEST = process.env.NOTIFY_EMAIL || 'dyd@dydescuelasuperior.es';
  var FROM = 'Inés Sánchez Beauty Concept <novias@dydescuelasuperior.es>';
  var REPLY_TO = 'inesanchezbeautyconcept@gmail.com';

  var notified = false;
  var notifyError = null;

  if (apiKey) {
    try {
      var html = '<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#1a1410;margin:0;padding:0;background:#f5f0e4;">'
        + '<div style="max-width:560px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'
        + '<div style="background:#1a1410;color:#fff;padding:20px 24px;text-align:center;">'
        + '<div style="font-size:18px;letter-spacing:0.1em;">CONTRATO FIRMADO POR ENLACE</div>'
        + '<div style="font-size:12px;color:#d4c5a0;margin-top:4px;">Inés Sánchez Beauty Concept</div>'
        + '</div>'
        + '<div style="padding:24px 28px;font-size:14px;line-height:1.7;">'
        + '<p style="margin:0 0 12px;"><strong>' + (d.nombre || 'La clienta') + '</strong> ha firmado su contrato desde el enlace que le enviaste'
        + (d.fechaBoda ? ' (boda: ' + d.fechaBoda + ')' : '') + '.</p>'
        + '<p style="margin:0 0 12px;">Adjunto encontrarás el PDF firmado. Ya se ha registrado también en el Sheet de contratos.</p>'
        + (d.email ? '<p style="margin:0;color:#7a6f65;">Email de la clienta: ' + d.email + '</p>' : '')
        + '</div>'
        + '</div></body></html>';

      var rResend = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM, to: [DEST], reply_to: REPLY_TO,
          subject: 'Contrato firmado — ' + (d.nombre || 'clienta'),
          html: html,
          attachments: [{ filename: d.filename, content: d.pdfBase64 }]
        })
      });
      var jResend = await rResend.json();
      if (!rResend.ok) {
        console.error('Resend complete-signing error:', jResend);
        notifyError = jResend;
      } else {
        notified = true;
      }
    } catch (err) {
      console.error('complete-signing notify error:', err);
      notifyError = err.message;
    }
  } else {
    notifyError = 'RESEND_API_KEY no configurada';
  }

  var deleted = false;
  var sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
  var token = process.env.APPS_SCRIPT_TOKEN;
  if (sheetUrl && token) {
    try {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 9000); // margen para cold start de Apps Script
      var rSheet = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deletePending', token: token, pendingToken: d.pendingToken }),
        redirect: 'follow', signal: controller.signal
      });
      clearTimeout(timeout);
      var jSheet = await rSheet.json();
      deleted = !!(jSheet && jSheet.ok);
    } catch (err) {
      console.error('complete-signing deletePending error:', err);
    }
  }

  return res.status(200).json({ ok: true, notified: notified, notifyError: notifyError, deleted: deleted });
};
