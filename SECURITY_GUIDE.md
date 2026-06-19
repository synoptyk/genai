# 🔐 GUÍA COMPLETA DE SEGURIDAD - Gen AI Platform

**VERSIÓN**: 1.0  
**FECHA**: 2026-06-18  
**ESTADO**: ⚠️ CRÍTICO - Leer antes de cualquier deployment

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen de Vulnerabilidades Corregidas](#resumen)
2. [Antes de Subir a Tiendas](#antes-de-subir)
3. [Gestión de Variables de Entorno](#variables-entorno)
4. [Protecciones Implementadas](#protecciones)
5. [Checklist Pre-Deployment](#checklist)
6. [Procedimiento de Rotación de Claves](#rotacion-claves)
7. [Monitoreo de Seguridad](#monitoreo)

---

## 📊 Resumen de Vulnerabilidades Corregidas {#resumen}

### ✅ Vulnerabilidades Abordadas

| Vulnerabilidad | Severidad | Estado | Solución |
|---|---|---|---|
| Credenciales hardcodeadas en .env | CRÍTICA | ✅ Corregida | Validación y encriptación |
| MongoDB expuesta en código | CRÍTICA | ✅ Corregida | Variables de entorno solo |
| APIs de terceros en repositorio | CRÍTICA | ✅ Corregida | Gestor de secretos |
| Sin protección CSRF | ALTA | ✅ Corregida | Middleware CSRF implementado |
| Sin sanitización de inputs | ALTA | ✅ Corregida | Middleware de sanitización |
| Sin validación de CORS | ALTA | ✅ Parcial | Ver sección CORS |
| Logs con información sensible | MEDIA | ✅ Corregida | Mascarado de secretos |

---

## 🚀 Antes de Subir a Tiendas (App Store / Google Play) {#antes-de-subir}

### ⚠️ PASOS OBLIGATORIOS

Antes de cualquier envío a tiendas, ejecuta este checklist:

```bash
# 1. VALIDAR QUE NO HAYA SECRETOS EXPUESTOS
npm run audit:security

# 2. LIMPIAR HISTORIAL DE GIT
git log --all --full-history | grep -i "password\|secret\|api_key"

# 3. BUILD FINAL CON VARIABLES SEGURAS
NODE_ENV=production npm run build

# 4. VALIDAR ARCHIVOS BUILD
ls -la build/ | grep -v node_modules

# 5. VERIFICAR QUE .env NO ESTÉ EN BUILD
grep -r "MONGO_URI\|JWT_SECRET" build/ || echo "✅ OK - Sin secretos en build"

# 6. ESCANEAR CON SNYK (si está instalado)
npx snyk test
```

### 📱 Para iOS (App Store)

```bash
# 1. Asegurar que Keychain está configurada
security dump-keychain-password /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/

# 2. Usar environment variables solo, no hardcoding
# 3. Encriptar credentials locales con Keychain
# 4. Validar certificates son válidos
```

### 🤖 Para Android (Google Play)

```bash
# 1. Asegurar que secrets.gradle NO está commiteado
# 2. Usar Google Secret Manager para API keys
# 3. Encriptar SharedPreferences para datos sensibles
# 4. Validar que AndroidManifest.xml no expone permisos innecesarios
```

---

## 🌍 Gestión de Variables de Entorno {#variables-entorno}

### Estructura Recomendada

```
.env                           ← NUNCA en repositorio
.env.example                   ← SIEMPRE en repositorio (valores dummy)
.env.production.vault          ← Encriptado en gestor de secretos
.github/workflows/deploy.yml   ← Usa secretos de GitHub Actions
```

### Variables de Entorno Requeridas

```bash
# 🔐 CRÍTICAS - No exponer nunca
MONGO_URI=mongodb://user:pass@host:port/db
JWT_SECRET=min-32-caracteres-aleatorios-seguro
CLOUDINARY_API_SECRET=xxx

# 📡 APIS EXTERNAS - Usar con cuidado
GEMINI_API_KEY=xxx
GROQ_API_KEY=xxx
GOOGLE_MAIL_CLIENT_SECRET=xxx

# 📧 SMTP - Encriptar en almacenamiento
SMTP_PASSWORD=xxx
TOA_PASS_REAL=xxx
GPS_PASS=xxx
```

### ✅ Cómo Configurar Seguramente

**Opción 1: Variables de Entorno del Sistema**
```bash
# En MacOS/Linux
export MONGO_URI="mongodb://..."
npm start

# En Windows
set MONGO_URI=mongodb://...
npm start
```

**Opción 2: Archivos .env (SOLO DESARROLLO)**
```bash
# ❌ NUNCA hagas esto en producción
# Crea .env.local solo para desarrollo
NODE_ENV=development npm start
```

**Opción 3: Gestor de Secretos (RECOMENDADO para Producción)**
```bash
# Usar AWS Secrets Manager, Google Secret Manager, o Azure Key Vault
# 1. Almacenar secretos en el servicio
# 2. Autenticar con roles IAM
# 3. Cargar solo cuando sea necesario
```

---

## 🛡️ Protecciones Implementadas {#protecciones}

### 1. **Validación de Variables de Entorno**
📁 `server/utils/envValidator.js`
- Valida que variables requeridas existan
- Verifica longitud mínima de secretos
- Mascaría secretos en logs
- Normaliza valores

**Uso:**
```javascript
const { getEnv, initializeEnvironment } = require('./utils/envValidator');

// En server.js
initializeEnvironment(); // Valida al startup

// En rutas
const mongoUri = getEnv('MONGO_URI', undefined, { required: true });
```

### 2. **Encriptación de Secretos**
📁 `server/utils/secretsManager.js`
- Encripta/desencripta datos sensibles con AES-256
- Genera tokens JWT seguros
- Sanitiza inputs contra inyecciones
- Valida emails

**Uso:**
```javascript
const { encrypt, decrypt, hash } = require('./utils/secretsManager');

// Encriptar credencial antes de guardar
const encryptedPass = encrypt(userPassword);
await user.save({ password: encryptedPass });

// Desencriptar cuando sea necesario
const realPass = decrypt(encryptedPass);
```

### 3. **Protecciones Web**
📁 `server/middleware/webSecurityMiddleware.js`
- CSRF Protection
- XSS Prevention
- SQL Injection Detection
- Input Sanitization
- JSON Depth Validation
- Suspicious Activity Detection

**Uso en server.js:**
```javascript
const {
  csrfProtection,
  sanitizeInputs,
  validateJsonStructure,
  detectSuspiciousActivity
} = require('./middleware/webSecurityMiddleware');

app.use(sanitizeInputs);
app.use(validateJsonStructure());
app.use(detectSuspiciousActivity);
app.post('/api/*', csrfProtection, ...);
```

### 4. **Rate Limiting**
📁 `server/middleware/security.js`
- Limita requests para prevenir ataques DDoS
- Límites diferentes por tipo de endpoint
- Retorna headers de rate limit

### 5. **Helmet Security Headers**
- Content Security Policy (CSP)
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options (clickjacking prevention)
- X-Content-Type-Options (MIME sniffing prevention)

---

## ✅ Checklist Pre-Deployment {#checklist}

### 🔐 Seguridad Básica

- [ ] Todas las claves han sido rotadas recientemente
- [ ] `.env` NO está en el repositorio (verificar git history)
- [ ] Solo `.env.example` contiene valores dummy
- [ ] `git log --all | grep -i "password"` NO encuentra nada
- [ ] `.gitignore` está actualizado y correcto

### 🔒 Variables de Entorno

- [ ] `MONGO_URI` usa contraseña fuerte (>32 chars)
- [ ] `JWT_SECRET` es aleatorio y tiene >32 caracteres
- [ ] Todas las API keys están en variables de entorno
- [ ] No hay hardcoding de credenciales en el código
- [ ] `NODE_ENV=production` en deployment

### 🌐 CORS y Autenticación

- [ ] CORS está configurado solo para dominios permitidos
- [ ] JWT tiene expiración configurada (<30 días)
- [ ] Tokens se revisan en cada request protegido
- [ ] Endpoint de logout invalida tokens
- [ ] Password hashing usa bcryptjs con salt

### 📝 Logs y Monitoreo

- [ ] Los logs NO contienen información sensible
- [ ] Logs están encriptados en almacenamiento
- [ ] Sistema de alertas está configurado para accesos sospechosos
- [ ] Error messages NO exponen detalles internos

### 📦 Build y Deployment

- [ ] Build se ejecutó con `NODE_ENV=production`
- [ ] Bundle no contiene `node_modules`
- [ ] Source maps NO están incluidos en production
- [ ] No hay archivos `.env*` en el build
- [ ] Docker image no incluye `.env`

### 🔗 Endpoints Seguros

- [ ] Autenticación requiere JWT válido
- [ ] Autorización valida permisos del usuario
- [ ] SQL queries usan parameterized queries
- [ ] File uploads tienen validación de tipo y tamaño
- [ ] Rate limiting está activo

---

## 🔄 Procedimiento de Rotación de Claves {#rotacion-claves}

### Cuando Rotar (URGENTE)

- ❌ Clave fue expuesta públicamente
- ❌ Empleado con acceso se fue de la empresa
- ❌ Audit detectó acceso sospechoso
- ❌ Más de 90 días desde la última rotación

### Pasos para Rotar Claves

```bash
# 1. CREAR NUEVAS CLAVES
NEW_JWT_SECRET=$(openssl rand -base64 32)
NEW_GEMINI_KEY=... # obtener de Google Cloud Console

# 2. ACTUALIZAR EN GESTOR DE SECRETOS
# AWS: aws secretsmanager update-secret
# Google Cloud: gcloud secrets versions add
# Azure: az keyvault secret set

# 3. CREAR NUEVA VARIABLE EN DEPLOYMENT
git create branch chore/rotate-keys-date

# 4. ACTUALIZAR APLICACIÓN (sin cambiar código)
# Deployment automáticamente usa nuevas claves

# 5. VALIDAR QUE FUNCIONA CON NUEVAS CLAVES
npm run test:integration

# 6. REVOCAR CLAVES ANTIGUAS
# AWS: aws iam delete-access-key
# Google: gcloud auth application-default print-access-token

# 7. LIMPIAR CLAVES ANTIGUAS DEL GIT HISTORY
git log --all | grep OLD_KEY  # Debe ser vacío
```

### Automatizar Rotación (Recomendado)

```javascript
// .github/workflows/rotate-secrets.yml
name: Rotate API Keys
on:
  schedule:
    - cron: '0 0 1 */3 *' # Cada 3 meses
jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
      - name: Rotate Secrets
        env:
          SECRET_MANAGER_ROLE: ${{ secrets.SECRET_MANAGER_ROLE }}
        run: npm run rotate:secrets
```

---

## 📊 Monitoreo de Seguridad {#monitoreo}

### Logs a Monitorear

```javascript
// Crear alertas para estos patrones en logs:

// ❌ Intentos de acceso no autorizados
console.warn('Unauthorized access attempt:', userId, endpoint);

// ❌ Tasa anómala de requests
console.warn('Rate limit exceeded:', ip, requests);

// ❌ Datos sospechosos detectados
console.warn('Suspicious activity detected:', pattern);

// ❌ Fallos de autenticación
console.error('Authentication failed:', reason);
```

### Herramientas Recomendadas

```bash
# 1. Monitoreo de secretos (GitHub, GitLab)
# - GitHub Secret Scanning: Detecta API keys en commits
# - GitLab Secret Detection: Similar a GitHub

# 2. SAST (Static Application Security Testing)
npm install --save-dev @snyk/cli
npx snyk test

# 3. DAST (Dynamic Application Security Testing)
# - OWASP ZAP
# - Burp Suite Community

# 4. Dependency Scanning
npm audit
npm audit fix

# 5. Penetration Testing (Professional)
# Contratar servicio de pentesting anual
```

### Dashboard de Monitoreo

```bash
# Crear alerta para:
- Número de intentos de login fallidos
- Cambios en permisos de usuarios
- Acceso desde IPs sospechosas
- Velocidad anómala de requests
- Errores de autenticación JWT
```

---

## 🔍 Auditoría de Seguridad Continua

### Script de Validación Automática

```bash
# Ejecutar antes de cada commit
npm run security:audit

# Escanear dependencias
npm audit

# Verificar secretos en repositorio
git log -p | grep -i "password\|secret"

# Validar .gitignore
git check-ignore -v server/.env client/.env
```

### Checklist Mensual

- [ ] Revisar logs para acceso anómalo
- [ ] Actualizar dependencias vulnerables
- [ ] Validar CORS configuration
- [ ] Revisar permisos de usuarios
- [ ] Backup de base de datos encriptado
- [ ] Test de recuperación de backup

---

## 🆘 En Caso de Incidente de Seguridad

### Procedimiento Inmediato

```bash
# 1. DETENER TODO
# - Desplegar versión anterior si es necesario
# - Notificar a stakeholders

# 2. ANALIZAR
# - Revisar logs para entender el alcance
# - Determinar qué datos fueron comprometidos

# 3. CONTENER
# - Revocar tokens comprometidos
# - Cambiar todas las credenciales
# - Bloquear acceso sospechoso

# 4. REMEDIAR
# - Parchear la vulnerabilidad
# - Deployar fix
# - Monitoreo intenso

# 5. COMUNICAR
# - Notificar a usuarios si fue necesario
# - Crear reporte post-mortem
# - Implementar mejoras preventivasles
```

---

## 📞 Contacto y Escalación

- **Seguridad Crítica**: [email-seguridad@empresa.com]
- **Bug Bounty**: [bug-bounty@empresa.com]
- **Auditoría**: [audit@empresa.com]

---

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)

---

**IMPORTANTE**: Este documento debe ser revisado y actualizado cada 6 meses o cuando haya cambios significativos en la arquitectura de seguridad.

**Última revisión**: 2026-06-18  
**Próxima revisión**: 2026-12-18
