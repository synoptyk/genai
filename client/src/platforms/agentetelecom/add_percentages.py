import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacement 1: Ordenes
    old_ordenes = """                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL ACUMULADO</td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                  <td className="py-2 px-2 text-right">{summary.asignadas}</td>
                  <td className="py-2 px-2 text-right text-emerald-400">{summary.completadas}</td>
                  <td className="py-2 px-2 text-right text-rose-400">{summary.noRealizadas}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{summary.metaOrdenes}</td>
                </tr>"""

    new_ordenes = """                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL ACUMULADO</td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                  <td className="py-2 px-2 text-right">{summary.asignadas}</td>
                  <td className="py-2 px-2 text-right text-emerald-400">{summary.completadas}</td>
                  <td className="py-2 px-2 text-right text-rose-400">{summary.noRealizadas}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{summary.metaOrdenes}</td>
                </tr>
                <tr className="bg-slate-800/20 font-bold text-[11px] uppercase tracking-wider">
                  <td className="py-2 px-2 text-slate-400">RENDIMIENTO (%)</td>
                  <td className="py-2 px-2 text-center text-slate-500">-</td>
                  <td className="py-2 px-2 text-right text-slate-400">100%</td>
                  <td className="py-2 px-2 text-right text-emerald-400">{summary.asignadas > 0 ? ((summary.completadas / summary.asignadas) * 100).toFixed(1) : '0.0'}%</td>
                  <td className="py-2 px-2 text-right text-rose-400">{summary.asignadas > 0 ? ((summary.noRealizadas / summary.asignadas) * 100).toFixed(1) : '0.0'}%</td>
                  <td className="py-2 px-2 text-right text-fuchsia-400">{summary.metaOrdenes > 0 ? ((summary.completadas / summary.metaOrdenes) * 100).toFixed(1) : '0.0'}% s/Meta</td>
                </tr>"""
    content = content.replace(old_ordenes, new_ordenes)

    # Replacement 2: Puntos
    old_puntos = """                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL ACUMULADO</td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                  <td className="py-2 px-2 text-right">{summary.ptsAsignados.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-indigo-400">{summary.pts.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{summary.metaPuntos.toFixed(1)}</td>
                </tr>"""

    new_puntos = """                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL ACUMULADO</td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                  <td className="py-2 px-2 text-right">{summary.ptsAsignados.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-indigo-400">{summary.pts.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{summary.metaPuntos.toFixed(1)}</td>
                </tr>
                <tr className="bg-slate-800/20 font-bold text-[11px] uppercase tracking-wider">
                  <td className="py-2 px-2 text-slate-400">RENDIMIENTO (%)</td>
                  <td className="py-2 px-2 text-center text-slate-500">-</td>
                  <td className="py-2 px-2 text-right text-slate-400">100%</td>
                  <td className="py-2 px-2 text-right text-indigo-400">{summary.ptsAsignados > 0 ? ((summary.pts / summary.ptsAsignados) * 100).toFixed(1) : '0.0'}%</td>
                  <td className="py-2 px-2 text-right text-fuchsia-400">{summary.metaPuntos > 0 ? ((summary.pts / summary.metaPuntos) * 100).toFixed(1) : '0.0'}% s/Meta</td>
                </tr>"""
    content = content.replace(old_puntos, new_puntos)


    # Replacement 3: Horas
    old_horas = """                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL ACUMULADO</td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                  <td className="py-2 px-2 text-right text-blue-400">
                    {data.reduce((acc, curr) => acc + (curr.horasAlta || 0), 0).toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right text-orange-400">
                    {data.reduce((acc, curr) => acc + (curr.horasReparacion || 0), 0).toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right text-blue-400">{summary.horasTotal.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-fuchsia-400">{summary.metaHoras}</td>
                </tr>"""
                
    new_horas = """                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL ACUMULADO</td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                  <td className="py-2 px-2 text-right text-blue-400">
                    {data.reduce((acc, curr) => acc + (curr.horasAlta || 0), 0).toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right text-orange-400">
                    {data.reduce((acc, curr) => acc + (curr.horasReparacion || 0), 0).toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right text-blue-400">{summary.horasTotal.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-fuchsia-400">{summary.metaHoras}</td>
                </tr>
                {(() => {
                  const totalHrsAltas = data.reduce((acc, curr) => acc + (curr.horasAlta || 0), 0);
                  const totalHrsRep = data.reduce((acc, curr) => acc + (curr.horasReparacion || 0), 0);
                  const totalHrs = summary.horasTotal;
                  const metaHrs = summary.metaHoras;
                  return (
                    <tr className="bg-slate-800/20 font-bold text-[11px] uppercase tracking-wider">
                      <td className="py-2 px-2 text-slate-400">DISTRIBUCIÓN / LOGRO</td>
                      <td className="py-2 px-2 text-center text-slate-500">-</td>
                      <td className="py-2 px-2 text-right text-blue-400">{totalHrs > 0 ? ((totalHrsAltas / totalHrs) * 100).toFixed(1) : '0.0'}%</td>
                      <td className="py-2 px-2 text-right text-orange-400">{totalHrs > 0 ? ((totalHrsRep / totalHrs) * 100).toFixed(1) : '0.0'}%</td>
                      <td className="py-2 px-2 text-right text-slate-400">100%</td>
                      <td className="py-2 px-2 text-right text-fuchsia-400">{metaHrs > 0 ? ((totalHrs / metaHrs) * 100).toFixed(1) : '0.0'}% s/Meta</td>
                    </tr>
                  );
                })()}"""
    content = content.replace(old_horas, new_horas)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
