# Agentes AI - Gen AI

Instrucciones para agentes AI que trabajan en este codebase.

## Proyecto

**Gen AI** es una aplicación empresarial 360 (SaaS/ERP) con módulos de:
- Empresa360, Admin, Agentetelecom, AI, Auth, Comunicaciones, Logística, Operaciones, Prevención, RRHH

## Stack Tecnológico

- **Backend**: Node.js 18+, Express, MongoDB (Mongoose)
- **Frontend**: React 18, React Router, Recharts, Leaflet
- **Mobile**: Expo (React Native)
- **Despliegue**: Docker, Render (backend), Vercel (frontend)

## Comandos Esenciales

```bash
# Instalación completa
npm run install:all

# Desarrollo (backend + frontend)
npm run dev

# Desarrollo completo (backend + frontend + mobile)
npm run dev:all

# Build frontend
npm run build:client

# Docker local
npm run docker:up
npm run docker:down

# Deploy producción
npm run deploy
```

## Estructura del Proyecto

```
/server/          # API Express + lógica de negocio
  /routes/        # Endpoints de API
  /middleware/    # Auth, security, error handling
  /platforms/    # Módulos de negocio (admin/, ai/, auth/, etc.)
  /utils/         # Utilidades (logger, mailer, cron, etc.)
  /config/        # Configuraciones
/client/          # Aplicación React
/mobile/          # Aplicación Expo
```

## Convenciones Importantes

### API Routes
- Todas las rutas usan middleware `protect` para autenticación
- Respuestas JSON: `{ ok: true, data: ... }` o `{ error: 'mensaje' }`
- Endpoints de health: `/api/health`, `/api/health/detailed`, `/api/health/metrics`

### Seguridad
- Rate limiting en `middleware/security.js`
- Helmet para headers HTTP
- Logging estructurado con Winston en `utils/logger.js`

### Base de Datos
- MongoDB con Mongoose
- Modelos en `server/platforms/*/models/`
- Sincronización de técnicos en `utils/syncTecnicosVinculados.js`

### Errores Comunes
- JWT expirado: `401 Unauthorized`
- Validación: usar `errorMiddleware.js`
- IDs inválidos: `400 Bad Request`

## Documentación Relacionada

- [README.md](README.md) - Guía general del proyecto
- [GUIA_DEPLOY_GENAI.md](GUIA_DEPLOY_GENAI.md) - Despliegue a producción
- [MEJORAS_REALIZADAS.md](MEJORAS_REALIZADAS.md) - Historial de mejoras

## Variables de Entorno

Ver `.env.example` para las variables requeridas:
- `MONGO_URI` - Conexión a MongoDB
- `JWT_SECRET` - Secret para tokens JWT
- `SMTP_PASSWORD` - Configuración de email
- `NODE_ENV` - development | production