// api/create-pending.js — Vercel Serverless Function
// Inés crea un contrato desde admin.html y este endpoint genera un
// enlace de firma de un solo uso para que la novia lo firme sin tener
// que rellenar nada. Protegido por password de admin.

var crypto = require('crypto');

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

  var formData = req.body && req.body.formData;
  var faltantes = ['nombre', 'dni', 'tel', 'email', 'fecha', 'dirSrv'].filter(function (k) {
    return !formData || !String(formData[k] || '').trim();
  });
  if (!formData || faltantes.length) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: ' + faltantes.join(', ') });
  }
  if (!Array.isArray(formData.serviciosNovia) || formData.serviciosNovia.length === 0) {
    return res.status(400).json({ error: 'El contrato debe tener al menos un servicio para la novia' });
  }

  var pendingToken = crypto.randomBytes(24).toString('hex');

  try {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 8000);
    var r = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'savePending', token: token, pendingToken: pendingToken, datos: formData }),
      redirect: 'follow', signal: controller.signal
    });
    clearTimeout(timeout);
    var j = await r.json();
    if (!r.ok || !j.ok) return res.status(500).json({ error: 'Error guardando el pendiente', detail: j });

    var base = process.env.PUBLIC_SITE_URL || 'https://inessancheznovias.netlify.app';
    return res.status(200).json({ ok: true, token: pendingToken, link: base + '/firmar.html?token=' + pendingToken });
  } catch (err) {
    console.error('create-pending error:', err);
    return res.status(500).json({ error: err.message });
  }
};
