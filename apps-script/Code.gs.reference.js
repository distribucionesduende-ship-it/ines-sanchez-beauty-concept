/**
 * Code.gs.reference.js — REFERENCIA, no se ejecuta desde este repo.
 *
 * Cómo aplicar:
 * 1. Abre el Google Sheet de contratos ("Inés Sánchez — Contratos") >
 *    Extensiones > Apps Script.
 * 2. Sustituye TODO el contenido actual por este archivo.
 * 3. Genera un SECRET_TOKEN largo y aleatorio, y ponlo aquí Y en la
 *    variable de entorno APPS_SCRIPT_TOKEN de Vercel (deben coincidir).
 * 4. IMPORTANTE: prueba primero sobre una COPIA del Sheet (Archivo >
 *    Crear una copia) con un despliegue de Web App nuevo, antes de
 *    tocar el documento real con datos de novias.
 * 5. Vuelve a desplegar el Web App (Implementar > Administrar
 *    implementaciones > Editar > Nueva versión) para que los cambios
 *    de doGet/doPost tengan efecto. La URL del Web App no cambia.
 *
 * Compatibilidad: las peticiones existentes desde api/send-email.js
 * (POST sin campo "action") siguen cayendo en legacyLogContract, que
 * reproduce el doPost original tal cual, solo añadiendo la firma como
 * última columna.
 *
 * Nota sobre la pestaña: legacyLogContract usaba antes
 * getActiveSheet(), que en un Web App no siempre apunta de forma
 * fiable a la pestaña de contratos (depende de cuál estuviera activa
 * la última vez que alguien abrió el documento a mano). Ahora que
 * añadimos una pestaña nueva "Precios", ese riesgo se vuelve real, así
 * que aquí se fija por nombre ("Hoja 1") en su lugar.
 */

var SHEET_CONTRATOS = 'Hoja 1';                   // pestaña real de contratos
var SHEET_PRECIOS   = 'Precios';                  // pestaña nueva, se crea sola si no existe
var SECRET_TOKEN    = 'CAMBIA_ESTE_TOKEN_LARGO';  // debe coincidir con APPS_SCRIPT_TOKEN en Vercel

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'JSON inválido' });
  }

  if (body.action) {
    if (body.token !== SECRET_TOKEN) return jsonOut({ ok: false, error: 'token inválido' });
    if (body.action === 'setPrecios') return handleSetPrecios(body);
    if (body.action === 'markPdfSent') return handleMarkPdfSent(body);
    return jsonOut({ ok: false, error: 'action no reconocida' });
  }

  // ---- LEGACY: comportamiento actual para las peticiones de api/send-email.js ----
  return legacyLogContract(body);
}

function doGet(e) {
  var action = e.parameter.action;
  if (!action) return jsonOut({ ok: false, error: 'action requerida' });
  if (e.parameter.token !== SECRET_TOKEN) return jsonOut({ ok: false, error: 'token inválido' });
  if (action === 'getPrecios') return handleGetPrecios();
  if (action === 'listContracts') return handleListContracts();
  return jsonOut({ ok: false, error: 'action no reconocida' });
}

/* ================= LEGACY (doPost original, con la firma añadida) ================= */
function legacyLogContract(d) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONTRATOS);

    // Crea la cabecera "Firma" la primera vez (columna 24, justo tras
    // "Depósito (€)"); en llamadas siguientes ya existe y no hace nada.
    ensureColumn(sheet, 'Firma');

    sheet.appendRow([
      d.timestamp || new Date().toISOString(),
      d.nombre || '',
      d.dni || '',
      d.tel || '',
      d.email || '',
      d.dir || '',
      d.fechaFmt || d.fecha || '',
      d.hora || '',
      d.lugar || '',
      d.dirSrv || '',
      d.dirSrv2 || '',
      (d.serviciosNovia || []).join(' | '),
      (d.combinados || []).join(' | '),
      (d.invitadas || []).join(' | '),
      d.zona || '',
      d.desplazamiento || 0,
      d.beautyCorner ? ('Hotel: ' + (d.beautyCorner.hotel || '-') + ' | Dir: ' + (d.beautyCorner.dir || '-') + (d.beautyCorner.notas ? ' | ' + d.beautyCorner.notas : '')) : '',
      d.subtotalNovia || 0,
      d.subtotalInvitadas || 0,
      d.descuentoPct || 0,
      d.descuentoImporte || 0,
      d.total != null ? d.total : 0,
      d.deposito || 0,
      d.firma || ''   // NUEVO: dataURL de la firma, para regenerar el contrato desde el admin
    ]);

    return jsonOut({ ok: true });

  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

