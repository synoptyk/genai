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
const write = (p, data) => fs.writeFileSync(p, data, 'utf8');

// 1. Remove rrhh_seguridad_ppe from models and CommandCenter
for (const file of [files.empresaModel, files.userModel, files.commandCenter]) {
  let content = read(file);
  content = content.replace(/\n\s*rrhh_seguridad_ppe:\s*\{\s*ver:\s*false,\s*crear:\s*false,\s*editar:\s*false,\s*bloquear:\s*false,\s*eliminar:\s*false\s*\},?/g, '');
  content = content.replace(/\{ id: 'rrhh_seguridad_ppe',\s*label:[^}]+},?/g, '');
  content = content.replace(/\{ id: 'rrhh_seguridad_ppe' \},?/g, '');
  write(file, content);
}

// 2. Remove rrhh_seguridad_ppe from AppRoutes
let appContent = read(files.app);
appContent = appContent.replace(/<Route path="\/[^"]+"\s+element=\{\s*<ProtectedRoute allowPermissions=\{?\['rrhh_seguridad_ppe'\]\}?>[\s\S]*?<\/ProtectedRoute>\s*\}\s*\/>/g, '');
write(files.app, appContent);

console.log('Removed rrhh_seguridad_ppe');
