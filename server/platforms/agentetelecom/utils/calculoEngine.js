const mongoose = require('mongoose');

// Cache local de tarifas
const _tarifaCache = {};

/**
 * Obtiene las tarifas LPU de una empresa con cache de 5 minutos
 */
async function obtenerTarifasEmpresa(empresaId, TarifaLPU) {
    const key = String(empresaId);
    const now = Date.now();
    if (_tarifaCache[key] && (now - _tarifaCache[key].ts) < 300000) return _tarifaCache[key].data;
    
    const tarifas = await TarifaLPU.find({ empresaRef: empresaId, activo: true }).lean();
    _tarifaCache[key] = { data: tarifas, ts: now };
    return tarifas;
}

/**
 * Parsea el XML de Productos_y_Servicios_Contratados de TOA
 */
function parsearProductosServiciosTOA(xmlStr) {
    if (!xmlStr || typeof xmlStr !== 'string' || !xmlStr.includes('<ProductService>')) return null;
    const productos = [];
    const regex = /<ProductService>([\s\S]*?)<\/ProductService>/g;
    let match;
    while ((match = regex.exec(xmlStr)) !== null) {
        const bloque = match[1];
        const get = (tag) => { 
            const m = bloque.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'i')); 
            return m ? m[1].trim().replace(/_+$/g, '') : ''; 
        };
        
        const monto = get('Monto') || get('Precio') || get('Price') || '';
        const tipoPreco = get('TipoPrecio') || get('TipoPrecoItem') || get('CON_PRECO') || get('ConPreco') || '';
        const itemConPreco = (tipoPreco && tipoPreco !== '0' && tipoPreco.toUpperCase() !== 'NO') || 
                            (parseFloat(monto) > 0);

        productos.push({ 
            codigo: get('Codigo'), 
            descripcion: get('Descripcion'), 
            familia: get('Familia'), 
            operacion: get('OperacionComercial'), 
            cantidad: parseInt(get('Cantidad')) || 1,
            tipoPrecio: tipoPreco,
            monto: monto,
            conPreco: itemConPreco
        });
    }
    if (!productos.length) return null;

    const altas = productos.filter(p => ['ALTA', 'ADD'].includes(p.operacion?.toUpperCase()));
    const bajas = productos.filter(p => ['BAJA', 'DEL', 'REMOVE'].includes(p.operacion?.toUpperCase()));
    
    const fibAlta = altas.find(p => p.familia === 'FIB' || /INTERNET|BANDA ANCHA/i.test(p.descripcion));
    const velocidadMatch = fibAlta ? fibAlta.descripcion.match(/(\d+\/\d+|\d+\s?MEGAS|\d+\s?GIGA)/i) : null;
    const velocidadInternet = velocidadMatch ? velocidadMatch[0] : (fibAlta ? fibAlta.descripcion : '');
    
    const tvAlta = altas.find(p => p.familia === 'IPTV' || /TV|TELEVISION/i.test(p.descripcion));
    const toipAlta = altas.find(p => p.familia === 'TOIP' || /TELEFONIA|VOZ/i.test(p.descripcion));
    const equiposFiltrados = altas.filter(p => {
        const desc = (p.descripcion || '').toUpperCase();
        const familia = (p.familia || '').toUpperCase();
        const esHardware = familia === 'EQ' || /EQUIPO|DECO|MODEM|ROUTER|EXTENSOR|EXTENDER|IPTV|DTA|STB|MESH|WIFI|PUNTO.ACCESO/i.test(desc);
        const esAccesorio = /CONTROL|REMOTO|FUENTE|PODER|CABLE|HDMI|SPLITTER|CONECTOR|PATCH|FILTRO|PLACA/i.test(desc);
        return esHardware && !esAccesorio;
    });

    const getEquipos = (reg) => equiposFiltrados.filter(p => reg.test(p.descripcion));
    
    // Decos: Evitar contar el mismo equipo fisico si viene duplicado por servicio
    const decosTodosRaw = getEquipos(/adicional|deco|iptv|dta|stb|receptor|box|streming|android|smart.tv|4k|vip|nagrav|pds/i);
    // Agrupar por descripción para evitar duplicidad de items idénticos en el mismo bloque XML si TOA los repite
    const decosTodos = [];
    const seenDecos = new Set();
    decosTodosRaw.forEach(d => {
        if (!seenDecos.has(d.descripcion)) {
            decosTodos.push(d);
            seenDecos.add(d.descripcion);
        }
    });

    const repetidores = getEquipos(/repetidor|extensor|extender|wifi|mesh|punto.acceso|access.point|amplificador|modul.wifi|repro.senal/i)
        .filter(p => !/deco|iptv|stb|receptor|box/i.test(p.descripcion));
        
    const telefonosTodos = getEquipos(/teléfono|telefono|phone/i);
    const modemArr = equiposFiltrados.filter(p => /modem|módem|ont|hgu|router|gateway/i.test(p.descripcion));
    const modem = modemArr.length > 0 ? modemArr[0] : null;
    
    const getQtyReal = (p) => {
        if (!p) return 0;
        let q = p.cantidad || 1;
        if (q === 1 && p.descripcion) {
            const m = p.descripcion.match(/\(x(\d+)\)/i) || p.descripcion.match(/(\d+)\s?(UNI|UNIDAD|UND|PCS)/i);
            if (m) q = parseInt(m[1]);
        }
        return q;
    };

    let ctWifi = decosTodos.reduce((s, p) => s + getQtyReal(p), 0);
    let ctRepetidores = repetidores.reduce((s, p) => s + getQtyReal(p), 0);
    let ctTelefonos = telefonosTodos.reduce((s, p) => s + getQtyReal(p), 0);

    let tipoOp = 'Alta nueva';
    if (bajas.length > 0 && altas.length > 0) tipoOp = 'Cambio/Migración';
    else if (bajas.length > 0 && altas.length === 0) tipoOp = 'Baja';

    // Descuento de equipo principal (1 Deco o 1 Repetidor no cuentan como adicional en Altas/Migraciones)
    if ((tipoOp === 'Alta nueva' || tipoOp === 'Cambio/Migración') && (ctWifi > 0 || ctRepetidores > 0)) {
        if (ctWifi > 0) ctWifi--; 
        else if (ctRepetidores > 0) ctRepetidores--;
    }

    if (tipoOp === 'Alta nueva' && ctTelefonos > 0) {
        ctTelefonos--;
    }
    
    const tienePreco = decosTodos.some(p => p.conPreco) || repetidores.some(p => p.conPreco) || telefonosTodos.some(p => p.conPreco);
    
    return {
        'Velocidad_Internet': velocidadInternet, 
        'Plan_TV': tvAlta ? tvAlta.descripcion : '', 
        'Telefonia': toipAlta ? toipAlta.descripcion : '',
        'Modem': modem ? modem.descripcion : '', 
        'Deco_Principal': (tipoOp === 'Alta nueva' || tipoOp === 'Cambio/Migración') ? 'Sí' : 'No',
        'Decos_Cable_Adicionales': '0',
        'Decos_WiFi_Adicionales': String(Math.max(0, ctWifi)),
        'Decos_Adicionales': String(Math.max(0, ctWifi)),
        'Repetidores_WiFi': String(Math.max(0, ctRepetidores)), 
        'Telefonos': String(Math.max(0, ctTelefonos)),
        'Total_Equipos_Extras': String(Math.max(0, ctWifi + ctRepetidores + ctTelefonos)), 
        'Tipo_Operacion': tipoOp,
        'Con_Preco': tienePreco ? 'SI' : 'NO',
        'Equipos_Detalle': `[${tipoOp}] ` + equiposFiltrados.map(p => {
            const q = getQtyReal(p);
            return `${p.descripcion}${q > 1 ? ` (x${q})` : ''}${p.conPreco ? ' [CON PRECIO]' : ''}`;
        }).join(' | '),
        'Total_Productos': String(productos.length),
        'Equipos_Codes': equiposFiltrados.map(p => p.codigo).join('|')
    };
}

