const txt = "Viernes, Mayo 22. °, 2026";
const r1 = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i;
const r2 = /(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+(\d{1,2})[^0-9]+(\d{4})/i;
console.log(txt.match(r1));
console.log(txt.match(r2));
