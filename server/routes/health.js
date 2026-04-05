/**
 * Health Check & Monitoring Routes
 * Endpoints para monitoreo de salud del sistema
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');

// Memoria y CPU
const getSystemStats = () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    memory: {
      total: `${(totalMem / 1024 / 1024).toFixed(2)} MB`,
      used: `${(usedMem / 1024 / 1024).toFixed(2)} MB`,
      free: `${(freeMem / 1024 / 1024).toFixed(2)} MB`,
      usage_percent: ((usedMem / totalMem) * 100).toFixed(2),
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model,
      load: os.loadavg().map(l => l.toFixed(2)),
      uptime: os.uptime(),
    },
    platform: {
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
    },
  };
};

// Estado de MongoDB
const getMongoStatus = async () => {
  try {
    const conn = mongoose.connection;
    const stats = {
      connected: conn.readyState === 1,
      host: conn.host,
      name: conn.name,
      port: conn.port,
    };

    if (stats.connected) {
      const collections = await conn.db.listCollections().toArray();
      stats.collections = collections.length;
      stats.collections_list = collections.map(c => c.name);
    }

    return stats;
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
};

// Estado de bots
const getBotStatus = () => {
  return {
    toa_bot: {
      enabled: true,
      schedule: '0 23 * * *',
      timezone: 'America/Santiago',
    },
    gps_bot: {
      enabled: false,
      reason: 'Disabled temporarily - causes event loop blocking',
      todo: 'Migrate to child_process.fork() before reactivating',
    },
  };
};

// GET /api/health - Health check básico
router.get('/', (req, res) => {
  const status = mongoose.connection.readyState === 1 ? 'healthy' : 'degraded';
  
  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.5.0',
  });
});

// GET /api/health/detailed - Health check detallado
router.get('/detailed', async (req, res) => {
  const [mongo, system, bots] = await Promise.all([
    getMongoStatus(),
    Promise.resolve(getSystemStats()),
    Promise.resolve(getBotStatus()),
  ]);

  const isHealthy = mongo.connected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.5.0',
    services: {
      mongodb: mongo,
      system: system,
      bots: bots,
    },
  });
});

// GET /api/health/metrics - Métricas para monitoreo
router.get('/metrics', async (req, res) => {
  const memUsage = process.memoryUsage();
  
  const metrics = {
    process: {
      memory: {
        heap_used: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      uptime: process.uptime(),
      pid: process.pid,
    },
    system: getSystemStats(),
    mongo: {
      connected: mongoose.connection.readyState === 1,
      pool_size: mongoose.connection.client.s.options.maxPoolSize,
    },
  };

  res.json(metrics);
});

// GET /api/health/ping - Ping simple
router.get('/ping', (req, res) => {
  res.json({
    pong: true,
    timestamp: Date.now(),
  });
});

module.exports = router;
