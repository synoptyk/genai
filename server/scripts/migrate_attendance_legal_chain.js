#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const mongoose = require('mongoose');
const RegistroAsistencia = require('../platforms/rrhh/models/RegistroAsistencia');

const LEGAL_ALLOWED_FIELDS = [
  'estado',
  'horaEntrada',
  'horaIngresoDeclarada',
  'horaSalida',
  'turnoId',
  'observacion',
  'tipoAusencia',
  'descuentaDia',
  'minutosTardanza',
  'horasExtra',
  'estadoHorasExtra',
  'horasExtraAprobadas',
  'validadoPor',
  'estadoDia',
  'syncFromProduccion',
  'estadoRegistro'
];

const DEFAULT_BATCH = 200;

function parseArgs(argv) {
  const args = {
    dryRun: false,
    apply: false,
    verifyOnly: false,
    rebuild: true,
    batch: DEFAULT_BATCH,
    empresaRef: null,
    from: null,
    to: null,
    limit: null
  };

  argv.forEach((arg) => {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--verify-only') args.verifyOnly = true;
    else if (arg === '--no-rebuild') args.rebuild = false;
    else if (arg.startsWith('--batch=')) args.batch = Math.max(10, Number(arg.split('=')[1]) || DEFAULT_BATCH);
    else if (arg.startsWith('--empresa=')) args.empresaRef = arg.split('=')[1];
    else if (arg.startsWith('--from=')) args.from = new Date(arg.split('=')[1]);
    else if (arg.startsWith('--to=')) args.to = new Date(arg.split('=')[1]);
    else if (arg.startsWith('--limit=')) args.limit = Math.max(1, Number(arg.split('=')[1]) || 1);
  });

  if (!args.verifyOnly && !args.apply && !args.dryRun) {
    args.dryRun = true;
  }

  if (args.verifyOnly) {
    args.dryRun = false;
    args.apply = false;
  }

  return args;
}

function normalizeForHash(value) {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach((k) => {
      out[k] = normalizeForHash(value[k]);
    });
    return out;
  }
  return value;
}

function sha256Hex(payload) {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function toPrimitive(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value.toString && value.toString !== Object.prototype.toString) {
    if (value._bsontype === 'ObjectId') return String(value);
  }
  return value;
}

function snapshotFromRecord(record) {
  const out = {};
  LEGAL_ALLOWED_FIELDS.forEach((field) => {
    if (record[field] !== undefined) out[field] = toPrimitive(record[field]);
  });
  if (!out.estadoRegistro) out.estadoRegistro = 'ACTIVO';
  return out;
}

function snapshotFromEvent(ev, baseSnapshot) {
  const next = { ...(baseSnapshot || {}) };

  if (ev.estadoSeleccionado) next.estado = ev.estadoSeleccionado;
  if (ev.hora && !next.horaEntrada) next.horaEntrada = ev.hora;
  if (ev.observacion) next.observacion = ev.observacion;

  if (ev.snapshotDespues && typeof ev.snapshotDespues === 'object') {
    Object.keys(ev.snapshotDespues).forEach((k) => {
      next[k] = toPrimitive(ev.snapshotDespues[k]);
    });
  }

  if (!next.estadoRegistro) next.estadoRegistro = 'ACTIVO';
  return next;
}

function buildEventHash({ hashPrevio, tipo, timestampIso, actor, snapshotDespues }) {
  const hashBase = normalizeForHash({
    hashPrevio,
    tipo,
    timestamp: timestampIso,
    actor,
    snapshotDespues
  });
  return sha256Hex(JSON.stringify(hashBase));
}

