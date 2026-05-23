import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Insert CustomLabel inside the component
    custom_tooltip_code = """  // Custom Tooltip"""
    custom_label_code = """  // Custom Label for Charts
  const CustomLabel = (props) => {
    const { x, y, value, width, height, position, bgColor, textColor, offset = 10 } = props;
    if (!value && value !== 0) return null;
    
    const textStr = String(value);
    const rectWidth = textStr.length * 6 + 8;
    const rectHeight = 16;
    
    let finalX = x;
    let finalY = y - offset;
    
    if (position === 'inside') {
      finalX = x + (width || 0) / 2;
      finalY = y + (height || 0) / 2;
    } else if (position === 'insideBottom') {
      finalX = x; 
      finalY = y + offset;
    } else if (position === 'top' && width !== undefined) {
      finalX = x + width / 2;
    }

    return (
      <g>
        <rect x={finalX - rectWidth / 2} y={finalY - rectHeight / 2} width={rectWidth} height={rectHeight} fill={bgColor} rx={4} ry={4} stroke={textColor} strokeWidth={0.5} strokeOpacity={0.5} />
        <text x={finalX} y={finalY} fill={textColor} fontSize={8} fontWeight="bold" textAnchor="middle" dominantBaseline="central">
          {value}
        </text>
      </g>
    );
  };

  // Custom Tooltip"""
    content = content.replace(custom_tooltip_code, custom_label_code)

    # 2. Update Headers
    header1_old = """        <div className="flex items-center gap-3 mb-6">
          <Activity size={20} className="text-fuchsia-400" />
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Volumen Diario de Órdenes</h2>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest">Tendencia de Completadas vs No Realizadas contra la Meta (Asignadas)</p>
          </div>
        </div>"""
    header1_new = """        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-fuchsia-400" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Volumen Diario de Órdenes</h2>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest">Tendencia de Completadas vs No Realizadas contra la Meta (Asignadas)</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
             <div className="text-slate-400">Meta: <span className="text-fuchsia-400 text-xs ml-1">{summary.asignadas}</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">Comp: <span className="text-emerald-400 text-xs ml-1">{summary.completadas} ({efectividad}%)</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">No Real: <span className="text-rose-400 text-xs ml-1">{summary.noRealizadas} ({(summary.asignadas > 0 ? 100 - parseFloat(efectividad) : 0).toFixed(1)}%)</span></div>
          </div>
        </div>"""
    content = content.replace(header1_old, header1_new)

    header2_old = """          <div className="flex items-center gap-3 mb-6">
            <Zap size={20} className="text-indigo-400" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Pendiente Puntos Diarios</h2>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest">Puntos Totales vs Asignaciones</p>
            </div>
          </div>"""
    header2_new = """          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Zap size={20} className="text-indigo-400" />
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Pendiente Puntos Diarios</h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest">Puntos Totales vs Asignaciones</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
               <div className="text-slate-400">Meta: <span className="text-fuchsia-400 text-xs ml-1">{summary.asignadas}</span></div>
               <div className="text-slate-400 border-l border-slate-700 pl-3">Puntos: <span className="text-indigo-400 text-xs ml-1">{summary.pts.toFixed(1)}</span></div>
            </div>
          </div>"""
    content = content.replace(header2_old, header2_new)

    header3_old = """          <div className="flex items-center gap-3 mb-6">
            <Clock size={20} className="text-blue-400" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Ejecución Horaria Diaria</h2>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest">Horas Altas vs Reparaciones vs Asignaciones</p>
            </div>
          </div>"""
    header3_new = """          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-blue-400" />
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Ejecución Horaria Diaria</h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest">Horas Altas vs Reparaciones vs Asignaciones</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
               <div className="text-slate-400">Meta: <span className="text-fuchsia-400 text-xs ml-1">{summary.asignadas}</span></div>
               <div className="text-slate-400 border-l border-slate-700 pl-3">Total Hrs: <span className="text-blue-400 text-xs ml-1">{summary.horasTotal.toFixed(1)}</span></div>
            </div>
          </div>"""
    content = content.replace(header3_old, header3_new)

    # 3. Update LabelLists
    ll_comp_old = """<LabelList dataKey="completadasPct" position="top" fill="#10b981" fontSize={10} fontWeight="bold" offset={10}/>"""
    ll_comp_new = """<LabelList dataKey="completadasPct" content={<CustomLabel bgColor="#064e3b" textColor="#34d399" offset={15} position="top" />} />"""
    content = content.replace(ll_comp_old, ll_comp_new)

    ll_nr_old = """<LabelList dataKey="noRealizadasPct" position="insideBottom" fill="#f43f5e" fontSize={10} fontWeight="bold" offset={15}/>"""
    ll_nr_new = """<LabelList dataKey="noRealizadasPct" content={<CustomLabel bgColor="#881337" textColor="#fb7185" offset={15} position="insideBottom" />} />"""
    content = content.replace(ll_nr_old, ll_nr_new)

    ll_meta1_old = """<LabelList dataKey="asignadas" position="top" fill="#e879f9" fontSize={10} fontWeight="bold" offset={10}/>"""
    ll_meta1_new = """<LabelList dataKey="asignadas" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={15} position="top" />} />"""
    content = content.replace(ll_meta1_old, ll_meta1_new)

    ll_pts_old = """<LabelList dataKey="pts" position="top" fill="#818cf8" fontSize={9} fontWeight="bold" offset={5}/>"""
    ll_pts_new = """<LabelList dataKey="pts" content={<CustomLabel bgColor="#312e81" textColor="#818cf8" offset={10} position="top" />} />"""
    content = content.replace(ll_pts_old, ll_pts_new)

    ll_meta2_old = """<LabelList dataKey="asignadas" position="top" fill="#e879f9" fontSize={9} fontWeight="bold" offset={5}/>"""
    ll_meta2_new = """<LabelList dataKey="asignadas" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={10} position="top" />} />"""
    content = content.replace(ll_meta2_old, ll_meta2_new) # Replaces both remaining

    ll_halta_old = """<LabelList dataKey="horasAlta" position="inside" fill="#fff" fontSize={9} fontWeight="bold"/>"""
    ll_halta_new = """<LabelList dataKey="horasAlta" content={<CustomLabel bgColor="#1e3a8a" textColor="#93c5fd" position="inside" />} />"""
    content = content.replace(ll_halta_old, ll_halta_new)

    ll_hrep_old = """<LabelList dataKey="horasReparacion" position="top" fill="#f97316" fontSize={9} fontWeight="bold" offset={5}/>"""
    ll_hrep_new = """<LabelList dataKey="horasReparacion" content={<CustomLabel bgColor="#7c2d12" textColor="#fdba74" offset={10} position="top" />} />"""
    content = content.replace(ll_hrep_old, ll_hrep_new)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("UI enhancements applied successfully.")

if __name__ == '__main__':
    main()
