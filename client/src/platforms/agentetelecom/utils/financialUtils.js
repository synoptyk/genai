
export const CLIENT_BAREMO_MAP = {
  'MOVISTAR': 3500,
  'VTR': 3800,
  'CLARO': 3600,
  'ENTEL': 3500,
  'MUNDO': 3500,
  'WOM': 3500,
  'ZENER': 3500,
  'COMFICA': 3500,
  'DIRECTV': 4000,
  'HITES': 3500,
  'DEFAULT': 3500
};

export const getBaremo = (name) => {
  if (!name) return CLIENT_BAREMO_MAP.DEFAULT;
  const n = name.toUpperCase().trim();
  for (const [key, val] of Object.entries(CLIENT_BAREMO_MAP)) {
    if (n.includes(key)) return val;
  }
  return CLIENT_BAREMO_MAP.DEFAULT;
};

export const formatCLP = (v) => new Intl.NumberFormat('es-CL', { 
  style: 'currency', 
  currency: 'CLP', 
  maximumFractionDigits: 0 
}).format(Math.round(v || 0));

export const formatNumber = (v) => new Intl.NumberFormat('es-CL', { 
  maximumFractionDigits: 1 
}).format(v || 0);
