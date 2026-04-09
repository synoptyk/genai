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
 * Calcula los puntos LPU (Baremos) para una actividad
 */
function calcularBaremos(doc, tarifas) {
    if (!tarifas || !tarifas.length) return null;

    // Sanitizar doc para asegurar keys con underscore
    const clean = {};
    for (const [k, v] of Object.entries(doc)) {
        clean[k.replace(/[\.\s]/g, '_')] = v;
    }

    // Re-parsear XML si faltan equipos
    if ((!clean.Decos_Cable_Adicionales || !clean.Decos_WiFi_Adicionales) && (clean.Productos_y_Servicios_Contratados || clean['Productos_y_Servicios_Contratados'])) {
        const xmlVal = clean.Productos_y_Servicios_Contratados || clean['Productos_y_Servicios_Contratados'] || '';
        const derivados = parsearProductosServiciosTOA(xmlVal);
        if (derivados) {
            Object.assign(clean, derivados);
        }
    }

    const tipoTrabajo = clean.Tipo_Trabajo || clean.Tipo_de_Trabajo || clean['Tipo de Trabajo'] || '';
    const subtipo = clean.Subtipo_de_Actividad || clean['Subtipo de Actividad'] || '';
    const reutDrop = (clean['Reutilización_de_Drop'] || clean['Reutilizacion_de_Drop'] || clean['Reutilizacion de Drop'] || '').toUpperCase();
    const conPreco = (clean['Con_Preco'] || clean['Con Preco'] || '').toUpperCase();
    
    const decosCableAd = parseInt(clean.Decos_Cable_Adicionales || 0);
    const decosWifiAd = parseInt(clean.Decos_WiFi_Adicionales || 0);
    const decosAd = parseInt(clean.Decos_Adicionales || 0);
    const repetidores = parseInt(clean.Repetidores_WiFi || 0);
    const telefonos = parseInt(clean.Telefonos || 0);

    const tarifasBase = tarifas.filter(t => !t.mapeo?.es_equipo_adicional);
    const tarifasEquipos = tarifas.filter(t => t.mapeo?.es_equipo_adicional);

    let mejorMatch = null;
    let mejorScore = -1;

    for (const t of tarifasBase) {
        let score = 0;
        const m = t.mapeo || {};

        if (m.tipo_trabajo_pattern) {
            const patterns = m.tipo_trabajo_pattern.split('|');
            const matched = patterns.some(p => {
                const pTrim = p.trim();
                if (pTrim === tipoTrabajo) return true;
                try { return new RegExp('^' + pTrim + '$').test(tipoTrabajo); } catch (_) { return false; }
            });
            if (matched) score += 10;
            else continue;
        }

        if (m.subtipo_actividad) {
            if (subtipo.startsWith(m.subtipo_actividad) || subtipo === m.subtipo_actividad) score += 5;
            else if (!m.tipo_trabajo_pattern) continue;
        }

        if (m.requiere_reutilizacion_drop) {
            if (m.requiere_reutilizacion_drop === reutDrop) score += 3;
            else if (reutDrop) score -= 5;
        }

        if (m.con_preco) {
            if (m.con_preco === conPreco) score += 4;
            else if (conPreco) score -= 5;
        }

        if (score > mejorScore) {
            mejorScore = score;
            mejorMatch = t;
        }
    }

    const ptsBase = mejorMatch ? mejorMatch.puntos : 0;
    const decosEfectivos = (decosCableAd > 0 || decosWifiAd > 0) ? (decosCableAd + decosWifiAd) : decosAd;
    
    let ptsDecoWifi = 0, ptsRepetidor = 0, ptsTelefono = 0;
    
    // Priorización de tarifas de equipos por código exacto o descripción específica (ej: 540057)
    for (const t of tarifasEquipos) {
        const campo = t.mapeo?.campo_cantidad || '';
        const tConPreco = (t.mapeo?.con_preco || '').toUpperCase();
        if (tConPreco && tConPreco !== conPreco) continue;

        // Regla especial: Código 540057 - Decodificador Adicional Wi-Fi TV (0.25 pts)
        if ((campo === 'Decos_WiFi_Adicionales' || campo === 'Decos_Adicionales') && decosEfectivos > 0) {
            const hasSpecificCode = (clean.Equipos_Codes || '').includes('540057');
            const isSpecificDesc = (t.codigo === '540057' || t.descripcion?.includes('540057'));
            
            if (hasSpecificCode || isSpecificDesc) {
                // Prioridad absoluta al código 540057 con su valor de 0.25 solicitado
                ptsDecoWifi = 0.25 * decosEfectivos;
                break; 
            }
            // Si no, lo tomamos como candidato genérico (pero seguimos buscando por si aparece el 540057)
            if (!ptsDecoWifi) ptsDecoWifi = t.puntos * decosEfectivos;
        }
    }

    // Segunda pasada para el resto de equipos
    for (const t of tarifasEquipos) {
        const campo = t.mapeo?.campo_cantidad || '';
        const tConPreco = (t.mapeo?.con_preco || '').toUpperCase();
        if (tConPreco && tConPreco !== conPreco) continue;

        if (campo === 'Repetidores_WiFi' && repetidores > 0 && !ptsRepetidor) {
            ptsRepetidor = t.puntos * repetidores;
        } else if (campo === 'Telefonos' && telefonos > 0 && !ptsTelefono) {
            ptsTelefono = t.puntos * telefonos;
        }
    }

    const ptsTotal = ptsBase + ptsDecoWifi + ptsRepetidor + ptsTelefono;

    return {
        ...clean,
        'Pts_Actividad_Base': ptsBase,
        'Desc_LPU_Base': mejorMatch ? mejorMatch.descripcion : '',
        'Pts_Deco_Adicional': ptsDecoWifi,
        'Pts_Repetidor_WiFi': ptsRepetidor,
        'Pts_Telefono': ptsTelefono,
        'PTS_TOTAL_BAREMO': Math.round(ptsTotal * 100) / 100
    };
}

module.exports = {
    obtenerTarifasEmpresa,
    parsearProductosServiciosTOA,
    calcularBaremos
};
