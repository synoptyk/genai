const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const files = {
  app: path.join(ROOT, 'client/src/App.js'),
  sidebar: path.join(ROOT, 'client/src/components/Sidebar.jsx'),
  commandCenter: path.join(ROOT, 'client/src/platforms/auth/SystemCommandCenter.jsx'),
  empresaModel: path.join(ROOT, 'server/platforms/auth/models/Empresa.js'),
  userModel: path.join(ROOT, 'server/platforms/auth/PlatformUser.js'),
};

const read = (p) => fs.readFileSync(p, 'utf8');

const uniq = (arr) => [...new Set(arr)].sort();

const isManagedPermissionKey = (key) => /^(admin_|rrhh_|prev_|flota_|dist_|op_|rend_|ind_|logistica_|cfg_|social_|comunic_|emp360_|ai_)/.test(key);

const extractWithRegex = (content, regex, group = 1) => {
  const out = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    out.push(m[group]);
  }
  return uniq(out);
};

const appContent = read(files.app);
const sidebarContent = read(files.sidebar);
const commandContent = read(files.commandCenter);
const empresaContent = read(files.empresaModel);
const userContent = read(files.userModel);

// 1) Permisos usados por rutas protegidas
const appPerms = extractWithRegex(appContent, /allowPermissions=\{\['([^']+)'\]\}/g);

// 2) Permisos listados en MODULE_PERMISSION_MAP del Sidebar
const sidebarPerms = extractWithRegex(sidebarContent, /'([a-z0-9_]+)'/g).filter(isManagedPermissionKey);

// 3) Permisos definidos por default en Command Center (objeto con { ver, crear, ... })
const commandDefaults = extractWithRegex(commandContent, /\n\s+([a-z0-9_]+):\s*\{\s*ver:\s*false,\s*crear:\s*false,\s*editar:\s*false,\s*bloquear:\s*false,\s*eliminar:\s*false\s*\}/g).filter(isManagedPermissionKey);

// 4) IDs mostrados en grillas del Command Center (id: 'xxx')
const commandVisible = extractWithRegex(commandContent, /\{\s*id:\s*'([a-z0-9_]+)'/g).filter(isManagedPermissionKey);

// 5) Modelos backend
const empresaPerms = extractWithRegex(empresaContent, /\n\s+([a-z0-9_]+):\s*\{\s*ver:\s*false,\s*crear:\s*false,\s*editar:\s*false,\s*bloquear:\s*false,\s*eliminar:\s*false\s*\}/g).filter(isManagedPermissionKey);
const userPerms = extractWithRegex(userContent, /\n\s+([a-z0-9_]+):\s*\{\s*ver:\s*false,\s*crear:\s*false,\s*editar:\s*false,\s*bloquear:\s*false,\s*eliminar:\s*false\s*\}/g).filter(isManagedPermissionKey);

const appManagedPerms = appPerms.filter(isManagedPermissionKey);

const sets = {
  AppRoutes: new Set(appManagedPerms),
  SidebarMap: new Set(sidebarPerms),
  CommandDefaults: new Set(commandDefaults),
  CommandVisible: new Set(commandVisible),
  EmpresaModel: new Set(empresaPerms),
  PlatformUserModel: new Set(userPerms),
};

const allKeys = uniq([
  ...appPerms,
  ...appManagedPerms,
  ...sidebarPerms,
  ...commandDefaults,
  ...commandVisible,
  ...empresaPerms,
  ...userPerms,
]);

const criticalSets = ['AppRoutes', 'SidebarMap', 'CommandDefaults', 'CommandVisible', 'EmpresaModel', 'PlatformUserModel'];

const missingMatrix = [];
for (const key of allKeys) {
  const missingIn = criticalSets.filter((s) => !sets[s].has(key));
  if (missingIn.length > 0) {
    missingMatrix.push({ key, missingIn });
  }
}

const printSet = (name, arr) => {
  console.log(`\n${name} (${arr.length})`);
  if (!arr.length) {
    console.log('  - none');
    return;
  }
  arr.forEach((k) => console.log(`  - ${k}`));
};

console.log('=== AUDIT PERMISOS SYNC ===');
console.log(`AppRoutes: ${appPerms.length}`);
console.log(`SidebarMap: ${sidebarPerms.length}`);
console.log(`CommandDefaults: ${commandDefaults.length}`);
console.log(`CommandVisible: ${commandVisible.length}`);
console.log(`EmpresaModel: ${empresaPerms.length}`);
console.log(`PlatformUserModel: ${userPerms.length}`);

const missingCritical = missingMatrix.filter((row) => row.missingIn.length > 0);

if (!missingCritical.length) {
  console.log('\nOK: Todo sincronizado entre vistas, rutas y modelos.');
  process.exit(0);
}

console.log(`\nALERTA: ${missingCritical.length} permisos con desalineacion.`);
missingCritical.forEach((row) => {
  console.log(`- ${row.key}: falta en [${row.missingIn.join(', ')}]`);
});

const appNotInCC = appPerms.filter((k) => !sets.CommandDefaults.has(k));
const appNotInModels = appManagedPerms.filter((k) => !sets.EmpresaModel.has(k) || !sets.PlatformUserModel.has(k));

printSet('Rutas protegidas sin default en Command Center', appNotInCC);
printSet('Rutas protegidas no presentes en modelos backend', appNotInModels);

process.exit(1);
