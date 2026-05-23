import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/ProduccionDiaTable.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update colSpan in thead "MÉTRICAS FINAL"
    content = content.replace(
        '<th className="sticky right-0 z-40 bg-slate-900 border-l-4 border-l-white px-1 text-[7px] font-black text-slate-500" colSpan={4}>MÉTRICAS FINAL</th>',
        '<th className="sticky right-0 z-40 bg-slate-900 border-l-4 border-l-white px-1 text-[7px] font-black text-slate-500" colSpan={isAsig ? 5 : 4}>MÉTRICAS FINAL</th>'
    )

    # 2. Update thead headers
    old_thead_headers = """<th className="sticky right-[125px] z-30 bg-slate-900 border-l-4 border-l-white w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">EST</th>
                <th className="sticky right-[90px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">{isPts ? 'PTS' : isAsig ? 'ASIG' : 'ORD'}</th>
                <th className="sticky right-[55px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">PROM</th>
                <th className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 w-[55px] min-w-[55px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">PROY. CIERRE</th>"""
    
    new_thead_headers = """{isAsig ? (
                  <>
                    <th className="sticky right-[140px] z-30 bg-slate-900 border-l-4 border-l-white w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">EST</th>
                    <th className="sticky right-[105px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-fuchsia-400 uppercase p-0 text-center">ASIG</th>
                    <th className="sticky right-[70px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-emerald-400 uppercase p-0 text-center">COMP</th>
                    <th className="sticky right-[35px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-rose-400 uppercase p-0 text-center">N.R.</th>
                    <th className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-cyan-400 uppercase p-0 text-center">EFECT</th>
                  </>
                ) : (
                  <>
                    <th className="sticky right-[125px] z-30 bg-slate-900 border-l-4 border-l-white w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">EST</th>
                    <th className="sticky right-[90px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">{isPts ? 'PTS' : 'ORD'}</th>
                    <th className="sticky right-[55px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">PROM</th>
                    <th className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 w-[55px] min-w-[55px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">PROY. CIERRE</th>
                  </>
                )}"""
    
    content = content.replace(old_thead_headers, new_thead_headers)

    # 3. Update tbody cells
    old_tbody_cells = """<td className="sticky right-[125px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                        <div className="flex items-center justify-center h-full px-1">
                          {(() => {
                            const rawStatus = (t.estado || t.status || 'Activo');
                            const status = rawStatus.toUpperCase();
                            
                            // Normalización de etiquetas para consistencia con Captura Talento
                            let displayLabel = status.substring(0, 4);
                            if (status.includes('TERR')) displayLabel = 'ACTV';
                            if (status.includes('CONT')) displayLabel = 'CONT';
                            if (status.includes('APROB')) displayLabel = 'APRB';
                            if (status.includes('ENTR')) displayLabel = 'ENTR';
                            if (status.includes('POST')) displayLabel = 'POST';

                            const isContratado = status.includes('CONT') || status.includes('ACTI') || status.includes('TERR');
                            const isBaja = status.includes('BAJA') || status.includes('FINI') || status.includes('INAC');
                            
                            return (
                              <div className={`
                                text-[6px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter transition-all whitespace-nowrap
                                ${isContratado 
                                  ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' 
                                  : isBaja 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
                                }
                              `}>
                                {displayLabel}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                     <td className="sticky right-[90px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-white p-0 m-0">{currentTotal.toFixed(1)}</td>
                     <td className="sticky right-[55px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-slate-400 p-0 m-0">{avgProd.toFixed(1)}</td>
                     <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black p-0 m-0 text-indigo-400">{proyeccion.toFixed(1)}</td>"""

    status_renderer = """<div className="flex items-center justify-center h-full px-1">
                          {(() => {
                            const rawStatus = (t.estado || t.status || 'Activo');
                            const status = rawStatus.toUpperCase();
                            let displayLabel = status.substring(0, 4);
                            if (status.includes('TERR')) displayLabel = 'ACTV';
                            if (status.includes('CONT')) displayLabel = 'CONT';
                            if (status.includes('APROB')) displayLabel = 'APRB';
                            if (status.includes('ENTR')) displayLabel = 'ENTR';
                            if (status.includes('POST')) displayLabel = 'POST';
                            const isContratado = status.includes('CONT') || status.includes('ACTI') || status.includes('TERR');
                            const isBaja = status.includes('BAJA') || status.includes('FINI') || status.includes('INAC');
                            return (
                              <div className={`
                                text-[6px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter transition-all whitespace-nowrap
                                ${isContratado 
                                  ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' 
                                  : isBaja 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
                                }
                              `}>
                                {displayLabel}
                              </div>
                            );
                          })()}
                        </div>"""

    new_tbody_cells = f"""{{isAsig ? (
                       <>
                         <td className="sticky right-[140px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                           {status_renderer}
                         </td>
                         <td className="sticky right-[105px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-fuchsia-400 p-0 m-0">
                           {{Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + ((dd?.completadas || 0) + (dd?.noRealizadas || 0)), 0)}}
                         </td>
                         <td className="sticky right-[70px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-emerald-400 p-0 m-0">
                           {{Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0)}}
                         </td>
                         <td className="sticky right-[35px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-rose-400 p-0 m-0">
                           {{Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0)}}
                         </td>
                         <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-cyan-400 p-0 m-0">
                           {{(() => {{
                             const comp = Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0);
                             const noReal = Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0);
                             const asig = comp + noReal;
                             return asig > 0 ? `${{((comp / asig) * 100).toFixed(1)}}%` : '0.0%';
                           }})()}}
                         </td>
                       </>
                     ) : (
                       <>
                         <td className="sticky right-[125px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                           {status_renderer}
                         </td>
                         <td className="sticky right-[90px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-white p-0 m-0">{{currentTotal.toFixed(1)}}</td>
                         <td className="sticky right-[55px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-slate-400 p-0 m-0">{{avgProd.toFixed(1)}}</td>
                         <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black p-0 m-0 text-indigo-400">{{proyeccion.toFixed(1)}}</td>
                       </>
                     )}}"""

    content = content.replace(old_tbody_cells, new_tbody_cells)

    # 4. Update tfoot for isAsig rows
    def replace_tfoot_row(content, row_name, color):
        # Find the row by its title
        pattern = r'(<tr[^>]*>.*?<td[^>]*>' + row_name + r'</td>.*?)<td className="sticky right-\[125px\].*?</tr>'
        
        def replacement(match):
            prefix = match.group(1)
            return prefix + f"""<td className="sticky right-[140px] z-20 bg-slate-900 border-l-4 border-l-white p-0"></td>
                     <td className="sticky right-[105px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-fuchsia-400 p-0">
                       {{sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + ((dd?.completadas || 0) + (dd?.noRealizadas || 0)), 0), 0)}}
                     </td>
                     <td className="sticky right-[70px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-emerald-400 p-0">
                       {{sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0)}}
                     </td>
                     <td className="sticky right-[35px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-rose-400 p-0">
                       {{sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0)}}
                     </td>
                     <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-cyan-400 p-0">
                       {{(() => {{
                         const totalComp = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0);
                         const totalNoReal = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {{}}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0);
                         const totalAsig = totalComp + totalNoReal;
                         return totalAsig > 0 ? `${{((totalComp / totalAsig) * 100).toFixed(1)}}%` : '0.0%';
                       }})()}}
                     </td>
                   </tr>"""
        
        return re.sub(pattern, replacement, content, flags=re.DOTALL)

    content = replace_tfoot_row(content, 'TOTAL ASIGNACIÓN', 'fuchsia-400')
    content = replace_tfoot_row(content, 'TOTAL COMPLETADO', 'emerald-400')
    content = replace_tfoot_row(content, 'TOTAL NO REALIZADO', 'rose-400')
    content = replace_tfoot_row(content, 'EFECTIVIDAD', 'cyan-400')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
