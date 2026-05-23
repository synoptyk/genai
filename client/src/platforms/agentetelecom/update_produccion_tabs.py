import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/Produccion.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Import DashboardSeguimientoDia
    import_stmt = "import ProduccionZonas from './components/ProduccionZonas';\nimport DashboardSeguimientoDia from './components/DashboardSeguimientoDia';"
    content = content.replace("import ProduccionZonas from './components/ProduccionZonas';", import_stmt)

    # Add to TABS
    tabs_old = """const TABS = [
  { id: 'resumen',       label: 'Resumen',        icon: Presentation },
  { id: 'produccion',   label: 'Producción/Día',  icon: Layers },
  { id: 'ranking',      label: 'Ranking',         icon: Trophy },
  { id: 'semanal',      label: 'Semanal',         icon: BarChart3 },
  { id: 'actividades',  label: 'Actividades',     icon: Activity },
  { id: 'proyectos',    label: 'Proyectos',       icon: Target },
  { id: 'zonas',        label: 'Zonas',           icon: Users },
];"""
    tabs_new = """const TABS = [
  { id: 'resumen',       label: 'Resumen',        icon: Presentation },
  { id: 'produccion',   label: 'Producción/Día',  icon: Layers },
  { id: 'seguimiento',  label: 'Dashboard Seg. Día', icon: Activity },
  { id: 'ranking',      label: 'Ranking',         icon: Trophy },
  { id: 'semanal',      label: 'Semanal',         icon: BarChart3 },
  { id: 'actividades',  label: 'Actividades',     icon: Activity },
  { id: 'proyectos',    label: 'Proyectos',       icon: Target },
  { id: 'zonas',        label: 'Zonas',           icon: Users },
];"""
    content = content.replace(tabs_old, tabs_new)

    # Add to tab content rendering
    content_old = """        {/* Zonas */}
        {activeTab === 'zonas' && (
          <ProduccionZonas 
            cities={serverData?.cities || {}} 
          />
        )}
      </div>"""
    content_new = """        {/* Zonas */}
        {activeTab === 'zonas' && (
          <ProduccionZonas 
            cities={serverData?.cities || {}} 
          />
        )}

        {/* Seguimiento Día */}
        {activeTab === 'seguimiento' && (
          <DashboardSeguimientoDia
            tecnicos={tecnicos}
            dateFrom={dateFrom}
            selectedMonths={selectedMonths}
          />
        )}
      </div>"""
    content = content.replace(content_old, content_new)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Produccion.jsx patched successfully")

if __name__ == '__main__':
    main()
