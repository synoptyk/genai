#!/bin/bash

# =================================================================
# SCRIPT DE DESPLIEGUE "INTELIGENCIA BLINDADA" (v5) - Genai
# =================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' 

echo -e "${BLUE}🚀 Iniciando despliegue de Genai (Modo Seguro e Infalible)...${NC}"

# 1. Configurar Proyecto
PROJECT_ID="genai360-494015"
gcloud config set project $PROJECT_ID
REGION="us-central1"

# 2. Habilitar APIs
echo -e "${BLUE}⚙️  Asegurando APIs...${NC}"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --quiet

# 3. Desplegar BACKEND
echo -e "${BLUE}📦 [1/2] Procesando BACKEND...${NC}"
# Usamos copia manual para máxima compatibilidad con tu versión de gcloud
cp docker/server.Dockerfile ./Dockerfile

# Require secret env vars for deployment instead of hardcoding them.
: "${MONGO_URI:?MONGO_URI debe exportarse antes de ejecutar este script}"
: "${JWT_SECRET:?JWT_SECRET debe exportarse antes de ejecutar este script}"
: "${SMTP_PASSWORD:?SMTP_PASSWORD debe exportarse antes de ejecutar este script}"
: "${SEED_ADMIN_PASSWORD:?SEED_ADMIN_PASSWORD debe exportarse antes de ejecutar este script}"
: "${TOA_PASS_REAL:?TOA_PASS_REAL debe exportarse antes de ejecutar este script}"
: "${GPS_PASS:?GPS_PASS debe exportarse antes de ejecutar este script}"

CLOUDINARY_CLOUD_NAME="${CLOUDINARY_CLOUD_NAME:-dcjct45jm}"
CLOUDINARY_API_KEY="${CLOUDINARY_API_KEY:-657489544971689}"
CLOUDINARY_API_SECRET="${CLOUDINARY_API_SECRET:-}"
TOA_URL="${TOA_URL:-https://telefonica-cl.etadirect.com/}"
TOA_USER_REAL="${TOA_USER_REAL:-16411496}"
GPS_URL="${GPS_URL:-https://www.gpsimple.cl/track/index.php}"
GPS_USER="${GPS_USER:-asalinas@skytelcom.cl}"
SMTP_HOST="${SMTP_HOST:-smtppro.zoho.com}"
SMTP_PORT="${SMTP_PORT:-465}"
SMTP_EMAIL="${SMTP_EMAIL:-genai@synoptyk.cl}"
FROM_NAME="${FROM_NAME:-Enterprise Platform}"
ENABLE_AUTO_SEED="${ENABLE_AUTO_SEED:-false}"
NODE_ENV="${NODE_ENV:-production}"

# Shell parameter expansion above fails fast if required secrets are missing.

gcloud run deploy genai-server \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 1 \
    --port 8080 \
    --set-env-vars "MONGO_URI=${MONGO_URI}" \
    --set-env-vars "JWT_SECRET=${JWT_SECRET}" \
    --set-env-vars "JWT_EXPIRES_IN=30d" \
    --set-env-vars "CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}" \
    --set-env-vars "CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}" \
    --set-env-vars "CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}" \
    --set-env-vars "TOA_URL=${TOA_URL}" \
    --set-env-vars "TOA_USER_REAL=${TOA_USER_REAL}" \
    --set-env-vars "TOA_PASS_REAL=${TOA_PASS_REAL}" \
    --set-env-vars "GPS_URL=${GPS_URL}" \
    --set-env-vars "GPS_USER=${GPS_USER}" \
    --set-env-vars "GPS_PASS=${GPS_PASS}" \
    --set-env-vars "SMTP_HOST=${SMTP_HOST}" \
    --set-env-vars "SMTP_PORT=${SMTP_PORT}" \
    --set-env-vars "SMTP_EMAIL=${SMTP_EMAIL}" \
    --set-env-vars "SMTP_PASSWORD=${SMTP_PASSWORD}" \
    --set-env-vars "FROM_NAME=${FROM_NAME}" \
    --set-env-vars "SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL}" \
    --set-env-vars "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}" \
    --set-env-vars "ENABLE_AUTO_SEED=${ENABLE_AUTO_SEED}" \
    --set-env-vars "NODE_ENV=${NODE_ENV}" \
    --clear-base-image \
    --quiet
rm ./Dockerfile

SERVER_URL=$(gcloud run services describe genai-server --platform managed --region $REGION --format='value(status.url)')
echo -e "${GREEN}✅ Backend en línea en: ${YELLOW}$SERVER_URL${NC}"

# 4. Desplegar CLIENTE
echo -e "${BLUE}📦 [2/2] Procesando CLIENTE...${NC}"

# Inyección mágica: Le decimos al Frontend dónde vive el Backend en la nube
echo "REACT_APP_API_URL=$SERVER_URL" > client/.env.production

cp docker/client.Dockerfile ./Dockerfile
gcloud run deploy genai-client \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --clear-base-image \
    --quiet
rm ./Dockerfile client/.env.production

CLIENT_URL=$(gcloud run services describe genai-client --platform managed --region $REGION --format='value(status.url)')

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}✨ ¡ÉXITO TOTAL EN EL DESPLIEGUE!${NC}"
echo -e "${BLUE}📱 URL Frontend: ${YELLOW}$CLIENT_URL${NC}"
echo -e "${BLUE}⚙️  URL Backend:  ${YELLOW}$SERVER_URL${NC}"
echo -e "${GREEN}====================================================${NC}"
