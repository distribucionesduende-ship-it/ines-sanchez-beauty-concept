// contract-pdf.js — Generación del contrato (HTML + PDF), compartida
// entre index.html (formulario público) y admin.html (reenvío desde
// el panel de administración). Sin dependencias propias; usa las
// librerías globales html2canvas y jsPDF ya cargadas por la página.

window.ContractPDF = (function(){

  // Construye el HTML de las 2 páginas del contrato a partir de un
  // objeto `d` con la misma forma que el `formData` que se envía a
  // /api/send-email (nombre, dni, tel, email, dir, fechaFmt, hora,
  // lugar, dirSrv, dirSrv2, serviciosNovia[], combinados[], invitadas[],
  // zona, desplazamiento, beautyCorner, subtotalNovia, subtotalInvitadas,
  // descuentoPct, descuentoImporte, total, deposito, firma), más dos
  // campos extra que no viajan al backend: `hoy` (fecha de firma, texto
  // ya formateado) y `logoB64` (opcional; sin él se usa un logo de texto).
  function buildHTML(d){
    var logoHTML = d.logoB64
      ? '<img class="cp-logo" src="data:image/png;base64,'+d.logoB64+'" alt="Inés Sánchez Beauty Concept">'
      : '<div style="font-family:Georgia,serif;text-align:center;"><div style="font-size:20px;letter-spacing:2px;">INÉS SÁNCHEZ</div><div style="font-size:10px;letter-spacing:4px;color:#b8972a;">BEAUTY CONCEPT</div></div>';

    var firmaHTML = d.firma
      ? '<img src="'+d.firma+'">'
      : '<span style="font-size:8pt;color:#999;">(firma no disponible)</span>';

    var novTabla = [].concat(d.serviciosNovia || [], d.combinados || [])
      .map(function(s){ return '<tr><td>'+s+'</td></tr>'; }).join('');
    if(!novTabla) novTabla = '<tr><td style="font-style:italic;color:#7a6f65;">Sin servicios seleccionados</td></tr>';

    var invTabla = (d.invitadas && d.invitadas.length)
      ? d.invitadas.map(function(s){ return '<tr><td>'+s+'</td></tr>'; }).join('')
      : '<tr><td style="font-style:italic;color:#7a6f65;">A confirmar mediante Anexo al contrato</td></tr>';

    var bcHTML = '';
    if(d.beautyCorner){
      bcHTML = '<div class="cp-nota"><strong>BEAUTY CORNER</strong> &mdash; Espacio: '+(d.beautyCorner.hotel||'—')+' | Dirección: '+(d.beautyCorner.dir||'—')+(d.beautyCorner.notas?'<br>Notas: '+d.beautyCorner.notas:'')+'<br><em>El presupuesto se coordinará y reflejará como Anexo al contrato principal.</em></div>';
    }

    var despFila = '';
    if(d.desplazamiento > 0){
      despFila = '<tr><td colspan="2">Desplazamiento — '+(d.zona||'—')+'</td><td style="text-align:right;font-weight:bold;">'+d.desplazamiento+' €</td></tr>';
    }

    var dtoFila = '';
    if(d.descuentoPct > 0){
      dtoFila = '<tr><td colspan="2" style="color:#e67e22;">Descuento comercial ('+d.descuentoPct+'%)</td><td style="text-align:right;font-weight:bold;color:#e67e22;">&minus;'+Number(d.descuentoImporte||0).toFixed(2)+' €</td></tr>';
    }

    return '<div class="cp-page">'
      +'<div class="cp-header">'+logoHTML+'<div class="cp-subtitle">C/ Obispo Hurtado 17, Granada &middot; inesanchezbeautyconcept@gmail.com</div></div>'
      +'<div class="cp-titulo">CONTRATO BODA</div>'
      +'<p class="cp-parrafo">De una parte, <strong>ORIGAMI COSMETICS S.L.</strong>, con CIF B19707660, y domicilio social en C/ Obispo Hurtado 17 de Granada Capital, representada en este acto por D. Álvaro Quirós Labella, con DNI 44278736X en calidad de Administrador y representante legal, en adelante <em>"LA EMPRESA"</em>.</p>'
      +'<p class="cp-parrafo">Y de otra, <strong>'+d.nombre+'</strong>, con DNI: '+d.dni+(d.dir?', domicilio en '+d.dir:'')+', en adelante <em>"LA CLIENTA"</em>.</p>'
      +'<p class="cp-parrafo">INÉS SÁNCHEZ BEAUTY CONCEPT es la marca comercial bajo la cual LA EMPRESA presta los servicios objeto del presente contrato. Ambas partes reconocen tener capacidad legal suficiente para suscribir el presente contrato, y ORIGAMI COSMETICS S.L. acuerda proporcionar a LA CLIENTA los servicios que se enumeran a continuación:</p>'
      +'<table><caption>TABLA I &mdash; DATOS DEL SERVICIO</caption>'
      +'<tr><th>NOMBRE</th><td>'+d.nombre+'</td><th>EMAIL</th><td>'+d.email+'</td></tr>'
      +'<tr><th>FECHA BODA</th><td>'+(d.fechaFmt||d.fecha||'—')+'</td><th>HORA</th><td>'+(d.hora||'—')+'</td></tr>'
      +'<tr><th>LUGAR EVENTO</th><td>'+(d.lugar||'—')+'</td><th>TELÉFONO</th><td>'+d.tel+'</td></tr>'
      +'<tr><th>DIR. SERVICIO</th><td>'+d.dirSrv+'</td><th>2ª DIRECCIÓN</th><td>'+(d.dirSrv2||'—')+'</td></tr>'
      +'</table>'
      +'<table><caption>SERVICIOS PARA LA NOVIA</caption>'
      +'<tr><th>Servicio</th></tr>'
      +novTabla+'</table>'
      +'<table><caption>SERVICIOS PARA INVITADAS (confirmadas a la firma)</caption>'
      +'<tr><th>Invitada</th></tr>'
      +invTabla+'</table>'
      +'<div class="cp-nota">Las invitadas podrán ampliarse mediante <strong>Anexo al presente contrato</strong>, sin coste de gestión adicional. El precio final se ajustará según los servicios confirmados.</div>'
      +bcHTML
      +'<table><caption>RESUMEN ECONÓMICO</caption>'
      +'<tr><th colspan="2">Concepto</th><th style="text-align:right;">Importe</th></tr>'
      +'<tr><td colspan="2">Subtotal servicios novia</td><td style="text-align:right;font-weight:bold;">'+(d.subtotalNovia||0)+' €</td></tr>'
      +(d.subtotalInvitadas>0?'<tr><td colspan="2">Subtotal servicios invitadas</td><td style="text-align:right;font-weight:bold;">'+d.subtotalInvitadas+' €</td></tr>':'')
      +dtoFila
      +despFila
      +'<tr class="cp-total-row"><td colspan="2">TOTAL ESTIMADO (IVA incluido)</td><td style="text-align:right;">'+Number(d.total||0).toFixed(2)+' €</td></tr>'
      +'<tr class="cp-dep-row"><td colspan="2">Depósito inicial (25%) a abonar al formalizar</td><td style="text-align:right;">'+d.deposito+' €</td></tr>'
      +'</table>'
      +'</div>'
      // PÁGINA 2
      +'<div class="cp-page">'
      +'<div class="cp-header" style="padding-bottom:5mm;margin-bottom:5mm;"><strong style="font-size:11pt;letter-spacing:.05em;">TÉRMINOS Y CONDICIONES</strong></div>'
      +'<div class="cp-clausula"><strong>1. Objeto</strong><span>Prestación de servicios de peluquería y/o estética, incluyendo maquillaje, manicuras, pedicuras o tratamientos faciales o corporales, con motivo del enlace matrimonial.</span></div>'
      +'<div class="cp-clausula"><strong>2. Servicios</strong><span>Tiempo estándar ~45 min/persona. Excluidos trabajos de complejidad excepcional, a valorar por LA EMPRESA según criterio profesional y comunicado a LA CLIENTA con antelación. Servicios extra: presupuestados y pactados aparte. El precio incluye hasta dos sesiones de prueba de maquillaje y/o peluquería, a realizar tras la firma del contrato, en fechas a coordinar con LA EMPRESA: la primera, muy recomendable aunque no obligatoria; la segunda, opcional según necesidad. En la primera prueba se presentan dos propuestas — una según las indicaciones de LA CLIENTA y otra de creación de la especialista — de las cuales LA CLIENTA selecciona la que se toma como referencia para el servicio del día del evento. LA CLIENTA deberá aportar en la prueba los complementos personales (pasadores, diademas, tocados, etc.) que desee incorporar al resultado final; su ausencia puede afectar al resultado obtenido, sin responsabilidad de LA EMPRESA por dicha variación. Si LA CLIENTA no asiste a ninguna prueba, el servicio se realizará según criterio profesional de LA EMPRESA.</span></div>'
      +'<div class="cp-clausula"><strong>3. Precio y Pago</strong><span>Precios con IVA incluido. Pago en tres plazos, referidos siempre a la fecha de la boda: 25% en concepto de depósito de reserva al firmar el contrato (no reembolsable, salvo desistimiento según cláusula 4) · 25% adicional entre 8 y 6 semanas antes de la boda · 50% restante, como máximo 7 días antes de la boda. Formas de pago: transferencia, tarjeta o efectivo. El impago de cualquier plazo en la fecha indicada faculta a LA EMPRESA a suspender la prestación del servicio hasta su regularización. El precio pactado en la firma se mantiene fijo, sin perjuicio de los ajustes derivados de las cláusulas 5 y 11.</span></div>'
      +'<div class="cp-clausula"><strong>4. Cancelación</strong><span>Desistimiento: 7 días naturales desde la firma, con devolución íntegra del depósito, siempre que ese plazo termine con 30 o más días de antelación a la boda. Cancelación con 30+ días de antelación a la boda (fuera del plazo de desistimiento): se retiene el depósito (25%); se devuelve cualquier cantidad adicional ya abonada. Cancelación con menos de 30 días de antelación: no procede devolución de ninguna cantidad abonada. Cancelación por LA EMPRESA sin causa: devolución íntegra.</span></div>'
      +'<div class="cp-clausula"><strong>5. Cambios</strong><span>Modificaciones sobre los servicios de LA NOVIA ya contratados (horario, ubicación, tipo de servicio) solicitadas por LA CLIENTA: sin coste si se comunican con 10 o más días de antelación a la boda. Con menos de 10 días: recargo del 20% sobre el importe de los servicios de la novia recogido en la Tabla I del contrato en el momento de su firma inicial, en concepto de reorganización de agenda y logística. Las ampliaciones de servicios para invitadas se rigen por la cláusula 11.</span></div>'
      +'<div class="cp-clausula"><strong>6. Obligaciones</strong><span>Espacio con electricidad, agua e higiene adecuadas. LA CLIENTA deberá informar con antelación de aquellas condiciones médicas o alergias que puedan afectar a la prestación de los servicios contratados (p. ej. alergias a productos cosméticos, afecciones cutáneas o capilares, tratamientos dermatológicos recientes). LA EMPRESA no responde de reacciones o incidencias derivadas de condiciones no comunicadas.</span></div>'
      +'<div class="cp-clausula"><strong>7. Responsabilidad</strong><span>Seguro de RC profesional. Sin responsabilidad por causas ajenas: tráfico, fuerza mayor, condiciones del local no imputables a LA EMPRESA.</span></div>'
      +'<div class="cp-clausula"><strong>8. Fuerza Mayor</strong><span>Personal sustituto de equivalente cualificación o reembolso íntegro de cantidades abonadas por servicios no prestados.</span></div>'
      +'<div class="cp-clausula"><strong>9. Datos Personales</strong><span>Los datos facilitados serán tratados por ORIGAMI COSMETICS S.L. con la finalidad de gestionar la relación contractual y prestar los servicios objeto de este contrato, sobre la base de la ejecución del contrato (art. 6.1.b RGPD). Se conservarán durante la vigencia de la relación contractual y, posteriormente, durante los plazos legales de prescripción de responsabilidades. LA CLIENTA puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad en inesanchezbeautyconcept@gmail.com, y presentar reclamación ante la AEPD (www.aepd.es). Información completa en la Política de Privacidad: https://inessancheznovias.netlify.app/privacidad.html. Uso de imágenes con fines publicitarios: tratamiento independiente, que no condiciona la prestación del servicio. LA CLIENTA otorga su consentimiento marcando la casilla habilitada a tal efecto en el formulario de contratación, revocable en cualquier momento.</span></div>'
      +'<div class="cp-clausula"><strong>10. Desplazamientos</strong><span>Sin desplazamiento: servicio en el centro (C/ Obispo Hurtado 17, Granada). Zona A (Granada capital): 50€ · Zona B (hasta 40km): 70€ · Zona C (resto provincia): 100€ + 0,26€/km. Bonif. A y B: 50% (3–5 extras) / 100% (6+). Bonif. C: 40% (3–5 extras) / 70% (6+). Aplicadas en factura final si todos los servicios son en mismo lugar y horario.</span></div>'
      +'<div class="cp-clausula"><strong>11. Invitadas</strong><span>Coordinadas por LA CLIENTA como contratante principal. Podrán ampliarse en cualquier momento, incluido el mismo día del evento, mediante Anexo al presente contrato y sin coste de gestión ni recargo, siempre sujeto a la disponibilidad de personal y tiempo del equipo de LA EMPRESA en ese momento. LA EMPRESA se reserva el derecho a no admitir ampliaciones que no pueda atender con las garantías de calidad y tiempo habituales. El precio final se ajustará según los servicios efectivamente confirmados.</span></div>'
      +'<div class="cp-clausula"><strong>12. Jurisdicción</strong><span>Legislación española. Tribunales de Granada, salvo disposición en contrario aplicable a consumidores. LA CLIENTA tiene a su disposición hojas de reclamaciones oficiales.</span></div>'
      +'<div style="margin-top:8mm;border-top:1pt solid #ddd5c8;padding-top:6mm;">'
      +'<div class="firmas-grid">'
      +'<div class="firma-box"><div class="fb-tit">LA EMPRESA</div><div class="fb-dat"><strong>ORIGAMI COSMETICS S.L.</strong></div><div class="fb-dat">C.I.F.: B19707660</div><div class="fb-dat">Álvaro Quirós Labella</div><div class="fb-dat">DNI: 44278736X</div><div class="fb-img"></div><div class="fb-fecha">FECHA: '+d.hoy+'</div></div>'
      +'<div class="firma-box"><div class="fb-tit">LA CLIENTA</div><div class="fb-dat"><strong>'+d.nombre+'</strong></div><div class="fb-dat">DNI: '+d.dni+'</div><div class="fb-img">'+firmaHTML+'</div><div class="fb-fecha">FECHA: '+d.hoy+'</div></div>'
      +'</div>'
      +'<p style="font-size:7pt;color:#aaa;text-align:center;margin-top:5mm;">Firma digital con validez legal según Reglamento (UE) 910/2014 (eIDAS).</p>'
      +'</div>'
      +'<div class="cp-pie">INÉS SÁNCHEZ BEAUTY CONCEPT · ORIGAMI COSMETICS S.L. · CIF B19707660 · inesanchezbeautyconcept@gmail.com</div>'
      +'</div>';
  }

  // Renderiza el HTML ya inyectado en `containerEl` (debe contener los
  // `.cp-page` a capturar) a un PDF, vía html2canvas + jsPDF. Devuelve
  // una Promise<Blob>. Si opts.download !== false, además dispara la
  // descarga en el navegador (comportamiento histórico para el
  // formulario público); admin.html puede pasar {download:false} para
  // solo obtener el blob sin descargarlo también localmente.
  function renderToPDF(containerEl, nombreArchivo, opts){
    opts = opts || {};
    var download = opts.download !== false;
    return new Promise(function(resolve, reject){
      var contenedor = containerEl;

      // Forzar reflow del DOM tras inyectar el HTML
      void contenedor.offsetHeight;
      void contenedor.getBoundingClientRect();

      // Esperar a que TODAS las imágenes (logo, firma) carguen
      var imgs = contenedor.querySelectorAll('img');
      var promesasImg = Array.from(imgs).map(function(img){
        if(img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise(function(res){
          img.onload = res;
          img.onerror = res;
          setTimeout(res, 3000);
        });
      });

      // Escala adaptativa: 1.5 en móvil (evita errores de memoria), 2 en desktop
      var esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      var escala = esMovil ? 1.5 : 2;

      Promise.all(promesasImg).then(function(){
        // Pausa de 200ms para render completo de fuentes y estilos
        return new Promise(function(r){ setTimeout(r, 200); });
      }).then(function(){
        if(typeof html2canvas === 'undefined'){
          return reject(new Error('Librería html2canvas no cargada. Revisa tu conexión a internet.'));
        }
        if(typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF){
          return reject(new Error('Librería jsPDF no cargada. Revisa tu conexión a internet.'));
        }

        var rect = contenedor.getBoundingClientRect();
        console.log('[Contrato] Contenedor:', rect.width, 'x', rect.height);
        if(rect.width < 100 || rect.height < 100){
          return reject(new Error('El contenedor del contrato no se ha renderizado. Recarga la página y vuelve a intentarlo.'));
        }

        var jsPDF = window.jspdf.jsPDF;
        var pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true });
        var paginas = contenedor.querySelectorAll('.cp-page');
        if(paginas.length === 0){
          return reject(new Error('No se ha podido generar el contenido del contrato.'));
        }
        console.log('[Contrato] Páginas:', paginas.length, '| Escala:', escala, '| Móvil:', esMovil);

        var procesarPagina = function(index){
          if(index >= paginas.length){
            try {
              if(download) pdf.save(nombreArchivo + '.pdf');
              var blob = pdf.output('blob');
              return resolve(blob);
            } catch(e) { return reject(e); }
          }
          html2canvas(paginas[index], {
            scale: escala, useCORS: true, allowTaint: false,
            backgroundColor: '#ffffff', logging: false,
            windowWidth: 794, width: 794, imageTimeout: 5000,
            foreignObjectRendering: false
          }).then(function(canvas){
            console.log('[Contrato] Pág.', index+1, ':', canvas.width, 'x', canvas.height);
            if(canvas.width < 10 || canvas.height < 10){
              return reject(new Error('La captura de la página '+(index+1)+' está vacía.'));
            }
            var imgData = canvas.toDataURL('image/jpeg', 0.92);
            if(index > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            setTimeout(function(){ procesarPagina(index + 1); }, 50);
          }).catch(function(err){
            console.error('[Contrato] Error pág.', index+1, err);
            reject(err);
          });
        };
        procesarPagina(0);
      }).catch(reject);
    });
  }

  return { buildHTML: buildHTML, renderToPDF: renderToPDF };
})();
