# Auditoria de Permisos y Acciones - 2026-04-11

## Alcance
Revision tecnica de:
- Visibilidad por sidebar.
- Acceso por ruta (URL directa).
- Cobertura de acciones crear/editar/eliminar/bloquear en frontend.

## Resultado ejecutivo
1. Cobertura de acceso `ver` por ruta: endurecida y aplicada en modulos principales.
2. Dashboard Ejecutivo: movido al Modulo Administracion.
3. Permisos granulares nuevos activos:
- admin_config_notificaciones
- emp360_beneficios
- emp360_lms
- emp360_evaluaciones
4. Cobertura de acciones (`crear/editar/eliminar`) aun heterogenea por pantalla.

## Cambios aplicados en codigo
- Sidebar:
  - Dashboard dentro de Administracion.
  - Mis Clientes usa admin_mis_clientes.
  - Config Notificaciones usa admin_config_notificaciones.
- Router:
  - Rutas con ProtectedRoute + allowPermissions en Admin, RRHH, Prevencion, Operaciones, Logistica, Empresa360, Comunicaciones y Dashboard.
- Hook permisos:
  - useCheckPermission ahora respeta configuracion explicita incluso para admin.
  - Compatibilidad entre acciones bloquear/suspender.
- Matrices de permisos:
  - SystemCommandCenter y GestorPersonal actualizados.

## Estado por capa
- Sidebar: OK (granular).
- URL directa: OK para rutas principales del shell.
- Acciones CRUD por vista: Parcial (requiere hardening de botones y handlers por modulo).

## Hallazgos en acciones de escritura (frontend)
### Con control de permisos explicito detectado
- src/platforms/rrhh/pages/GestorPersonal.jsx

### Archivos con hardening de accion aplicado en segunda ola
- src/platforms/admin/pages/MisClientes.jsx
- src/platforms/admin/pages/ConfigNotificaciones.jsx
- src/platforms/admin/pages/GestionRindeGastos.jsx
- src/platforms/admin/pages/ModelosBonificacion.jsx
- src/platforms/empresa360/pages/Beneficios360.jsx
- src/platforms/empresa360/pages/Biometria360.jsx
- src/platforms/empresa360/pages/CapacitacionLMS.jsx
- src/platforms/empresa360/pages/Evaluaciones360.jsx
- src/platforms/empresa360/pages/Facturacion360.jsx
- src/platforms/empresa360/pages/Tesoreria360.jsx

### Archivos con hardening de accion aplicado en tercera ola
- src/platforms/admin/pages/Aprobaciones360.jsx  (admin_aprobaciones + admin_aprobaciones_compras / editar)
- src/platforms/admin/pages/PortalesOperativos.jsx  (admin_gestion_portales / editar + eliminar)

### Archivos con escritura que siguen pendientes de hardening de accion
- src/platforms/agentetelecom/Ajustes.jsx
- src/platforms/agentetelecom/Baremos.jsx
- src/platforms/agentetelecom/CierreBonos.jsx
- src/platforms/agentetelecom/ConfigLPU.jsx
- src/platforms/agentetelecom/DescargaTOA.jsx
- src/platforms/agentetelecom/Designaciones.jsx
- src/platforms/agentetelecom/Dotacion.jsx
- src/platforms/agentetelecom/FichaIngreso.jsx
- src/platforms/agentetelecom/Flota.jsx
- src/platforms/agentetelecom/MonitorGps.jsx
- src/platforms/agentetelecom/Tarifario.jsx
- src/platforms/ai/AIAssistant.jsx
- src/platforms/auth/SystemCommandCenter.jsx
- src/platforms/comunicaciones/components/ChatInterface.jsx
- src/platforms/comunicaciones/pages/AgendaPanel.jsx
- src/platforms/logistica/components/DynamicAuditModal.jsx
- src/platforms/logistica/pages/Almacenes.jsx
- src/platforms/logistica/pages/Auditorias.jsx
- src/platforms/logistica/pages/ConfigLogistica.jsx
- src/platforms/logistica/pages/ConfiguracionCompras.jsx
- src/platforms/logistica/pages/Despachos.jsx
- src/platforms/logistica/pages/GestionCategorias.jsx
- src/platforms/logistica/pages/GestionCompras.jsx
- src/platforms/logistica/pages/GestionMovimientos.jsx
- src/platforms/logistica/pages/Inventario.jsx
- src/platforms/logistica/pages/Proveedores.jsx
- src/platforms/operaciones/components/CheckListVehicular.jsx
- src/platforms/operaciones/components/GestorTurnosOperaciones.jsx
- src/platforms/operaciones/pages/PortalColaborador.jsx
- src/platforms/operaciones/pages/PortalSupervision.jsx
- src/platforms/operaciones/pages/RindeGastos.jsx
- src/platforms/rrhh/pages/ControlAsistencia.jsx

## Recomendacion tecnica para cerrar 100%
1. Estandarizar guardas de accion en UI con useCheckPermission(module, action).
2. Estandarizar validacion server-side por accion para cada endpoint.
3. Agregar pruebas E2E por rol (smoke):
- Sin permiso ver: sin menu + sin URL.
- Con ver y sin editar: lectura OK, mutaciones bloqueadas.
- Con editar/eliminar: acciones habilitadas.

## Nota
El endurecimiento de `ver` quedo operativo y validado por build. El hardening total de acciones requiere una segunda ola de cambios sobre las vistas listadas.
