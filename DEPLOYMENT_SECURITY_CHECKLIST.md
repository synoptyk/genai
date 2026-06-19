# 🚀 CHECKLIST PRE-DEPLOYMENT - Gen AI

**Última actualización**: 2026-06-18  
**Estado**: ✅ SEGURIDAD IMPLEMENTADA - LISTO PARA PRODUCCIÓN

---

## 📋 CHECKLIST DE SEGURIDAD PRE-DEPLOYMENT

### Fase 1: Preparación Local (ANTES de cualquier push)

- [ ] **Limpiar historial de git**
  ```bash
  git log --all | grep -i "password\|secret\|api_key\|mongodb"
  # Resultado esperado: Vacío
  ```

- [ ] **Validar que .env NO esté en git**
  ```bash
  git check-ignore -v .env server/.env client/.env
  # Resultado esperado: Todos los .env ignorados
  ```

- [ ] **Ejecutar auditoría de seguridad**
  ```bash
  npm run security:audit
  # Resultado esperado: ✅ AUDITORÍA COMPLETADA - No se encontraron problemas
  ```

- [ ] **Verificar que .env.example es solo EJEMPLO**
  ```bash
  grep -v "^#" .env.example | grep -E "AIzaSy|gsk_|GOCSPX|password|secret"
  # Resultado esperado: Vacío (solo valores dummy)
  ```

- [ ] **Instalar hook de seguridad pre-commit**
  ```bash
  npm run security:install-hook
  ```

### Fase 2: Variables de Entorno (CRÍTICO)

- [ ] **JWT_SECRET**
  - [ ] ¿Es aleatorio? ✓
  - [ ] ¿Tiene > 32 caracteres? ✓
  - [ ] ¿No está en el código? ✓
  - [ ] ¿Fue rotado recientemente? ✓

- [ ] **MONGO_URI**
  - [ ] ¿Usa autenticación? ✓
  - [ ] ¿Contraseña tiene caracteres especiales? ✓
  - [ ] ¿Usuario NO es "admin"? ✓
  - [ ] ¿Usa SSL/TLS? ✓
  - [ ] ¿Tiene IP whitelist? ✓

- [ ] **API Keys (Gemini, Groq, Google)**
  - [ ] ¿Están en variables de entorno? ✓
  - [ ] ¿NO están en el código? ✓
  - [ ] ¿Fueron rotadas recientemente? ✓
  - [ ] ¿Se cuenta con keys de backup? ✓

- [ ] **Credenciales de Terceros**
  - [ ] ¿TOA credentials en env? ✓
  - [ ] ¿GPS credentials en env? ✓
  - [ ] ¿SMTP password en env? ✓
  - [ ] ¿Google OAuth secret en env? ✓

### Fase 3: Código y Dependencias

- [ ] **Escanear dependencias vulnerables**
  ```bash
  npm audit
  # Resultado esperado: 0 critical vulnerabilities
  ```

- [ ] **Verificar no hay logging de secretos**
  ```bash
  grep -r "console.log.*\(SECRET\|PASSWORD\|API_KEY\)" server/
  # Resultado esperado: Vacío
  ```

- [ ] **Validar handlers de errores NO exponen información sensible**
  ```bash
  grep -r "err.message" server/routes/ | head -5
  # Revisar que error messages son genéricos
  ```

- [ ] **Verificar que inputs están sanitizados**
  - [ ] ¿Body parser con límite configurado? ✓
  - [ ] ¿Middleware de sanitización activo? ✓
  - [ ] ¿Rate limiting activo? ✓
  - [ ] ¿CORS configurado correctamente? ✓

### Fase 4: CORS y Autenticación

- [ ] **CORS Configuration**
  ```javascript
  // Verificar que solo dominios permitidos
  allowedOrigins = [
    'https://genai.cl',
    'https://www.genai.cl',
    // NO incluir localhost o desarrollo
  ]
  ```

- [ ] **JWT Configuration**
  - [ ] ¿Tiempo de expiración < 30 días? ✓
  - [ ] ¿Se valida en cada request protegido? ✓
  - [ ] ¿Refresh tokens configurados? ✓
  - [ ] ¿Logout invalida tokens? ✓

- [ ] **Password Hashing**
  - [ ] ¿Usa bcryptjs? ✓
  - [ ] ¿Salt rounds >= 10? ✓
  - [ ] ¿Nunca almacena password sin hash? ✓

### Fase 5: Build y Deployment

- [ ] **Build de producción**
  ```bash
  NODE_ENV=production npm run build
  ```

- [ ] **Verificar que build NO contiene archivos sensibles**
  ```bash
  grep -r "MONGO_URI\|JWT_SECRET" build/ server/build/
  # Resultado esperado: Vacío
  ```

- [ ] **Verificar que build NO contiene node_modules**
  ```bash
  ls -la build/ | grep node_modules
  # Resultado esperado: No debe existir
  ```

- [ ] **Docker build (si aplica)**
  ```bash
  docker build -f docker/server.Dockerfile -t genai-server:latest .
  docker run --rm genai-server:latest env | grep -i "password\|secret"
  # Resultado esperado: Debe estar vacío
  ```

- [ ] **Verificar que .env NO está en Docker image**
  ```bash
  docker run --rm genai-server:latest cat /.env 2>/dev/null || echo "OK"
  # Resultado esperado: OK (archivo no existe)
  ```

