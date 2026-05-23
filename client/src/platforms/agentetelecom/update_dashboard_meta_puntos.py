import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update props
    content = content.replace(
        'export default function DashboardSeguimientoDia({ tecnicos = [], dateFrom, selectedMonths = [] }) {',
        'export default function DashboardSeguimientoDia({ tecnicos = [], dateFrom, selectedMonths = [], metaConfig = {} }) {'
    )

    # 2. Update data generation
    data_gen_old = """      let minAlta = 0;
      let minReparacion = 0;

      tecnicos.forEach(t => {
        const dd = t.dailyMap?.[dateKey];
        if (dd) {
          completadas += (dd.completadas || 0);
          noRealizadas += (dd.noRealizadas || 0);
          pts += (dd.pts || 0);
          minTotal += (dd.minTotal || 0);
          minAlta += (dd.minAlta || 0);
          minReparacion += (dd.minReparacion || 0);
        }
      });

      const asignadas = completadas + noRealizadas;

      return {"""
    
    data_gen_new = """      let minAlta = 0;
      let minReparacion = 0;
      let tecnicosActivos = 0;

      const metaDiariaPB = metaConfig.metaProduccionDia || metaConfig.metaDiaria || 7.5;

      tecnicos.forEach(t => {
        const dd = t.dailyMap?.[dateKey];
        if (dd) {
          completadas += (dd.completadas || 0);
          noRealizadas += (dd.noRealizadas || 0);
          pts += (dd.pts || 0);
          minTotal += (dd.minTotal || 0);
          minAlta += (dd.minAlta || 0);
          minReparacion += (dd.minReparacion || 0);
          if (dd.completadas > 0 || dd.noRealizadas > 0 || dd.pts > 0 || dd.orders > 0 || dd.minTotal > 0) {
            tecnicosActivos += 1;
          }
        }
      });

      const asignadas = completadas + noRealizadas;
      const metaPuntos = Number((tecnicosActivos * metaDiariaPB).toFixed(1));

      return {
        tecnicosActivos,
        metaPuntos,"""
    content = content.replace(data_gen_old, data_gen_new)

    # 3. Update summary
    summary_old = """    return data.reduce((acc, curr) => {
      acc.asignadas += curr.asignadas;
      acc.completadas += curr.completadas;
      acc.noRealizadas += curr.noRealizadas;
      acc.pts += curr.pts;
      acc.horasTotal += curr.horasTotal;
      return acc;
    }, { asignadas: 0, completadas: 0, noRealizadas: 0, pts: 0, horasTotal: 0 });"""
    summary_new = """    return data.reduce((acc, curr) => {
      acc.asignadas += curr.asignadas;
      acc.completadas += curr.completadas;
      acc.noRealizadas += curr.noRealizadas;
      acc.pts += curr.pts;
      acc.horasTotal += curr.horasTotal;
      acc.metaPuntos += curr.metaPuntos;
      return acc;
    }, { asignadas: 0, completadas: 0, noRealizadas: 0, pts: 0, horasTotal: 0, metaPuntos: 0 });"""
    content = content.replace(summary_old, summary_new)

    # 4. Update Custom Tooltip to show active techs
    tooltip_old = """        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl">
          <p className="text-white font-black mb-2 border-b border-slate-700 pb-1">Día {label}</p>
          {payload.map((entry, index) => ("""
    tooltip_new = """        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl">
          <p className="text-white font-black mb-2 border-b border-slate-700 pb-1">Día {label} <span className="text-slate-400 font-normal text-[10px] ml-2">({payload[0]?.payload.tecnicosActivos} Técnicos)</span></p>
          {payload.map((entry, index) => ("""
    content = content.replace(tooltip_old, tooltip_new)

    # 5. Update Points header text
    header2_old = """            <div className="flex items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
               <div className="text-slate-400">Asignación: <span className="text-fuchsia-400 text-xs ml-1">{summary.asignadas}</span></div>
               <div className="text-slate-400 border-l border-slate-700 pl-3">Puntos: <span className="text-indigo-400 text-xs ml-1">{summary.pts.toFixed(1)}</span></div>
            </div>"""
    header2_new = """            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
               <div className="text-slate-400">Meta (7.5xTech): <span className="text-fuchsia-400 text-xs ml-1">{summary.metaPuntos.toFixed(1)}</span></div>
               <div className="text-slate-400 border-l border-slate-700 pl-3">Puntos: <span className="text-indigo-400 text-xs ml-1">{summary.pts.toFixed(1)}</span></div>
            </div>"""
    content = content.replace(header2_old, header2_new)

    # 6. Update Points Line chart dataKey and label
    line2_old = """<Line yAxisId="right" type="monotone" dataKey="asignadas" name="Asignadas" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="asignadas" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={10} position="top" />} />
                </Line>"""
    line2_new = """<Line yAxisId="right" type="monotone" dataKey="metaPuntos" name="Meta (Puntos)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="metaPuntos" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={10} position="top" />} />
                </Line>"""
    content = content.replace(line2_old, line2_new)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("DashboardSeguimientoDia.jsx updated for Meta Points and Active Techs")

if __name__ == '__main__':
    main()
