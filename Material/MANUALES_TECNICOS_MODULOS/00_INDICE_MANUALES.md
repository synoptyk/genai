# Manuales Tecnicos de Modulos - Portal Gen AI

Fecha: 2026-04-11
Uso: Base de conocimiento para soporte humano y bot agente.

## Objetivo
Este paquete documenta los modulos funcionales, permisos, rutas, operaciones y casos de soporte frecuentes.

## Como usar estos manuales con el bot
1. Cargar todos los archivos .md como knowledge base.
2. Configurar retrieval por modulo y por ruta.
3. Usar 00_INDICE_MANUALES.md como punto de entrada.
4. Priorizar respuestas con secciones: Diagnostico, Causa probable, Paso a paso, Escalamiento.

## Documentos
- 01_ADMINISTRACION.md
- 02_CONECTA_PORTAL.md
- 03_RRHH.md
- 04_RELACIONES_LABORALES.md
- 05_REMUNERACIONES.md
- 06_PREVENCION_HSE.md
- 07_FLOTA_GPS.md
- 08_OPERACIONES.md
- 09_RENDIMIENTO_PRODUCTIVO.md
- 10_LOGISTICA_360.md
- 11_CONFIGURACIONES.md
- 12_COMUNICACIONES_360.md
- 13_GEN_AI.md
- 14_SEGURIDAD_ROLES_PERMISOS.md
- 99_PLAYBOOK_SOPORTE.md

## Convenciones
- Permiso granular: modulo_accion (ej: rrhh_captura, emp360_lms).
- Acciones: ver, crear, editar, bloquear/suspender, eliminar.
- Si no hay permiso ver, no debe existir acceso por sidebar ni por URL.
