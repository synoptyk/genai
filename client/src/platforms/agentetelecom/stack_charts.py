import re

def main():
    file_path = '/Users/mauro/Synoptik_Innovacion/Gen AI/client/src/platforms/agentetelecom/components/DashboardSeguimientoDia.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Change grid layout to be 1 column only
    old_grid = '      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">'
    new_grid = '      <div className="grid grid-cols-1 gap-6">'
    content = content.replace(old_grid, new_grid)

    # Change height of both charts from h-64 to h-80
    old_height = '<div className="h-64 w-full">'
    new_height = '<div className="h-80 w-full">'
    content = content.replace(old_height, new_height)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("DashboardSeguimientoDia.jsx updated to stack charts vertically with h-80")

if __name__ == '__main__':
    main()
