#!/bin/bash
# Script para reemplazar "http://localhost:5001" por la importación dinámica de API_URL

find src -type f \( -name "*.js" -o -name "*.jsx" \) | while read file; do
  if grep -q "http://localhost:5001" "$file"; then
    echo "Processing $file"
    
    # Calcular niveles hacia arriba desde la ubicación del archivo hasta src/config.js
    DIRCOUNT=$(dirname "$file" | tr -cd '/' | wc -c)
    PREFIX=""
    for ((i=1; i<=DIRCOUNT; i++)); do
      PREFIX="../$PREFIX"
    done
    
    if [ "$PREFIX" = "" ]; then
      PREFIX="./"
    fi
    
    # Añadir import a la línea 2 si no existe
    if ! grep -q "import API_URL" "$file"; then
      sed -i.bak "2i\\
import API_URL from '${PREFIX}config';\\
" "$file"
    fi
    
    # Reemplazar 'http://localhost:5001/api/X' por \`${API_URL}/api/X\`
    sed -i.bak -E "s|['\"]http://localhost:5001/([^'\"]*)['\"]|\`\$\{API_URL\}/\1\`|g" "$file"
    rm -f "${file}.bak"
  fi
done
