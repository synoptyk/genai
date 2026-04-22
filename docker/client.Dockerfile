FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY client/package*.json ./
RUN npm install --legacy-peer-deps

COPY client/ ./

ARG REACT_APP_API_URL=http://localhost:5003
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
