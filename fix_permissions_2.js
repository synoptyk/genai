const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const files = {
  app: path.join(ROOT, 'client/src/App.js'),
  commandCenter: path.join(ROOT, 'client/src/platforms/auth/SystemCommandCenter.jsx')
};

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, data) => fs.writeFileSync(p, data, 'utf8');

// 1. Fix admin_tipos_bono in SystemCommandCenter.jsx
let cc = read(files.commandCenter);
if (!cc.includes("{ id: 'admin_tipos_bono'")) {
    // Add to 'Administración' array
    cc = cc.replace(
        /\{ id: 'admin_modelos_bonificacion', label: 'Modelos Bonificación' \},/g,
        "{ id: 'admin_modelos_bonificacion', label: 'Modelos Bonificación' },\n                                        { id: 'admin_tipos_bono', label: 'Tipos de Bono' },"
    );
    // Add to activeModIds array
    cc = cc.replace(
        /\{ id: 'admin_modelos_bonificacion' \},/g,
        "{ id: 'admin_modelos_bonificacion' }, { id: 'admin_tipos_bono' },"
    );
    write(files.commandCenter, cc);
}

// 2. Add missing routes to App.js
let app = read(files.app);

const missingRoutes = [
  { key: 'admin_aprobaciones', path: '/admin-aprobaciones' },
  { key: 'admin_aprobaciones_compras', path: '/admin-aprobaciones-compras' },
  { key: 'admin_historial', path: '/admin-historial' },
  { key: 'cfg_clientes', path: '/cfg-clientes' },
  { key: 'ind_agricola', path: '/ind-agricola' },
  { key: 'ind_construccion', path: '/ind-construccion' },
  { key: 'ind_energia', path: '/ind-energia' },
  { key: 'ind_manufactura', path: '/ind-manufactura' },
  { key: 'ind_mineria', path: '/ind-mineria' },
  { key: 'ind_pesquero', path: '/ind-pesquero' },
  { key: 'ind_transporte', path: '/ind-transporte' },
  { key: 'logistica_almacenes', path: '/logistica-almacenes' },
  { key: 'logistica_configuracion', path: '/logistica-configuracion' },
  { key: 'op_portales', path: '/op-portales' },
  { key: 'prev_acreditacion', path: '/prev-acreditacion' },
  { key: 'rend_cierre_bonos', path: '/rend-cierre-bonos' },
  { key: 'rrhh_contratos_anexos', path: '/rrhh-contratos-anexos' },
  { key: 'rrhh_historial', path: '/rrhh-historial' }
];

// We will inject these right before {/* ─── RUTAS PUBLICAS & FALLBACK ─── */}
const routesHTML = missingRoutes.map(r => `          <Route path="${r.path}" element={<ProtectedRoute allowPermissions={['${r.key}']}><div>🚧 Módulo ${r.key} en desarrollo</div></ProtectedRoute>} />`).join('\n');

app = app.replace(/\{\/\* ─── RUTAS PUBLICAS & FALLBACK ─── \*\/\}/g, `          {/* INJECTED MISSING ROUTES */}\n${routesHTML}\n\n          {/* ─── RUTAS PUBLICAS & FALLBACK ─── */}`);

write(files.app, app);

console.log('Fixed missing parts.');
