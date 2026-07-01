// api/contracts.js — Vercel Serverless Function
// GET protegido: lista los contratos guardados en el Google Sheet
// (proxy al Apps Script, action=listContracts).

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  var adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return res.status(500).json({ error: 'ADMIN_PASSWORD no configurada en Vercel' });
  if (req.headers['x-admin-password'] !== adminPassword) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  var sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
  var token = process.env.APPS_SCRIPT_TOKEN;
  if (!sheetUrl || !token) return res.status(500).json({ error: 'GOOGLE_SHEET_WEBHOOK o APPS_SCRIPT_TOKEN no configurados' });

  try {
    var url = sheetUrl + (sheetUrl.indexOf('?') >= 0 ? '&' : '?') +
      'action=listContracts&token=' + encodeURIComponent(token);

    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 8000);
    var r = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    clearTimeout(timeout);

    var j = await r.json();
    if (!r.ok || !j.ok) return res.status(502).json({ error: 'Error leyendo el Sheet', detail: j });
    return res.status(200).json({ ok: true, headers: j.headers || [], rows: j.rows || [] });
  } catch (err) {
    console.error('contracts GET error:', err);
    return res.status(502).json({ error: err.message });
  }
};
