#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' 

PROJECT_ID="genai360-494015"
gcloud config set project $PROJECT_ID
REGION="us-central1"

SERVER_URL=$(gcloud run services describe genai-server --platform managed --region $REGION --format='value(status.url)')
echo -e "${GREEN}✅ Backend en línea en: ${YELLOW}$SERVER_URL${NC}"

# 4. Desplegar CLIENTE
echo -e "${BLUE}📦 Procesando CLIENTE...${NC}"

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
