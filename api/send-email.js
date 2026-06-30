// api/send-email.js — Vercel Serverless Function
// Envía notificación a DyD + confirmación a la novia vía Resend

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY no configurada en Vercel' });

  const DEST = process.env.NOTIFY_EMAIL || 'dyd@dydescuelasuperior.es';
  const FROM = 'Inés Sánchez Beauty Concept <novias@dydescuelasuperior.es>';
  const REPLY_TO = 'inesanchezbeautyconcept@gmail.com';

  try {
    const d = req.body;
    if (!d || !d.nombre) return res.status(400).json({ error: 'Datos incompletos' });

    // ---- EMAIL 1: Notificación a DyD ----
    const notifHtml = buildNotification(d);
    const r1 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [DEST], reply_to: REPLY_TO,
        subject: 'Nueva solicitud: ' + d.nombre + ' — Boda ' + (d.fechaFmt || d.fecha),
        html: notifHtml
      })
    });
    const j1 = await r1.json();
    if (!r1.ok) {
      console.error('Resend notif error:', j1);
      return res.status(500).json({ error: 'Error enviando notificación', detail: j1 });
    }

    // ---- EMAIL 2: Confirmación a la novia ----
    var r2Result = null;
    if (d.email) {
      const confirmHtml = buildConfirmation(d);
      const r2 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM, to: [d.email], reply_to: REPLY_TO,
          subject: '¡Solicitud recibida! — Inés Sánchez Beauty Concept',
          html: confirmHtml
        })
      });
      r2Result = await r2.json();
      if (!r2.ok) console.error('Resend confirm error:', r2Result);
    }

    return res.status(200).json({ ok: true, notif: j1, confirm: r2Result });

  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: err.message });
  }
};


// =================== PLANTILLA: NOTIFICACIÓN A DyD ===================
function buildNotification(d) {
  var srvNovia = (d.serviciosNovia || []).map(function(s) {
    return '<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">' + s + '</td></tr>';
  }).join('');
  var srvComb = (d.combinados || []).map(function(s) {
    return '<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">' + s + '</td></tr>';
  }).join('');
  var srvInv = (d.invitadas || []).map(function(s) {
    return '<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">' + s + '</td></tr>';
  }).join('');

  var bcInfo = '';
  if (d.beautyCorner) {
    bcInfo = '<tr><td style="padding:6px 10px;font-weight:600;background:#fff8e1;">Beauty Corner: '
      + (d.beautyCorner.hotel || '—') + ' | ' + (d.beautyCorner.dir || '—')
      + (d.beautyCorner.notas ? ' | ' + d.beautyCorner.notas : '')
      + '</td></tr>';
  }

  var dtoRow = '';
  if (d.descuentoPct > 0) {
    dtoRow = '<tr><td style="padding:6px 10px;color:#e67e22;">Descuento (' + d.descuentoPct + '%): −' + d.descuentoImporte + ' €</td></tr>';
  }

  return '<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#1a1410;margin:0;padding:0;background:#f5f0e4;">'
    + '<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'
    // Header
    + '<div style="background:#1a1410;color:#fff;padding:20px 24px;text-align:center;">'
    + '<div style="font-size:18px;letter-spacing:0.1em;">NUEVA SOLICITUD</div>'
    + '<div style="font-size:12px;color:#d4c5a0;margin-top:4px;">Inés Sánchez Beauty Concept</div>'
    + '</div>'
    // Datos personales
    + '<div style="padding:20px 24px;">'
    + '<table style="width:100%;border-collapse:collapse;font-size:14px;">'
    + '<tr style="background:#f0ebe1;"><td colspan="2" style="padding:8px 10px;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#7a6f65;">Datos personales</td></tr>'
    + row('Nombre', d.nombre)
    + row('DNI', d.dni)
    + row('Teléfono', d.tel)
    + row('Email', d.email)
    + row('Dirección', d.dir)
    + '</table>'
    // Datos evento
    + '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">'
    + '<tr style="background:#f0ebe1;"><td colspan="2" style="padding:8px 10px;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#7a6f65;">Datos del evento</td></tr>'
    + row('Fecha boda', d.fechaFmt || d.fecha)
    + row('Hora', d.hora)
    + row('Lugar evento', d.lugar || '—')
    + row('Dir. servicio', d.dirSrv)
    + row('2ª dirección', d.dirSrv2 || '—')
    + '</table>'
    // Servicios
    + '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">'
    + '<tr style="background:#f0ebe1;"><td style="padding:8px 10px;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#7a6f65;">Servicios seleccionados</td></tr>'
    + (srvNovia || '<tr><td style="padding:6px 10px;color:#999;">Ninguno</td></tr>')
    + srvComb
    + '</table>'
    // Invitadas
    + '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">'
    + '<tr style="background:#f0ebe1;"><td style="padding:8px 10px;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#7a6f65;">Invitadas</td></tr>'
    + (srvInv || '<tr><td style="padding:6px 10px;color:#999;">Sin invitadas confirmadas</td></tr>')
    + '</table>'
    // Resumen
    + '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">'
    + '<tr style="background:#f0ebe1;"><td style="padding:8px 10px;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#7a6f65;">Resumen económico</td></tr>'
    + '<tr><td style="padding:6px 10px;">Subtotal novia: ' + (d.subtotalNovia || 0) + ' €</td></tr>'
    + (d.subtotalInvitadas > 0 ? '<tr><td style="padding:6px 10px;">Subtotal invitadas: ' + d.subtotalInvitadas + ' €</td></tr>' : '')
    + dtoRow
    + '<tr><td style="padding:6px 10px;">Desplazamiento (' + (d.zona || '—') + '): ' + (d.desplazamiento || 0) + ' €</td></tr>'
    + bcInfo
    + '<tr><td style="padding:10px;font-weight:bold;font-size:16px;background:#1a1410;color:#fff;">TOTAL: ' + (d.total != null ? d.total.toFixed(2) : '—') + ' €</td></tr>'
    + '<tr><td style="padding:6px 10px;font-style:italic;color:#7a6f65;">Depósito (25%): ' + (d.deposito || '—') + ' €</td></tr>'
    + '</table>'
    // Timestamp
    + '<div style="margin-top:16px;padding:10px;background:#faf7f2;border-radius:4px;font-size:12px;color:#999;">Enviado: ' + (d.timestamp || new Date().toISOString()) + '</div>'
    + '</div></div></body></html>';
}

