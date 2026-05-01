/**
 * Verificar contexto de autenticación del usuario
 * Útil para saber por qué falla la solicitud
 */

console.log(`
🔐 VERIFICACIÓN DE CONTEXTO DE AUTENTICACIÓN
==============================================

Para debuggear el error 400, necesitamos verificar:

1. ✅ El usuario está autenticado (token válido)
   - Ve a Developer Tools (F12) → Network
   - Haz clic en "Bajar Data MongoDB"
   - Busca la solicitud POST a /api/recalcular-actividades-mongodb
   - Revisa los headers: ¿Contiene "Authorization: Bearer ..."?

2. ✅ Los parámetros se envían correctamente
   - En la pestaña Network, haz clic en la solicitud
   - Ve a "Request" → "Payload" o "Request Body"
   - Deberías ver: { "fechaInicio": "2026-03-XX", "fechaFin": "2026-03-XX" }

3. ✅ El servidor recibe empresaRef correctamente
   - En la consola del servidor (donde ejecutaste npm start)
   - Deberías ver logs como:
     "[recalcular-actividades-mongodb] Recibida solicitud"
     "Usuario: tu_email@example.com"
     "EmpresaId resuelto: 123abc..."

4. ✅ Las tarifas LPU están configuradas
   - En el navegador, abre: http://localhost:3000/configuracion-lpu
   - ¿Ves tarifas listadas? Si NO, ahí está el problema.

PASOS A SEGUIR:
1. Abre F12 (Developer Tools)
2. Ve a pestaña Console
3. Intenta hacer clic en "Bajar Data MongoDB"
4. Copia todos los logs que veas (incluyendo errores)
5. Envíame la información completa
