import re

def main():
    dashboard_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'

    with open(dashboard_path, 'r', encoding='utf-8') as f:
        dash_content = f.read()

    # 1. Add metaOrdenes calculation
    dash_old_1 = """      const metaPuntos = Number((tecnicosActivos * metaDiariaPB).toFixed(1));
      const metaHoras = tecnicosActivos * 7;
      const metaPuntosLine = tecnicosActivos > 0 ? metaPuntos : null;
      const metaHorasLine = tecnicosActivos > 0 ? metaHoras : null;"""
    dash_new_1 = """      const metaOrdenes = tecnicosActivos * 5;
      const metaPuntos = Number((tecnicosActivos * metaDiariaPB).toFixed(1));
      const metaHoras = tecnicosActivos * 7;
      const metaOrdenesLine = tecnicosActivos > 0 ? metaOrdenes : null;
      const metaPuntosLine = tecnicosActivos > 0 ? metaPuntos : null;
      const metaHorasLine = tecnicosActivos > 0 ? metaHoras : null;"""
    dash_content = dash_content.replace(dash_old_1, dash_new_1)

    # 2. Add to return object
    dash_old_2 = """      return {
        metaPuntosLine,
        metaHorasLine,
        tecnicosActivos,
        metaPuntos,
        metaHoras,"""
    dash_new_2 = """      return {
        metaOrdenesLine,
        metaPuntosLine,
        metaHorasLine,
        tecnicosActivos,
        metaOrdenes,
        metaPuntos,
        metaHoras,"""
    dash_content = dash_content.replace(dash_old_2, dash_new_2)

    # 3. Add to summary
    dash_old_3 = """      acc.metaPuntos += curr.metaPuntos;
      acc.metaHoras += curr.metaHoras;
      return acc;
    }, { asignadas: 0, completadas: 0, noRealizadas: 0, ptsAsignados: 0, pts: 0, horasTotal: 0, metaPuntos: 0, metaHoras: 0 });"""
    dash_new_3 = """      acc.metaOrdenes += curr.metaOrdenes;
      acc.metaPuntos += curr.metaPuntos;
      acc.metaHoras += curr.metaHoras;
      return acc;
    }, { asignadas: 0, completadas: 0, noRealizadas: 0, ptsAsignados: 0, pts: 0, horasTotal: 0, metaOrdenes: 0, metaPuntos: 0, metaHoras: 0 });"""
    dash_content = dash_content.replace(dash_old_3, dash_new_3)

    # 4. Update the header of Chart 1
    dash_old_4 = """             <div className="text-slate-400">Asignación: <span className="text-fuchsia-400 text-xs ml-1">{summary.asignadas}</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">Comp: <span className="text-emerald-400 text-xs ml-1">{summary.completadas} ({efectividad}%)</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">No Real: <span className="text-rose-400 text-xs ml-1">{summary.noRealizadas} ({(summary.asignadas > 0 ? 100 - parseFloat(efectividad) : 0).toFixed(1)}%)</span></div>"""
    dash_new_4 = """             <div className="text-slate-400">Meta (5xTech): <span className="text-fuchsia-400 text-xs ml-1">{summary.metaOrdenes}</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">Asignación: <span className="text-pink-400 text-xs ml-1">{summary.asignadas}</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">Comp: <span className="text-emerald-400 text-xs ml-1">{summary.completadas} ({efectividad}%)</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">No Real: <span className="text-rose-400 text-xs ml-1">{summary.noRealizadas} ({(summary.asignadas > 0 ? 100 - parseFloat(efectividad) : 0).toFixed(1)}%)</span></div>"""
    dash_content = dash_content.replace(dash_old_4, dash_new_4)

    # 5. Add Meta line to Chart 1, and make Asignadas solid
    dash_old_5 = """              <Line type="monotone" dataKey="asignadas" name="Asignadas" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#e879f9', strokeWidth: 0 }}>
                <LabelList dataKey="asignadas" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />
              </Line>"""
    dash_new_5 = """              <Line type="monotone" dataKey="asignadas" name="Asignadas" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, fill: '#ec4899', strokeWidth: 0 }}>
                <LabelList dataKey="asignadas" content={<CustomLabel bgColor="#831843" textColor="#fbcfe8" offset={20} position="bottom" />} />
              </Line>
              <Line type="monotone" dataKey="metaOrdenesLine" name="Meta (Órdenes)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" connectNulls={true} dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                <LabelList dataKey="metaOrdenesLine" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="top" />} />
              </Line>"""
    dash_content = dash_content.replace(dash_old_5, dash_new_5)


    with open(dashboard_path, 'w', encoding='utf-8') as f:
        f.write(dash_content)

    print("Successfully added Meta Ordenes to Chart 1.")

if __name__ == '__main__':
    main()
