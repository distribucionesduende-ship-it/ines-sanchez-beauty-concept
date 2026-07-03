// api/cancel-reservation.js — Vercel Serverless Function
// Cancela una reserva ya confirmada (Estado -> "Cancelada") desde el
// panel admin. Protegido por password de admin.

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

  var sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
  var token = process.env.APPS_SCRIPT_TOKEN;
  if (!sheetUrl || !token) return res.status(500).json({ error: 'GOOGLE_SHEET_WEBHOOK o APPS_SCRIPT_TOKEN no configurados' });

  var d = req.body || {};
  if (!d.rowId || !d.timestampValor) {
    return res.status(400).json({ error: 'Faltan rowId o timestampValor' });
  }

  try {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 9000); // margen para cold start de Apps Script
    var r = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancelReservation', token: token, rowId: d.rowId, timestampValor: d.timestampValor }),
      redirect: 'follow', signal: controller.signal
    });
    clearTimeout(timeout);
    var j = await r.json();
    if (!r.ok || !j.ok) {
      var status = j && j.error === 'row_mismatch' ? 409 : 500;
      return res.status(status).json({ error: j.error || 'Error cancelando la reserva', detail: j });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('cancel-reservation error:', err);
    var msg = err.name === 'AbortError' ? 'Tiempo de espera agotado (Apps Script tardó demasiado), inténtalo de nuevo' : err.message;
    return res.status(502).json({ error: msg });
  }
};
