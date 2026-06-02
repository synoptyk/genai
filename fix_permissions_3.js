const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const appFile = path.join(ROOT, 'client/src/App.js');
let app = fs.readFileSync(appFile, 'utf8');

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

const routesHTML = missingRoutes.map(r => `          <Route path="${r.path}" element={<ProtectedRoute allowPermissions={['${r.key}']}><div>🚧 Módulo ${r.key} en desarrollo</div></ProtectedRoute>} />`).join('\n');

app = app.replace('    </Routes>', `          {/* INJECTED MISSING ROUTES */}\n${routesHTML}\n    </Routes>`);

fs.writeFileSync(appFile, app, 'utf8');
console.log('Injected missing routes.');
