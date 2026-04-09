const BonoConfig = require('../models/BonoConfig');
const TipoBono = require('../models/TipoBono');
const ModeloBonificacion = require('../models/ModeloBonificacion');
const mongoose = require('mongoose');

/**
 * 🚀 CONTROLLER MAESTRO DE BONIFICACIONES (v5.0)
 */

// GET all for empresa
exports.getAll = async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    let items = await BonoConfig.find({ empresaRef: empresaId }).sort({ nombre: 1 });
    
    // Safety check: Filter out duplicates in results if database is cluttered
    // Although we should fix the root cause, this ensures a clean UI immediately
    const uniqueMap = new Map();
    items = items.filter(item => {
      if (uniqueMap.has(item.nombre)) return false;
      uniqueMap.set(item.nombre, true);
      return true;
    });

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET by ID
exports.getById = async (req, res) => {
  try {
    const item = await BonoConfig.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CREATE
exports.create = async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const item = new BonoConfig({ ...req.body, empresaRef: empresaId });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// UPDATE
exports.update = async (req, res) => {
  try {
    const item = await BonoConfig.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedAt: new Date() }, 
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE
exports.delete = async (req, res) => {
  try {
    const item = await BonoConfig.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json({ message: 'Bonificación eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🔄 MIGRACIÓN: Unifica TipoBono + ModeloBonificacion
 * Este endpoint permite a la empresa migrar sus reglas antiguas al nuevo motor potente.
 */
exports.migrateLegacy = async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    
    // 1. Obtener modelos antiguos
    const modelos = await ModeloBonificacion.find({ empresaRef: empresaId }).populate('tipoBonoRef');
    const tiposBono = await TipoBono.find({ empresaRef: empresaId });
    
    const existingBonos = await BonoConfig.find({ empresaRef: empresaId });
    const existingNames = existingBonos.map(b => b.nombre);

    let migrados = 0;
    
    // 2. Mapear Modelos a la nueva estructura
    for (const mod of modelos) {
      if (existingNames.includes(mod.nombre)) continue;
      
      const type = mod.tipoBonoRef || {};
      
      const newBono = new BonoConfig({
        nombre:      mod.nombre,
        description: mod.description || type.descripcion,
        empresaRef:  empresaId,
        activo:      mod.activo,
        color:       mod.color,
        category:    (type.tipo === 'NO_IMPONIBLE' ? 'REEMBOLSO' : 'INCENTIVO'),
        
        payroll: {
          codigoDT:         type.codigoDT || '1040',
          tipo:             type.tipo || 'IMPONIBLE',
          frecuencia:       type.frecuencia || 'MENSUAL',
          pagoProporcional: type.pagoProporcional ?? true,
          baseLegal:        type.baseLegal,
          observacionDT:    type.observacionDT,
          limiteReferencial: type.limiteReferencial,
          avisoLegal:       type.avisoLegal
        },
        
        strategy: mod.tipo, 
        config: {
          monto:            mod.bonoFijo?.monto || 0,
          tramosBaremos:    mod.tramosBaremos,
          puntosExcluidos:  mod.puntosExcluidos,
          tramosCalidad:    (mod.tramosRR || []).concat(mod.tramosAI || []),
          comision:         mod.comision,
          metaKpi:          mod.metaKpi,
          escalaAntiguedad: mod.escalaAntiguedad
        },
        
        targeting: mod.aplicaA,
        integration: {
          esModuloProduccion: type.esModuloProduccion || false,
          source: (type.esModuloProduccion ? 'TOA_BOT' : 'SOLICITUD_MANUAL')
        }
      });
      
      await newBono.save();
      migrados++;
      existingNames.push(mod.nombre);
    }
    
    // 3. Tipos de Bono que no estaban vinculados a Modelos (Bonos Legales directos)
    for (const tipo of tiposBono) {
      if (!existingNames.includes(tipo.nombre)) {
        const newBono = new BonoConfig({
          nombre:      tipo.nombre,
          description: tipo.descripcion,
          empresaRef:  empresaId,
          activo:      tipo.activo,
          category:    (tipo.tipo === 'NO_IMPONIBLE' ? 'REEMBOLSO' : 'REMUNERACIÓN'),
          
          payroll: {
            codigoDT:         tipo.codigoDT || '1040',
            tipo:             tipo.tipo || 'IMPONIBLE',
            frecuencia:       tipo.frecuencia || 'MENSUAL',
            pagoProporcional: tipo.pagoProporcional ?? true,
            baseLegal:        tipo.baseLegal,
            observacionDT:    tipo.observacionDT,
            limiteReferencial: tipo.limiteReferencial
          },
          
          strategy: 'FIJO',
          config: { monto: 0 },
          integration: { esModuloProduccion: tipo.esModuloProduccion || false }
        });
        await newBono.save();
        migrados++;
        existingNames.push(tipo.nombre);
      }
    }

    res.json({ message: migrados > 0 ? `Migración exitosa: ${migrados} bonificaciones unificadas.` : 'No se encontraron bonificaciones nuevas para migrar.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
