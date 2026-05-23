import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update Top Card
    content = content.replace(
        '<h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asignadas (Meta)</h3>',
        '<h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asignadas</h3>'
    )

    # 2. Update Headers Text
    content = content.replace('contra la Meta (Asignadas)', 'contra la Asignación')
    content = content.replace('Puntos Totales vs Asignaciones', 'Puntos Totales vs Asignación')
    content = content.replace('Horas Altas vs Reparaciones vs Asignaciones', 'Horas Altas vs Reparaciones vs Asignación')

    # 3. Update Summary Headers Right (Meta: -> Asignación:)
    content = content.replace('Meta: <span', 'Asignación: <span')

    # 4. Update Line chart names
    content = content.replace('name="Meta (Asignadas)"', 'name="Asignadas"')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("DashboardSeguimientoDia updated (Meta -> Asignación)")

if __name__ == '__main__':
    main()
