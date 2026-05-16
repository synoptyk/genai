
export const pts = (v) => parseFloat(v) || 0;

export const getFeriadosChile = (year) => {
  // Guard: si el año no es válido retornamos lista vacía para no crashear
  const y = parseInt(year, 10);
  if (!y || isNaN(y) || y < 1900 || y > 2100) return [];

  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + e * 2 + i * 2 - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(Date.UTC(y, month - 1, day));
  const viernesSanto = new Date(easter.getTime() - 2 * 86400000);
  const sabadoSanto = new Date(easter.getTime() - 1 * 86400000);

  // Guard: format solo si la fecha es válida
  const format = (d) => {
    if (!d || isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  };

  const holidays = [
    `${y}-01-01`, format(viernesSanto), format(sabadoSanto),
    `${y}-05-01`, `${y}-05-21`, `${y}-06-20`, `${y}-07-16`, 
    `${y}-08-15`, `${y}-09-18`, `${y}-09-19`, `${y}-11-01`, 
    `${y}-12-08`, `${y}-12-25`
  ].filter(Boolean); // Filtra nulls de fechas inválidas

  if (y === 2024 || y === 2025 || y === 2026) {
     if (y === 2026) holidays.push(`${y}-06-21`);
  }

  const applyMovableRule = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (isNaN(d.getTime())) return null;
    const dow = d.getUTCDay();
    if (dow === 2) d.setUTCDate(d.getUTCDate() - 1);
    else if (dow === 3) d.setUTCDate(d.getUTCDate() - 2);
    else if (dow === 4) d.setUTCDate(d.getUTCDate() - 3);
    else if (dow === 5) d.setUTCDate(d.getUTCDate() + 3);
    return format(d);
  };

  const r1 = applyMovableRule(`${y}-06-29`);
  const r2 = applyMovableRule(`${y}-10-12`);
  if (r1) holidays.push(r1);
  if (r2) holidays.push(r2);

  const oct31 = new Date(`${y}-10-31T00:00:00Z`);
  const oct31Dow = oct31.getUTCDay();
  if (oct31Dow === 2) oct31.setUTCDate(30);
  else if (oct31Dow === 3) oct31.setUTCDate(oct31.getUTCDate() + 2);
  const oct31Str = format(oct31);
  if (oct31Str) holidays.push(oct31Str);

  const sep18 = new Date(`${y}-09-18T00:00:00Z`);
  const sep18Dow = sep18.getUTCDay();
  if (sep18Dow === 2) holidays.push(`${y}-09-17`);
  if (sep18Dow === 4) holidays.push(`${y}-09-20`);

  return holidays;
};

export const MACRO_ZONAS = {
  'NORTE': ['ARICA', 'ALTO HOSPICIO', 'IQUIQUE', 'ANTOFAGASTA', 'CALAMA', 'COPIAPO', 'LA SERENA', 'COQUIMBO', 'OVALLE'],
  'CENTRO COSTA': ['VALPARAISO', 'VINA DEL MAR', 'QUILPUE', 'VILLA ALEMANA', 'QUILLOTA', 'LOS ANDES', 'SAN ANTONIO'],
  'METROPOLITANA': ['SANTIAGO', 'NUNOA', 'LAS CONDES', 'LA FLORIDA', 'PUENTE ALTO', 'MAIPU', 'PROVIDENCIA', 'SAN MIGUEL', 'RECOLETA', 'MACUL', 'ESTACION CENTRAL', 'PUDAHUEL', 'INDEPENDENCIA', 'QUINTA NORMAL', 'SAN BERNARDO', 'CONCHALI', 'PENALOLEN', 'LA CISTERNA', 'QUILICURA', 'CERRO NAVIA', 'HUECHURABA', 'SAN JOAQUIN'],
  'SUR': ['RANCAGUA', 'TALCA', 'CURICO', 'CHILLAN', 'CONCEPCION', 'TALCAHUANO', 'LOS ANGELES', 'TEMUCO', 'VALDIVIA', 'OSORNO', 'PUERTO MONTT', 'PUNTA ARENAS']
};

