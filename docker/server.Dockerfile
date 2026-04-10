FROM node:20-bookworm-slim

WORKDIR /app

# Evita descarga pesada de Chrome en build (postinstall de puppeteer)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

COPY server/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server/ ./

EXPOSE 5003

CMD ["npm", "start"]
