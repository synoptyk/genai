/**
 * Script de prueba unitaria para verificar la lógica de cálculo del finiquito.
 */

// Simulación de la función isFeriadoChile
function isFeriadoChile(fecha) {
    const y = fecha.getFullYear();
    const m = fecha.getMonth() + 1;
    const d = fecha.getDate();
    
    const fijos = [
        '1-1', '5-1', '5-21', '7-16', '8-15', '9-18', '9-19', '10-31', '11-1', '12-8', '12-25'
    ];
    
    if (fijos.includes(`${m}-${d}`)) return true;
    
    if (y === 2025) {
        if (m === 4 && (d === 18 || d === 19)) return true;
        if (m === 6 && d === 29) return true;
        if (m === 10 && d === 12) return true;
    }
    if (y === 2026) {
        if (m === 4 && (d === 3 || d === 4)) return true;
        if (m === 6 && d === 29) return true;
        if (m === 10 && d === 12) return true;
    }
    return false;
}

// Simulación de la proyección del feriado proporcional
function calcularProyeccionFeriado(fechaEgreso, diasHabilesPendientes) {
    let fechaCursor = new Date(fechaEgreso.getTime());
    let diasHabilesRestantes = diasHabilesPendientes;
    let diasCorridos = 0;
    
    while (diasHabilesRestantes > 0) {
        fechaCursor.setDate(fechaCursor.getDate() + 1);
        const dayOfWeek = fechaCursor.getDay(); // 0 = Domingo, 6 = Sábado
        const esFinDeSemana = (dayOfWeek === 0 || dayOfWeek === 6);
        const esFeriado = isFeriadoChile(fechaCursor);
        
        if (esFinDeSemana || esFeriado) {
            diasCorridos += 1;
        } else {
            if (diasHabilesRestantes >= 1) {
                diasHabilesRestantes -= 1;
                diasCorridos += 1;
            } else {
                diasCorridos += diasHabilesRestantes;
                diasHabilesRestantes = 0;
            }
        }
    }
    return diasCorridos;
}