export const fmtPts = (v) => {
  const n = typeof v === 'number' ? v : pts(v);
  return n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

export const countBusinessDays = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr + 'T12:00:00Z');
  const end = new Date(endStr + 'T12:00:00Z');
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  const actualEnd = end > today ? today : end;
  if (start > actualEnd) return 0;

  const year = start.getUTCFullYear();
  const holidays = getFeriadosChile(year);

  let count = 0;
  let cur = new Date(start);
  while (cur <= actualEnd) {
    const day = cur.getUTCDay();
    const isoDate = cur.toISOString().split('T')[0];
    if (day !== 0 && !holidays.includes(isoDate)) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
};

export const getWorkDaysInMonth = (year, month) => {
  const start = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
  const holidays = getFeriadosChile(year);

  let count = 0;
  let cur = new Date(start);
  while (cur <= end) {
    const day = cur.getUTCDay();
    const isoDate = cur.toISOString().split('T')[0];
    if (day !== 0 && !holidays.includes(isoDate)) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
};

export const getTecnico = (d) => d['Técnico'] || d.Técnico || '';
export const getCiudad = (d) => d['Ciudad'] || d.Ciudad || '';
export const getSubtipo = (d) => d['Subtipo_de_Actividad'] || d.Subtipo_de_Actividad || '';
export const getZona = (d) => d['Zona_de_Trabajo'] || d.Zona_de_Trabajo || '';
export const getAgencia = (d) => d['Agencia'] || d.Agencia || '';
export const getComuna = (d) => d['Comuna'] || d.Comuna || '';
export const getDescLPU = (d) => d['Desc_LPU_Base'] || d.Desc_LPU_Base || '';
export const getCodigoLPU = (d) => d['Codigo_LPU_Base'] || d.Codigo_LPU_Base || '';
export const getOrderId = (d) => (d['Número_de_Petición'] || d['Número de Petición'] || d.ordenId || '').toString();
export const isRepair = (d) => getOrderId(d).toUpperCase().startsWith('INC');
export const getFecha = (d) => d['fecha'] || d.fecha || '';

export const ptsTotal = (d) => pts(d['Pts_Total_Baremo'] || d.Pts_Total_Baremo || d.ptsTotalBaremo);
export const ptsBase = (d) => pts(d['Pts_Actividad_Base'] || d.Pts_Actividad_Base);
export const ptsDeco = (d) => pts(d['Pts_Deco_Adicional'] || d.Pts_Deco_Adicional);
export const ptsRepetidor = (d) => pts(d['Pts_Repetidor_WiFi'] || d.Pts_Repetidor_WiFi);
export const ptsTelefono = (d) => pts(d['Pts_Telefono'] || d.Pts_Telefono);

export const toExcelVal = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val)) && /^-?\d+(\.\d+)?$/.test(val)) {
    return Number(val);
  }
  return val;
};

export const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const toDateKey = (d) => {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseToUTC = (dateStr) => {
  if (!dateStr) return new Date(NaN);
  let d = new Date(dateStr);
  if (isNaN(d.getTime()) && typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      d = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
      return d;
    }
  }
  if (isNaN(d.getTime())) return d;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

export const addDays = (d, n) => {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
};

export const toInputDate = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const firstDayOfMonth = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
};

export const getISOWeek = (dateStr) => {
  const d = new Date(dateStr);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
  return { week: weekNo, year: utc.getUTCFullYear() };
};

export const getWeekRange = (year, week) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
  const weekStart = new Date(startOfWeek1);
  weekStart.setUTCDate(weekStart.getUTCDate() + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${fmt(weekStart)} - ${fmt(weekEnd)}`;
};

export const colorScaleProduccion = (val, meta) => {
  const target = meta > 0 ? meta : 7.5; 
  if (val <= 0) return 'bg-slate-900/40 text-slate-500';
  const pct = val / target;
  if (pct >= 0.95) return 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] font-black';
  if (pct >= 0.75) return 'bg-amber-500 text-slate-900 font-black';
  if (pct >= 0.50) return 'bg-orange-600 text-white font-black';
  return 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] font-black animate-pulse';
};