/**
 * Calcula los puntos LPU (Baremos) para una actividad.
 * Version canónica — usada por todos los módulos (Portal Trabajador, Producción, etc.)
 */
function calcularBaremos(doc, tarifas) {
    if (!tarifas || !tarifas.length) return null;

    // Sanitizar doc para asegurar keys con underscore (mantenemos _id, etc.)
    const clean = {};
    for (const [k, v] of Object.entries(doc)) {
        clean[k.replace(/[\.\s]/g, '_')] = v;
    }

    // Re-parsear XML si faltan campos derivados de equipos
    if ((!clean.Decos_Cable_Adicionales || !clean.Decos_WiFi_Adicionales) &&
        (clean.Productos_y_Servicios_Contratados || clean['Productos_y_Servicios_Contratados'])) {
        const xmlVal = clean.Productos_y_Servicios_Contratados || '';
        const derivados = parsearProductosServiciosTOA(xmlVal);
        if (derivados) {
            Object.assign(clean, derivados);
            // Mantener aliases UPPER para compatibilidad con rutas legacy
            Object.entries(derivados).forEach(([k, v]) => {
                clean[k.toUpperCase().replace(/[\.\s]/g, '_')] = v;
            });
        }
    }

    const tipoTrabajo = clean.Tipo_Trabajo || clean.Tipo_de_Trabajo || clean['Tipo_de_Trabajo'] || '';
    const subtipo     = clean.Subtipo_de_Actividad || clean['Subtipo_de_Actividad'] || '';
    const reutDrop    = (clean['Reutilización_de_Drop'] || clean['Reutilizacion_de_Drop'] || clean['Reutilizacion_de_Drop'] || '').toUpperCase();
    const conPreco    = (clean['Con_Preco'] || '').toUpperCase();

    const decosCableAd = parseInt(clean.Decos_Cable_Adicionales || 0);
    const decosWifiAd  = parseInt(clean.Decos_WiFi_Adicionales  || 0);
    const decosAd      = parseInt(clean.Decos_Adicionales        || 0);
    const repetidores  = parseInt(clean.Repetidores_WiFi         || 0);
    const telefonos    = parseInt(clean.Telefonos                 || 0);

    // Códigos LPU explícitos que puede traer el bot en _productCodes
    const codigosDoc = clean._productCodes || [];

    const tarifasBase   = tarifas.filter(t => !t.mapeo?.es_equipo_adicional);
    const tarifasEquipos = tarifas.filter(t => t.mapeo?.es_equipo_adicional);

    // ── 1. ACTIVIDAD BASE — buscar la tarifa de mayor score ──────────────────
    let mejorMatch = null;
    let mejorScore = -1;

    for (const t of tarifasBase) {
        let score = 0;
        const m = t.mapeo || {};

        // Coincidencia por código LPU explícito (máxima prioridad)
        if (t.codigo && codigosDoc.includes(t.codigo)) {
            score += 100;
        }

        // Coincidencia por Tipo_Trabajo (regex o exacto)
        if (m.tipo_trabajo_pattern) {
            const patterns = m.tipo_trabajo_pattern.split('|');
            const matched = patterns.some(p => {
                const pTrim = p.trim();
                if (pTrim === tipoTrabajo) return true;
                try { return new RegExp('^' + pTrim + '$').test(tipoTrabajo); } catch (_) { return false; }
            });
            if (matched) score += 10;
            else if (score < 100) continue; // sin código explícito ni tipo → descarta
        }

        // Coincidencia por Subtipo_de_Actividad
        if (m.subtipo_actividad) {
            if (subtipo.startsWith(m.subtipo_actividad) || subtipo === m.subtipo_actividad) score += 5;
            else if (!m.tipo_trabajo_pattern && score < 100) continue;
        }

        // Coincidencia por Reutilización DROP
        if (m.requiere_reutilizacion_drop) {
            if (m.requiere_reutilizacion_drop === reutDrop) score += 3;
            else if (reutDrop) score -= 5;
        }

        // Coincidencia por Con_Preco
        if (m.con_preco) {
            if (m.con_preco === conPreco) score += 4;
            else if (conPreco) score -= 5;
        }

        // Coincidencia por familia de producto (TOIP, IPTV, FIB)
        if (m.familia_producto) {
            const famCheck = { 'TOIP': clean.Telefonia, 'IPTV': clean.Plan_TV, 'FIB': clean.Velocidad_Internet };
            if (famCheck[m.familia_producto]) score += 2;
        }

        // Condición extra — evaluada de forma estricta (si no cumple, descarta)
        if (m.condicion_extra) {
            const cond = m.condicion_extra.trim();
            let matchExp = false;
            if (cond.includes('=')) {
                const [key, val] = cond.split('=');
                const docVal = String(clean[key.trim()] || '').toLowerCase();
                matchExp = docVal.includes(val.trim().toLowerCase());
            } else {
                matchExp = JSON.stringify(clean).toLowerCase().includes(cond.toLowerCase());
            }
            if (matchExp) score += 15;
            else continue; // regla estricta: condición no cumplida → descarta
        }

        if (score > mejorScore) { mejorScore = score; mejorMatch = t; }
    }

    const ptsBase    = mejorMatch ? mejorMatch.puntos : 0;
    const codigoBase = mejorMatch ? mejorMatch.codigo : '';
    const descBase   = mejorMatch ? mejorMatch.descripcion : '';

    // ── 2. EQUIPOS ADICIONALES ───────────────────────────────────────────────
    const decosEfectivos = (decosCableAd > 0 || decosWifiAd > 0) ? (decosCableAd + decosWifiAd) : decosAd;

    // Tarifa deco: siempre la de MÍNIMO puntos entre todos los candidatos (WiFi 0.25 gana sobre cable 0.5)
    const decoTarifaWifi = tarifasEquipos
      .filter(t => ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo?.campo_cantidad || ''))
      .sort((a, b) => a.puntos - b.puntos)[0];

    let ptsDecoCable = 0, ptsDecoWifi = 0, ptsRepetidor = 0, ptsTelefono = 0;
    let codigoDecoWifi = '', codigoRepetidor = '';

    // Aplicar tarifa WiFi (mínima) a todos los decos
    if (decoTarifaWifi && decosEfectivos > 0) {
      ptsDecoWifi  = decoTarifaWifi.puntos * decosEfectivos;
      codigoDecoWifi = decoTarifaWifi.codigo;
    }

    for (const t of tarifasEquipos) {
        const campo     = t.mapeo?.campo_cantidad || '';
        const tConPreco = (t.mapeo?.con_preco || '').toUpperCase();
        if (tConPreco && tConPreco !== conPreco) continue;
        // Decos ya calculados arriba con tarifa mínima — solo procesar rep. y tel.
        if (campo === 'Repetidores_WiFi' && repetidores > 0 && !ptsRepetidor) {
            ptsRepetidor   = t.puntos * repetidores;
            codigoRepetidor = t.codigo;
        } else if (campo === 'Telefonos' && telefonos > 0 && !ptsTelefono) {
            ptsTelefono    = t.puntos * telefonos;
        }
    }

    const ptsTotal = Math.round((ptsBase + ptsDecoCable + ptsDecoWifi + ptsRepetidor + ptsTelefono) * 100) / 100;

    return {
        ...clean,
        // Campos baremos (números para cálculos downstream)
        'Pts_Actividad_Base':   ptsBase,
        'Codigo_LPU_Base':      codigoBase,
        'Desc_LPU_Base':        descBase,
        'Pts_Deco_Cable':       ptsDecoCable,
        'Pts_Deco_Adicional':   ptsDecoCable + ptsDecoWifi,   // alias legacy
        'Pts_Deco_WiFi':        ptsDecoWifi,
        'Codigo_LPU_Deco_WiFi': codigoDecoWifi,
        'Pts_Repetidor_WiFi':   ptsRepetidor,
        'Codigo_LPU_Repetidor': codigoRepetidor,
        'Pts_Telefono':         ptsTelefono,
        // Nombre canónico del campo total (ambas variantes para compatibilidad)
        'Pts_Total_Baremo':     ptsTotal,   // nombre usado en DB
        'PTS_TOTAL_BAREMO':     ptsTotal,   // alias UPPER para rutas legacy
    };
}

