const regex = /(?:\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{1,2}\s+(?:de\s+)?(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+\d{4}|(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\.?\s+\d{1,2}[^0-9]+\d{4})/i;
console.log(regex.test("Viernes, Mayo 22. °, 2026"));
console.log(regex.test("22 may. 2026"));
console.log(regex.test("2026-05-22"));
console.log(regex.test("may 22, 2026"));