// Test manual: ejecuta esto desde el editor para verificar permisos.
// Borra la fila de prueba del Sheet después de comprobar que funciona.
function testWebhook() {
  var e = {
    postData: {
      contents: JSON.stringify({
        timestamp: new Date().toISOString(),
        nombre: 'TEST — Borrar esta fila',
        dni: '00000000T',
        tel: '600000000',
        email: 'test@test.com',
        dir: 'Dirección de prueba',
        fecha: '2027-01-01',
        fechaFmt: '1/1/2027',
        hora: '12:00',
        lugar: 'Lugar de prueba',
        dirSrv: 'Dir servicio prueba',
        dirSrv2: '',
        serviciosNovia: ['Maquillaje novia: 270 €'],
        combinados: [],
        invitadas: [],
        zona: 'Granada capital',
        desplazamiento: 50,
        beautyCorner: null,
        subtotalNovia: 270,
        subtotalInvitadas: 0,
        descuentoPct: 0,
        descuentoImporte: 0,
        total: 320,
        deposito: '80.00',
        firma: ''
      })
    }
  };
  var result = doPost(e);
  Logger.log(result.getContent());
}

/* ================= PRECIOS ================= */
function handleGetPrecios() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_PRECIOS);
  if (!sh) return jsonOut({ ok: true, precios: null, updatedAt: null });
  var raw = sh.getRange('B1').getValue();
  var updatedAt = sh.getRange('B2').getValue();
  if (!raw) return jsonOut({ ok: true, precios: null, updatedAt: null });
  try {
    return jsonOut({ ok: true, precios: JSON.parse(raw), updatedAt: updatedAt || null });
  } catch (err) {
    return jsonOut({ ok: true, precios: null, updatedAt: null, error: 'JSON corrupto en Precios!B1' });
  }
}

function handleSetPrecios(body) {
  if (!body.precios) return jsonOut({ ok: false, error: 'falta "precios"' });
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_PRECIOS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_PRECIOS);
    sh.getRange('A1').setValue('precios_json');
    sh.getRange('A2').setValue('actualizado');
  }
  sh.getRange('B1').setValue(JSON.stringify(body.precios));
  sh.getRange('B2').setValue(new Date().toISOString());
  return jsonOut({ ok: true });
}

/* ================= LISTADO DE CONTRATOS ================= */
function handleListContracts() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_CONTRATOS);
  if (!sh) return jsonOut({ ok: false, error: 'Hoja de contratos no encontrada' });
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return jsonOut({ ok: true, headers: [], rows: [] });

  var headers = data[0].map(function (h) { return String(h || '').trim(); });
  var rows = [];
  for (var r = 1; r < data.length; r++) {
    var vals = data[r];
    if (vals.join('') === '') continue;
    var obj = { rowId: r + 1 };
    headers.forEach(function (h, i) { obj[h] = vals[i]; });
    rows.push(obj);
  }
  return jsonOut({ ok: true, headers: headers, rows: rows });
}

/* ================= MARCAR PDF ENVIADO ================= */
function handleMarkPdfSent(body) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_CONTRATOS);
  if (!sh) return jsonOut({ ok: false, error: 'Hoja de contratos no encontrada' });

  var rowId = Number(body.rowId);
  if (!rowId || rowId < 2) return jsonOut({ ok: false, error: 'rowId inválido' });

  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var checkColName = body.checkColumn || 'Fecha registro';
  var checkCol = headers.indexOf(checkColName) + 1;
  if (checkCol > 0 && body.timestampValor) {
    var actual = sh.getRange(rowId, checkCol).getValue();
    if (String(actual) !== String(body.timestampValor)) {
      return jsonOut({ ok: false, error: 'row_mismatch' });
    }
  }

  var colEnviado = ensureColumn(sh, 'PDF enviado');
  var colFecha = ensureColumn(sh, 'Fecha envío PDF');
  sh.getRange(rowId, colEnviado).setValue('Sí');
  sh.getRange(rowId, colFecha).setValue(new Date().toISOString());
  return jsonOut({ ok: true });
}

// Índice 1-indexed de una columna por nombre de cabecera; la crea al
// final si no existe. Nunca reordena ni borra columnas existentes.
function ensureColumn(sh, headerName) {
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === headerName) return i + 1;
  }
  var newCol = lastCol + 1;
  sh.getRange(1, newCol).setValue(headerName);
  return newCol;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