function rebuildTimeline(record, rebuildMode = true) {
  const events = Array.isArray(record.eventosTimeline) ? record.eventosTimeline : [];
  const baseSnapshot = snapshotFromRecord(record);

  let prevHash = 'GENESIS';
  let prevSnapshot = null;
  const rebuilt = [];

  const sourceEvents = events.length > 0 ? events : [{
    tipo: 'Migracion Cadena Legal v1',
    hora: record.horaIngresoDeclarada || record.horaEntrada || record.horaSalida || '00:00',
    estadoSeleccionado: record.estado || 'Presente',
    observacion: 'Evento base creado por migración de integridad legal',
    registradoPor: 'sistema-migracion',
    timestamp: record.updatedAt || record.createdAt || new Date(),
    snapshotDespues: baseSnapshot
  }];

  for (let i = 0; i < sourceEvents.length; i += 1) {
    const ev = sourceEvents[i] || {};
    const ts = ev.timestamp ? new Date(ev.timestamp) : new Date();
    const timestampIso = Number.isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();
    const actor = ev.registradoPor || 'sistema-migracion';
    const tipo = ev.tipo || 'Evento Migrado';
    const snapshotAntes = prevSnapshot ? { ...prevSnapshot } : null;
    const snapshotDespues = snapshotFromEvent(ev, prevSnapshot || baseSnapshot);

    const hashPrevio = prevHash;
    const hashActual = buildEventHash({
      hashPrevio,
      tipo,
      timestampIso,
      actor,
      snapshotDespues
    });

    const migratedEvent = {
      ...ev,
      tipo,
      registradoPor: actor,
      timestamp: new Date(timestampIso),
      snapshotAntes,
      snapshotDespues,
      hashPrevio,
      hashActual
    };

    if (!rebuildMode && ev.hashActual && ev.hashPrevio) {
      migratedEvent.hashPrevio = ev.hashPrevio;
      migratedEvent.hashActual = ev.hashActual;
    }

    prevHash = migratedEvent.hashActual;
    prevSnapshot = snapshotDespues;
    rebuilt.push(migratedEvent);
  }

  const currentAuditLog = record.auditLog && typeof record.auditLog === 'object' ? { ...record.auditLog } : {};
  const auditLog = {
    ...currentAuditLog,
    timestamp: currentAuditLog.timestamp || record.updatedAt || new Date(),
    metodo: currentAuditLog.metodo || 'Web',
    ultimoEventoHash: prevHash
  };

  return {
    eventosTimeline: rebuilt,
    auditLog,
    estadoRegistro: record.estadoRegistro || 'ACTIVO'
  };
}

function verifyRecord(record) {
  const events = Array.isArray(record.eventosTimeline) ? record.eventosTimeline : [];
  let prev = 'GENESIS';
  const inconsistencias = [];

  events.forEach((ev, idx) => {
    const ts = ev.timestamp ? new Date(ev.timestamp) : null;
    const timestampIso = ts && !Number.isNaN(ts.getTime()) ? ts.toISOString() : null;

    if (!timestampIso) {
      inconsistencias.push(`Evento ${idx + 1}: timestamp inválido`);
      return;
    }

    const hashPrevio = ev.hashPrevio || prev;
    const expected = buildEventHash({
      hashPrevio,
      tipo: ev.tipo,
      timestampIso,
      actor: ev.registradoPor || 'sistema-migracion',
      snapshotDespues: ev.snapshotDespues || {}
    });

    if (hashPrevio !== prev) {
      inconsistencias.push(`Evento ${idx + 1}: hashPrevio no coincide`);
    }

    if ((ev.hashActual || '') !== expected) {
      inconsistencias.push(`Evento ${idx + 1}: hashActual inválido`);
    }

    prev = ev.hashActual || prev;
  });

  const lastHash = record.auditLog?.ultimoEventoHash || null;
  if (events.length === 0) {
    inconsistencias.push('Registro sin eventosTimeline');
  }
  if (!lastHash) {
    inconsistencias.push('auditLog.ultimoEventoHash ausente');
  } else if (prev !== lastHash) {
    inconsistencias.push('auditLog.ultimoEventoHash no coincide con cadena');
  }

  return {
    ok: inconsistencias.length === 0,
    inconsistencias,
    totalEventos: events.length
  };
}

async function connect() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGO_URI/MONGODB_URI no configurado');
  }
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 60000,
    connectTimeoutMS: 60000,
    socketTimeoutMS: 300000,
    retryWrites: true,
    w: 'majority'
  });
}

async function runVerifyOnly(filter, batch) {
  let scanned = 0;
  let invalid = 0;
  let hasMore = true;
  let lastId = null;
  const badSamples = [];

  while (hasMore) {
    const f = { ...filter };
    if (lastId) f._id = { $gt: lastId };

    const docs = await RegistroAsistencia.find(f)
      .sort({ _id: 1 })
      .limit(batch)
      .lean();

    if (!docs.length) break;

    docs.forEach((doc) => {
      scanned += 1;
      const ver = verifyRecord(doc);
      if (!ver.ok) {
        invalid += 1;
        if (badSamples.length < 20) {
          badSamples.push({ id: String(doc._id), inconsistencias: ver.inconsistencias });
        }
      }
    });

    lastId = docs[docs.length - 1]._id;
    hasMore = docs.length === batch;
  }

  console.log('\n=== VERIFICACION LEGAL ===');
  console.log(`Registros escaneados: ${scanned}`);
  console.log(`Registros invalidos: ${invalid}`);
  if (badSamples.length) {
    console.log('Muestras de inconsistencias:');
    badSamples.forEach((b) => {
      console.log(`- ${b.id}: ${b.inconsistencias.join(' | ')}`);
    });
  }

  return invalid === 0;
}

