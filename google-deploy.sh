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
gcloud run deploy genai-server \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 1 \
    --port 8080 \
    --set-env-vars "MONGO_URI=mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin" \
    --set-env-vars "JWT_SECRET=YYuFufyipIiHXWAxNQoxYXPiL6jQhGV1fsIvwwaJaRc=" \
    --set-env-vars "JWT_EXPIRES_IN=30d" \
    --set-env-vars "CLOUDINARY_CLOUD_NAME=dcjct45jm" \
    --set-env-vars "CLOUDINARY_API_KEY=657489544971689" \
    --set-env-vars "CLOUDINARY_API_SECRET=kOnxzw9a3tb5Y5J4PmUZLDYAOqg" \
    --set-env-vars "TOA_URL=https://telefonica-cl.etadirect.com/" \
    --set-env-vars "TOA_USER_REAL=16411496" \
    --set-env-vars "TOA_PASS_REAL=Sinsajo10918." \
    --set-env-vars "GPS_URL=https://www.gpsimple.cl/track/index.php" \
    --set-env-vars "GPS_USER=asalinas@skytelcom.cl" \
    --set-env-vars "GPS_PASS=qRX8kjQj" \
    --set-env-vars "SMTP_HOST=smtppro.zoho.com" \
    --set-env-vars "SMTP_PORT=465" \
    --set-env-vars "SMTP_EMAIL=genai@synoptyk.cl" \
    --set-env-vars "SMTP_PASSWORD=Genai_2026.." \
    --set-env-vars "FROM_NAME=Enterprise Platform" \
    --set-env-vars "SEED_ADMIN_EMAIL=admin@platform-os.cl" \
    --set-env-vars "SEED_ADMIN_PASSWORD=BarrientosJobsMosk" \
    --set-env-vars "ENABLE_AUTO_SEED=false" \
    --set-env-vars "NODE_ENV=production" \
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