// Cache de valorización (10 minutos)
const _mapaValorizacionCache = {};

/**
 * Agrega Valor_Actividad_CLP a un doc ya baremizado.
 * mapaValorizacion → resultado de construirMapaValorizacion()
 */
function valorizarBaremos(doc, mapaValorizacion) {
    const base = {
        'Valor_Punto_CLP':  '0',
        'Valor_Actividad_CLP': '0',
        'Retencion_Pct': '0',
        'Retencion_CLP': '0',
        'Valor_Actividad_Neta_CLP': '0',
        'Cliente_Tarifa':   '',
        'Proyecto_Tarifa':  ''
    };
    const ptsTotal  = parseFloat(doc.Pts_Total_Baremo || doc.PTS_TOTAL_BAREMO || 0);
    const idRecurso = doc['ID_Recurso'] || doc['ID Recurso'] || doc['Recurso'] || '';
    if (!idRecurso || !mapaValorizacion || ptsTotal === 0) return base;

    const config = mapaValorizacion[idRecurso];
    if (!config) return base;

    const valorPunto = config.valorPunto || 0;
    const valorBruto = Math.round(ptsTotal * valorPunto);
    const retencionPct = Math.max(0, Number(config.retencion || 0));
    const descuentoRet = Math.round(valorBruto * (retencionPct / 100));
    const valorNeto = valorBruto - descuentoRet;

    return {
        'Valor_Punto_CLP':     String(valorPunto),
        'Valor_Actividad_CLP': String(valorBruto),
        'Retencion_Pct': String(retencionPct),
        'Retencion_CLP': String(descuentoRet),
        'Valor_Actividad_Neta_CLP': String(valorNeto),
        'Cliente_Tarifa':      config.cliente  || '',
        'Proyecto_Tarifa':     config.proyecto || ''
    };
}

