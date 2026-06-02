const txt = "22 may. 2026";
const r = /(\d{1,2})\s+(de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+(\d{4})/i;
const m = txt.match(r);
console.log(m);
