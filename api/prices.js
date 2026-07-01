// api/prices.js — Vercel Serverless Function
// GET: precios actuales (proxy al Apps Script, con fallback si falla)
// POST: actualiza los precios (protegido por password de admin)

// Copia de los valores hardcoded de CFG en index.html. Si el Apps
// Script no responde o aún no tiene la pestaña "Precios" rellenada,
// el sitio público sigue funcionando con estos valores.
var FALLBACK_PRICES = {
  serviciosNovia: [
    { nom: 'Maquillaje novia', pre: 270 },
    { nom: 'Peluquería novia', pre: 270 },
    { nom: 'Maquillaje + Peluquería novia', pre: 450 }
  ],
  combinadosNovia: [
    { nom: 'Mirada que enamora', desc: 'Diseño y depilación de cejas · Lifting y tinte de pestañas', pre: 50 },
    { nom: 'Ritual de luz', desc: 'Tratamiento glow · Dermapen', pre: 110 },
    { nom: 'Detalle perfecto', desc: 'Manicura especial novia · Pedicura especial novia', pre: 50 }
  ],
  serviciosInv: [
    { nom: 'Maquillaje', pre: 65 },
    { nom: 'Peluquería', pre: 65 },
    { nom: 'Maquillaje y peluquería', pre: 110 },
    { nom: 'Manicura (desde)', pre: 15 },
    { nom: 'Tratamiento Eterna Juventud', pre: 70 }
  ],
  zonas: [
    { et: 'En el centro', nm: 'Servicio en el centro', pre: 0, bonif: null },
    { et: 'Zona A', nm: 'Granada capital y periferia', pre: 50, bonif: { m: 50, t: 100 } },
    { et: 'Zona B', nm: 'Hasta 40 km desde la capital', pre: 70, bonif: { m: 50, t: 100 } },
    { et: 'Zona C', nm: 'Resto de la provincia', pre: 100, bonif: { m: 40, t: 70 } }
  ]
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Método no permitido' });
};

async function handleGet(req, res) {
  var sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
  var token = process.env.APPS_SCRIPT_TOKEN;

  if (!sheetUrl || !token) {
    return res.status(200).json({ ok: true, source: 'fallback', updatedAt: null, precios: FALLBACK_PRICES });
  }

  try {
    var url = sheetUrl + (sheetUrl.indexOf('?') >= 0 ? '&' : '?') +
      'action=getPrecios&token=' + encodeURIComponent(token);

    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 4000);
    var r = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    clearTimeout(timeout);

    var j = await r.json();
    if (!r.ok || !j.ok || !j.precios || !isValidShape(j.precios)) {
      return res.status(200).json({ ok: true, source: 'fallback', updatedAt: null, precios: FALLBACK_PRICES });
    }
    return res.status(200).json({ ok: true, source: 'sheet', updatedAt: j.updatedAt || null, precios: j.precios });
  } catch (err) {
    console.error('prices GET error:', err);
    return res.status(200).json({ ok: true, source: 'fallback', updatedAt: null, precios: FALLBACK_PRICES });
  }
}

async function handlePost(req, res) {
  var adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return res.status(500).json({ error: 'ADMIN_PASSWORD no configurada en Vercel' });
  if (req.headers['x-admin-password'] !== adminPassword) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  var sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
  var token = process.env.APPS_SCRIPT_TOKEN;
  if (!sheetUrl || !token) return res.status(500).json({ error: 'GOOGLE_SHEET_WEBHOOK o APPS_SCRIPT_TOKEN no configurados' });

  var precios = req.body && req.body.precios;
  if (!precios || !isValidShape(precios)) return res.status(400).json({ error: 'Formato de precios inválido' });

  try {
    var r = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setPrecios', token: token, precios: precios }),
      redirect: 'follow'
    });
    var j = await r.json();
    if (!r.ok || !j.ok) return res.status(500).json({ error: 'Error guardando precios', detail: j });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('prices POST error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function isValidShape(p) {
  return p && Array.isArray(p.serviciosNovia) && p.serviciosNovia.length > 0 &&
    Array.isArray(p.combinadosNovia) && Array.isArray(p.serviciosInv) && p.serviciosInv.length > 0 &&
    Array.isArray(p.zonas) && p.zonas.length > 0;
}
