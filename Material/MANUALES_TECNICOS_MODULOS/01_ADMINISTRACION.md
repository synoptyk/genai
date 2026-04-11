# Manual Tecnico - Administracion

## Objetivo
Gestion central de datos maestros, clientes, aprobaciones y herramientas corporativas.

## Rutas clave
- /dashboard
- /administracion/mis-clientes
- /proyectos
- /administracion/aprobaciones
- /rrhh/historial
- /administracion/pagos-bancarios
- /administracion/gestion-gastos
- /empresa360/facturacion
- /empresa360/tesoreria
- /empresa360/biometria
- /administracion/configuracion-notificaciones
- /administracion/gestion-portales

## Permisos granulares esperados
- admin_resumen_ejecutivo
- admin_mis_clientes
- admin_proyectos
- admin_aprobaciones
- admin_aprobaciones_compras
- admin_historial
- admin_pagos_bancarios
- admin_gestion_gastos
- emp360_facturacion
- emp360_tesoreria
- emp360_biometria
- admin_config_notificaciones
- admin_gestion_portales

## Operaciones frecuentes
- Crear/editar/eliminar cliente.
- Revisar y resolver aprobaciones.
- Gestionar parametros administrativos y notificaciones.

## Soporte rapido
1. Si no ve Dashboard Ejecutivo, validar admin_resumen_ejecutivo.ver.
2. Si ve menu pero no abre ruta, validar permiso en backend + front.
3. Si no puede editar, revisar accion editar del permiso especifico.
