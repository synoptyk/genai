import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update data generation
    data_gen_old = """      const asignadas = completadas + noRealizadas;
      const metaPuntos = Number((tecnicosActivos * metaDiariaPB).toFixed(1));
      const metaHoras = tecnicosActivos * 7;

      return {"""
    data_gen_new = """      const asignadas = completadas + noRealizadas;
      const metaPuntos = Number((tecnicosActivos * metaDiariaPB).toFixed(1));
      const metaHoras = tecnicosActivos * 7;
      const metaPuntosLine = tecnicosActivos > 0 ? metaPuntos : null;
      const metaHorasLine = tecnicosActivos > 0 ? metaHoras : null;

      return {
        metaPuntosLine,
        metaHorasLine,"""
    content = content.replace(data_gen_old, data_gen_new)

    # 2. Add Asignadas bar to Chart 2 and use metaPuntosLine
    chart2_old = """                <Bar yAxisId="left" dataKey="pts" name="Puntos Generados" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20}>
                  <LabelList dataKey="pts" content={<CustomLabel bgColor="#312e81" textColor="#818cf8" offset={10} position="top" />} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="metaPuntos" name="Meta (Puntos)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="metaPuntos" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />
                </Line>"""
    chart2_new = """                <Bar yAxisId="left" dataKey="asignadas" name="Asignadas" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={12}>
                  <LabelList dataKey="asignadas" content={<CustomLabel bgColor="#831843" textColor="#fbcfe8" offset={10} position="top" />} />
                </Bar>
                <Bar yAxisId="left" dataKey="pts" name="Puntos Generados" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={12}>
                  <LabelList dataKey="pts" content={<CustomLabel bgColor="#312e81" textColor="#818cf8" offset={10} position="top" />} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="metaPuntosLine" name="Meta (Puntos)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" connectNulls={true} dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="metaPuntosLine" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />
                </Line>"""
    content = content.replace(chart2_old, chart2_new)

    # 3. Use metaHorasLine for Chart 3
    chart3_old = """                <Line yAxisId="right" type="monotone" dataKey="metaHoras" name="Meta (Horas)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="metaHoras" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />
                </Line>"""
    chart3_new = """                <Line yAxisId="right" type="monotone" dataKey="metaHorasLine" name="Meta (Horas)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" connectNulls={true} dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="metaHorasLine" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />
                </Line>"""
    content = content.replace(chart3_old, chart3_new)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("DashboardSeguimientoDia.jsx updated to add asignadas bar and connect nulls for meta")

if __name__ == '__main__':
    main()