function row(label, value) {
  return '<tr>'
    + '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;width:35%;color:#7a6f65;">' + label + '</td>'
    + '<td style="padding:6px 10px;border-bottom:1px solid #eee;">' + (value || '—') + '</td>'
    + '</tr>';
}


// =================== PLANTILLA: CONFIRMACIÓN A LA NOVIA ===================
function buildConfirmation(d) {
  var nombre = (d.nombre || '').split(' ')[0]; // Solo el primer nombre
  var fechaTxt = d.fechaFmt || d.fecha || '';

  return '<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#1a1410;margin:0;padding:0;background:#f5f0e4;">'
    + '<div style="max-width:560px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'
    // Header elegante
    + '<div style="text-align:center;padding:32px 24px 20px;border-bottom:2px solid #1a1410;">'
    + '<div style="font-size:22px;letter-spacing:0.15em;font-weight:300;color:#1a1410;">INÉS SÁNCHEZ</div>'
    + '<div style="font-size:10px;letter-spacing:0.25em;color:#b8972a;margin-top:4px;">BEAUTY CONCEPT</div>'
    + '</div>'
    // Cuerpo
    + '<div style="padding:28px 32px;">'
    + '<p style="font-size:16px;line-height:1.7;margin:0 0 16px;">¡Hola ' + nombre + '!</p>'
    + '<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">Hemos recibido tu solicitud para los servicios de belleza de tu boda'
    + (fechaTxt ? ' del <strong>' + fechaTxt + '</strong>' : '') + '. ¡Qué ilusión!</p>'
    + '<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">Revisaremos tus datos y nos pondremos en contacto contigo en las próximas horas para confirmar los detalles y enviarte el contrato definitivo.</p>'
    + '<p style="font-size:14px;line-height:1.7;margin:0 0 24px;">Si mientras tanto tienes cualquier duda, no dudes en escribirnos.</p>'
    // Datos de contacto
    + '<div style="background:#faf7f2;border-radius:6px;padding:16px 20px;margin-bottom:20px;">'
    + '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#7a6f65;margin-bottom:8px;">Contacto</div>'
    + '<div style="font-size:14px;margin-bottom:4px;">📧 inesanchezbeautyconcept@gmail.com</div>'
    + '<div style="font-size:14px;">📍 C/ Obispo Hurtado 17, Granada</div>'
    + '</div>'
    + '<p style="font-size:14px;line-height:1.7;margin:0;">Un abrazo y ¡enhorabuena! 💛</p>'
    + '<p style="font-size:14px;font-weight:600;margin:8px 0 0;">Inés Sánchez</p>'
    + '</div>'
    // Footer
    + '<div style="text-align:center;padding:16px;background:#faf7f2;font-size:11px;color:#aaa;letter-spacing:0.06em;">'
    + 'INÉS SÁNCHEZ BEAUTY CONCEPT · ORIGAMI COSMETICS S.L. · CIF B19707660'
    + '</div>'
    + '</div></body></html>';
}
