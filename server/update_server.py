import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/server/server.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Parsing of Duración de la actividad
    # The variable `clean` has the normalized activity data.
    # `const cleanEstado = clean.Estado || 'Sin Estado';` is at line 2184.
    
    parser_code = """      // Determinar tipo de actividad para análisis
      const subtipoAct = clean['Subtipo_de_Actividad'] || clean['Subtipo de Actividad'] || '';
      const tipoTrabajo = clean['Tipo_de_Trabajo'] || clean['Tipo de Trabajo'] || '';
      
      // Parsear Duración de la actividad
      let minDuracion = 0;
      const durRaw = clean['Duración de la actividad'] || clean['Duración_de_la_actividad'] || clean['duracion'] || '';
      if (durRaw && typeof durRaw === 'string' && durRaw.includes(':')) {
        const parts = durRaw.split(':');
        if (parts.length === 2) {
          minDuracion = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
      }
"""
    content = content.replace("""      // Determinar tipo de actividad para análisis
      const subtipoAct = clean['Subtipo_de_Actividad'] || clean['Subtipo de Actividad'] || '';
      const tipoTrabajo = clean['Tipo_de_Trabajo'] || clean['Tipo de Trabajo'] || '';""", parser_code)

    # 2. Aggregating in dailyMap
    agg_code = """          if (!t.dailyMap[dateKey]) t.dailyMap[dateKey] = { orders: 0, pts: 0, byActivity: {}, completadas: 0, noRealizadas: 0, minTotal: 0, minAlta: 0, minReparacion: 0 };
          t.dailyMap[dateKey].orders++;
          t.dailyMap[dateKey].pts += pTotal;
          
          const estLower = (cleanEstado || '').toLowerCase();
          const isCompleted = estLower.includes('completad') || estLower.includes('finalizad') || estLower.includes('ok') || estLower.includes('ejecutad');
          if (isCompleted) {
            t.dailyMap[dateKey].completadas++;
            t.dailyMap[dateKey].minTotal += minDuracion;
          } else {
            t.dailyMap[dateKey].noRealizadas++;
          }
          
          if (isCompleted) {
            if (/ALTA|INSTALACION|MIGRACION|TRASLADO/i.test(subtipoAct)) {
              t.dailyMap[dateKey].minAlta += minDuracion;
            } else if (/RECLAMO|AVERIA|MANTENIMIENTO|REPOSICION|RUTINA/i.test(subtipoAct)) {
              t.dailyMap[dateKey].minReparacion += minDuracion;
            }
          }"""
          
    content = content.replace("""          if (!t.dailyMap[dateKey]) t.dailyMap[dateKey] = { orders: 0, pts: 0, byActivity: {}, completadas: 0, noRealizadas: 0 };
          t.dailyMap[dateKey].orders++;
          t.dailyMap[dateKey].pts += pTotal;
          
          const estLower = (cleanEstado || '').toLowerCase();
          if (estLower.includes('completad') || estLower.includes('finalizad') || estLower.includes('ok') || estLower.includes('ejecutad')) {
            t.dailyMap[dateKey].completadas++;
          } else {
            t.dailyMap[dateKey].noRealizadas++;
          }""", agg_code)

    # 3. Aggregating in orphans (orphanEntry)
    orphan_code = """      Object.entries(orphanEntry.dailyMap || {}).forEach(([dk, dd]) => {
        if (!canon.dailyMap[dk]) canon.dailyMap[dk] = { orders: 0, pts: 0, byActivity: {}, completadas: 0, noRealizadas: 0, minTotal: 0, minAlta: 0, minReparacion: 0 };
        canon.dailyMap[dk].orders += dd.orders;
        canon.dailyMap[dk].pts += dd.pts;
        canon.dailyMap[dk].completadas = (canon.dailyMap[dk].completadas || 0) + (dd.completadas || 0);
        canon.dailyMap[dk].noRealizadas = (canon.dailyMap[dk].noRealizadas || 0) + (dd.noRealizadas || 0);
        canon.dailyMap[dk].minTotal = (canon.dailyMap[dk].minTotal || 0) + (dd.minTotal || 0);
        canon.dailyMap[dk].minAlta = (canon.dailyMap[dk].minAlta || 0) + (dd.minAlta || 0);
        canon.dailyMap[dk].minReparacion = (canon.dailyMap[dk].minReparacion || 0) + (dd.minReparacion || 0);"""
        
    content = content.replace("""      Object.entries(orphanEntry.dailyMap || {}).forEach(([dk, dd]) => {
        if (!canon.dailyMap[dk]) canon.dailyMap[dk] = { orders: 0, pts: 0, byActivity: {}, completadas: 0, noRealizadas: 0 };
        canon.dailyMap[dk].orders += dd.orders;
        canon.dailyMap[dk].pts += dd.pts;
        canon.dailyMap[dk].completadas = (canon.dailyMap[dk].completadas || 0) + (dd.completadas || 0);
        canon.dailyMap[dk].noRealizadas = (canon.dailyMap[dk].noRealizadas || 0) + (dd.noRealizadas || 0);""", orphan_code)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("server.js updated successfully")

if __name__ == '__main__':
    main()