// Función de prueba del motor de cálculo
function testCalculadora(fechaIngresoStr, fechaEgresoStr, diasTomados, sueldoBase, promedioVariable, causal, montoAFC, valorUF = 38500) {
    const fechaIngreso = new Date(fechaIngresoStr);
    const fechaEgreso = new Date(fechaEgresoStr);
    
    console.log(`\n========================================`);
    console.log(`🧪 PROBANDO CASO: ${causal}`);
    console.log(`   • Ingreso: ${fechaIngresoStr} | Egreso: ${fechaEgresoStr}`);
    console.log(`   • Sueldo Base: $${sueldoBase} | Promedio Variable: $${promedioVariable}`);
    console.log(`   • Vacaciones Tomadas: ${diasTomados} días`);
    if (causal.includes('161')) {
        console.log(`   • Cotización AFC Empleador: $${montoAFC}`);
    }
    
    // 1. Días de servicio
    const diffTime = Math.abs(fechaEgreso - fechaIngreso);
    const totalDaysOfService = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    let start = new Date(fechaIngreso.getTime());
    let end = new Date(fechaEgreso.getTime());
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
        months -= 1;
        const prevMonthDate = new Date(end.getFullYear(), end.getMonth(), 0);
        days += prevMonthDate.getDate();
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }
    
    console.log(`   ➔ Antigüedad: ${years} años, ${months} meses, ${days} días (Días totales: ${totalDaysOfService})`);
    
    // 2. Años de Servicio para Indemnización
    let aniosServicioCalculados = 0;
    let montoIndemnizacionAnos = 0;
    const totalAntiguedadMeses = (years * 12) + months;
    const aplicaIAS = (causal === 'Necesidades de la empresa (Art. 161)');
    
    if (aplicaIAS && totalAntiguedadMeses >= 12) {
        if (months > 6 || (months === 6 && days > 0)) {
            aniosServicioCalculados = years + 1;
        } else {
            aniosServicioCalculados = years;
        }
        aniosServicioCalculados = Math.min(aniosServicioCalculados, 11);
    }
    
    const sueldoImponible = Number(sueldoBase) + Number(promedioVariable);
    const topeRemuneracion = 90 * Number(valorUF);
    const sueldoImponibleConTope = Math.min(sueldoImponible, topeRemuneracion);
    
    if (aplicaIAS) {
        montoIndemnizacionAnos = aniosServicioCalculados * sueldoImponibleConTope;
    }
    
    // 3. Aviso Previo
    let montoIndemnizacionAviso = 0;
    if (causal === 'Necesidades de la empresa (Art. 161)') {
        montoIndemnizacionAviso = sueldoImponibleConTope;
    }
    
    // 4. Vacaciones Proporcionales
    const diasVacacionesHabilesGanados = totalDaysOfService * (1.25 / 30);
    const diasVacacionesHabilesPendientes = Math.max(0, diasVacacionesHabilesGanados - Number(diasTomados));
    const diasVacacionesCorridos = calcularProyeccionFeriado(fechaEgreso, diasVacacionesHabilesPendientes);
    const valorDiaFeriado = sueldoImponible / 30;
    const montoFeriadoProporcional = Math.round(diasVacacionesCorridos * valorDiaFeriado);
    
    // 5. AFC (Topado legalmente al monto de la indemnización por años de servicio)
    const descuentoAFCAplicado = causal === 'Necesidades de la empresa (Art. 161)' 
        ? Math.min(Number(montoAFC), montoIndemnizacionAnos) 
        : 0;
    
    // 6. Neto
    const netoFiniquito = Math.max(0,
        montoIndemnizacionAnos +
        montoIndemnizacionAviso +
        montoFeriadoProporcional -
        descuentoAFCAplicado
    );
    
    console.log(`   ➔ Vacaciones Ganadas (Habiles): ${diasVacacionesHabilesGanados.toFixed(2)}`);
    console.log(`   ➔ Vacaciones Pendientes (Habiles): ${diasVacacionesHabilesPendientes.toFixed(2)}`);
    console.log(`   ➔ Proyección Feriado (Corridos): ${diasVacacionesCorridos.toFixed(2)}`);
    console.log(`   ➔ Pago Feriado Proporcional: $${montoFeriadoProporcional.toLocaleString('es-CL')}`);
    
    if (aplicaIAS) {
        console.log(`   ➔ Años Servicio Indemnizados: ${aniosServicioCalculados} años`);
        console.log(`   ➔ Pago Indemnización Años: $${montoIndemnizacionAnos.toLocaleString('es-CL')}`);
        console.log(`   ➔ Pago Aviso Previo: $${montoIndemnizacionAviso.toLocaleString('es-CL')}`);
        console.log(`   ➔ Descuento AFC: -$${descuentoAFCAplicado.toLocaleString('es-CL')}`);
    }
    
    console.log(`   💰 TOTAL NETO FINIQUITO: $${netoFiniquito.toLocaleString('es-CL')}`);
    console.log(`========================================`);
}

// Ejecución de casos de prueba
// Caso 1: Vencimiento del plazo (Art. 159 N°4) - Sin IAS, sin Aviso, solo vacaciones
testCalculadora('2025-01-01', '2025-06-15', 5, 800000, 0, 'Vencimiento del plazo (Art. 159 N°4)', 0);

// Caso 2: Art. 161 con < 1 año de antigüedad
testCalculadora('2025-01-01', '2025-09-30', 0, 1000000, 150000, 'Necesidades de la empresa (Art. 161)', 120000);

// Caso 3: Art. 161 con > 1 año y fracción superior a 6 meses
testCalculadora('2024-01-01', '2025-08-15', 10, 1200000, 0, 'Necesidades de la empresa (Art. 161)', 250000);

// Caso 4: Art. 161 con sueldo alto que supera el tope imponible (90 UF = ~$3.465.000)
testCalculadora('2020-01-01', '2025-12-31', 15, 4500000, 500000, 'Necesidades de la empresa (Art. 161)', 600000);
