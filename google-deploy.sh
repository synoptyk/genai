#!/bin/bash
set -euo pipefail

# =================================================================
# SCRIPT DE DESPLIEGUE "INTELIGENCIA BLINDADA" (v6) - Genai
# =================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cleanup_temp() {
    rm -f ./Dockerfile ./client/.env.production
}
trap cleanup_temp EXIT

echo -e "${BLUE}🚀 Iniciando despliegue de Genai (Modo Seguro e Infalible)...${NC}"

if ! command -v gcloud >/dev/null 2>&1; then
    echo -e "${RED}❌ gcloud no está instalado o no está en PATH.${NC}"
    exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo -e "${RED}❌ No hay sesión activa en gcloud. Ejecuta: gcloud auth login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Cuenta activa de gcloud: ${YELLOW}${ACTIVE_ACCOUNT}${NC}"

# 1. Configurar Proyecto
PROJECT_ID="genai360-494015"
gcloud config set project $PROJECT_ID
REGION="us-central1"

# 2. Habilitar APIs
echo -e "${BLUE}⚙️  Asegurando APIs...${NC}"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --quiet

# 3. Desplegar BACKEND
echo -e "${BLUE}📦 [1/2] Procesando BACKEND...${NC}"
if [ ! -f docker/server.Dockerfile ]; then
    echo -e "${RED}❌ No existe docker/server.Dockerfile${NC}"
    exit 1
fi
# Usamos copia manual para máxima compatibilidad con tu versión de gcloud
cp docker/server.Dockerfile ./Dockerfile

# Construir bandera de actualización de variables solo para las que existen localmente
ENV_UPDATE=""
[ -n "${MONGODB_URI:-}" ] && MONGO_URI="$MONGODB_URI"
[ -n "${MONGO_URI:-}" ] && ENV_UPDATE="${ENV_UPDATE}MONGO_URI=${MONGO_URI},"
[ -n "${JWT_SECRET:-}" ] && ENV_UPDATE="${ENV_UPDATE}JWT_SECRET=${JWT_SECRET},"
[ -n "${SMTP_PASSWORD:-}" ] && ENV_UPDATE="${ENV_UPDATE}SMTP_PASSWORD=${SMTP_PASSWORD},"
[ -n "${CLOUDINARY_API_SECRET:-}" ] && ENV_UPDATE="${ENV_UPDATE}CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET},"
# Puedes agregar más variables aquí si necesitas actualizarlas desde local

ENV_FLAG=""
if [ -n "$ENV_UPDATE" ]; then
    ENV_FLAG="--update-env-vars ${ENV_UPDATE%,}"
fi

gcloud run deploy genai-server \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 1 \
    --port 8080 \
    $ENV_FLAG \
    --clear-base-image \
    --quiet

SERVER_URL=$(gcloud run services describe genai-server --platform managed --region $REGION --format='value(status.url)')
echo -e "${GREEN}✅ Backend en línea en: ${YELLOW}$SERVER_URL${NC}"

# 4. Desplegar CLIENTE
echo -e "${BLUE}📦 [2/2] Procesando CLIENTE...${NC}"

# Inyección mágica: Le decimos al Frontend dónde vive el Backend en la nube
echo "REACT_APP_API_URL=$SERVER_URL" > client/.env.production

if [ ! -f docker/client.Dockerfile ]; then
    echo -e "${RED}❌ No existe docker/client.Dockerfile${NC}"
    exit 1
fi

cp docker/client.Dockerfile ./Dockerfile
gcloud run deploy genai-client \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --clear-base-image \
    --quiet

CLIENT_URL=$(gcloud run services describe genai-client --platform managed --region $REGION --format='value(status.url)')

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}✨ ¡ÉXITO TOTAL EN EL DESPLIEGUE!${NC}"
echo -e "${BLUE}📱 URL Frontend: ${YELLOW}$CLIENT_URL${NC}"
echo -e "${BLUE}⚙️  URL Backend:  ${YELLOW}$SERVER_URL${NC}"
echo -e "${GREEN}====================================================${NC}"