async function runMigration(args) {
  const filter = {};
  if (args.empresaRef) filter.empresaRef = new mongoose.Types.ObjectId(args.empresaRef);
  if (args.from || args.to) {
    filter.fecha = {};
    if (args.from) filter.fecha.$gte = args.from;
    if (args.to) filter.fecha.$lte = args.to;
  }

  let processed = 0;
  let changed = 0;
  let hasMore = true;
  let lastId = null;
  const ops = [];

  while (hasMore) {
    const f = { ...filter };
    if (lastId) f._id = { $gt: lastId };

    const docs = await RegistroAsistencia.find(f)
      .sort({ _id: 1 })
      .limit(args.batch)
      .lean();

    if (!docs.length) break;

    for (const doc of docs) {
      if (args.limit && processed >= args.limit) {
        hasMore = false;
        break;
      }

      processed += 1;
      const migrated = rebuildTimeline(doc, args.rebuild);

      const isChanged =
        (doc.estadoRegistro || 'ACTIVO') !== migrated.estadoRegistro ||
        JSON.stringify(doc.auditLog || {}) !== JSON.stringify(migrated.auditLog || {}) ||
        JSON.stringify(doc.eventosTimeline || []) !== JSON.stringify(migrated.eventosTimeline || []);

      if (isChanged) {
        changed += 1;
        if (args.apply) {
          ops.push({
            updateOne: {
              filter: { _id: doc._id },
              update: {
                $set: {
                  estadoRegistro: migrated.estadoRegistro,
                  auditLog: migrated.auditLog,
                  eventosTimeline: migrated.eventosTimeline
                }
              }
            }
          });
        }
      }

      if (ops.length >= args.batch) {
        await RegistroAsistencia.bulkWrite(ops, { ordered: false });
        ops.length = 0;
      }
    }

    lastId = docs[docs.length - 1]._id;
    hasMore = hasMore && docs.length === args.batch;
    console.log(`Procesados: ${processed} | Con cambios: ${changed}`);
  }

  if (args.apply && ops.length) {
    await RegistroAsistencia.bulkWrite(ops, { ordered: false });
  }

  return { filter, processed, changed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log('Modo:', args.verifyOnly ? 'VERIFY_ONLY' : args.apply ? 'APPLY' : 'DRY_RUN');
  console.log('Batch:', args.batch, '| Rebuild:', args.rebuild ? 'YES' : 'NO');

  await connect();
  console.log('Conectado a MongoDB');

  if (args.verifyOnly) {
    const filter = {};
    if (args.empresaRef) filter.empresaRef = new mongoose.Types.ObjectId(args.empresaRef);
    if (args.from || args.to) {
      filter.fecha = {};
      if (args.from) filter.fecha.$gte = args.from;
      if (args.to) filter.fecha.$lte = args.to;
    }
    const ok = await runVerifyOnly(filter, args.batch);
    await mongoose.disconnect();
    process.exit(ok ? 0 : 2);
  }

  const result = await runMigration(args);
  console.log('\n=== RESUMEN MIGRACION ===');
  console.log('Filtro aplicado:', JSON.stringify(result.filter));
  console.log('Registros procesados:', result.processed);
  console.log('Registros con cambios:', result.changed);

  if (!args.apply) {
    console.log('\nDRY RUN finalizado. No se escribieron cambios en la base de datos.');
  } else {
    console.log('\nAplicacion completada. Ejecutando verificacion post-migracion...');
    const ok = await runVerifyOnly(result.filter, args.batch);
    if (!ok) {
      console.error('Verificacion post-migracion detecto inconsistencias.');
      await mongoose.disconnect();
      process.exit(3);
    }
    console.log('Verificacion post-migracion OK. Cadena legal consistente.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Error en migracion legal de asistencia:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