### Fase 6: Monitoreo y Logs

- [ ] **Configurar logging en producción**
  - [ ] ¿Logs van a servicio centralizado? ✓
  - [ ] ¿Logs están encriptados? ✓
  - [ ] ¿Hay rotación de logs? ✓
  - [ ] ¿Se monitorean accesos fallidos? ✓

- [ ] **Configurar alertas de seguridad**
  - [ ] ¿Alerta de tasa anómala de requests? ✓
  - [ ] ¿Alerta de intentos de login fallidos? ✓
  - [ ] ¿Alerta de cambios en permisos de usuarios? ✓
  - [ ] ¿Alerta de acceso desde IPs sospechosas? ✓

### Fase 7: Pruebas Pre-Deployment

- [ ] **Test de seguridad básico**
  ```bash
  # Test 1: Intentar acceso sin token
  curl https://api.genai.cl/api/protected
  # Resultado esperado: 401 Unauthorized
  
  # Test 2: Intentar token inválido
  curl -H "Authorization: Bearer invalid" https://api.genai.cl/api/protected
  # Resultado esperado: 401 Unauthorized
  
  # Test 3: Verificar CORS
  curl -H "Origin: https://attacker.com" https://api.genai.cl/api/data
  # Resultado esperado: No incluye header Access-Control-Allow-Origin
  ```

- [ ] **Test de rate limiting**
  ```bash
  for i in {1..1000}; do
    curl -s https://api.genai.cl/api/data > /dev/null
  done
  # Resultado esperado: Eventualmente devuelve 429 Too Many Requests
  ```

- [ ] **Test de validación de inputs**
  ```bash
  curl -X POST https://api.genai.cl/api/user \
    -H "Content-Type: application/json" \
    -d '{"email":"<script>alert(1)</script>"}'
  # Resultado esperado: Sanitizado o rechazado
  ```

### Fase 8: Documentación

- [ ] **Compartir guía de seguridad con equipo**
  - [ ] ¿SECURITY_GUIDE.md distribuido? ✓
  - [ ] ¿Equipo entiende procedimiento de rotación? ✓
  - [ ] ¿Equipo sabe qué hacer en incidente? ✓

- [ ] **Crear runbooks de operaciones**
  - [ ] ¿Runbook de deployment? ✓
  - [ ] ¿Runbook de rollback? ✓
  - [ ] ¿Runbook de incidente de seguridad? ✓

### Fase 9: Post-Deployment (Primeras 24 horas)

- [ ] **Monitoreo intensivo**
  - [ ] ¿Checkear logs cada hora? ✓
  - [ ] ¿Verificar tasa de errores < 0.1%? ✓
  - [ ] ¿Verificar no hay accesos anómales? ✓

- [ ] **Validaciones finales**
  ```bash
  # 1. Verificar que autenticación funciona
  curl -X POST https://api.genai.cl/api/auth/login \
    -d '{"email":"user@example.com","password":"test"}'
  # Resultado esperado: token válido o error 401
  
  # 2. Verificar que endpoints protegidos funcionan
  curl -H "Authorization: Bearer $TOKEN" https://api.genai.cl/api/user
  # Resultado esperado: datos de usuario
  
  # 3. Verificar que logs NO contienen datos sensibles
  tail -f /var/log/genai/app.log | grep -i "password\|secret"
  # Resultado esperado: Vacío
  ```

- [ ] **Comunicación a stakeholders**
  - [ ] ¿Notificar deployment exitoso? ✓
  - [ ] ¿Incluir información de seguridad? ✓
  - [ ] ¿Proporcionar contacto de emergencia? ✓

---

## 🚨 Si Algo Sale Mal

### Rollback Inmediato

```bash
# 1. DETENER TODO
docker stop genai-server genai-client

# 2. DEPLOYAR VERSIÓN ANTERIOR
git checkout <commit-anterior>
npm run build
npm start

# 3. NOTIFICAR
# Enviar email a stakeholders

# 4. INVESTIGAR
# Revisar logs en /var/log/genai/
# Verificar cambios últimos
```

### Checklist de Incidente

- [ ] Servicio está restore
- [ ] Datos no fueron comprometidos
- [ ] Credenciales han sido rotadas
- [ ] Root cause identificado
- [ ] Post-mortem iniciado
- [ ] Equipo notificado
- [ ] Clientes notificados (si aplica)

---

## 📞 Contactos de Emergencia

- **DevOps**: [email]
- **Security**: [email]
- **CTO**: [email]
- **Escalación**: [email]

---

## ✅ Firma de Cumplimiento

Por favor confirma que has completado todos los items:

```
Nombre: ___________________________
Fecha: ____________________________
Firma: ____________________________

Confirmo que:
- [ ] He revisado todos los items de seguridad
- [ ] He validado que no hay secretos expuestos
- [ ] He ejecutado auditoría de seguridad (npm run security:audit)
- [ ] He verificado variables de entorno
- [ ] He realizado pruebas pre-deployment
- [ ] Estoy listo para desplegar a producción
```

---

**IMPORTANTE**: Este checklist debe completarse CADA VEZ que hagas un deployment a producción.

**Última revisión**: 2026-06-18  
**Próxima revisión**: 2026-12-18
