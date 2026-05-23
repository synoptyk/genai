import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/ProduccionDiaTable.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix getSortedTechs
    get_sorted_techs_old = """  const getSortedTechs = (type) => {
    const isPts = type === 'pts';
    const isAsig = type === 'asignadas';
    return [...tecnicos]"""
    get_sorted_techs_new = """  const getSortedTechs = (type) => {
    const isPts = type === 'pts';
    const isAsig = type === 'asignadas';
    const isHorasTotal = type === 'horasTotal';
    const isHorasAlta = type === 'horasAlta';
    const isHorasRep = type === 'horasReparacion';
    return [...tecnicos]"""
    content = content.replace(get_sorted_techs_old, get_sorted_techs_new)

    get_sorted_techs_reduce_old = """          if (isAsig) return acc + ((d.completadas || 0) + (d.noRealizadas || 0));
          return acc + (d.orders || d.count || 0);"""
    get_sorted_techs_reduce_new = """          if (isAsig) return acc + ((d.completadas || 0) + (d.noRealizadas || 0));
          if (isHorasTotal) return acc + (d.minTotal || 0);
          if (isHorasAlta) return acc + (d.minAlta || 0);
          if (isHorasRep) return acc + (d.minReparacion || 0);
          return acc + (d.orders || d.count || 0);"""
    content = content.replace(get_sorted_techs_reduce_old, get_sorted_techs_reduce_new)

    # Fix handleDownloadExcel
    handle_dl_old = """  const handleDownloadExcel = (type) => {
    const isPts = type === 'pts';
    const isAsig = type === 'asignadas';
    const dayNamesRow = ["""
    handle_dl_new = """  const handleDownloadExcel = (type) => {
    const isPts = type === 'pts';
    const isAsig = type === 'asignadas';
    const isHorasTotal = type === 'horasTotal';
    const isHorasAlta = type === 'horasAlta';
    const isHorasRep = type === 'horasReparacion';
    const isHorasAny = isHorasTotal || isHorasAlta || isHorasRep;
    const dayNamesRow = ["""
    content = content.replace(handle_dl_old, handle_dl_new)

    handle_dl_headers_old = """'ESTADO', isPts ? 'TOTAL PTS' : isAsig ? 'TOTAL ASIGN' : 'TOTAL ORD', 'PROM. DIARIO', 'PROY. CIERRE'"""
    handle_dl_headers_new = """'ESTADO', isPts ? 'TOTAL PTS' : isAsig ? 'TOTAL ASIGN' : isHorasAny ? 'TOTAL HORAS' : 'TOTAL ORD', 'PROM. DIARIO', 'PROY. CIERRE'"""
    content = content.replace(handle_dl_headers_old, handle_dl_headers_new)

    # Note: handle_dl_reduce_old is same as get_sorted_techs_reduce_old
    # But content.replace does all occurrences, so the three reduce blocks in getSortedTechs and handleDownloadExcel are covered!

    # Also there's one productiveDays filter logic
    prod_days_filter_old = """        if (isAsig) return ((d.completadas || 0) + (d.noRealizadas || 0)) > 0;
        return (d.orders || d.count || 0) > 0;"""
    prod_days_filter_new = """        if (isAsig) return ((d.completadas || 0) + (d.noRealizadas || 0)) > 0;
        if (isHorasTotal) return (d.minTotal || 0) > 0;
        if (isHorasAlta) return (d.minAlta || 0) > 0;
        if (isHorasRep) return (d.minReparacion || 0) > 0;
        return (d.orders || d.count || 0) > 0;"""
    content = content.replace(prod_days_filter_old, prod_days_filter_new)
    
    # Also dailyValues map logic
    daily_vals_old = """        if (isAsig) return ((dayData?.completadas || 0) + (dayData?.noRealizadas || 0));
        return (dayData?.orders || dayData?.count || 0);"""
    daily_vals_new = """        if (isAsig) return ((dayData?.completadas || 0) + (dayData?.noRealizadas || 0));
        if (isHorasTotal) return ((dayData?.minTotal || 0) / 60).toFixed(1);
        if (isHorasAlta) return ((dayData?.minAlta || 0) / 60).toFixed(1);
        if (isHorasRep) return ((dayData?.minReparacion || 0) / 60).toFixed(1);
        return (dayData?.orders || dayData?.count || 0);"""
    content = content.replace(daily_vals_old, daily_vals_new)
    
    # Also currentTotal.toFixed(1) output
    dl_current_total_old = """        currentTotal.toFixed(1),
        avgProd.toFixed(1),
        proyeccion.toFixed(1)"""
    dl_current_total_new = """        isHorasAny ? (currentTotal / 60).toFixed(1) : currentTotal.toFixed(1),
        isHorasAny ? (avgProd / 60).toFixed(1) : avgProd.toFixed(1),
        isHorasAny ? (proyeccion / 60).toFixed(1) : proyeccion.toFixed(1)"""
    content = content.replace(dl_current_total_old, dl_current_total_new)
    
    dl_filename_old = """XLSX.writeFile(workbook, `Reporte_Produccion_${isPts ? 'PTS' : isAsig ? 'ASIG' : 'ORD'}_${year}_${month + 1}.xlsx`);"""
    dl_filename_new = """XLSX.writeFile(workbook, `Reporte_Produccion_${isPts ? 'PTS' : isAsig ? 'ASIG' : isHorasAny ? 'HRS' : 'ORD'}_${year}_${month + 1}.xlsx`);"""
    content = content.replace(dl_filename_old, dl_filename_new)
    
    dl_sheet_name_old = """isPts ? 'Producción PTS' : isAsig ? 'Asignadas' : 'Volumen ORD'"""
    dl_sheet_name_new = """isPts ? 'Producción PTS' : isAsig ? 'Asignadas' : isHorasAny ? 'Horas Ejecutadas' : 'Volumen ORD'"""
    content = content.replace(dl_sheet_name_old, dl_sheet_name_new)

    # Fix renderTable flags
    render_table_old = """  const renderTable = (type, title) => {
    const isPts = type === 'pts';
    const isAsig = type === 'asignadas';
    const mainColor = isPts ? 'text-emerald-400' : isAsig ? 'text-fuchsia-400' : 'text-cyan-400';"""
    render_table_new = """  const renderTable = (type, title) => {
    const isPts = type === 'pts';
    const isAsig = type === 'asignadas';
    const isHorasTotal = type === 'horasTotal';
    const isHorasAlta = type === 'horasAlta';
    const isHorasRep = type === 'horasReparacion';
    const isHorasAny = isHorasTotal || isHorasAlta || isHorasRep;
    const mainColor = isPts ? 'text-emerald-400' : isAsig ? 'text-fuchsia-400' : isHorasTotal ? 'text-emerald-400' : isHorasAlta ? 'text-blue-400' : isHorasRep ? 'text-orange-400' : 'text-cyan-400';"""
    content = content.replace(render_table_old, render_table_new)

    main_bg_old = """    const mainBg = isPts ? 'bg-emerald-500' : isAsig ? 'bg-fuchsia-500' : 'bg-cyan-500';"""
    main_bg_new = """    const mainBg = isPts ? 'bg-emerald-500' : isAsig ? 'bg-fuchsia-500' : isHorasTotal ? 'bg-emerald-500' : isHorasAlta ? 'bg-blue-500' : isHorasRep ? 'bg-orange-500' : 'bg-cyan-500';"""
    content = content.replace(main_bg_old, main_bg_new)

    # Also the bottom of the component needs to render the new tables
    render_calls_old = """      {renderTable('pts', 'TABLA 01: RENDIMIENTO (PUNTOS)')}
      {renderTable('orders', 'TABLA 02: VOLUMEN (ÓRDENES)')}
      {renderTable('asignadas', 'TABLA 03: ÓRDENES ASIGNADAS (COMPLETADAS + NO REALIZADAS)')}
    </div>"""
    render_calls_new = """      {renderTable('pts', 'TABLA 01: RENDIMIENTO (PUNTOS)')}
      {renderTable('orders', 'TABLA 02: VOLUMEN (ÓRDENES)')}
      {renderTable('asignadas', 'TABLA 03: ÓRDENES ASIGNADAS (COMPLETADAS + NO REALIZADAS)')}
      {renderTable('horasTotal', 'TABLA 04: HORAS TOTALES EJECUTADAS')}
      {renderTable('horasAlta', 'TABLA 05: HORAS ALTAS/INSTALACIONES')}
      {renderTable('horasReparacion', 'TABLA 06: HORAS REPARACIONES')}
    </div>"""
    content = content.replace(render_calls_old, render_calls_new)

    # Remove the bad flag definitions at the top that I accidentally added
    bad_flags_old = """  const isAsig = activeTable === 't03';
  const isHorasTotal = activeTable === 't04';
  const isHorasAlta = activeTable === 't05';
  const isHorasRep = activeTable === 't06';
  const isHorasAny = isHorasTotal || isHorasAlta || isHorasRep;"""
    content = content.replace(bad_flags_old, "")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("ProduccionDiaTable updated with proper scopes")

if __name__ == '__main__':
    main()
