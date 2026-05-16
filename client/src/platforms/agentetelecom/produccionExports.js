import * as XLSX from 'xlsx';

export const exportToExcel = (sortedTechRanking, calMonth, serverData, toExcelVal) => {
  if (!sortedTechRanking.length) return;
  
  const { year, month } = calMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const meta = serverData?.metaConfig?.metaProduccionDia || serverData?.metaConfig?.metaDiaria || 7.5;

  const rows = sortedTechRanking.map((t, i) => {
    const activeDays = Object.values(t.dailyMap || {}).filter(d => (d.pts || 0) > 0).length;
    const avgProd = activeDays > 0 ? (t.monthTotal / activeDays) : 0;
    const techGoal = meta * activeDays;
    const techPct = techGoal > 0 ? (t.monthTotal / techGoal) : 0;
    const techDeficit = t.monthTotal - techGoal;

    const row = {
      '#': i + 1,
      'ID': t.idRecursoToa || '—',
      'Técnico': t.fullName || t.name,
      'Proyecto': t.proyecto || 'S/P',
      'Estado': (t.estado || t.status || 'CONTRATADO').toUpperCase()
    };

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      row[`Día ${d}`] = toExcelVal(t.dailyMap?.[dateKey]?.pts || 0);
    }

    row['Pts. Total'] = toExcelVal(t.monthTotal);
    row['Prom/Día'] = toExcelVal(avgProd);
    row['% Meta'] = `${Math.round(techPct * 100)}%`;
    row['Déficit'] = toExcelVal(techDeficit);

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Producción");
  XLSX.writeFile(wb, `Produccion_${year}_${month + 1}.xlsx`);
};

export const downloadPDF = async (reportRef, title = 'Reporte de Producción') => {
  if (!reportRef.current) return;
  
  try {
    // Dynamic imports to reduce initial bundle size and build complexity
    const [html2canvas, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);

    const canvas = await html2canvas.default(reportRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#f8fafc'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error("❌ Error generando PDF:", error);
  }
};