/**
 * Construye el mapa idRecurso → { cliente, proyecto, valorPunto }
 * para usar en valorizarBaremos(). Caché de 10 minutos.
 */
async function construirMapaValorizacion(empresaId) {
    const cacheKey = String(empresaId);
    const now = Date.now();
    const currentVersion = (process.__mapValVersionByEmpresa && process.__mapValVersionByEmpresa[cacheKey]) || 0;
    if (
        _mapaValorizacionCache[cacheKey] &&
        _mapaValorizacionCache[cacheKey].ver === currentVersion &&
        (now - _mapaValorizacionCache[cacheKey].ts) < 600000
    ) {
        return _mapaValorizacionCache[cacheKey].data;
    }

    // Lazy-require para evitar dependencias circulares
    const Tecnico           = require('../models/Tecnico');
    const Proyecto          = require('../../rrhh/models/Proyecto');
    const Cliente           = require('../models/Cliente');
    const ValorPuntoCliente = require('../models/ValorPuntoCliente');

    const tecnicos = await Tecnico.find({ empresaRef: empresaId, idRecursoToa: { $exists: true, $ne: '' } }).lean();
    if (!tecnicos.length) { _mapaValorizacionCache[cacheKey] = { data: {}, ts: now, ver: currentVersion }; return {}; }

    const projectIds  = [...new Set(tecnicos.map(t => t.projectId).filter(Boolean))];
    const proyectos   = projectIds.length ? await Proyecto.find({ _id: { $in: projectIds } }).lean() : [];
    const clientIds   = [...new Set(proyectos.map(p => p.cliente).filter(Boolean))];
    const clientesDoc = clientIds.length ? await Cliente.find({ _id: { $in: clientIds } }).select('nombre valorPuntoActual').lean() : [];

    const clientNameMap = {};
    const clientPriceMap = {};
    clientesDoc.forEach(c => {
        clientNameMap[String(c._id)]  = c.nombre || '';
        clientPriceMap[String(c._id)] = c.valorPuntoActual || 0;
        const n = (c.nombre || '').toUpperCase().trim();
        if (n) clientPriceMap[n] = c.valorPuntoActual || 0;
    });

    const proyectoMap = {};
    proyectos.forEach(p => { proyectoMap[String(p._id)] = p; });

    const valoresPunto   = await ValorPuntoCliente.find({ empresaRef: empresaId, activo: true }).lean();
    const valorPorCliente = {};
    valoresPunto.forEach(v => {
        const cNorm = (v.cliente  || '').toUpperCase().trim();
        const pNorm = (v.proyecto || '').toUpperCase().trim();
        const key   = pNorm ? `${cNorm}|${pNorm}` : cNorm;
        valorPorCliente[key] = v;
        if (!valorPorCliente[cNorm]) valorPorCliente[cNorm] = v;
    });

    const mapa = {};
    tecnicos.forEach(t => {
        const proyecto      = t.projectId ? proyectoMap[String(t.projectId)] : null;
        const clienteId     = proyecto?.cliente ? String(proyecto.cliente) : '';
        const clienteNombre = clientNameMap[clienteId] || (typeof proyecto?.cliente === 'string' ? proyecto.cliente : '');
        const proyectoNombre = proyecto?.nombreProyecto || '';

        const cNorm    = clienteNombre.toUpperCase().trim();
        const pNorm    = proyectoNombre.toUpperCase().trim();
        const config   = valorPorCliente[`${cNorm}|${pNorm}`] || valorPorCliente[cNorm];
        let   vPunto   = config?.valor_punto || 0;
        if (!vPunto) vPunto = clientPriceMap[clienteId] || clientPriceMap[cNorm] || 0;

        mapa[t.idRecursoToa] = {
            cliente:      clienteNombre,
            clienteId:    clienteId || clienteNombre,
            proyecto:     proyectoNombre,
            valorPunto:   vPunto,
            moneda:       config?.moneda || 'CLP',
            retencion:    config?.retencion || 0,
            tecnicoNombre: t.nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim()
        };
    });

    _mapaValorizacionCache[cacheKey] = { data: mapa, ts: now, ver: currentVersion };
    return mapa;
}

/** Invalida el cache de valorización (llamar cuando cambia ValorPuntoCliente) */
function invalidarCacheValorizacion(empresaId) {
    if (empresaId) delete _mapaValorizacionCache[String(empresaId)];
    else Object.keys(_mapaValorizacionCache).forEach(k => delete _mapaValorizacionCache[k]);
}

module.exports = {
    obtenerTarifasEmpresa,
    parsearProductosServiciosTOA,
    calcularBaremos,
    valorizarBaremos,
    construirMapaValorizacion,
    invalidarCacheValorizacion
};
