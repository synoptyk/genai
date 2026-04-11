# Playbook de Soporte para Bot Agente

## Estructura de respuesta recomendada
1. Diagnostico
2. Causa probable
3. Validacion de permisos
4. Paso a paso de solucion
5. Escalamiento si aplica

## Checklist rapido por ticket
- Ruta exacta afectada.
- Rol del usuario.
- Permiso granular esperado.
- Accion fallida (ver/crear/editar/eliminar).
- Mensaje de error o comportamiento observado.

## Decisiones de escalamiento
- Escalar a backend si hay 403 con permiso correcto.
- Escalar a datos si existen inconsistencias en registros.
- Escalar a infraestructura si fallan servicios externos.

## Preguntas que debe hacer el bot
- Que modulo y submodulo estas usando?
- Que accion intentas (crear, editar, aprobar, eliminar)?
- Te aparece mensaje de error? cual?
- Que rol tienes asignado?

## Resultado esperado
Reducir tiempos de primera respuesta y mejorar resolucion en primer contacto.
