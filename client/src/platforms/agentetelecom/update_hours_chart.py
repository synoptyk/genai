import re

def main():
    dashboard_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'

    with open(dashboard_path, 'r', encoding='utf-8') as f:
        dash_content = f.read()

    # 1. Update metaHoras from 7 to 6
    dash_old_1 = """const metaHoras = tecnicosActivos * 7;"""
    dash_new_1 = """const metaHoras = tecnicosActivos * 6;"""
    dash_content = dash_content.replace(dash_old_1, dash_new_1)

    # 2. Add horasDesplazamiento and horasContactabilidad, and update horasTotal
    dash_old_2 = """        horasTotal: Number((minTotal / 60).toFixed(1)),
        horasAlta: Number((minAlta / 60).toFixed(1)),
        horasReparacion: Number((minReparacion / 60).toFixed(1)),"""
    dash_new_2 = """        horasDesplazamiento: Number(((asignadas * 30) / 60).toFixed(1)),
        horasContactabilidad: Number(((asignadas * 10) / 60).toFixed(1)),
        horasTotal: Number(((minTotal + (asignadas * 40)) / 60).toFixed(1)),
        horasAlta: Number((minAlta / 60).toFixed(1)),
        horasReparacion: Number((minReparacion / 60).toFixed(1)),"""
    dash_content = dash_content.replace(dash_old_2, dash_new_2)

    # 3. Add to summary accumulator
    dash_old_3 = """      acc.horasTotal += curr.horasTotal;
      acc.metaOrdenes += curr.metaOrdenes;"""
    dash_new_3 = """      acc.horasTotal += curr.horasTotal;
      acc.horasDesplazamiento += curr.horasDesplazamiento;
      acc.horasContactabilidad += curr.horasContactabilidad;
      acc.metaOrdenes += curr.metaOrdenes;"""
    dash_content = dash_content.replace(dash_old_3, dash_new_3)

    dash_old_4 = """}, { asignadas: 0, completadas: 0, noRealizadas: 0, ptsAsignados: 0, pts: 0, horasTotal: 0, metaOrdenes: 0, metaPuntos: 0, metaHoras: 0 });"""
    dash_new_4 = """}, { asignadas: 0, completadas: 0, noRealizadas: 0, ptsAsignados: 0, pts: 0, horasTotal: 0, horasDesplazamiento: 0, horasContactabilidad: 0, metaOrdenes: 0, metaPuntos: 0, metaHoras: 0 });"""
    dash_content = dash_content.replace(dash_old_4, dash_new_4)

    # 4. Update Header text in Chart 3
    dash_old_5 = """<div className="text-slate-400">Meta (7hxTech):"""
    dash_new_5 = """<div className="text-slate-400">Meta (6hxTech):"""
    dash_content = dash_content.replace(dash_old_5, dash_new_5)

    # 5. Add Stacked Bars in Chart 3
    dash_old_6 = """                <Bar yAxisId="left" dataKey="horasAlta" stackId="horas" name="Horas Altas/Inst." fill="#3b82f6">
                  <LabelList dataKey="horasAlta" content={<CustomLabel bgColor="#1e3a8a" textColor="#93c5fd" position="inside" />} />
                </Bar>
                <Bar yAxisId="left" dataKey="horasReparacion" stackId="horas" name="Horas Reparaciones" fill="#f97316" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="horasReparacion" content={<CustomLabel bgColor="#7c2d12" textColor="#fdba74" offset={10} position="top" />} />
                </Bar>"""
    dash_new_6 = """                <Bar yAxisId="left" dataKey="horasAlta" stackId="horas" name="Horas Altas/Inst." fill="#3b82f6">
                  <LabelList dataKey="horasAlta" content={<CustomLabel bgColor="#1e3a8a" textColor="#93c5fd" position="inside" />} />
                </Bar>
                <Bar yAxisId="left" dataKey="horasReparacion" stackId="horas" name="Horas Reparaciones" fill="#f97316">
                  <LabelList dataKey="horasReparacion" content={<CustomLabel bgColor="#7c2d12" textColor="#fdba74" position="inside" />} />
                </Bar>
                <Bar yAxisId="left" dataKey="horasDesplazamiento" stackId="horas" name="Desplazamiento (+30m/ord)" fill="#a855f7">
                  <LabelList dataKey="horasDesplazamiento" content={<CustomLabel bgColor="#581c87" textColor="#d8b4fe" position="inside" />} />
                </Bar>
                <Bar yAxisId="left" dataKey="horasContactabilidad" stackId="horas" name="Contactabilidad (+10m/ord)" fill="#14b8a6" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="horasContactabilidad" content={<CustomLabel bgColor="#0f766e" textColor="#5eead4" offset={10} position="top" />} />
                </Bar>"""
    dash_content = dash_content.replace(dash_old_6, dash_new_6)


    with open(dashboard_path, 'w', encoding='utf-8') as f:
        f.write(dash_content)

    print("Successfully updated hours execution chart.")

if __name__ == '__main__':
    main()
