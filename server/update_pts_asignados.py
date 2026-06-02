import re

def main():
    server_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/server/server.js'
    dashboard_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'

    # 1. Update server.js
    with open(server_path, 'r', encoding='utf-8') as f:
        server_content = f.read()

    server_old_1 = """          if (isCompleted) {
            t.dailyMap[dateKey].completadas++;
            t.dailyMap[dateKey].minTotal += minDuracion;
          } else {
            t.dailyMap[dateKey].noRealizadas++;
          }"""
    server_new_1 = """          if (isCompleted) {
            t.dailyMap[dateKey].completadas++;
            t.dailyMap[dateKey].minTotal += minDuracion;
            t.dailyMap[dateKey].ptsCompletados = (t.dailyMap[dateKey].ptsCompletados || 0) + pTotal;
          } else {
            t.dailyMap[dateKey].noRealizadas++;
            t.dailyMap[dateKey].ptsNoRealizados = (t.dailyMap[dateKey].ptsNoRealizados || 0) + pTotal;
          }"""
    server_content = server_content.replace(server_old_1, server_new_1)

    server_old_2 = """        canon.dailyMap[dk].pts += dd.pts;
        canon.dailyMap[dk].completadas = (canon.dailyMap[dk].completadas || 0) + (dd.completadas || 0);"""
    server_new_2 = """        canon.dailyMap[dk].pts += dd.pts;
        canon.dailyMap[dk].ptsCompletados = (canon.dailyMap[dk].ptsCompletados || 0) + (dd.ptsCompletados || 0);
        canon.dailyMap[dk].ptsNoRealizados = (canon.dailyMap[dk].ptsNoRealizados || 0) + (dd.ptsNoRealizados || 0);
        canon.dailyMap[dk].completadas = (canon.dailyMap[dk].completadas || 0) + (dd.completadas || 0);"""
    server_content = server_content.replace(server_old_2, server_new_2)

    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(server_content)


    # 2. Update DashboardSeguimientoDia.jsx
    with open(dashboard_path, 'r', encoding='utf-8') as f:
        dash_content = f.read()

    dash_old_1 = """      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      let completadas = 0;
      let noRealizadas = 0;
      let pts = 0;
      let minTotal = 0;"""
    dash_new_1 = """      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      let completadas = 0;
      let noRealizadas = 0;
      let ptsAsignados = 0;
      let pts = 0;
      let minTotal = 0;"""
    dash_content = dash_content.replace(dash_old_1, dash_new_1)

    dash_old_2 = """        if (dd) {
          completadas += (dd.completadas || 0);
          noRealizadas += (dd.noRealizadas || 0);
          pts += (dd.pts || 0);
          minTotal += (dd.minTotal || 0);"""
    dash_new_2 = """        if (dd) {
          completadas += (dd.completadas || 0);
          noRealizadas += (dd.noRealizadas || 0);
          ptsAsignados += (dd.pts || 0);
          pts += (dd.ptsCompletados !== undefined ? dd.ptsCompletados : (dd.pts || 0));
          minTotal += (dd.minTotal || 0);"""
    dash_content = dash_content.replace(dash_old_2, dash_new_2)

    dash_old_3 = """      return {
        dia: String(d).padStart(2, '0'),
        tecnicosActivos,
        completadas,
        noRealizadas,
        asignadas,
        pts: Number(pts.toFixed(1)),
        horasAlta: Number(horasAlta.toFixed(1)),"""
    dash_new_3 = """      return {
        dia: String(d).padStart(2, '0'),
        tecnicosActivos,
        completadas,
        noRealizadas,
        asignadas,
        ptsAsignados: Number(ptsAsignados.toFixed(1)),
        pts: Number(pts.toFixed(1)),
        horasAlta: Number(horasAlta.toFixed(1)),"""
    dash_content = dash_content.replace(dash_old_3, dash_new_3)

    dash_old_4 = """                <Bar yAxisId="left" dataKey="asignadas" name="Asignadas" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={12}>
                  <LabelList dataKey="asignadas" content={<CustomLabel bgColor="#831843" textColor="#fbcfe8" offset={10} position="top" />} />
                </Bar>"""
    dash_new_4 = """                <Bar yAxisId="left" dataKey="ptsAsignados" name="Puntos Asignados" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={12}>
                  <LabelList dataKey="ptsAsignados" content={<CustomLabel bgColor="#831843" textColor="#fbcfe8" offset={20} position="top" />} />
                </Bar>"""
    dash_content = dash_content.replace(dash_old_4, dash_new_4)

    # Change the position of pts so they don't overlap. Since ptsAsignados >= pts, pts is usually smaller. Let's keep pts on top offset 10, and ptsAsignados on top offset 25?
    dash_old_5 = """<LabelList dataKey="ptsAsignados" content={<CustomLabel bgColor="#831843" textColor="#fbcfe8" offset={20} position="top" />} />"""
    dash_new_5 = """<LabelList dataKey="ptsAsignados" content={<CustomLabel bgColor="#831843" textColor="#fbcfe8" offset={30} position="top" />} />"""
    dash_content = dash_content.replace(dash_old_5, dash_new_5)


    with open(dashboard_path, 'w', encoding='utf-8') as f:
        f.write(dash_content)

    print("Successfully updated server and frontend for Puntos Asignados.")

if __name__ == '__main__':
    main()
