import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update data generation to include metaHoras
    data_gen_old = """      const asignadas = completadas + noRealizadas;
      const metaPuntos = Number((tecnicosActivos * metaDiariaPB).toFixed(1));

      return {
        tecnicosActivos,
        metaPuntos,"""
    data_gen_new = """      const asignadas = completadas + noRealizadas;
      const metaPuntos = Number((tecnicosActivos * metaDiariaPB).toFixed(1));
      const metaHoras = tecnicosActivos * 7;

      return {
        tecnicosActivos,
        metaPuntos,
        metaHoras,"""
    content = content.replace(data_gen_old, data_gen_new)

    # 2. Update summary aggregation
    summary_old = """      acc.metaPuntos += curr.metaPuntos;
      return acc;
    }, { asignadas: 0, completadas: 0, noRealizadas: 0, pts: 0, horasTotal: 0, metaPuntos: 0 });"""
    summary_new = """      acc.metaPuntos += curr.metaPuntos;
      acc.metaHoras += curr.metaHoras;
      return acc;
    }, { asignadas: 0, completadas: 0, noRealizadas: 0, pts: 0, horasTotal: 0, metaPuntos: 0, metaHoras: 0 });"""
    content = content.replace(summary_old, summary_new)

    # 3. Update Chart 3 header
    header3_old = """            <div className="flex items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
               <div className="text-slate-400">Asignación: <span className="text-fuchsia-400 text-xs ml-1">{summary.asignadas}</span></div>
               <div className="text-slate-400 border-l border-slate-700 pl-3">Total Hrs: <span className="text-blue-400 text-xs ml-1">{summary.horasTotal.toFixed(1)}</span></div>
            </div>"""
    header3_new = """            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
               <div className="text-slate-400">Meta (7hxTech): <span className="text-fuchsia-400 text-xs ml-1">{summary.metaHoras.toFixed(1)}</span></div>
               <div className="text-slate-400 border-l border-slate-700 pl-3">Total Hrs: <span className="text-blue-400 text-xs ml-1">{summary.horasTotal.toFixed(1)}</span></div>
            </div>"""
    content = content.replace(header3_old, header3_new)

    # 4. Update Chart 3 line graph
    # Find the line graph for chart 3. The dataKey is "asignadas".
    # Wait, in the entire file there are three `<Line ... dataKey="asignadas"` originally, but one was changed to "metaPuntos".
    # We can just look for the remaining one. There's one in Chart 1 and one in Chart 3.
    # Chart 1: <Line type="monotone" dataKey="asignadas" name="Asignadas" ...
    # Chart 3: <Line yAxisId="right" type="monotone" dataKey="asignadas" name="Asignadas" ...
    
    line3_old = """<Line yAxisId="right" type="monotone" dataKey="asignadas" name="Asignadas" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="asignadas" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={10} position="top" />} />
                </Line>"""
    line3_new = """<Line yAxisId="right" type="monotone" dataKey="metaHoras" name="Meta (Horas)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="metaHoras" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={10} position="top" />} />
                </Line>"""
    content = content.replace(line3_old, line3_new)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("DashboardSeguimientoDia.jsx updated for Meta Horas")

if __name__ == '__main__':
    main()
