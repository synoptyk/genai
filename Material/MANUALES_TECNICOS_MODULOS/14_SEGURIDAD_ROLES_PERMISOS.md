# Seguridad, Roles y Permisos Granulares

## Jerarquia de acceso
1. system_admin: acceso total.
2. ceo: acceso total funcional.
3. admin: acceso por matriz granular y contrato empresa.
4. roles operativos: acceso estrictamente granular.

## Reglas implementadas
- Sidebar usa hasSubAccess por permiso.
- Rutas criticas usan ProtectedRoute con allowPermissions.
- Sin permiso ver no hay acceso por URL.

## Acciones por permiso
- ver: habilita visualizacion y entrada.
- crear: alta de registros.
- editar: cambios de registros existentes.
- bloquear/suspender: control de disponibilidad.
- eliminar: baja logica o fisica.

## Recomendacion de gobierno
- Mantener una matriz unica fuente de verdad.
- Versionar cambios de permisos por release.
- Ejecutar pruebas de humo por rol en cada deploy.
