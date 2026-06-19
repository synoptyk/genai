#!/usr/bin/env node

/**
 * 🔐 SECURITY AUDIT SCRIPT
 * Ejecuta un escaneo de seguridad completo
 * 
 * Uso: npm run security:audit
 *      node scripts/security-audit.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: path.resolve('server/.env') });
dotenv.config({ path: path.resolve('client/.env') });

// Colores
const colors = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m'
};

let totalIssues = 0;
let totalWarnings = 0;

function log(type, message, details = '') {
  const icons = {
    error: '❌',
    warning: '⚠️ ',
    success: '✅',
    info: 'ℹ️ '
  };

  const colors_map = {
    error: colors.RED,
    warning: colors.YELLOW,
    success: colors.GREEN,
    info: colors.BLUE
  };

  console.log(`${colors_map[type]}${icons[type]} ${message}${colors.RESET}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

function heading(title) {
  console.log(`\n${colors.BLUE}${'═'.repeat(70)}${colors.RESET}`);
  console.log(`${colors.BLUE}${title}${colors.RESET}`);
  console.log(`${colors.BLUE}${'═'.repeat(70)}${colors.RESET}\n`);
}

// ============================================================================
// 1. VERIFICAR ARCHIVOS .ENV EN REPOSITORIO
// ============================================================================

heading('1️⃣  VALIDANDO ARCHIVOS .ENV EN REPOSITORIO');

function checkEnvFiles() {
  const envFiles = [
    '.env',
    'server/.env',
    'client/.env',
    'mobile/.env'
  ];

  const tracked = [];
  const untracked = [];

  for (const file of envFiles) {
    if (!fs.existsSync(file)) continue;

    try {
      execSync(`git ls-files --error-unmatch --cached -- ${file}`, { stdio: 'ignore' });
      tracked.push(file);
    } catch {
      untracked.push(file);
    }
  }

  if (tracked.length > 0) {
    log('error', 'Archivos .env están en el repositorio:', tracked.join(', '));
    totalIssues++;
  } else {
    log('success', 'Ningún archivo .env está trackeado en git');
  }

  if (untracked.length > 0) {
    log('warning', 'Archivos .env locales no trackeados:', untracked.join(', '));
  }
}

checkEnvFiles();

// ============================================================================
// 2. DETECTAR SECRETOS EN CÓDIGO
// ============================================================================

heading('2️⃣  ESCANEANDO EN BUSCA DE SECRETOS EN CÓDIGO');

function collectCodeFiles(dir, extensions, ignoredPaths) {
  const normalizedIgnored = ignoredPaths.map(p => p.replace(/\/+$|^\.*$/, ''));
  const result = [];

  function walk(current) {
    const stats = fs.statSync(current);
    const relative = path.relative('.', current);
    const segments = relative.split(path.sep);

    if (stats.isDirectory()) {
      if (segments.some(segment => normalizedIgnored.includes(segment))) {
        return;
      }

      fs.readdirSync(current).forEach(entry => walk(path.join(current, entry)));
      return;
    }

    if (stats.isFile() && extensions.includes(path.extname(current))) {
      result.push(current);
    }
  }

  walk(dir);
  return result;
}

function scanForSecrets() {
  const patterns = [
    { regex: /mongodb:\/\/[^"'\s]+:[^"'\s]+@/gi, name: 'MongoDB URI' },
    { regex: /(?<!["'])\bmongo_uri\b\s*=\s*['"][^'"\n]+['"]/gi, name: 'Mongo URI Assignment' },
    { regex: /(?<!["'])\bjwt_secret\b\s*[=:]\s*['"][^'"\n]{10,}['"]/gi, name: 'JWT Secret' },
    { regex: /AIzaSy[A-Za-z0-9_-]{35}/g, name: 'Google API Key' },
    { regex: /gsk_[A-Za-z0-9]{32,}/g, name: 'Groq API Key' },
    { regex: /GOCSPX-[A-Za-z0-9_-]{20,}/g, name: 'Google OAuth Secret' },
    { regex: /(?<!["'])\bpassword\b\s*[=:]\s*['"][^'"\n]{5,}['"]/gi, name: 'Password' },
    { regex: /(?<!["'])\bapi_key\b\s*[=:]\s*['"][^'"\n]{10,}['"]/gi, name: 'API Key' },
    { regex: /(?<!["'])\bsecret\b\s*[=:]\s*['"][^'"\n]{10,}['"]/gi, name: 'Secret' }
  ];

  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];
  const directories = ['server', 'client', 'mobile', 'src', 'scratch'];
  const ignoredPaths = ['node_modules', '.gradle', '.cache', '.claude', 'logs', 'dist', 'build', '~', 'android', 'ios'];
  let secretsFound = 0;

  for (const pattern of patterns) {
    for (const dir of directories) {
      if (!fs.existsSync(dir)) continue;

      const files = collectCodeFiles(dir, extensions, ignoredPaths);

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const matches = content.match(pattern.regex);

          if (matches) {
            log('error', `Posible secreto detectado en ${file}:`, pattern.name);
            secretsFound++;
            totalIssues++;
          }
        } catch (e) {
          // Ignorar errores de lectura
        }
      }
    }
  }

  if (secretsFound === 0) {
    log('success', 'No se detectaron secretos en el código');
  }
}

scanForSecrets();

// ============================================================================
// 3. VALIDAR TAMAÑO DE ARCHIVOS
// ============================================================================

heading('3️⃣  VALIDANDO TAMAÑO DE ARCHIVOS');

function findLargeFiles(dir, maxSize, ignoredDirs) {
  const result = [];

  function walk(current) {
    const stats = fs.statSync(current);
    const relative = path.relative('.', current);
    const segments = relative.split(path.sep);

    if (segments.some(segment => ignoredDirs.includes(segment))) {
      return;
    }

    if (stats.isDirectory()) {
      fs.readdirSync(current).forEach(entry => walk(path.join(current, entry)));
      return;
    }

    if (stats.isFile() && stats.size > maxSize) {
      result.push({ file: current, size: stats.size });
    }
  }

  walk(dir);
  return result;
}

function checkFileSizes() {
  const maxSize = 50 * 1024 * 1024; // 50 MB
  const ignoredDirs = ['node_modules', '.git', 'build', 'dist', '.cache', '.claude'];
  const largeFiles = findLargeFiles('.', maxSize, ignoredDirs);

  if (largeFiles.length > 0) {
    log('warning', `${largeFiles.length} archivos mayores a 50MB encontrados`);
    largeFiles.forEach(f => {
      log('info', `${f.file} (${(f.size / 1024 / 1024).toFixed(2)} MB)`);
      totalWarnings++;
    });
  } else {
    log('success', 'Todos los archivos tienen tamaño apropiado');
  }
}

checkFileSizes();

// ============================================================================
// 4. VERIFICAR GITIGNORE
// ============================================================================

heading('4️⃣  VALIDANDO .GITIGNORE');

function checkGitignore() {
  const criticalPatterns = ['.env', '*.key', 'secrets.json', 'credentials.json'];
  const gitignorePath = '.gitignore';

  if (!fs.existsSync(gitignorePath)) {
    log('warning', '.gitignore no encontrado');
    totalWarnings++;
    return;
  }

  const content = fs.readFileSync(gitignorePath, 'utf8');
  const missing = [];

  for (const pattern of criticalPatterns) {
    if (!content.includes(pattern)) {
      missing.push(pattern);
    }
  }

  if (missing.length > 0) {
    log('warning', `Patrones de seguridad faltantes en .gitignore:`, missing.join(', '));
    totalWarnings++;
  } else {
    log('success', 'Todos los patrones críticos están en .gitignore');
  }
}

checkGitignore();

// ============================================================================
// 5. VERIFICAR DEPENDENCIAS VULNERABLES
// ============================================================================

heading('5️⃣  ESCANEANDO DEPENDENCIAS VULNERABLES');

function checkVulnerabilities() {
  let output = '';
  try {
    output = execSync('npm audit --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    output = error.stdout ? error.stdout.toString() : '';
  }

  if (!output) {
    log('warning', 'npm audit no devolvió un reporte JSON válido');
    return;
  }

  try {
    const result = JSON.parse(output);

    if (result.metadata?.vulnerabilities) {
      const critical = result.metadata.vulnerabilities.critical || 0;
      const high = result.metadata.vulnerabilities.high || 0;
      const medium = result.metadata.vulnerabilities.medium || 0;

      if (critical > 0) {
        log('error', `${critical} vulnerabilidades CRÍTICAS encontradas`);
        totalIssues += critical;
      }

      if (high > 0) {
        log('warning', `${high} vulnerabilidades ALTAS encontradas`);
        totalWarnings += high;
      }

      if (medium > 0) {
        log('info', `${medium} vulnerabilidades MEDIAS encontradas`);
      }

      if (critical === 0 && high === 0 && medium === 0) {
        log('success', 'No se detectaron vulnerabilidades en dependencias');
      }
    } else {
      log('success', 'No se detectaron vulnerabilidades en dependencias');
    }
  } catch (parseError) {
    log('warning', 'npm audit devolvió JSON inválido');
    log('info', parseError.message);
  }
}

checkVulnerabilities();

// ============================================================================
// 6. VERIFICAR VARIABLES DE ENTORNO REQUERIDAS
// ============================================================================

heading('6️⃣  VALIDANDO VARIABLES DE ENTORNO REQUERIDAS');

function checkRequiredEnvVars() {
  const required = [
    'MONGO_URI',
    'JWT_SECRET',
    'NODE_ENV'
  ];

  const optional = [
    'GEMINI_API_KEY',
    'GROQ_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'SMTP_HOST'
  ];

  const missing = [];
  const present = [];

  for (const varName of required) {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    log('warning', `Variables requeridas faltantes: ${missing.join(', ')}`);
    totalWarnings += missing.length;
  } else {
    log('success', 'Todas las variables requeridas están configuradas');
  }

  const optionalPresent = optional.filter(v => process.env[v]);
  if (optionalPresent.length > 0) {
    log('info', `${optionalPresent.length} integraciones opcionales configuradas`);
  }
}

checkRequiredEnvVars();

// ============================================================================
// 7. VERIFICAR GIT HISTORY
// ============================================================================

heading('7️⃣  ESCANEANDO GIT HISTORY');

function checkGitHistory() {
  const patterns = ['.env', 'password', 'secret', 'api_key'];

  try {
    let suspiciousCommits = 0;

    for (const pattern of patterns) {
      try {
        execSync(`git log -p --all -S${pattern} -- | head -1`, { stdio: 'ignore' });
        suspiciousCommits++;
      } catch {
        // No encontrado
      }
    }

    if (suspiciousCommits > 0) {
      log('warning', 'Git history contiene commits sospechosos');
      log('info', 'Ejecutar: git log --all -S"pattern" para revisar');
      totalWarnings++;
    } else {
      log('success', 'Git history parece limpio de secretos');
    }
  } catch {
    log('info', 'No se pudo escanear git history completamente');
  }
}

checkGitHistory();

// ============================================================================
// RESUMEN FINAL
// ============================================================================

heading('📊 RESUMEN DE AUDITORÍA');

console.log(`${colors.RED}Errores Críticos: ${totalIssues}${colors.RESET}`);
console.log(`${colors.YELLOW}Advertencias: ${totalWarnings}${colors.RESET}`);

const total = totalIssues + totalWarnings;

if (totalIssues === 0 && totalWarnings === 0) {
  log('success', 'AUDITORÍA COMPLETADA - No se encontraron problemas de seguridad');
  process.exit(0);
} else if (totalIssues === 0) {
  log('warning', 'AUDITORÍA COMPLETADA - Pero hay advertencias');
  process.exit(0);
} else {
  log('error', `AUDITORÍA COMPLETADA - ${totalIssues} problemas críticos encontrados`);
  log('info', 'Ejecutar: npm run security:fix para intentar reparar automáticamente');
  process.exit(1);
}
