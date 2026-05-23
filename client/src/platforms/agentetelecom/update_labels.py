import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update imports
    import_old = """  BarChart, Bar, Legend, ComposedChart, Line
} from 'recharts';"""
    import_new = """  BarChart, Bar, Legend, ComposedChart, Line, LabelList
} from 'recharts';"""
    content = content.replace(import_old, import_new)

    # 2. Update data generation to include percentages
    data_gen_old = """        horasTotal: Number((minTotal / 60).toFixed(1)),
        horasAlta: Number((minAlta / 60).toFixed(1)),
        horasReparacion: Number((minReparacion / 60).toFixed(1))
      };
    });"""
    data_gen_new = """        horasTotal: Number((minTotal / 60).toFixed(1)),
        horasAlta: Number((minAlta / 60).toFixed(1)),
        horasReparacion: Number((minReparacion / 60).toFixed(1)),
        completadasPct: asignadas > 0 ? ((completadas / asignadas) * 100).toFixed(0) + '%' : '',
        noRealizadasPct: asignadas > 0 && noRealizadas > 0 ? ((noRealizadas / asignadas) * 100).toFixed(0) + '%' : ''
      };
    });"""
    content = content.replace(data_gen_old, data_gen_new)

    # 3. Update Chart 1
    area_comp_old = """<Area type="monotone" dataKey="completadas" name="Completadas" stroke="#10b981" strokeWidth={3} fill="url(#colorComp)" />"""
    area_comp_new = """<Area type="monotone" dataKey="completadas" name="Completadas" stroke="#10b981" strokeWidth={3} fill="url(#colorComp)">
                <LabelList dataKey="completadasPct" position="top" fill="#10b981" fontSize={10} fontWeight="bold" offset={10}/>
              </Area>"""
    content = content.replace(area_comp_old, area_comp_new)

    area_nr_old = """<Area type="monotone" dataKey="noRealizadas" name="No Realizadas" stroke="#f43f5e" strokeWidth={3} fill="url(#colorNR)" />"""
    area_nr_new = """<Area type="monotone" dataKey="noRealizadas" name="No Realizadas" stroke="#f43f5e" strokeWidth={3} fill="url(#colorNR)">
                <LabelList dataKey="noRealizadasPct" position="insideBottom" fill="#f43f5e" fontSize={10} fontWeight="bold" offset={15}/>
              </Area>"""
    content = content.replace(area_nr_old, area_nr_new)

    line_meta_old = """<Line type="monotone" dataKey="asignadas" name="Meta (Asignadas)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#e879f9', strokeWidth: 0 }} />"""
    line_meta_new = """<Line type="monotone" dataKey="asignadas" name="Meta (Asignadas)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#e879f9', strokeWidth: 0 }}>
                <LabelList dataKey="asignadas" position="top" fill="#e879f9" fontSize={10} fontWeight="bold" offset={10}/>
              </Line>"""
    content = content.replace(line_meta_old, line_meta_new)

    # 4. Update Chart 2
    bar_pts_old = """<Bar yAxisId="left" dataKey="pts" name="Puntos Generados" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />"""
    bar_pts_new = """<Bar yAxisId="left" dataKey="pts" name="Puntos Generados" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20}>
                  <LabelList dataKey="pts" position="top" fill="#818cf8" fontSize={9} fontWeight="bold" offset={5}/>
                </Bar>"""
    content = content.replace(bar_pts_old, bar_pts_new)

    line_meta2_old = """<Line yAxisId="right" type="monotone" dataKey="asignadas" name="Meta (Asignadas)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }} />"""
    line_meta2_new = """<Line yAxisId="right" type="monotone" dataKey="asignadas" name="Meta (Asignadas)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="asignadas" position="top" fill="#e879f9" fontSize={9} fontWeight="bold" offset={5}/>
                </Line>"""
    # Note: replace with count=1 won't work easily if there are multiple. 
    # Let's replace line_meta2_old globally.
    content = content.replace(line_meta2_old, line_meta2_new)

    # 5. Update Chart 3
    bar_h_alta_old = """<Bar yAxisId="left" dataKey="horasAlta" stackId="horas" name="Horas Altas/Inst." fill="#3b82f6" />"""
    bar_h_alta_new = """<Bar yAxisId="left" dataKey="horasAlta" stackId="horas" name="Horas Altas/Inst." fill="#3b82f6">
                  <LabelList dataKey="horasAlta" position="inside" fill="#fff" fontSize={9} fontWeight="bold"/>
                </Bar>"""
    content = content.replace(bar_h_alta_old, bar_h_alta_new)

    bar_h_rep_old = """<Bar yAxisId="left" dataKey="horasReparacion" stackId="horas" name="Horas Reparaciones" fill="#f97316" radius={[4, 4, 0, 0]} />"""
    bar_h_rep_new = """<Bar yAxisId="left" dataKey="horasReparacion" stackId="horas" name="Horas Reparaciones" fill="#f97316" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="horasReparacion" position="top" fill="#f97316" fontSize={9} fontWeight="bold" offset={5}/>
                </Bar>"""
    content = content.replace(bar_h_rep_old, bar_h_rep_new)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("DashboardSeguimientoDia.jsx updated with data labels!")

if __name__ == '__main__':
    main()
