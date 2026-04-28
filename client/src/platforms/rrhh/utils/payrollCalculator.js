/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   MOTOR DE CÁLCULO LIBRO DE REMUNERACIONES — CHILE (v4.0)           ║
 * ║   Conforme a: Código del Trabajo, DT, SII, AFC Chile, Previred      ║
 * ║   Incluye todos los conceptos del Libro de Remuneraciones DT        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ─── VALORES LEGALES REFERENCIALES (Feb 2026) ────────────────────────────────
export const VALORES_LEGALES = {
    IMM: 510000,   // Ingreso Mínimo Mensual
    UF: 38500,    // Valor UF (inyectado desde API)
    UTM: 67500,    // Valor UTM (inyectado desde API)
    TOPE_AFP: 89.9,      // Tope imponible AFP en UF
    TOPE_AFC: 135.1,      // Tope imponible AFC en UF
    SIS: 1.54,     // Seguro de Invalidez y Sobrevivencia (% sobre imponible)
    MUTUAL_BASE: 0.90,    // Mutualidad base (% empleador)
    ASIG_FAM_TRAMOS: [
        { hasta: 584970, monto: 15500 },
        { hasta: 854370, monto: 9500 },
        { hasta: 1332270, monto: 3000 },
        { hasta: Infinity, monto: 0 }
    ]
};

// ─── TASAS AFP VIGENTES 2026 ──────────────────────────────────────────────────
export const TASAS_AFP = {
    'CAPITAL': 11.44,
    'CUPRUM': 11.44,
    'HABITAT': 11.27,
    'PLANVITAL': 11.16,
    'PROVIDA': 11.45,
    'MODELO': 10.58,
    'UNO': 10.46,
};

// ─── TRAMOS IMPUESTO ÚNICO SEGUNDA CATEGORÍA (UTM 2026) ──────────────────────
export const TRAMOS_IMPUESTO = [
    { desde: 0, hasta: 13.5, tasa: 0.000, rebaja: 0.00 },
    { desde: 13.5, hasta: 30, tasa: 0.040, rebaja: 0.54 },
    { desde: 30, hasta: 50, tasa: 0.080, rebaja: 1.74 },
    { desde: 50, hasta: 70, tasa: 0.135, rebaja: 4.49 },
    { desde: 70, hasta: 90, tasa: 0.230, rebaja: 11.14 },
    { desde: 90, hasta: 120, tasa: 0.304, rebaja: 17.80 },
    { desde: 120, hasta: 310, tasa: 0.350, rebaja: 23.32 },
    { desde: 310, hasta: Infinity, tasa: 0.400, rebaja: 38.82 },
];

/** Topar base imponible según tipo de descuento */
const topar = (base, topeUF, uf) => Math.min(base, Math.round(topeUF * (uf || VALORES_LEGALES.UF)));

/** Calcular horas extra */
export const calcularHorasExtra = (sueldoBase, horasExtra = 0, horasMes = 180) => {
    if (!horasExtra || horasExtra <= 0) return 0;
    const valorHoraStr = (sueldoBase / horasMes).toFixed(2);
    const valorHora = parseFloat(valorHoraStr);
    return Math.round(valorHora * 1.5 * horasExtra);
};

/** Gratificación legal mensual (Art. 50 CT) 
 * Ahora calcula sobre el tope de IMM y permite base dinámica
 */
export const calcularGratificacion = (baseTotalImponibles, tipoGratificacion = 'legal', imm = VALORES_LEGALES.IMM) => {
    if (tipoGratificacion === 'sin gratificacion') return 0;
    if (tipoGratificacion === 'garantizada') return Math.round(baseTotalImponibles * 0.25);

    // Art 50: 25% con tope de 4.75 ingresos mínimos mensuales prorrateado (mensualizado)
    const gratNormal = baseTotalImponibles * 0.25;
    const gratTopeMensual = (4.75 * imm) / 12;
    return Math.round(Math.min(gratNormal, gratTopeMensual));
};

/** Calcular Semana Corrida (Código 1001 DT)
 * Se aplica a trabajadores con remuneración variable (baremos/piezas).
 * Formula: (Suma devengado variable / dias hábiles mes) * (domingos + festivos)
 */
export const calcularSemanaCorrida = (sumaVariable = 0, ajustes = {}) => {
    const diasHabiles = ajustes.diasHabiles || 25; // Default promedio
    const domFest = ajustes.domingosFestivos || 5; // Default promedio mensual (Sábados si contratado en semana de 6 días)
    if (!sumaVariable || sumaVariable <= 0) return 0;
    
    return Math.round((sumaVariable / diasHabiles) * domFest);
};

