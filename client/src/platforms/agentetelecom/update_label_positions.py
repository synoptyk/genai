import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update CustomLabel for 'bottom' and 'top' with width check
    custom_label_old = """    if (position === 'inside') {
      finalX = x + (width || 0) / 2;
      finalY = y + (height || 0) / 2;
    } else if (position === 'insideBottom') {
      finalX = x; 
      finalY = y + offset;
    } else if (position === 'top' && width !== undefined) {
      finalX = x + width / 2;
    }"""
    custom_label_new = """    if (position === 'inside') {
      finalX = x + (width || 0) / 2;
      finalY = y + (height || 0) / 2;
    } else if (position === 'insideBottom') {
      finalX = x; 
      finalY = y + offset;
    } else if (position === 'bottom') {
      if (width !== undefined) finalX = x + width / 2;
      finalY = y + offset;
    } else if (position === 'top') {
      if (width !== undefined) finalX = x + width / 2;
      finalY = y - offset;
    }"""
    content = content.replace(custom_label_old, custom_label_new)

    # 2. Update LabelLists
    
    # Chart 1
    # Completadas: top 15 -> top 20
    content = content.replace(
        '<LabelList dataKey="completadasPct" content={<CustomLabel bgColor="#064e3b" textColor="#34d399" offset={15} position="top" />} />',
        '<LabelList dataKey="completadasPct" content={<CustomLabel bgColor="#064e3b" textColor="#34d399" offset={20} position="top" />} />'
    )
    
    # Asignadas (Chart 1): top 15 -> bottom 20
    content = content.replace(
        '<LabelList dataKey="asignadas" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={15} position="top" />} />',
        '<LabelList dataKey="asignadas" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />'
    )
    
    # No Realizadas (Chart 1): insideBottom 15 -> insideBottom 25
    content = content.replace(
        '<LabelList dataKey="noRealizadasPct" content={<CustomLabel bgColor="#881337" textColor="#fb7185" offset={15} position="insideBottom" />} />',
        '<LabelList dataKey="noRealizadasPct" content={<CustomLabel bgColor="#881337" textColor="#fb7185" offset={25} position="insideBottom" />} />'
    )

    # Chart 2: Meta Puntos: top 10 -> bottom 20
    content = content.replace(
        '<LabelList dataKey="metaPuntos" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={10} position="top" />} />',
        '<LabelList dataKey="metaPuntos" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />'
    )
    
    # Chart 3: Meta Horas: top 10 -> bottom 20
    content = content.replace(
        '<LabelList dataKey="metaHoras" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={10} position="top" />} />',
        '<LabelList dataKey="metaHoras" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />'
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("DashboardSeguimientoDia.jsx updated to separate labels")

if __name__ == '__main__':
    main()
