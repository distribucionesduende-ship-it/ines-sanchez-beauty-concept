// api/pending.js — Vercel Serverless Function
// GET público: consulta un contrato pendiente de firma por token.
// Sin password — el propio token largo de la URL es la credencial
// (enlace enviado directamente a la novia por Inés).

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  var pendingToken = req.query.token;
  if (!pendingToken) return res.status(400).json({ ok: false, error: 'token requerido' });

  var sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
  var secret = process.env.APPS_SCRIPT_TOKEN;
  if (!sheetUrl || !secret) return res.status(500).json({ ok: false, error: 'GOOGLE_SHEET_WEBHOOK o APPS_SCRIPT_TOKEN no configurados' });

  try {
    var url = sheetUrl + (sheetUrl.indexOf('?') >= 0 ? '&' : '?') +
      'action=getPending&token=' + encodeURIComponent(secret) + '&pendingToken=' + encodeURIComponent(pendingToken);
    var controller = new AbortController();
    // Apps Script puede tardar varios segundos en "despertar" (cold
    // start) tras un periodo sin uso. 9s deja margen para eso sin
    // acercarse al límite de duración por defecto de las funciones de
    // Vercel (10s). Un timeout aquí es un fallo TRANSITORIO, no que el
    // enlace no exista — el llamante (firmar.html) debe reintentar en
    // vez de mostrar "enlace no válido".
    var timeout = setTimeout(function () { controller.abort(); }, 9000);
    var r = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    clearTimeout(timeout);
    var j = await r.json();
    if (!r.ok) return res.status(502).json({ ok: false, error: 'Error consultando el enlace', transient: true });
    return res.status(200).json(j); // {ok:true, datos} o {ok:false, error}
  } catch (err) {
    console.error('pending GET error:', err);
    return res.status(502).json({ ok: false, error: err.message, transient: true });
  }
};
