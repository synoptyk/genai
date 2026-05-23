import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Table 1: Órdenes
    table_ordenes = """
        <div className="mt-6 overflow-x-auto border-t border-slate-800 pt-4">
          <table className="w-full text-left text-xs text-slate-400 whitespace-nowrap">
            <thead className="text-slate-500 border-b border-slate-800">
              <tr>
                <th className="py-2 px-2 font-bold">DÍA</th>
                <th className="py-2 px-2 font-bold text-center">TÉCNICOS</th>
                <th className="py-2 px-2 font-bold text-right">ÓRD. ASIGNADAS</th>
                <th className="py-2 px-2 font-bold text-right text-emerald-400">ÓRD. COMPL.</th>
                <th className="py-2 px-2 font-bold text-right text-rose-400">ÓRD. NO REALIZ.</th>
                <th className="py-2 px-2 font-bold text-right text-slate-300">META ÓRD.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {data.map((row) => (
                <tr key={row.dia} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2 px-2 font-bold text-white">Día {row.dia}</td>
                  <td className="py-2 px-2 text-center text-slate-300">{row.tecnicosActivos}</td>
                  <td className="py-2 px-2 text-right">{row.asignadas}</td>
                  <td className="py-2 px-2 text-right text-emerald-400 font-bold">{row.completadas}</td>
                  <td className="py-2 px-2 text-right text-rose-400">{row.noRealizadas}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{row.metaOrdenesLine || 0}</td>
                </tr>
              ))}
              <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                <td className="py-2 px-2">TOTAL</td>
                <td className="py-2 px-2 text-center text-slate-400">-</td>
                <td className="py-2 px-2 text-right">{summary.asignadas}</td>
                <td className="py-2 px-2 text-right text-emerald-400">{summary.completadas}</td>
                <td className="py-2 px-2 text-right text-rose-400">{summary.noRealizadas}</td>
                <td className="py-2 px-2 text-right text-slate-300">{summary.metaOrdenes}</td>
              </tr>
            </tbody>
          </table>
        </div>"""

    # Table 2: Puntos
    table_puntos = """
          <div className="mt-6 overflow-x-auto border-t border-slate-800 pt-4">
            <table className="w-full text-left text-xs text-slate-400 whitespace-nowrap">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-2 font-bold">DÍA</th>
                  <th className="py-2 px-2 font-bold text-center">TÉCNICOS</th>
                  <th className="py-2 px-2 font-bold text-right">PTS ASIGNADOS</th>
                  <th className="py-2 px-2 font-bold text-right text-indigo-400">PTS GENERADOS</th>
                  <th className="py-2 px-2 font-bold text-right text-slate-300">META PUNTOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.map((row) => (
                  <tr key={row.dia} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2 px-2 font-bold text-white">Día {row.dia}</td>
                    <td className="py-2 px-2 text-center text-slate-300">{row.tecnicosActivos}</td>
                    <td className="py-2 px-2 text-right">{row.ptsAsignados.toFixed(1)}</td>
                    <td className="py-2 px-2 text-right text-indigo-400 font-bold">{row.pts.toFixed(1)}</td>
                    <td className="py-2 px-2 text-right text-slate-300">{row.metaPuntosLine || 0}</td>
                  </tr>
                ))}
                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL</td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                  <td className="py-2 px-2 text-right">{summary.ptsAsignados.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-indigo-400">{summary.pts.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{summary.metaPuntos.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>"""

    # Table 3: Horas
    table_horas = """
          <div className="mt-6 overflow-x-auto border-t border-slate-800 pt-4">
            <table className="w-full text-left text-xs text-slate-400 whitespace-nowrap">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-2 font-bold">DÍA</th>
                  <th className="py-2 px-2 font-bold text-center">TÉCNICOS</th>
                  <th className="py-2 px-2 font-bold text-right text-blue-400">HRS ALTAS</th>
                  <th className="py-2 px-2 font-bold text-right text-orange-400">HRS REPAR.</th>
                  <th className="py-2 px-2 font-bold text-right text-blue-400">HRS TOTAL</th>
                  <th className="py-2 px-2 font-bold text-right text-fuchsia-400">META HRS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.map((row) => (
                  <tr key={row.dia} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2 px-2 font-bold text-white">Día {row.dia}</td>
                    <td className="py-2 px-2 text-center text-slate-300">{row.tecnicosActivos}</td>
                    <td className="py-2 px-2 text-right text-blue-400">{row.horasAlta.toFixed(1)}</td>
                    <td className="py-2 px-2 text-right text-orange-400">{row.horasReparacion.toFixed(1)}</td>
                    <td className="py-2 px-2 text-right text-blue-400 font-bold">{row.horasTotal.toFixed(1)}</td>
                    <td className="py-2 px-2 text-right text-fuchsia-400">{row.metaHorasLine || 0}</td>
                  </tr>
                ))}
                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL</td>
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
              </tbody>
            </table>
          </div>"""

    # Insert Table 1
    content = content.replace(
        "            </ComposedChart>\n          </ResponsiveContainer>\n        </div>\n      </div>",
        "            </ComposedChart>\n          </ResponsiveContainer>\n        </div>" + table_ordenes + "\n      </div>",
        1
    )

    # Insert Table 2
    content = content.replace(
        "                </Line>\n              </ComposedChart>\n            </ResponsiveContainer>\n          </div>\n        </div>",
        "                </Line>\n              </ComposedChart>\n            </ResponsiveContainer>\n          </div>" + table_puntos + "\n        </div>",
        1
    )

    # Insert Table 3
    content = content.replace(
        "                </Line>\n              </ComposedChart>\n            </ResponsiveContainer>\n          </div>\n        </div>\n\n      </div>\n\n      {/* Tabla de Detalle de Datos */}",
        "                </Line>\n              </ComposedChart>\n            </ResponsiveContainer>\n          </div>" + table_horas + "\n        </div>\n\n      </div>\n\n      {/* Tabla de Detalle de Datos */}"
    )

    # Remove the bottom table
    content = re.sub(r'\{\/\* Tabla de Detalle de Datos \*\/\}[\s\S]*?<\/table>\s*<\/div>', '', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
