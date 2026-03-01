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

/** Gratificación legal mensual (Art. 50 CT) */
export const calcularGratificacion = (sueldoBase, tipoGratificacion = 'legal', imm = VALORES_LEGALES.IMM) => {
    if (tipoGratificacion === 'sin gratificacion') return 0;
    if (tipoGratificacion === 'garantizada') return Math.round(sueldoBase * 0.25);

    // Art 50: 25% con tope de 4.75 ingresos mínimos mensuales prorrateado
    const gratNormal = sueldoBase * 0.25;
    const gratTopeMensual = (4.75 * imm) / 12;
    return Math.round(Math.min(gratNormal, gratTopeMensual));
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

    // 1. Haberes Imponibles
    const sueldoBase = Math.max(parseInt(worker.baseSalary || 0), imm);
    const horasExtra = parseInt(ajustes.horasExtra || worker.horasExtra || 0);
    const gratificacion = calcularGratificacion(sueldoBase, worker.tipoGratificacion, imm);

    // Procesar bonos del modelo (bonuses array)
    let bonosImponiblesInyectados = 0;
    let bonosNoImponiblesInyectados = 0;
    if (worker.bonuses && Array.isArray(worker.bonuses)) {
        worker.bonuses.forEach(b => {
            if (b.isImponible) bonosImponiblesInyectados += (parseInt(b.amount) || 0);
            else bonosNoImponiblesInyectados += (parseInt(b.amount) || 0);
        });
    }

    const otrosImponiblesAjuste = parseInt(ajustes.bonoProductividad || 0) +
        parseInt(ajustes.bonoAsistencia || 0) +
        parseInt(ajustes.bonosImponibles || 0);

    const horaExtraMonto = calcularHorasExtra(sueldoBase, horasExtra);

    const totalHaberesImponibles = sueldoBase + gratificacion + horaExtraMonto +
        bonosImponiblesInyectados + otrosImponiblesAjuste;

    // 2. Haberes No Imponibles
    const asignacionFamiliar = calcularAsignacionFamiliar(totalHaberesImponibles, worker.cantidadCargas);
    const otrosNoImponiblesAjuste = parseInt(ajustes.viaticos || 0) +
        parseInt(ajustes.colacion || 0) +
        parseInt(ajustes.movilizacion || 0) +
        parseInt(ajustes.bonosNoImponibles || 0);

    const totalHaberesNoImponibles = asignacionFamiliar + bonosNoImponiblesInyectados + otrosNoImponiblesAjuste;
    const totalHaberes = totalHaberesImponibles + totalHaberesNoImponibles;

    // 3. Descuentos Previsionales
    const imponibleTopadoAFP = topar(totalHaberesImponibles, VALORES_LEGALES.TOPE_AFP, uf);
    const imponibleTopadoAFC = topar(totalHaberesImponibles, VALORES_LEGALES.TOPE_AFC, uf);

    // AFP (Exento si es pensionado)
    let montoAFP = 0;
    if (worker.pensionado !== 'SI') {
        const afpName = (worker.afp || 'HABITAT').toUpperCase();
        const tasaAFP = TASAS_AFP[afpName] || 11.27;
        montoAFP = Math.round(imponibleTopadoAFP * (tasaAFP / 100));
    }

    // Salud (FONASA 7% o ISAPRE)
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

    // AFC (Seguro de Cesantía)
    let montoAFC = 0;
    if (worker.contractType === 'Indefinido' && worker.pensionado !== 'SI') {
        montoAFC = Math.round(imponibleTopadoAFC * 0.006);
    }

    const totalPrevision = montoAFP + montoSalud + montoAFC;

    // 4. Impuesto Único (Base = Imponibles - Previsión)
    const baseTributable = Math.max(0, totalHaberesImponibles - totalPrevision);
    const baseUTM = baseTributable / utm;
    const tramo = TRAMOS_IMPUESTO.find(t => baseUTM > t.desde && baseUTM <= t.hasta);
    const impuestoUnico = tramo ? Math.max(0, Math.round((baseTributable * tramo.tasa) - (tramo.rebaja * utm))) : 0;

    // 5. Descuentos Voluntarios / Otros
    const otrosDescuentos = parseInt(ajustes.anticipo || 0) +
        parseInt(ajustes.cuotaSindical || 0) +
        parseInt(ajustes.descuentoJudicial || 0) +
        parseInt(ajustes.otrosDescuentos || 0);

    const totalDescuentos = totalPrevision + impuestoUnico + otrosDescuentos;
    const liquidoAPagar = Math.max(0, totalHaberes - totalDescuentos);

    // 6. Costo Empresa (Patronales)
    const sis = Math.round(imponibleTopadoAFP * (VALORES_LEGALES.SIS / 100));
    const mutual = Math.round(imponibleTopadoAFP * (VALORES_LEGALES.MUTUAL_BASE / 100));
    let afcPatronal = 0;
    if (worker.contractType === 'Indefinido') afcPatronal = Math.round(imponibleTopadoAFC * 0.024);
    else afcPatronal = Math.round(imponibleTopadoAFC * 0.03);

    const costoTotalEmpresa = totalHaberes + sis + mutual + afcPatronal;

    return {
        habImponibles: {
            sueldoBase,
            gratificacion,
            horaExtraMonto,
            bonosInyectados: bonosImponiblesInyectados,
            otros: otrosImponiblesAjuste,
            subtotal: totalHaberesImponibles
        },
        habNoImponibles: {
            asignacionFamiliar,
            bonosInyectados: bonosNoImponiblesInyectados,
            otros: otrosNoImponiblesAjuste,
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
        patronales: { sis, mutual, afc: afcPatronal }
    };
};

/** Mapear Candidato (Mongoose) a Worker (Calculadora) */
export const candidatoToWorkerData = (c) => ({
    baseSalary: c.sueldoBase || 0,
    afp: (c.afp || 'HABITAT').toUpperCase(),
    previsionSalud: c.previsionSalud || 'FONASA',
    monedaPlan: c.monedaPlan || 'UF',
    valorPlan: c.valorPlan || 0,
    pensionado: c.pensionado || 'NO',
    contractType: c.contractType || c.hiring?.contractType || 'Indefinido',
    tipoGratificacion: c.tipoGratificacion || 'legal',
    cantidadCargas: c.listaCargas?.length || (c.tieneCargas === 'SI' ? 1 : 0),
    bonuses: c.bonuses || [],
});

export default calcularLiquidacionReal;
