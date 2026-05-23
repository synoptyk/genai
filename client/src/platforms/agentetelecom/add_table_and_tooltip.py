import re

def main():
    dashboard_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'

    with open(dashboard_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update CustomTooltip
    old_tooltip = """  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl">
          <p className="text-white font-black mb-2 border-b border-slate-700 pb-1">Día {label} <span className="text-slate-400 font-normal text-[10px] ml-2">({payload[0]?.payload.tecnicosActivos} Técnicos)</span></p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest my-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400">{entry.name}:</span>
              <span className="text-white ml-auto">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };"""

    new_tooltip = """  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const isHoras = payload.some(p => p.dataKey === 'horasAlta' || p.dataKey === 'horasReparacion');
      const dataPoint = payload[0]?.payload || {};
      
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl">
          <p className="text-white font-black mb-2 border-b border-slate-700 pb-1">Día {label} <span className="text-slate-400 font-normal text-[10px] ml-2">({dataPoint.tecnicosActivos} Técnicos)</span></p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest my-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400">{entry.name}:</span>
              <span className="text-white ml-auto">{entry.value}</span>
            </div>
          ))}
          {isHoras && (
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest my-1 mt-2 pt-1 border-t border-slate-700">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-blue-400">TOTAL HORAS:</span>
              <span className="text-blue-400 ml-auto">{dataPoint.horasTotal}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };"""

    content = content.replace(old_tooltip, new_tooltip)

    # 2. Add Table at the bottom
    old_bottom = """      </div>
    </div>
  );
}"""

    new_bottom = """      </div>

      {/* Tabla de Detalle de Datos */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl overflow-x-auto mt-6">
        <h3 className="text-slate-300 font-black tracking-widest mb-4 flex items-center gap-2 uppercase text-xs">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          Detalle Diario de Operación
        </h3>
        <table className="w-full text-left text-xs text-slate-400 whitespace-nowrap">
          <thead className="text-slate-500 border-b border-slate-800">
            <tr>
              <th className="py-3 px-2 font-bold">DÍA</th>
              <th className="py-3 px-2 font-bold text-center">TÉCNICOS</th>
              <th className="py-3 px-2 font-bold text-right">ÓRD. ASIGNADAS</th>
              <th className="py-3 px-2 font-bold text-right text-emerald-400">ÓRD. COMPL.</th>
              <th className="py-3 px-2 font-bold text-right text-rose-400">ÓRD. NO REALIZ.</th>
              <th className="py-3 px-2 font-bold text-right text-slate-300">META ÓRD.</th>
              <th className="py-3 px-2 font-bold text-right text-indigo-400">PTS GENERADOS</th>
              <th className="py-3 px-2 font-bold text-right">PTS ASIGNADOS</th>
              <th className="py-3 px-2 font-bold text-right text-slate-300">META PUNTOS</th>
              <th className="py-3 px-2 font-bold text-right text-blue-400">HRS ALTAS</th>
              <th className="py-3 px-2 font-bold text-right text-orange-400">HRS REPAR.</th>
              <th className="py-3 px-2 font-bold text-right text-blue-400">HRS TOTAL</th>
              <th className="py-3 px-2 font-bold text-right text-fuchsia-400">META HRS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map((row) => (
              <tr key={row.dia} className="hover:bg-slate-800/20 transition-colors">
                <td className="py-3 px-2 font-bold text-white">Día {row.dia}</td>
                <td className="py-3 px-2 text-center text-slate-300">{row.tecnicosActivos}</td>
                <td className="py-3 px-2 text-right">{row.asignadas}</td>
                <td className="py-3 px-2 text-right text-emerald-400 font-bold">{row.completadas}</td>
                <td className="py-3 px-2 text-right text-rose-400">{row.noRealizadas}</td>
                <td className="py-3 px-2 text-right text-slate-300">{row.metaOrdenesLine || 0}</td>
                <td className="py-3 px-2 text-right text-indigo-400 font-bold">{row.pts.toFixed(1)}</td>
                <td className="py-3 px-2 text-right">{row.ptsAsignados.toFixed(1)}</td>
                <td className="py-3 px-2 text-right text-slate-300">{row.metaPuntosLine || 0}</td>
                <td className="py-3 px-2 text-right text-blue-400">{row.horasAlta.toFixed(1)}</td>
                <td className="py-3 px-2 text-right text-orange-400">{row.horasReparacion.toFixed(1)}</td>
                <td className="py-3 px-2 text-right text-blue-400 font-bold">{row.horasTotal.toFixed(1)}</td>
                <td className="py-3 px-2 text-right text-fuchsia-400">{row.metaHorasLine || 0}</td>
              </tr>
            ))}
            <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
              <td className="py-3 px-2">TOTAL</td>
              <td className="py-3 px-2 text-center text-slate-400">-</td>
              <td className="py-3 px-2 text-right">{summary.asignadas}</td>
              <td className="py-3 px-2 text-right text-emerald-400">{summary.completadas}</td>
              <td className="py-3 px-2 text-right text-rose-400">{summary.noRealizadas}</td>
              <td className="py-3 px-2 text-right text-slate-300">{summary.metaOrdenes}</td>
              <td className="py-3 px-2 text-right text-indigo-400">{summary.pts.toFixed(1)}</td>
              <td className="py-3 px-2 text-right">{summary.ptsAsignados.toFixed(1)}</td>
              <td className="py-3 px-2 text-right text-slate-300">{summary.metaPuntos.toFixed(1)}</td>
              <td className="py-3 px-2 text-right text-blue-400">
                {data.reduce((acc, curr) => acc + (curr.horasAlta || 0), 0).toFixed(1)}
              </td>
              <td className="py-3 px-2 text-right text-orange-400">
                {data.reduce((acc, curr) => acc + (curr.horasReparacion || 0), 0).toFixed(1)}
              </td>
              <td className="py-3 px-2 text-right text-blue-400">
                {summary.horasTotal.toFixed(1)}
              </td>
              <td className="py-3 px-2 text-right text-fuchsia-400">{summary.metaHoras}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}"""

    content = content.replace(old_bottom, new_bottom)

    with open(dashboard_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Added table and total horas to tooltip.")

if __name__ == '__main__':
    main()
