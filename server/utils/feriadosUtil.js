/**
 * feriadosUtil.js - Utilidades centralizadas para feriados y domingos en Chile
 * Consolida la lógica de calendario laboral usada en asistencia, producción y nómina
 */

// ─── FERIADOS FIJOS Y MÓVILES (2024-2027) ───────────────────────────────────
const FERIADOS_FIJOS = [
  '01-01', // Año Nuevo
  '05-01', // Día del Trabajo
  '05-21', // Glorias Navales
  '07-16', // Virgen del Carmen
  '08-15', // Asunción de la Virgen
  '11-01', // Día de todos los Santos
  '12-08', // Inmaculada Concepción
  '12-25', // Navidad
];

// Feriados móviles por año (Viernes Santo, Sábado Santo, etc.)
const FERIADOS_MOVILES = {
  2024: ['04-12', '04-13', '06-20', '06-29', '10-12'],
  2025: ['04-18', '04-19', '06-20', '06-29', '10-12'],
  2026: ['04-03', '04-04', '06-20', '06-29', '10-12'],
  2027: ['03-26', '03-27', '06-20', '06-29', '10-12'],
};

// Mapping de feriados a nombres
const FERIADOS_NOMBRES = {
  '01-01': 'Año Nuevo',
  '04-18': 'Viernes Santo',
  '04-19': 'Sábado Santo',
  '04-03': 'Viernes Santo',
  '04-04': 'Sábado Santo',
  '05-01': 'Día del Trabajo',
  '05-21': 'Glorias Navales',
  '06-20': 'Solsticio (no laboral)',
  '06-29': 'San Pedro y San Pablo',
  '07-16': 'Virgen del Carmen',
  '08-15': 'Asunción de la Virgen',
  '09-18': 'Día de la Independencia',
  '09-19': 'Día de las Glorias del Ejército',
  '10-12': 'Encuentro de Dos Mundos',
  '10-31': 'Iglesias Evangélicas',
  '11-01': 'Día de Todos los Santos',
  '12-08': 'Inmaculada Concepción',
  '12-25': 'Navidad',
};

/**
 * Determina si una fecha es domingo
 * @param {string|Date} fecha - Fecha en formato 'YYYY-MM-DD' o Date
 * @returns {boolean}
 */
function isDomingo(fecha) {
  let date = fecha;
  if (typeof fecha === 'string') {
    date = new Date(fecha + 'T12:00:00Z');
  }
  return date.getUTCDay() === 0;
}

/**
 * Determina si una fecha es feriado en Chile
 * @param {string|Date} fecha - Fecha en formato 'YYYY-MM-DD' o Date
 * @returns {boolean}
 */
function isFeriado(fecha) {
  let dateStr = fecha;
  let year = new Date().getUTCFullYear();

  if (fecha instanceof Date) {
    year = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const d = String(fecha.getUTCDate()).padStart(2, '0');
    dateStr = `${year}-${m}-${d}`;
  } else if (typeof fecha === 'string') {
    year = parseInt(fecha.substring(0, 4));
  }

  const mmdd = dateStr.substring(5); // Extrae MM-DD

  // Verificar feriados fijos
  if (FERIADOS_FIJOS.includes(mmdd)) {
    return true;
  }

  // Verificar feriados móviles del año
  if (FERIADOS_MOVILES[year] && FERIADOS_MOVILES[year].includes(mmdd)) {
    return true;
  }

  return false;
}

/**
 * Obtiene el nombre del feriado si existe
 * @param {string} fecha - Fecha en formato 'YYYY-MM-DD'
 * @returns {string|null}
 */
function getNombreFeriado(fecha) {
  const mmdd = fecha.substring(5);
  return FERIADOS_NOMBRES[mmdd] || null;
}

/**
 * Verifica si una fecha está antes de la fecha de contrato
 * @param {string|Date} fecha - Fecha en formato 'YYYY-MM-DD' o Date
 * @param {string|Date} contractStart - Fecha de inicio de contrato
 * @returns {boolean}
 */
function isBeforeContract(fecha, contractStart) {
  let dateA = fecha;
  let dateB = contractStart;

  if (typeof fecha === 'string') {
    dateA = new Date(fecha + 'T12:00:00Z');
  }
  if (typeof contractStart === 'string') {
    dateB = new Date(contractStart + 'T12:00:00Z');
  }

  return dateA < dateB;
}

/**
 * Obtiene todos los días del mes con sus propiedades (feriado, domingo, etc.)
 * @param {number} year - Año (ej: 2026)
 * @param {number} month - Mes 1-12 (ej: 4 para abril)
 * @returns {Array} Array de objetos { fecha, numDia, esDomingo, esFeriado, nombreFeriado }
 */
function getDiasDelMes(year, month) {
  const dias = [];
  const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = 1; day <= ultimoDia; day++) {
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const esDomingo = isDomingo(dateObj);
    const esFeriado = isFeriado(dateObj);
    const nombreFeriado = esFeriado ? getNombreFeriado(dateStr) : null;

    dias.push({
      fecha: dateStr,
      numDia: day,
      diaSemana: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dateObj.getUTCDay()],
      esDomingo,
      esFeriado,
      nombreFeriado,
    });
  }

  return dias;
}

/**
 * Cuenta días hábiles (L-V, excluyendo feriados) en un rango
 * @param {string} startDate - Fecha inicial en formato 'YYYY-MM-DD'
 * @param {string} endDate - Fecha final en formato 'YYYY-MM-DD'
 * @returns {number}
 */
function countDiasHabiles(startDate, endDate) {
  const start = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');

  let count = 0;
  let current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getUTCDay();
    const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6; // No Dom ni Sáb
    const notHoliday = !isFeriado(current);

    if (isWeekday && notHoliday) {
      count++;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

/**
 * Formatea una fecha a string YYYY-MM-DD
 * @param {Date} date - Objeto Date
 * @returns {string}
 */
function toDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene la fecha del día siguiente
 * @param {string} dateStr - Fecha en formato 'YYYY-MM-DD'
 * @returns {string}
 */
function getNextDay(dateStr) {
  const date = new Date(dateStr + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return toDateString(date);
}

/**
 * Obtiene la fecha del día anterior
 * @param {string} dateStr - Fecha en formato 'YYYY-MM-DD'
 * @returns {string}
 */
function getPreviousDay(dateStr) {
  const date = new Date(dateStr + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() - 1);
  return toDateString(date);
}

module.exports = {
  isDomingo,
  isFeriado,
  getNombreFeriado,
  isBeforeContract,
  getDiasDelMes,
  countDiasHabiles,
  toDateString,
  getNextDay,
  getPreviousDay,
};
