# 🔧 Diagnóstico de Sincronización Candidato → Técnico → Producción

Hemos implementado mejoras significativas en la sincronización. Sigue estos pasos para verificar que todo funciona:

## Paso 1: Preparar un Técnico de Prueba

1. Ve a **RRHH > Captura de Talento**
2. Selecciona un técnico que esté **"Contratado"** (es CRÍTICO)
3. Anota su **RUT** y su **Proyecto actual**
4. Ejemplo: `18.765.432-9` con proyecto `"Cenco Valparaiso"`

## Paso 2: Hacer un Cambio Visible

1. Edita ese técnico en Captura de Talento
2. Cambia su **PROYECTO** a uno diferente
3. O cambia su **SEDE**
4. O ambos
5. Guarda los cambios
6. Verifica que se muestra un mensaje de "Guardado exitosamente"

---

## Paso 3: Verificar Sincronización en Backend

**Opción A: Sin Código (Más Fácil)**

1. Abre el navegador DevTools (F12)
2. Ve a la pestaña **Network**
3. Cuando guardes en Captura de Talento, busca la request `PUT /api/rrhh/candidatos/:id`
4. Mira que el servidor responde exitosamente (status 200)

**Opción B: Usar Endpoint de Diagnóstico**

1. Abre una nueva pestaña en el navegador
2. Ve a: `http://localhost:3000/api/debug/sincronizacion/18765432` 
   - (reemplaza 18765432 con tu RUT sin puntos ni guiones)
3. Verás un JSON con esta estructura:

```json
{
  "rut": "18765432",
  "candidato": {
    "projectId": "NEW_PROJECT_ID",
    "position": "Técnico Telecom"
  },
  "tecnico": {
    "projectId": "SAME_AS_CANDIDATO?",
    "cargo": "Técnico Telecom"
  },
  "sincronizado": {
    "candidatoExiste": true,
    "tecnicoExiste": true,
    "projectIdSincronizado": true,  ← ¡DEBE SER TRUE!
    "cargoSincronizado": true
  }
}
```

**Qué buscar:**
- ✅ `candidatoExiste: true` → Candidato existe en BD
- ✅ `tecnicoExiste: true` → Tecnico existe en BD
- ✅ `projectIdSincronizado: true` → Los projectIds coinciden
- ✅ `enMapaValorizacion: true` → Está en el mapa de caché

---

## Paso 4: Si Algo NO Está Sincronizado

Si ves algo como `projectIdSincronizado: false`, significa los datos NO se sincronizaron.

### Solución Rápida:

1. Abre: `http://localhost:3000/api/debug/reset-cache-valorizacion`
2. Haz un **POST** (no GET) - Puedes usar Postman o:
   ```bash
   curl -X POST http://localhost:3000/api/debug/reset-cache-valorizacion \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
3. Verás: 
   ```json
   {
     "message": "Cache reseteado y reconstruido",
     "oldVersion": 5,
     "newVersion": 6,
     "mapaSize": 127
   }
   ```
4. Ahora ve a **Producción Operativa** o **Producción Financiera** y REFRESCA (F5)
5. Deberías ver los cambios

---

## Paso 5: Verificar en Producción Operativa/Financiera

1. Va a **Menu > Producción Operativa** o **Producción Financiera**
2. Busca el técnico por nombre ó RUT
3. Verifica que:
   - ✅ El **PROYECTO** es el nuevo que asignaste  
   - ✅ La **SEDE** es la nueva (si la cambiaste)
   - ✅ El **CARGO** es correcto

---

## 🔍 Logs del Servidor

Si desplegaste a Render o similar, busca los logs cuando editas un candidato. Deberías ver:

```
═══════════════════════════════════════════════════════━
🟢 PUT /api/rrhh/candidatos/:63a9f1b2c4d5e6f7a8b9c0d1 RECEIVED
📦 Body keys: fullName, rut, projectId, position, status, ...
✏️ Cambios: projectId=62f9a1b2c4d5e6f7a8b9c0d2, status=Contratado, position=Técnico
🧹 Cleaned data keys: ...
📊 Candidato guardado en MongoDB: SÍ
   - fullName: Juan Martinez
   - rut: 18765432
   - projectId: 62f9a1b2c4d5e6f7a8b9c0d2
   - status: Contratado

🔄 Llamando syncToTecnico...
🔄 syncToTecnico START: RUT=18765432, projectId=62f9a1b2c4d5e6f7a8b9c0d2, createIfMissing=true
📍 Tecnico existe en DB: SÍ
📝 Actualizando Tecnico existente...
✅ Tecnico actualizado en MongoDB: matched=1, modified=1
🔄 Cache invalidado y versión bumped para empresa 61e8a1b2c4d5e6f7a8b9c0d0
✅ syncToTecnico completado
═══════════════════════════════════════════════════════━
```

**Si ves `modified=0`**, significa MongoDB no detectó cambios. Esto podría ser porque:
1. Los datos ya eran idénticos
2. O hay un problema de escritura en BD

---

## 📋 Checklist de Debugging

- [ ] Técnico está en status "Contratado"
- [ ] Técnico tiene un `idRecursoToa` (TO A de órdenes de trabajo)
- [ ] Edité algo visible (proyecto, sede, cargo)
- [ ] Guardé con éxito en Captura de Talento
- [ ] Endpoint `/api/debug/sincronizacion/:rut` muestra `sincronizado: true`
- [ ] Refresco Producción Operativa/Financiera
- [ ] Cambios aparecen en Producción

---

## ❌ Si NADA Funciona

1. **Mensaje de error específico**: Copia exactamente qué error ves
2. **Logs completos**: Copia los logs del servidor cuando editas
3. **Endpoint diagnóstico**: Comparte la respuesta JSON completa de `/api/debug/sincronizacion/RUT`
4. **RUT específico**: Cuéntame exactamente qué RUT probaste

---

## 🚀 Cambios Realizados en Esta Sesión

1. **syncToTecnico Mejorado**:
   - Usa `updateOne()` para forzar guardado en MongoDB
   - SIEMPRE sincroniiza 20+ campos (no solo si detecta cambios)
   - Logging detallado de cada paso

2. **PUT /candidatos/:id**:
   - SIEMPRE llama syncToTecnico (sin condicionales de status)
   - createIfMissing=true para crear Tecnico si no existe   
   - Logging de todo el proceso

3. **Endpoints de Diagnóstico**:
   - `GET /api/debug/sincronizacion/:rut` → Ver estado actual
   - `POST /api/debug/reset-cache-valorizacion` → Forzar reconstrucción de caché

---

📍 **Todos los cambios ya están en producción (main branch)**

