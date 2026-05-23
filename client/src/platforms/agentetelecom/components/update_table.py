import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/ProduccionDiaTable.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add tables
    tables_replacement = """  { id: 't03', badge: '03', label: 'ÓRDENES ASIGNADAS', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  { id: 't04', badge: '04', label: 'HORAS TOTALES', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 't05', badge: '05', label: 'HORAS ALTAS/INST.', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 't06', badge: '06', label: 'HORAS REPARACIONES', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
]"""
    content = content.replace("  { id: 't03', badge: '03', label: 'ÓRDENES ASIGNADAS', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },\n]", tables_replacement)

    # 2. Add flag variables
    flags_replacement = """  const isAsig = activeTable === 't03';
  const isHorasTotal = activeTable === 't04';
  const isHorasAlta = activeTable === 't05';
  const isHorasRep = activeTable === 't06';
  const isHorasAny = isHorasTotal || isHorasAlta || isHorasRep;"""
    content = content.replace("  const isAsig = activeTable === 't03';", flags_replacement)

    # 3. thead colspan
    content = content.replace("colSpan={isAsig ? 5 : 4}>MÉTRICAS FINAL", "colSpan={isAsig ? 5 : isHorasAny ? 2 : 4}>MÉTRICAS FINAL")

    # 4. thead row 2
    thead_r2_replacement = """                {isAsig ? (
                  <>
                    <th className="sticky right-[140px] z-30 bg-slate-900 border-l-4 border-l-white w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">EST</th>
                    <th className="sticky right-[105px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-fuchsia-400 uppercase p-0 text-center">ASIG</th>
                    <th className="sticky right-[70px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-emerald-400 uppercase p-0 text-center">COMP</th>
                    <th className="sticky right-[35px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-rose-400 uppercase p-0 text-center">N.R.</th>
                    <th className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-cyan-400 uppercase p-0 text-center">EFECT</th>
                  </>
                ) : isHorasAny ? (
                  <>
                    <th className="sticky right-[45px] z-30 bg-slate-900 border-l-4 border-l-white w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">EST</th>
                    <th className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 w-[45px] min-w-[45px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">TOTAL HRS</th>
                  </>
                ) : ("""
    
    pattern_thead2 = r'\{isAsig \? \(\s*<>\s*<th className="sticky right-\[140px\].*?EFECT</th>\s*</>\s*\) : \('
    content = re.sub(pattern_thead2, thead_r2_replacement, content, flags=re.DOTALL)

    # 5. td values
    td_val_replacement = """                          {isPts ? (
                            <span className={`text-[9px] font-black tracking-tight ${dd?.pts > 0 ? 'text-indigo-400' : 'text-slate-700'}`}>
                              {dd?.pts > 0 ? dd.pts.toFixed(1) : '—'}
                            </span>
                          ) : isAsig ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <span className={`text-[9px] font-black tracking-tight leading-none ${dd?.completadas > 0 ? 'text-emerald-400' : 'text-slate-700'}`}>
                                {dd?.completadas > 0 ? dd.completadas : '—'}
                              </span>
                              <span className={`text-[7px] font-black tracking-tight leading-none ${dd?.noRealizadas > 0 ? 'text-rose-400' : 'text-slate-700/50'}`}>
                                {dd?.noRealizadas > 0 ? dd.noRealizadas : '—'}
                              </span>
                            </div>
                          ) : isHorasAny ? (
                            <span className={`text-[9px] font-black tracking-tight ${
                              isHorasTotal ? (dd?.minTotal > 0 ? 'text-emerald-400' : 'text-slate-700') :
                              isHorasAlta ? (dd?.minAlta > 0 ? 'text-blue-400' : 'text-slate-700') :
                              (dd?.minReparacion > 0 ? 'text-orange-400' : 'text-slate-700')
                            }`}>
                              {(() => {
                                const minV = isHorasTotal ? (dd?.minTotal||0) : isHorasAlta ? (dd?.minAlta||0) : (dd?.minReparacion||0);
                                return minV > 0 ? `${Math.floor(minV/60).toString().padStart(2, '0')}:${(minV%60).toString().padStart(2, '0')}` : '—';
                              })()}
                            </span>
                          ) : ("""
    pattern_td_val = r'\{isPts \? \(\s*<span className={`text-\[9px\] font-black tracking-tight \$\{dd\?\.pts > 0 \? \'text-indigo-400\' : \'text-slate-700\'\}`}>\s*\{dd\?\.pts > 0 \? dd\.pts\.toFixed\(1\) : \'—\'\}\s*</span>\s*\) : isAsig \? \(\s*<div className="flex flex-col items-center justify-center h-full">\s*<span className={`text-\[9px\] font-black tracking-tight leading-none \$\{dd\?\.completadas > 0 \? \'text-emerald-400\' : \'text-slate-700\'\}`}>\s*\{dd\?\.completadas > 0 \? dd\.completadas : \'—\'\}\s*</span>\s*<span className={`text-\[7px\] font-black tracking-tight leading-none \$\{dd\?\.noRealizadas > 0 \? \'text-rose-400\' : \'text-slate-700/50\'\}`}>\s*\{dd\?\.noRealizadas > 0 \? dd\.noRealizadas : \'—\'\}\s*</span>\s*</div>\s*\) : \('
    
    content = re.sub(pattern_td_val, td_val_replacement, content, flags=re.DOTALL)

    # 6. tbody right side
    tbody_r_replacement = """                     {isAsig ? (
                       <>
                         <td className="sticky right-[140px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                           {status_renderer}
                         </td>
                         <td className="sticky right-[105px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-fuchsia-400 p-0 m-0">
                           {Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + ((dd?.completadas || 0) + (dd?.noRealizadas || 0)), 0)}
                         </td>
                         <td className="sticky right-[70px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-emerald-400 p-0 m-0">
                           {Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0)}
                         </td>
                         <td className="sticky right-[35px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-rose-400 p-0 m-0">
                           {Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0)}
                         </td>
                         <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-cyan-400 p-0 m-0">
                           {(() => {
                             const comp = Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0);
                             const noReal = Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0);
                             const asig = comp + noReal;
                             return asig > 0 ? `${((comp / asig) * 100).toFixed(1)}%` : '0.0%';
                           })()}
                         </td>
                       </>
                     ) : isHorasAny ? (
                       <>
                         <td className="sticky right-[45px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                           {status_renderer}
                         </td>
                         <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-white p-0 m-0">
                           {(() => {
                             const minTot = Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (isHorasTotal ? (dd?.minTotal||0) : isHorasAlta ? (dd?.minAlta||0) : (dd?.minReparacion||0)), 0);
                             return minTot > 0 ? `${Math.floor(minTot/60).toString().padStart(2, '0')}:${(minTot%60).toString().padStart(2, '0')}` : '—';
                           })()}
                         </td>
                       </>
                     ) : ("""
    
    pattern_tbody_r = r'\{isAsig \? \(\s*<>\s*<td className="sticky right-\[140px\].*?</td>\s*</>\s*\) : \('
    
    # Needs a hack: since `status_renderer` logic isn't defined as a const, we can just replace the block directly. Wait, `status_renderer` is the actual inline code in the file.
    # It's better to capture the isAsig block and replace it.
    
    match = re.search(r'(\{isAsig \? \(\s*<>\s*<td className="sticky right-\[140px\].*?</>\s*\)) : \(', content, flags=re.DOTALL)
    if match:
        original_asig_block = match.group(1)
        new_combined_block = original_asig_block + """ : isHorasAny ? (
                       <>
                         <td className="sticky right-[45px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                          <div className="flex items-center justify-center h-full px-1">
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
                          </div>
                         </td>
                         <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-white p-0 m-0">
                           {(() => {
                             const minTot = Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (isHorasTotal ? (dd?.minTotal||0) : isHorasAlta ? (dd?.minAlta||0) : (dd?.minReparacion||0)), 0);
                             return minTot > 0 ? `${Math.floor(minTot/60).toString().padStart(2, '0')}:${(minTot%60).toString().padStart(2, '0')}` : '—';
                           })()}
                         </td>
                       </>
                     )"""
        content = content.replace(original_asig_block, new_combined_block)

    # 7. tfoot
    tfoot_replacement = """                <tfoot className="sticky bottom-0 z-40 relative">
                  {isHorasAny ? (
                    <tr className="bg-slate-900 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                      <td className="sticky left-0 z-30 bg-slate-900 border-r-4 border-r-white border-t border-slate-800 p-0 m-0 w-[40px] min-w-[40px]"></td>
                      <td className="sticky left-[40px] z-30 bg-slate-900 border-r-4 border-r-white border-t border-slate-800 px-3 py-1.5 w-[200px] min-w-[200px]">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full animate-pulse ${
                            isHorasTotal ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' :
                            isHorasAlta ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-orange-500 shadow-[0_0_10px_#f97316]'
                          }`} />
                          TOTAL {isHorasTotal ? 'EJECUTADO' : isHorasAlta ? 'ALTAS' : 'REPARACIONES'}
                        </span>
                      </td>
                      {daysArray.map(dateStr => {
                        const totalMinDay = sortedTechs.reduce((sum, t) => sum + (t.dailyMap?.[dateStr]?.[isHorasTotal ? 'minTotal' : isHorasAlta ? 'minAlta' : 'minReparacion'] || 0), 0);
                        return (
                          <td key={dateStr} className={`border-t border-slate-800 text-center py-1.5 min-w-[30px] transition-all bg-slate-900`}>
                            <span className={`text-[10px] font-black tracking-tight ${totalMinDay > 0 ? 'text-white' : 'text-slate-700'}`}>
                              {totalMinDay > 0 ? `${Math.floor(totalMinDay/60).toString().padStart(2, '0')}:${(totalMinDay%60).toString().padStart(2, '0')}` : '—'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="sticky right-[45px] z-30 bg-slate-900 border-l-4 border-l-white border-t border-slate-800 p-0"></td>
                      <td className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 border-t border-slate-800 text-center py-1.5">
                        <span className="text-[11px] font-black text-indigo-400">
                           {(() => {
                             const grandTotalMin = sortedTechs.reduce((sum, t) => sum + Object.values(t.dailyMap || {}).reduce((s, dd) => s + (isHorasTotal ? (dd?.minTotal||0) : isHorasAlta ? (dd?.minAlta||0) : (dd?.minReparacion||0)), 0), 0);
                             return grandTotalMin > 0 ? `${Math.floor(grandTotalMin/60).toString().padStart(2, '0')}:${(grandTotalMin%60).toString().padStart(2, '0')}` : '—';
                           })()}
                        </span>
                      </td>
                    </tr>
                  ) : isAsig ? ("""
    
    content = content.replace("                <tfoot className=\"sticky bottom-0 z-40 relative\">\n                  {isAsig ? (", tfoot_replacement)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("ProduccionDiaTable updated successfully")

if __name__ == '__main__':
    main()
