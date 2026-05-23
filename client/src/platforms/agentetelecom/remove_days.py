import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find and remove the {data.map((row) => ( ... ))} blocks
    pattern = r'\{data\.map\(\(row\) => \([\s\S]*?\)\)\}'
    
    new_content = re.sub(pattern, '', content)
    
    # Let's also change "TOTAL" to "TOTAL ACUMULADO" to make it look better
    new_content = new_content.replace('<td className="py-2 px-2">TOTAL</td>', '<td className="py-2 px-2">TOTAL ACUMULADO</td>')
    
    # We can also remove the "TÉCNICOS" column since it doesn't make much sense in a monthly total if it just says "-"
    # Wait, the header has TÉCNICOS and the total row has "-"
    # It might be better to just keep it as is, but change TOTAL to TOTAL ACUMULADO.
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

if __name__ == '__main__':
    main()
