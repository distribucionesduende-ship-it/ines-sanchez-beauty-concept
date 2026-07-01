/**
 * Code.gs.reference.js — REFERENCIA, no se ejecuta desde este repo.
 *
 * Cómo aplicar:
 * 1. Abre el Google Sheet de contratos > Extensiones > Apps Script.
 * 2. Copia TODO tu código actual del doPost dentro de la función
 *    legacyLogContract(d) de más abajo, tal cual está hoy (sin cambiarlo),
 *    salvo por UNA línea nueva: añade d.firma al final del appendRow
 *    (ver comentario dentro de legacyLogContract) y añade la columna
 *    "Firma" en la fila de cabecera del Sheet.
 * 3. Ajusta SHEET_CONTRATOS al nombre real de tu pestaña de contratos.
 * 4. Genera un SECRET_TOKEN largo y aleatorio, y ponlo aquí Y en la
 *    variable de entorno APPS_SCRIPT_TOKEN de Vercel (deben coincidir).
 * 5. IMPORTANTE: prueba todo esto primero sobre una COPIA del Sheet
 *    (Archivo > Crear una copia) con un despliegue de Web App nuevo,
 *    antes de tocar el documento real con datos de novias.
 * 6. Vuelve a desplegar el Web App (Implementar > Administrar
 *    implementaciones > Editar > Nueva versión) para que los cambios
 *    de doGet/doPost tengan efecto. La URL del Web App no cambia.
 *
 * Compatibilidad: las peticiones existentes desde api/send-email.js
 * (POST sin campo "action") siguen cayendo en legacyLogContract sin
 * ningún cambio de comportamiento.
 */

var SHEET_CONTRATOS = 'Contratos';               // <-- ajusta al nombre real de tu pestaña
var SHEET_PRECIOS   = 'Precios';                 // pestaña nueva, se crea sola si no existe
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

/* ================= LEGACY (pega aquí tu doPost actual, TAL CUAL) ================= */
function legacyLogContract(d) {
  // >>> SUSTITUYE ESTA FUNCIÓN por el cuerpo exacto de tu doPost de hoy <<<
  //
  // Encabezados reales del Sheet (fila 1), en este orden:
  //   Fecha registro, Nombre, DNI, Teléfono, Email, Dirección, Fecha boda,
  //   Hora, Lugar evento, Dir. servicio, 2ª dirección, Servicios novia,
  //   Combinados, Invitadas, Zona, Desplazamiento (€), Beauty Corner,
  //   Subtotal novia (€), Subtotal invitadas (€), Dto (%), Dto (€),
  //   Total (€), Depósito (€)
  //
  // Tu appendRow actual probablemente sea algo como:
  //   var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_CONTRATOS);
  //   sh.appendRow([
  //     d.timestamp, d.nombre, d.dni, d.tel, d.email, d.dir, d.fechaFmt,
  //     d.hora, d.lugar, d.dirSrv, d.dirSrv2,
  //     (d.serviciosNovia || []).join(' | '), (d.combinados || []).join(' | '),
  //     (d.invitadas || []).join(' | '), d.zona, d.desplazamiento,
  //     d.beautyCorner ? JSON.stringify(d.beautyCorner) : '',
  //     d.subtotalNovia, d.subtotalInvitadas, d.descuentoPct,
  //     d.descuentoImporte, d.total, d.deposito
  //   ]);
  //
  // Añade AL FINAL una columna nueva "Firma" (crea la cabecera en la
  // celda tras "Depósito (€)" si aún no existe) y añade d.firma al final
  // del array del appendRow:
  //     ...
  //     d.total, d.deposito,
  //     d.firma || ''   // <-- NUEVO: dataURL de la firma, para poder
  //                      //     regenerar el contrato desde el admin
  //   ]);
  //
  // return jsonOut({ ok: true });

  throw new Error('legacyLogContract: pega aquí tu doPost original antes de desplegar');
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
