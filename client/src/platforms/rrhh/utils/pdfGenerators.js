import { formatLongDateUTC, formatDateUTC } from '../../../utils/rutUtils';

// Si rutUtils no tiene estas funciones, se pueden re-implementar aquí si son privadas.
// Veamos cómo estaban definidas en Finiquitos.jsx:
const formatLongDateUTCLocal = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getUTCDate()).padStart(2, '0');
        const months = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const month = months[d.getUTCMonth()];
        const year = d.getUTCFullYear();
        return `${day} de ${month} de ${year}`;
    } catch (e) {
        return '';
    }
};

const formatDateUTCLocal = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return '';
    }
};

export const generateCartaTerminoPdf = (candidato, data) => {
    const { cartaFechaTermino, cartaCausal, cartaHechos, cartaFechaAviso } = data;
    
    if (!candidato) return alert('Selecciona un colaborador.');
    if (!cartaFechaTermino) return alert('Ingresa la fecha de término.');
    if (!cartaCausal) return alert('Selecciona la causal legal.');
    if (!cartaHechos) return alert('Ingresa los hechos que fundan la causal.');

    const fechaAvisoStr = cartaFechaAviso
        ? formatLongDateUTCLocal(cartaFechaAviso)
        : formatLongDateUTCLocal(new Date().toISOString());
        
    const fechaTerminoStr = formatLongDateUTCLocal(cartaFechaTermino);
    
    const empresaNombre = candidato.empresaRef?.nombre || 'Empresa Empleadora';
    
    const html = `
        <html>
        <head>
            <title>Carta de Aviso de Término de Contrato - ${candidato.fullName}</title>
            <style>
                body { font-family: 'Arial', sans-serif; color: #1e293b; margin: 50px; line-height: 1.6; font-size: 12px; }
                .header { text-align: right; margin-bottom: 40px; font-weight: bold; color: #475569; }
                .destinatario { margin-bottom: 30px; }
                .destinatario p { margin: 3px 0; }
                .titulo { text-align: center; font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 30px; color: #0f172a; }
                .cuerpo { text-align: justify; margin-bottom: 25px; }
                .hechos-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; margin: 15px 0; border-radius: 8px; font-style: italic; }
                .cotizaciones { margin-bottom: 30px; font-weight: bold; color: #1e293b; }
                .firmas { display: flex; justify-content: space-between; margin-top: 80px; }
                .firma-box { width: 45%; text-align: center; }
                .linea { border-top: 1px solid #475569; margin-top: 60px; margin-bottom: 5px; }
                .info-dt { font-size: 10px; color: #64748b; margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 10px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="header">
                Rancagua, ${fechaAvisoStr}
            </div>
            
            <div class="destinatario">
                <p><strong>Señor(a):</strong></p>
                <p><strong>${candidato.fullName}</strong></p>
                <p>RUT: ${candidato.rut}</p>
                <p>Domicilio: ${candidato.address || 'No registrado'}</p>
                <p>Presente</p>
            </div>
            
            <div class="titulo">
                Comunicación de Término de Relación Laboral
            </div>
            
            <div class="cuerpo">
                Por medio de la presente, y de conformidad a lo establecido en los artículos 162 y siguientes del Código del Trabajo, venimos en comunicar a usted la decisión de esta empresa de poner término al contrato de trabajo que nos vincula, a contar del <strong>${fechaTerminoStr}</strong>.
            </div>
            
            <div class="cuerpo">
                La causal legal en la que se fundamenta esta decisión es la del <strong>${cartaCausal}</strong>.
            </div>
            
            <div class="cuerpo">
                <strong>Hechos en que se funda el término del contrato:</strong>
                <div class="hechos-box">
                    ${cartaHechos.replace(/\n/g, '<br />')}
                </div>
            </div>
            
            <div class="cotizaciones">
                Asimismo, en cumplimiento a lo dispuesto en la Ley N° 19.631 (Ley Bustos), dejamos expresa constancia de que sus cotizaciones previsionales, de salud y del seguro de desempleo se encuentran totalmente declaradas y pagadas a los organismos correspondientes a la fecha de término de su contrato de trabajo. Adjuntamos a esta comunicación los certificados previsionales impresos correspondientes.
            </div>
            
            <div class="cuerpo">
                Agradecemos los servicios prestados a la compañía durante la vigencia de su contrato y le solicitamos presentarse a la brevedad para realizar el pago de sus haberes previsionales y firma del correspondiente finiquito de contrato de trabajo.
            </div>
            
            <div class="firmas">
                <div class="firma-box">
                    <div class="linea"></div>
                    <p><strong>${empresaNombre}</strong></p>
                    <p>EMPLEADOR / REPRESENTANTE LEGAL</p>
                </div>
                <div class="firma-box">
                    <div class="linea"></div>
                    <p><strong>${candidato.fullName}</strong></p>
                    <p>FIRMA DE RECEPCIÓN TRABAJADOR</p>
                    <p>Fecha de recepción: ____/____/________</p>
                </div>
            </div>
            
            <div class="info-dt">
                Nota al Empleador: De conformidad con el artículo 162 del Código del Trabajo, recuerde que debe enviar una copia exacta de esta comunicación a la Inspección del Trabajo respectiva dentro de los plazos legales contados desde la separación del trabajador (3 días hábiles para Art. 161; 6 días hábiles para causales de los Artículos 159 y 160).
            </div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return alert('No se pudo abrir la ventana de impresión. Por favor, desactiva el bloqueador de popups.');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
};

export const generateFiniquitoPdf = (candidato) => {
    const fd = candidato.finiquitoDetalle || {};
    const fechaFiniquitoStr = candidato.fechaFiniquito
        ? formatLongDateUTCLocal(candidato.fechaFiniquito)
        : formatLongDateUTCLocal(new Date().toISOString());
    
    const fechaIngresoStr = candidato.contractStartDate
        ? formatDateUTCLocal(candidato.contractStartDate)
        : (fd.fechaIngresoReal ? formatDateUTCLocal(fd.fechaIngresoReal) : 'No registrada');
        
    const fechaEgresoStr = candidato.fechaFiniquito
        ? formatDateUTCLocal(candidato.fechaFiniquito)
        : (fd.fechaEgreso ? formatDateUTCLocal(fd.fechaEgreso) : 'No registrada');

    const empresaNombre = candidato.empresaRef?.nombre || 'Empresa Empleadora';
    const causalTermino = fd.causalTermino || candidato.finiquitoMotivo || 'Necesidades de la empresa (Art. 161)';

    const aniosServicio = fd.aniosServicioCalculados || 0;
    const montoIAS = fd.montoIndemnizacionAnos || 0;
    const montoISAP = fd.montoIndemnizacionAviso || 0;
    const montoFP = fd.montoFeriadoProporcional || 0;
    const diasFP = fd.diasVacacionesCorridosCalculados || 0;
    const diasHabilesFP = fd.diasVacacionesHabilesCalculados || 0;
    const otrosHaberes = fd.otrosHaberes || 0;
    
    const pagarDiasProporcionales = fd.pagarDiasProporcionales || false;
    const diasTrabajadosMes = fd.diasTrabajadosMes || 0;
    const montoSueldoProporcional = fd.montoSueldoProporcional || 0;
    const montoColacionProporcional = fd.montoColacionProporcional || 0;
    const montoMovilizacionProporcional = fd.montoMovilizacionProporcional || 0;
    const montoGratificacionProporcional = fd.montoGratificacionProporcional || 0;
    const totalHaberesProporcionales = pagarDiasProporcionales ? (montoSueldoProporcional + montoColacionProporcional + montoMovilizacionProporcional + montoGratificacionProporcional) : 0;

    const indemnizacionVoluntaria = fd.indemnizacionVoluntaria || 0;
    const aguinaldosOtros = fd.aguinaldosOtros || 0;

    const descuentoAnticipos = fd.descuentoAnticipos || 0;
    const descuentoPrestamoCaja = fd.descuentoPrestamoCaja || 0;
    const descuentoPrestamoEmpresa = fd.descuentoPrestamoEmpresa || 0;
    const descuentoAfpProporcional = fd.descuentoAfpProporcional || 0;
    const descuentoSaludProporcional = fd.descuentoSaludProporcional || 0;
    const descuentoAfcProporcional = fd.descuentoAfcProporcional || 0;
    const descuentoSeguroColectivo = fd.descuentoSeguroColectivo || 0;
    const descuentoEquiposNoDevueltos = fd.descuentoEquiposNoDevueltos || 0;
    
    const descuentoAFC = fd.descuentoAFC || 0;
    const otrosDescuentos = fd.otrosDescuentos || 0;
    const netoFiniquito = fd.netoFiniquito !== undefined ? fd.netoFiniquito : 0;

    const totalHaberes = montoIAS + montoISAP + montoFP + otrosHaberes + totalHaberesProporcionales + indemnizacionVoluntaria + aguinaldosOtros;
    const totalDescuentos = descuentoAFC + otrosDescuentos + descuentoAnticipos + descuentoPrestamoCaja + descuentoPrestamoEmpresa + descuentoAfpProporcional + descuentoSaludProporcional + descuentoAfcProporcional + descuentoSeguroColectivo + descuentoEquiposNoDevueltos;

    const html = \`
        <html>
        <head>
            <title>Acta de Finiquito - \${candidato.fullName}</title>
            <style>
                body { font-family: 'Arial', sans-serif; color: #1e293b; margin: 40px; line-height: 1.5; font-size: 12px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { font-size: 18px; font-weight: 800; margin: 0; text-transform: uppercase; color: #0f172a; }
                .header p { font-size: 11px; margin: 5px 0 0 0; color: #64748b; font-weight: bold; }
                .body-text { margin-bottom: 20px; text-align: justify; }
                .table-title { font-weight: bold; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; color: #334155; }
                table { border-collapse: collapse; margin-bottom: 20px; width: 100%; }
                th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                th { background: #f1f5f9; font-weight: bold; font-size: 11px; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .section { margin-top: 25px; }
                .reserva-box { border: 2px dashed #94a3b8; padding: 15px; margin-top: 25px; border-radius: 8px; background: #f8fafc; }
                .reserva-title { font-weight: 900; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
                .firmas { display: flex; justify-content: space-between; margin-top: 60px; }
                .firma-box { width: 45%; text-align: center; }
                .linea { border-top: 1px solid #475569; margin-top: 50px; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>\${fd.procesadoEn === 'Notaria' ? 'Acta de Finiquito de Contrato de Trabajo (Legalizado ante Notario)' : 'Acta de Finiquito de Contrato de Trabajo'}</h1>
                <p>\${fd.procesadoEn === 'Notaria' ? \`PROCESADO EN: \${fd.notariaNombre || 'NOTARÍA PÚBLICA'}\` : 'DIRECCIÓN DEL TRABAJO COMPLIANT'}</p>
            </div>
            
            <div class="body-text">
                En la ciudad de Rancagua, Chile, a \${fechaFiniquitoStr}, comparecen por una parte <strong>\${empresaNombre}</strong>, en adelante "el Empleador", y por la otra don (ña) <strong>\${candidato.fullName}</strong>, nacionalidad \${candidato.nationality || 'Chilena'}, cédula de identidad N° <strong>\${candidato.rut}</strong>, de profesión u oficio <strong>\${candidato.position || 'Colaborador'}</strong>, domiciliado(a) en \${candidato.address || 'No registrado'}, en adelante "el Trabajador", quienes dejan constancia de lo siguiente:
            </div>

            <div class="body-text">
                <strong>PRIMERO:</strong> Las partes declaran que la relación laboral que los unía, iniciada con fecha \${fechaIngresoStr}, ha terminado con fecha \${fechaEgresoStr}, por la causal contemplada en el Código del Trabajo: <strong>"\${causalTermino}"</strong>.
            </div>

            <div class="body-text">
                <strong>SEGUNDO:</strong> El Empleador practica la liquidación de los haberes que le corresponden al Trabajador con motivo del término de su contrato de trabajo, la que arroja los siguientes conceptos e importes:
            </div>

            <div class="table-title">Desglose de Haberes e Indemnizaciones</div>
            <table>
                <thead>
                    <tr>
                        <th>Concepto / Detalle</th>
                        <th class="text-right" style="width: 150px;">Monto ($)</th>
                    </tr>
                </thead>
                <tbody>
                    \${montoIAS > 0 ? \`
                    <tr>
                        <td>Indemnización por Años de Servicio (\${aniosServicio} año(s) calculado(s))</td>
                        <td class="text-right">$\${montoIAS.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${montoISAP > 0 ? \`
                    <tr>
                        <td>Indemnización Sustitutiva de Aviso Previo</td>
                        <td class="text-right">$\${montoISAP.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    <tr>
                        <td>Feriado Proporcional (\${diasFP} días corridos, equivalentes a \${diasHabilesFP} días hábiles)</td>
                        <td class="text-right">$\${montoFP.toLocaleString('es-CL')}</td>
                    </tr>
                    \${totalHaberesProporcionales > 0 ? \`
                    <tr>
                        <td>Sueldo Proporcional mes de egreso (\${diasTrabajadosMes} días)</td>
                        <td class="text-right">$\${montoSueldoProporcional.toLocaleString('es-CL')}</td>
                    </tr>
                    \${montoGratificacionProporcional > 0 ? \`
                    <tr>
                        <td>Gratificación Proporcional mes de egreso (\${diasTrabajadosMes} días)</td>
                        <td class="text-right">$\${montoGratificacionProporcional.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${(montoColacionProporcional + montoMovilizacionProporcional) > 0 ? \`
                    <tr>
                        <td>Asignaciones Proporcionales (Colación/Movilización)</td>
                        <td class="text-right">$\${(montoColacionProporcional + montoMovilizacionProporcional).toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \` : ''}
                    \${indemnizacionVoluntaria > 0 ? \`
                    <tr>
                        <td>Indemnización Voluntaria / Bono de Desvinculación</td>
                        <td class="text-right">$\${indemnizacionVoluntaria.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${aguinaldosOtros > 0 ? \`
                    <tr>
                        <td>Aguinaldos / Bonos Pendientes</td>
                        <td class="text-right">$\${aguinaldosOtros.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${otrosHaberes > 0 ? \`
                    <tr>
                        <td>Otros Haberes devengados a pagar</td>
                        <td class="text-right">$\${otrosHaberes.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    <tr class="font-bold">
                        <td>TOTAL HABERES</td>
                        <td class="text-right">$\${totalHaberes.toLocaleString('es-CL')}</td>
                    </tr>
                </tbody>
            </table>

            <div class="table-title">Desglose de Descuentos</div>
            <table>
                <thead>
                    <tr>
                        <th>Concepto / Detalle</th>
                        <th class="text-right" style="width: 150px;">Monto ($)</th>
                    </tr>
                </thead>
                <tbody>
                    \${descuentoAFC > 0 ? \`
                    <tr>
                        <td>Descuento Aporte Empleador Seguro de Cesantía (Art. 13 Ley 19.728)</td>
                        <td class="text-right text-red-600">-$\${descuentoAFC.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${descuentoAnticipos > 0 ? \`
                    <tr>
                        <td>Anticipo de Sueldo</td>
                        <td class="text-right text-red-600">-$\${descuentoAnticipos.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${descuentoPrestamoCaja > 0 ? \`
                    <tr>
                        <td>Préstamo Caja de Compensación</td>
                        <td class="text-right text-red-600">-$\${descuentoPrestamoCaja.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${descuentoPrestamoEmpresa > 0 ? \`
                    <tr>
                        <td>Préstamo Interno Empresa</td>
                        <td class="text-right text-red-600">-$\${descuentoPrestamoEmpresa.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${descuentoAfpProporcional > 0 ? \`
                    <tr>
                        <td>Cotización AFP Proporcional</td>
                        <td class="text-right text-red-600">-$\${descuentoAfpProporcional.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${descuentoSaludProporcional > 0 ? \`
                    <tr>
                        <td>Cotización Salud Proporcional</td>
                        <td class="text-right text-red-600">-$\${descuentoSaludProporcional.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${descuentoAfcProporcional > 0 ? \`
                    <tr>
                        <td>Cotización AFC Proporcional</td>
                        <td class="text-right text-red-600">-$\${descuentoAfcProporcional.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${descuentoSeguroColectivo > 0 ? \`
                    <tr>
                        <td>Seguro Colectivo / Convenio</td>
                        <td class="text-right text-red-600">-$\${descuentoSeguroColectivo.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${descuentoEquiposNoDevueltos > 0 ? \`
                    <tr>
                        <td>Descuento por Equipos/Herramientas no Devueltos</td>
                        <td class="text-right text-red-600">-$\${descuentoEquiposNoDevueltos.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    \${otrosDescuentos > 0 ? \`
                    <tr>
                        <td>Otros Descuentos autorizados</td>
                        <td class="text-right text-red-600">-$\${otrosDescuentos.toLocaleString('es-CL')}</td>
                    </tr>\` : ''}
                    <tr class="font-bold">
                        <td>TOTAL DESCUENTOS</td>
                        <td class="text-right">-$\${totalDescuentos.toLocaleString('es-CL')}</td>
                    </tr>
                </tbody>
            </table>

            <table>
                <tbody>
                    <tr class="font-bold" style="font-size: 13px; background: #e2e8f0;">
                        <td>SALDO NETO A PAGAR AL TRABAJADOR</td>
                        <td class="text-right" style="color: #047857;">$\${netoFiniquito.toLocaleString('es-CL')}</td>
                    </tr>
                </tbody>
            </table>

            <div class="body-text">
                <strong>TERCERO:</strong> El Trabajador declara recibir del Empleador, a su entera satisfacción, la suma neta de <strong>$\${netoFiniquito.toLocaleString('es-CL')}</strong> mediante transferencia bancaria o vale vista, y otorga con esto el más amplio, completo y recíproco finiquito de todas las obligaciones laborales, declarando no tener deuda pendiente alguna por concepto de remuneraciones, horas extras, feriado legal o proporcional, cotizaciones previsionales u otros.
            </div>

            <div class="reserva-box">
                <div class="reserva-title">Reserva de Derechos del Trabajador (Espacio Legal de la DT)</div>
                <div style="font-size: 10px; color: #64748b; margin-bottom: 20px;">
                    De conformidad con la doctrina de la Dirección del Trabajo, el trabajador conserva la facultad de consignar su reserva de derechos al estampar su firma para posteriores acciones ante tribunales.
                </div>
                <div style="border-bottom: 1px solid #cbd5e1; height: 16px; margin-bottom: 10px;"></div>
                <div style="border-bottom: 1px solid #cbd5e1; height: 16px; margin-bottom: 10px;"></div>
                <div style="border-bottom: 1px solid #cbd5e1; height: 16px;"></div>
            </div>

            \${fd.procesadoEn === 'Notaria' ? \`
            <div class="reserva-box" style="border: 1px solid #cbd5e1; padding: 15px; margin-top: 25px; border-radius: 8px; background: #f8fafc;">
                <div class="reserva-title" style="font-weight: 900; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 6px;">
                    Certificación de Ministro de Fe (Notario Público)
                </div>
                <div style="font-size: 10px; color: #334155; line-height: 1.4; text-align: justify;">
                    Autorizo las firmas de los comparecientes don/ña <strong>\${candidato.fullName}</strong> y el representante legal de <strong>\${empresaNombre}</strong>, quienes firman ante mí en señal de conformidad y ratificación de este documento, y después de haber pagado la suma de $\${netoFiniquito.toLocaleString('es-CL')} pactada.
                </div>
                <div style="font-size: 9px; color: #64748b; margin-top: 8px; font-weight: bold;">
                    Fecha de legalización: \${fd.notariaFechaFirma ? new Date(fd.notariaFechaFirma).toLocaleDateString('es-CL') : '______'} | Gastos notariales: $\${(fd.notariaGastos || 0).toLocaleString('es-CL')} (Pagado por \${fd.notariaPagadoPor})
                </div>
            </div>\` : ''}

            \${fd.procesadoEn === 'Notaria' ? \`
            <div class="firmas" style="display: flex; justify-content: space-between; margin-top: 60px;">
                <div class="firma-box" style="width: 30%; text-align: center;">
                    <div class="linea"></div>
                    <p class="font-bold">\${candidato.fullName}</p>
                    <p>TRABAJADOR</p>
                    <p>RUT: \${candidato.rut}</p>
                </div>
                <div class="firma-box" style="width: 30%; text-align: center;">
                    <div class="linea"></div>
                    <p class="font-bold">\${empresaNombre}</p>
                    <p>EMPLEADOR</p>
                </div>
                <div class="firma-box" style="width: 30%; text-align: center;">
                    <div class="linea"></div>
                    <p class="font-bold">\${fd.notariaNombre || 'NOTARIO PÚBLICO'}</p>
                    <p>MINISTRO DE FE / NOTARIO</p>
                </div>
            </div>
            \` : \`
            <div class="firmas">
                <div class="firma-box" style="width: 45%;">
                    <div class="linea"></div>
                    <p class="font-bold">\${candidato.fullName}</p>
                    <p>TRABAJADOR</p>
                    <p>RUT: \${candidato.rut}</p>
                </div>
                <div class="firma-box" style="width: 45%;">
                    <div class="linea"></div>
                    <p class="font-bold">\${empresaNombre}</p>
                    <p>EMPLEADOR</p>
                </div>
            </div>
            \`}
        </body>
        </html>
    \`;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return alert('No se pudo abrir la ventana de impresión. Por favor, desactiva el bloqueador de popups.');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
};