/** Asignación familiar */
export const calcularAsignacionFamiliar = (sueldoBase, cantidadCargas = 0) => {
    if (!cantidadCargas || cantidadCargas <= 0) return 0;
    const tramo = VALORES_LEGALES.ASIG_FAM_TRAMOS.find(t => sueldoBase <= t.hasta);
    return (tramo ? tramo.monto : 0) * cantidadCargas;
};

// ─────────────────────────────────────────────────────────────────────────────
//  LIQUIDACIÓN COMPLETA
// ─────────────────────────────────────────────────────────────────────────────
export const calcularLiquidacionReal = (worker = {}, ajustes = {}, params = {}) => {
    const uf = params.ufValue || VALORES_LEGALES.UF;
    const utm = params.utmValue || VALORES_LEGALES.UTM;
    const imm = params.immValue || VALORES_LEGALES.IMM;
    const sisRateRaw = params.sisRate || VALORES_LEGALES.SIS;
    const tAfpUf = params.topeAfpUf || VALORES_LEGALES.TOPE_AFP;
    const tAfcUf = params.topeAfcUf || VALORES_LEGALES.TOPE_AFC;
    
    // NEW 2026: Seguro Expectativa de Vida (Aporte Longevidad) - Generalmente 0.5% o configurable
    const expectativaVidaRate = params.expectativaVidaRate || 0.5;

    // Helper para parsear fechas de forma segura (soporta ISO y DD/MM/AAAA)
    const parseSafeDate = (d) => {
        if (!d) return null;
        if (d instanceof Date) return d;
        let dateObj = new Date(d);
        if (!isNaN(dateObj.getTime())) return dateObj;
        
        // Intentar parsear formato DD/MM/AAAA
        if (typeof d === 'string' && d.includes('/')) {
            const [day, month, year] = d.split('/').map(Number);
            dateObj = new Date(year, month - 1, day);
            if (!isNaN(dateObj.getTime())) return dateObj;
        }
        return null;
    };

    // ── CÁLCULO DE DÍAS PROPORCIONALES ──
    const periodStr = params.period || new Date().toISOString().slice(0,7); // YYYY-MM
    let diasTrabajados = 30; // Base mensual estándar (Art. 44 C.T.)

    const [year, month] = periodStr.split('-').map(Number);
    const firstDayOfPeriod = new Date(year, month - 1, 1);
    const lastDayOfPeriod  = new Date(year, month, 0);

    // 1. Ajuste por Fecha de Inicio y Término de Contrato
    const startDate = parseSafeDate(worker.contractStartDate);
    if (startDate && startDate.getFullYear() === year && (startDate.getMonth() + 1) === month) {
        const startDay = startDate.getDate();
        diasTrabajados = Math.max(0, 30 - startDay + 1);
    }

    // Ajuste Término
    const endDate = parseSafeDate(worker.contractEndDate || worker.fechaFiniquito);
    if (endDate && endDate.getFullYear() === year && (endDate.getMonth() + 1) === month) {
        const endDay = endDate.getDate();
        // Si empezó y terminó el mismo mes
        if (startDate && startDate > firstDayOfPeriod) {
            const startDayPart = startDate.getDate();
            diasTrabajados = Math.max(0, endDay - startDayPart + 1);
        } else {
            diasTrabajados = Math.min(diasTrabajados, endDay);
        }
    }

    // 2. Prioridad a la Asistencia Real (Sincronizada)
    // Se asume que la asistencia real ya descuenta ausencias injustificadas del total de 30 o días proporcionales.
    if (ajustes.diasTrabajadosReal !== undefined && ajustes.diasTrabajadosReal !== null) {
        diasTrabajados = Math.max(0, Math.min(30, Number(ajustes.diasTrabajadosReal)));
    }

    // 2b. Ajuste por NC (No Contratado) - si vienen días NC, restar feriados/domingos/NC del período computable
    // diasNC = días previos a contractStartDate (bloqueo total)
    // diasFeriado y diasDomingo = no afectan porque ya están incluidos en la sincronización
    if (ajustes.diasNC && ajustes.diasNC > 0) {
        // diasNC ya está contado como no-computable, no afecta diasTrabajados si vino de sync
        // Pero si NO vino de sync, debemos restar NC del cálculo base
        if (ajustes.diasTrabajadosReal === undefined) {
            diasTrabajados = Math.max(0, diasTrabajados - ajustes.diasNC);
        }
    }

    // 3. Descuento por Licencias Médicas (Si se pasan explícitamente y no están en diasTrabajadosReal)
    if (ajustes.diasLicencia > 0) {
        diasTrabajados = Math.max(0, diasTrabajados - Number(ajustes.diasLicencia));
    }

    const propFactor = diasTrabajados / 30;

    // 1. Haberes Imponibles
    let sueldoBasePactado = Math.max(parseInt(worker.baseSalary || 0), imm);
    const sueldoBase = Math.round(sueldoBasePactado * propFactor);

    const horasExtra = parseInt(ajustes.horasExtra || worker.horasExtra || 0);

    // Procesar bonos del modelo (bonuses array - fijos/pactados)
    let bonosImponiblesInyectados = 0;
    let bonosNoImponiblesInyectados = 0;
    if (worker.bonuses && Array.isArray(worker.bonuses)) {
        worker.bonuses.forEach(b => {
            // Casi todos los bonos fijos de ficha son proporcionales a los días trabajados
            const bonusAmount = (parseInt(b.amount) || 0) * propFactor;
            if (b.isImponible) bonosImponiblesInyectados += Math.round(bonusAmount);
            else bonosNoImponiblesInyectados += Math.round(bonusAmount);
        });
    }

    // Bonos variables/fijos inyectados (Agrupados por Código DT desde Cierres/Manual)
    let totalBonosPorCodigoImp = 0;
    let totalBonosPorCodigoNoImp = 0;
    const codesMap = ajustes.bonosPorCodigo || {};
    
    Object.entries(codesMap).forEach(([code, amount]) => {
        if (code.startsWith('1')) totalBonosPorCodigoImp += amount;
        else totalBonosPorCodigoNoImp += amount;
    });

    const horaExtraMonto = calcularHorasExtra(sueldoBasePactado, horasExtra);
    
    // Semana Corrida: Usamos la base variable explícita si existe, sino caemos al total imponible (legacy)
    const baseSC = ajustes.variableBaseSC !== undefined ? ajustes.variableBaseSC : totalBonosPorCodigoImp;
    const semanaCorrida = calcularSemanaCorrida(baseSC, ajustes);

    const baseParaGratif = sueldoBase + horaExtraMonto + totalBonosPorCodigoImp + semanaCorrida;
    const gratificacion = calcularGratificacion(baseParaGratif, worker.tipoGratificacion, imm);

    const totalHaberesImponibles = sueldoBase + gratificacion + horaExtraMonto +
        bonosImponiblesInyectados + totalBonosPorCodigoImp + semanaCorrida;

    // 2. Haberes No Imponibles
    const asignacionFamiliar = calcularAsignacionFamiliar(totalHaberesImponibles, worker.cantidadCargas);
    
    // Proporcionalidad en Colación y Movilización
    const colacion = Math.round(parseInt(ajustes.colacion || 0) * propFactor);
    const movilizacion = Math.round(parseInt(ajustes.movilizacion || 0) * propFactor);
    
    const otrosNoImponiblesAjuste = parseInt(ajustes.viaticos || 0) +
        colacion +
        movilizacion +
        parseInt(ajustes.bonosNoImponibles || 0) +
        totalBonosPorCodigoNoImp;

    const totalHaberesNoImponibles = Math.round(asignacionFamiliar + bonosNoImponiblesInyectados + otrosNoImponiblesAjuste);
    const totalHaberes = totalHaberesImponibles + totalHaberesNoImponibles;

    // 3. Descuentos Previsionales
    const imponibleTopadoAFP = topar(totalHaberesImponibles, tAfpUf, uf);
    const imponibleTopadoAFC = topar(totalHaberesImponibles, tAfcUf, uf);

    // AFP
    let montoAFP = 0;
    if (worker.pensionado !== 'SI') {
        const afpName = (worker.afp || 'HABITAT').toUpperCase();
        const tasaAFP = TASAS_AFP[afpName] || 11.27;
        montoAFP = Math.round(imponibleTopadoAFP * (tasaAFP / 100));
    }

    // Salud
    const fonasaMinimo = Math.round(imponibleTopadoAFP * 0.07);
    let montoSalud = fonasaMinimo;
    let excesoIsapre = 0;

    if (worker.previsionSalud === 'ISAPRE') {
        let planCLP = parseInt(worker.valorPlan) || 0;
        if (worker.monedaPlan === 'UF') {
            planCLP = Math.round(parseFloat(worker.valorPlan) * uf);
        }
        montoSalud = Math.max(fonasaMinimo, planCLP);
        excesoIsapre = Math.max(0, planCLP - fonasaMinimo);
    }

    // AFC
    let montoAFC = 0;
    if (worker.contractType === 'INDEFINIDO' && worker.pensionado !== 'SI') {
        montoAFC = Math.round(imponibleTopadoAFC * 0.006);
    }

    const totalPrevision = montoAFP + montoSalud + montoAFC;

    // 4. Impuesto Único
    const baseTributable = Math.max(0, totalHaberesImponibles - totalPrevision);
    const baseUTM = baseTributable / utm;
    const tramo = TRAMOS_IMPUESTO.find(t => baseUTM > t.desde && baseUTM <= t.hasta);
    const impuestoUnico = tramo ? Math.max(0, Math.round((baseTributable * tramo.tasa) - (tramo.rebaja * utm))) : 0;

    // 5. Descuentos Voluntarios
    const otrosDescuentos = parseInt(ajustes.anticipo || 0) +
        parseInt(ajustes.cuotaSindical || 0) +
        parseInt(ajustes.descuentoJudicial || 0) +
        parseInt(ajustes.otrosDescuentos || 0);

    const totalDescuentos = totalPrevision + impuestoUnico + otrosDescuentos;
    const liquidoAPagar = Math.max(0, totalHaberes - totalDescuentos);

    // 6. Costo Empresa (Patronales)
    const sis = Math.round(imponibleTopadoAFP * (sisRateRaw / 100));
    const mutual = Math.round(imponibleTopadoAFP * (VALORES_LEGALES.MUTUAL_BASE / 100));
    
    // NEW 2026: Seguro Expectativa de Vida
    const expectativaVida = Math.round(imponibleTopadoAFP * (expectativaVidaRate / 100));

    let afcPatronal = 0;
    if (worker.contractType === 'INDEFINIDO') afcPatronal = Math.round(imponibleTopadoAFC * 0.024);
    else afcPatronal = Math.round(imponibleTopadoAFC * 0.03);

    const costoTotalEmpresa = totalHaberes + sis + mutual + afcPatronal + expectativaVida;

    return {
        diasTrabajados,
        diasLicencia: ajustes.diasLicencia || 0,
        diasAusente: ajustes.diasAusente || Math.max(0, 30 - diasTrabajados - (ajustes.diasLicencia || 0)), // Si viene explícito lo usamos, sino el cálculo residual
        habImponibles: {
            sueldoBase,
            gratificacion,
            semanaCorrida,
            horasExtraQty: horasExtra,
            horaExtraMonto,
            bonosInyectados: bonosImponiblesInyectados,
            bonosPorCodigo: codesMap,
            subtotal: totalHaberesImponibles
        },
        habNoImponibles: {
            asignacionFamiliar,
            colacion,
            movilizacion,
            bonosInyectados: bonosNoImponiblesInyectados,
            otros: parseInt(ajustes.viaticos || 0) + parseInt(ajustes.bonosNoImponibles || 0) + totalBonosPorCodigoNoImp,
            subtotal: totalHaberesNoImponibles
        },
        prevision: {
            afp: montoAFP,
            salud: montoSalud,
            afc: montoAFC,
            excesoIsapre,
            subtotal: totalPrevision
        },
        impuestoUnico,
        baseTributable,
        tramoImpuesto: tramo ? `${(tramo.tasa * 100).toFixed(1)}%` : 'Exento',
        otrosDescuentos,
        totalHaberes,
        totalDescuentos,
        liquidoAPagar,
        costoTotalEmpresa,
        patronales: { 
            sis, 
            mutual, 
            afc: afcPatronal,
            expectativaVida 
        }
    };
};

/** Mapear Candidato (Mongoose) a Worker (Calculadora) */
export const candidatoToWorkerData = (c) => ({
    baseSalary: c.sueldoBase || 0,
    contractType: (c.contractType || c.hiring?.contractType || 'Indefinido').toUpperCase(),
    contractStartDate: c.contractStartDate || c.hiring?.contractStartDate || null,
    contractEndDate:   c.contractEndDate   || c.hiring?.contractEndDate   || null,
    fechaFiniquito:    c.fechaFiniquito    || null,
    afp: (c.afp || 'HABITAT').toUpperCase(),
    previsionSalud: c.previsionSalud || 'FONASA',
    monedaPlan: c.monedaPlan || 'UF',
    valorPlan: c.valorPlan || 0,
    pensionado: c.pensionado || 'NO',
    tipoGratificacion: c.tipoGratificacion || 'legal',
    cantidadCargas: c.listaCargas?.length || (c.tieneCargas === 'SI' ? 1 : 0),
    bonuses: c.bonuses || [],
});

export default calcularLiquidacionReal;
