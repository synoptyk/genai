#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Iniciando proceso de actualización y despliegue para Genai..."
echo "------------------------------------------------------------"

# 1. Sincronizar con Git
echo "📦 Sincronizando cambios con Git..."
git add .
git commit -m "Enhancement: Added inspection dashboards and supervisor progress tracking"
git push

# 2. Ejecutar script de despliegue en Google Cloud
if [ -f "./google-deploy.sh" ]; then
    echo "☁️  Iniciando despliegue en Google Cloud Run..."
    chmod +x google-deploy.sh
    ./google-deploy.sh
else
    echo "❌ Error: No se encontró google-deploy.sh"
    exit 1
fi

echo "------------------------------------------------------------"
echo "✨ Proceso completado. Presiona cualquier tecla para cerrar."
read -n 1
