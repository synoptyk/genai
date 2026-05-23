import re
import os

def main():
    dashboard_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    server_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/server/server.js'

    # --- 1. FRONTEND REVERSION ---
    with open(dashboard_path, 'r', encoding='utf-8') as f:
        dash_content = f.read()

    dash_old_1 = """        horasDesplazamiento: Number(((asignadas * 30) / 60).toFixed(1)),
        horasContactabilidad: Number(((asignadas * 10) / 60).toFixed(1)),
        horasTotal: Number(((minTotal + (asignadas * 40)) / 60).toFixed(1)),"""
    dash_new_1 = """        horasTotal: Number((minTotal / 60).toFixed(1)),"""
    dash_content = dash_content.replace(dash_old_1, dash_new_1)

    dash_old_2 = """      acc.horasTotal += curr.horasTotal;
      acc.horasDesplazamiento += curr.horasDesplazamiento;
      acc.horasContactabilidad += curr.horasContactabilidad;"""
    dash_new_2 = """      acc.horasTotal += curr.horasTotal;"""
    dash_content = dash_content.replace(dash_old_2, dash_new_2)

    dash_old_3 = """{ asignadas: 0, completadas: 0, noRealizadas: 0, ptsAsignados: 0, pts: 0, horasTotal: 0, horasDesplazamiento: 0, horasContactabilidad: 0, metaOrdenes: 0, metaPuntos: 0, metaHoras: 0 }"""
    dash_new_3 = """{ asignadas: 0, completadas: 0, noRealizadas: 0, ptsAsignados: 0, pts: 0, horasTotal: 0, metaOrdenes: 0, metaPuntos: 0, metaHoras: 0 }"""
    dash_content = dash_content.replace(dash_old_3, dash_new_3)

    dash_old_4 = """                <Bar yAxisId="left" dataKey="horasAlta" stackId="horas" name="Horas Altas/Inst." fill="#3b82f6">
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
    dash_new_4 = """                <Bar yAxisId="left" dataKey="horasAlta" stackId="horas" name="Horas Altas/Inst." fill="#3b82f6">
                  <LabelList dataKey="horasAlta" content={<CustomLabel bgColor="#1e3a8a" textColor="#93c5fd" position="inside" />} />
                </Bar>
                <Bar yAxisId="left" dataKey="horasReparacion" stackId="horas" name="Horas Reparaciones" fill="#f97316" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="horasReparacion" content={<CustomLabel bgColor="#7c2d12" textColor="#fdba74" offset={10} position="top" />} />
                </Bar>"""
    dash_content = dash_content.replace(dash_old_4, dash_new_4)

    with open(dashboard_path, 'w', encoding='utf-8') as f:
        f.write(dash_content)


    # --- 2. BACKEND MODIFICATION ---
    with open(server_path, 'r', encoding='utf-8') as f:
        server_content = f.read()

    server_old_1 = """          if (isCompleted) {
            if (/ALTA|INSTALACION|MIGRACION|TRASLADO/i.test(subtipoAct)) {
              t.dailyMap[dateKey].minAlta += minDuracion;
            } else if (/RECLAMO|AVERIA|MANTENIMIENTO|REPOSICION|RUTINA/i.test(subtipoAct)) {
              t.dailyMap[dateKey].minReparacion += minDuracion;
            }
          }"""
    server_new_1 = """          const isAlta = /ALTA|INSTALACION|MIGRACION|TRASLADO/i.test(subtipoAct);
          const isReparacion = /RECLAMO|AVERIA|MANTENIMIENTO|REPOSICION|RUTINA/i.test(subtipoAct);

          if (isCompleted) {
            if (isAlta) t.dailyMap[dateKey].minAlta += minDuracion;
            else if (isReparacion) t.dailyMap[dateKey].minReparacion += minDuracion;
          }

          // APLICAR 40 MINS (30 despl + 10 contac) POR CADA ORDEN (Completadas + No Realizadas)
          t.dailyMap[dateKey].minTotal += 40;
          if (isAlta) {
            t.dailyMap[dateKey].minAlta += 40;
          } else if (isReparacion) {
            t.dailyMap[dateKey].minReparacion += 40;
          } else {
            // Si no se detecta, se suma por defecto a Alta
            t.dailyMap[dateKey].minAlta += 40;
          }"""
    server_content = server_content.replace(server_old_1, server_new_1)

    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(server_content)

    print("Successfully updated frontend and backend hours logic.")

if __name__ == '__main__':
    main()
