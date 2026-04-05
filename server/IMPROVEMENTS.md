# Server Improvements - 2026-04-05

## 🎯 Mejoras Aplicadas

### 1. Seguridad & Rate Limiting
**Archivos:** `middleware/security.js`

- **express-rate-limit**: Previene abuso y ataques de fuerza bruta
  - General API: 100 requests/15min
  - Auth endpoints: 20 requests/15min (más estricto)
  - Bot endpoints: 50 requests/5min
  - Upload endpoints: 10 uploads/hora

- **Helmet**: Security headers HTTP
  - Content Security Policy (CSP)
  - HSTS (HTTPS forzado)
  - XSS Protection
  - No Sniff
  - Referrer Policy

### 2. Logging Estructurado (Winston)
**Archivos:** `utils/logger.js`

- Reemplaza `console.log` con logging profesional
- Logs rotados por día (14 días de retención)
- Categorías específicas:
  - `logger.db` - Consultas y errores de DB
  - `logger.auth` - Logins, logouts, fallos
  - `logger.bot` - Ejecución de bots
  - `logger.api` - Requests/responses de API
- Archivos separados para errores y logs combinados

### 3. Health Checks & Monitoreo
**Archivos:** `routes/health.js`

Endpoints nuevos:
- `GET /api/health` - Health check básico
- `GET /api/health/detailed` - Estado de todos los servicios
- `GET /api/health/metrics` - Métricas para monitoreo
- `GET /api/health/ping` - Ping simple

Respuestas incluyen:
- Estado de MongoDB
- Uso de memoria y CPU
- Estado de bots (TOA/GPS)
- Uptime del servidor

### 4. Manejo de Errores Global
**Archivos:** `middleware/errorHandler.js`

- Error handler centralizado
- Manejo específico para:
  - Validation errors (Mongoose)
  - Duplicate keys (MongoDB 11000)
  - JWT errors (expirados, inválidos)
  - Cast errors (IDs inválidos)
  - Multer errors (uploads)
  - Puppeteer errors (bots)
- 404 handler para rutas no encontradas
- Logging automático de todos los errores

### 5. Configuración de API Centralizada
**Archivos:** `config/api.js`

- API versioning preparado (`/api/v1`)
- Límites de payload configurados
- Timeouts por tipo de operación
- Configuración de paginación
- Endpoints deprecados (para migración futura)

### 6. Scripts de Utilidad
**Archivos:** `package.json` (scripts nuevos)

- `npm run start:dev` - Dev mode con logs detallados
- `npm run start:prod` - Production mode
- `npm run logs` - Ver logs en tiempo real
- `npm run logs:error` - Ver solo errores
- `npm run health` - Health check desde CLI

### 7. Git Ignore Mejorado
**Archivos:** `.gitignore`

- Logs excluidos
- Environment variables excluidas
- Cache de Puppeteer excluido
- Archivos temporales excluidos

---

## 📦 Nuevas Dependencias

```json
{
  "express-rate-limit": "^8.3.2",
  "helmet": "^8.1.0",
  "winston": "^3.19.0",
  "winston-daily-rotate-file": "^5.0.0"
}
```

---

## 🔧 Cómo Usar las Mejoras

### Rate Limiting

En `server.js`, después de `app.use(cors(corsOptions))`:

```javascript
const { generalLimiter, authLimiter, helmetConfig } = require('./middleware/security');

app.use(helmetConfig);
app.use(generalLimiter);

// Para rutas de auth:
app.use('/api/auth', authLimiter);
```

### Logging

Reemplazar `console.log` con `logger`:

```javascript
const logger = require('./utils/logger');

// En lugar de:
console.log('Usuario logueado');

// Usar:
logger.info('Usuario logueado', { userId: 123 });

// Logging específico:
logger.auth.login(userId, req.ip);
logger.db.query(query, time);
logger.bot.start('TOA');
```

### Health Checks

Desde terminal:
```bash
curl http://localhost:5003/api/health
curl http://localhost:5003/api/health/detailed
curl http://localhost:5003/api/health/metrics
```

Desde navegador o monitoring service:
- `https://tu-backend.onrender.com/api/health`

### Manejo de Errores

En `server.js`, al final (después de todas las rutas):

```javascript
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 404 handler (debe ir antes del error handler)
app.use(notFoundHandler);

// Global error handler (debe ser el último middleware)
app.use(errorHandler);
```

---

## ⚠️ Consideraciones

### 1. Rate Limiting en Producción

Ajustar límites según uso real:
- Monitorear logs de rate limit (`logs/combined-*.log`)
- Si hay falsos positivos, aumentar límites
- Si hay ataques, disminuir límites

### 2. Logs y Espacio en Disco

- Logs rotan diariamente y se mantienen por 14 días
- Monitorear espacio en `server/logs/`
- Ajustar `maxFiles` en `utils/logger.js` si es necesario

### 3. Health Checks

- Endpoints son públicos (sin auth)
- En producción, considerar agregar IP whitelist
- Usar para monitoring externo (UptimeRobot, Pingdom, etc.)

### 4. Helmet CSP

- La CSP actual es permisiva para desarrollo
- En producción, ajustar `scriptSrc`, `connectSrc` según dominios reales
- Testear thoroughly antes de deploy

---

## 🚀 Próximos Pasos (Opcionales)

1. **Refactorizar server.js** - Dividir en rutas modulares
2. **Migrar GPS bot a fork()** - Para no bloquear event loop
3. **Agregar TypeScript** - Type safety
4. **Implementar caché** - Redis para queries frecuentes
5. **Agregar tests** - Unit/integration tests
6. **CI/CD pipeline** - Tests automáticos antes de deploy
7. **Docker** - Containerización para deploy consistente
8. **APM** - New Relic, DataDog, o similar para monitoreo avanzado

---

## 📊 Métricas de Mejora

| Aspecto | Antes | Después |
|---------|-------|---------|
| Rate Limiting | ❌ None | ✅ 4 tiers configurados |
| Security Headers | ❌ None | ✅ Helmet con CSP, HSTS, XSS |
| Logging | ⚠️ console.log | ✅ Winston con rotación |
| Error Handling | ⚠️ Manual por ruta | ✅ Global handler |
| Health Checks | ❌ None | ✅ 4 endpoints |
| API Versioning | ❌ None | ✅ Preparado para v1 |
| Monitoring | ❌ None | ✅ Metrics endpoint |

---

*Mejoras aplicadas el 2026-04-05. Todo el código existente sigue funcionando.*
