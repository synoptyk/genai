const mongoose = require('mongoose');

// Cache local de tarifas
const _tarifaCache = {};

/**
 * Obtiene las tarifas LPU de una empresa con cache de 5 minutos
 * Auto-importa el modelo TarifaLPU para que sea autónomo
 */
async function obtenerTarifasEmpresa(empresaId, TarifaLPUModel = null) {
    const key = String(empresaId);
    const now = Date.now();
    if (_tarifaCache[key] && (now - _tarifaCache[key].ts) < 300000) return _tarifaCache[key].data;

    // Auto-importar el modelo si no se proporciona
    const TarifaLPU = TarifaLPUModel || require('../models/TarifaLPU');
    const tarifas = await TarifaLPU.find({ empresaRef: empresaId, activo: true }).lean();
    _tarifaCache[key] = { data: tarifas, ts: now };
    return tarifas;
}

/**
 * Invalida el cache de tarifas (llamar cuando se actualiza una tarifa LPU)
 */
function invalidarCacheTarifas(empresaId) {
    if (empresaId) delete _tarifaCache[String(empresaId)];
    else Object.keys(_tarifaCache).forEach(k => delete _tarifaCache[k]);
}

/**
 * Parsea el XML de Productos_y_Servicios_Contratados de TOA
 * Extrae la cantidad de equipos adicionales del string XML de Productos_y_Servicios_Contratados de TOA.
 * Ahora recibe el tipo de trabajo real para no confundir Averías con Altas.
 */
function parsearProductosServiciosTOA(xmlString, tipoTrabajoReal = '', subtipoReal = '') {
    if (!xmlString || typeof xmlString !== 'string' || !xmlString.includes('<ProductService>')) return null;

    const productos = [];
    const regex = /<ProductService>([\s\S]*?)<\/ProductService>/g;
    let match;
    
    while ((match = regex.exec(xmlString)) !== null) {
        const bloque = match[1];
        const get = (tag) => {
            const m = bloque.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'i'));
            return m ? m[1].trim().replace(/_+$/g, '') : '';
        };

        const montoStr = get('Monto') || get('Precio') || get('Price') || '';
        const monto = parseFloat(montoStr) || 0;
        const tipoPreco = get('TipoPrecio') || get('TipoPrecoItem') || get('CON_PRECO') || get('ConPreco') || '';
        const itemConPreco = (tipoPreco && tipoPreco !== '0' && tipoPreco.toUpperCase() !== 'NO') || (parseFloat(montoStr) > 0);

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
    
    const decosTodosRaw = getEquipos(/adicional|deco|iptv|dta|stb|receptor|box|streming|android|smart.tv|4k|vip|nagrav|pds/i);
    
    // Regla de negocio: Por defecto, todos los decos adicionales son WiFi, a menos que el nombre especifique explícitamente cable/cableado/coaxial
    const decosCable = decosTodosRaw.filter(p => /cable|cableado|coax|rg6|ethernet|utp/i.test(p.descripcion));
    const decosWifi = decosTodosRaw.filter(p => !/cable|cableado|coax|rg6|ethernet|utp/i.test(p.descripcion));

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

    let ctWifi = decosWifi.reduce((s, p) => s + getQtyReal(p), 0);
    let ctCable = decosCable.reduce((s, p) => s + getQtyReal(p), 0);
    let ctRepetidores = repetidores.reduce((s, p) => s + getQtyReal(p), 0);
    let ctTelefonos = telefonosTodos.reduce((s, p) => s + getQtyReal(p), 0);

    // Deducir el tipo de operación basado estrictamente en si es realmente un alta
    const esRealmenteAlta = /alta/i.test(tipoTrabajoReal) || /alta/i.test(subtipoReal);
    const esRealmenteMigracion = /migraci|traslado/i.test(tipoTrabajoReal) || /migraci|traslado/i.test(subtipoReal);
    const esAveria = /reclamo|averia|reparacion|sin potencia/i.test(tipoTrabajoReal) || /reclamo|averia|reparacion|sin potencia/i.test(subtipoReal);

    let tipoOp = 'Alta nueva';
    if (esAveria) {
        tipoOp = 'Avería/Reclamo';
    } else if (esRealmenteMigracion || (bajas.length > 0 && altas.length > 0)) {
        tipoOp = 'Cambio/Migración';
    } else if (bajas.length > 0 && altas.length === 0) {
        tipoOp = 'Baja';
    } else {
        tipoOp = 'Alta nueva';
    }

    // Descuento de equipo principal (1 Deco o 1 Repetidor no cuentan como adicional SOLO en Altas/Migraciones Reales)
    // El deco principal siempre asume ser de Cable si hay, si no, se descuenta de WiFi
    if (tipoOp === 'Alta nueva' || tipoOp === 'Cambio/Migración') {
        if (ctCable > 0) ctCable--;
        else if (ctWifi > 0) ctWifi--; 
        else if (ctRepetidores > 0) ctRepetidores--;
    }

    if (tipoOp === 'Alta nueva' && ctTelefonos > 0) {
        ctTelefonos--;
    }
    
    const tienePreco = decosTodosRaw.some(p => p.conPreco) || repetidores.some(p => p.conPreco) || telefonosTodos.some(p => p.conPreco);
    
    return {
        'Velocidad_Internet': velocidadInternet, 
        'Plan_TV': tvAlta ? tvAlta.descripcion : '', 
        'Telefonia': toipAlta ? toipAlta.descripcion : '',
        'Modem': modem ? modem.descripcion : '', 
        'Deco_Principal': (tipoOp === 'Alta nueva' || tipoOp === 'Cambio/Migración') ? 'Sí' : 'No',
        'Decos_Cable_Adicionales': String(Math.max(0, ctCable)),
        'Decos_WiFi_Adicionales': String(Math.max(0, ctWifi)),
        'Decos_Adicionales': '0', // Ya no lo usamos general para evitar doble conteo, usar WiFi o Cable
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

    // Re-parsear XML si no existen explícitamente los campos derivados o si están en '0'
    const xmlVal = clean.Productos_y_Servicios_Contratados || clean['Productos_y_Servicios_Contratados'] || clean['Productos_y_Servicios_Contratados_String'] || clean['PRODUCTOS_Y_SERVICIOS_CONTRATADOS_STRING'] || '';
    if (xmlVal) {
        const derivados = parsearProductosServiciosTOA(xmlVal, clean.Tipo_Trabajo || clean.Tipo_de_Trabajo || '', clean.Subtipo_de_Actividad || '');
        if (derivados) {
            // Solo sobreescribimos si en clean no existen, o si el XML aporta un valor mayor a cero
            Object.entries(derivados).forEach(([k, v]) => {
                if (!clean[k] || parseInt(clean[k]) === 0 || clean[k] === '0') {
                    clean[k] = v;
                    clean[k.toUpperCase().replace(/[\.\s]/g, '_')] = v;
                }
            });
        }
    }

    const tipoTrabajo = clean.Tipo_Trabajo || clean.Tipo_de_Trabajo || clean['Tipo_de_Trabajo'] || '';
    const subtipo     = clean.Subtipo_de_Actividad || clean['Subtipo_de_Actividad'] || '';
    const reutDrop    = (clean['Reutilización_de_Drop'] || clean['Reutilizacion_de_Drop'] || clean['Reutilización de Drop'] || '').toUpperCase();
    const conPreco    = (clean['Con_Preco'] || '').toUpperCase();
    
    // Normalizar Acometida desde variantes
    const acometida = (clean.Acometida || clean.ACOMETIDA || clean['Acometida_Exterior'] || clean['Acometida_Interior'] || '').toUpperCase();
    clean.Acometida = acometida; // Asegurar que esté disponible para condicion_extra

    const eqNuevos = parseInt(clean.CANTIDAD_DE_EQUIPOS_NUEVOS || clean.Cantidad_de_Equipos_Nuevos || 0);
    const decosCableAd = parseInt(clean.Decos_Cable_Adicionales || 0);
    const decosWifiAd  = parseInt(clean.Decos_WiFi_Adicionales  || 0);
    let decosAd      = parseInt(clean.Decos_Adicionales       || 0);
    const repetidores  = parseInt(clean.Repetidores_WiFi         || 0);
    const telefonos    = parseInt(clean.Telefonos                 || 0);
    
    // Si no tenemos decos explícitos ni por XML pero tenemos CANTIDAD_DE_EQUIPOS_NUEVOS, usamos ese valor
    if (decosCableAd === 0 && decosWifiAd === 0 && decosAd === 0 && eqNuevos > 0) {
        decosAd = eqNuevos;
    }

    // Códigos LPU explícitos que puede traer el bot o el documento
    const codigosDoc = [
        ...(clean._productCodes || []),
        clean.CODIGO_LPU_BASE,
        clean['Cód LPU'],
        clean.COD_LPU,
        clean.LPU_COD
    ].filter(Boolean).map(c => String(c).trim());

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
            // Si la tarifa especifica 'SI', el documento debe tener 'SI'.
            // Si la tarifa especifica 'NO', el documento debe tener 'NO'.
            // Consideramos valores vacíos en el documento como 'NO' por defecto.
            const docReut = reutDrop === 'SI' ? 'SI' : 'NO';
            const tarReut = m.requiere_reutilizacion_drop.toUpperCase();
            if (tarReut === docReut) {
                score += 5; // Más peso para asegurar que gane la tarifa correcta
            } else {
                score -= 10; // Fuerte penalización si hay colisión (ej. tarifa es con DROP pero doc no tiene DROP)
            }
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

    // --- REGLA DE NEGOCIO GENAI: NO CALCULAR ALTO VALOR ---
    const categoria = (mejorMatch?.categoria || '').toUpperCase();
    const codigoActual = String(mejorMatch?.codigo || '');
    // Se considera Alto Valor si la categoría lo dice O si el código está en el rango 600xxx
    const esAltoValor = categoria.includes('ALTO VALOR') || codigoActual.startsWith('600');

    const ptsBase    = (mejorMatch && !esAltoValor) ? mejorMatch.puntos : 0;
    const codigoBase = mejorMatch ? mejorMatch.codigo : '';
    const descBase   = mejorMatch ? mejorMatch.descripcion : '';
    const grupoBase  = mejorMatch ? mejorMatch.grupo : '';
    const catBase    = mejorMatch ? mejorMatch.categoria : '';

    // ── 2. EQUIPOS ADICIONALES ───────────────────────────────────────────────
    // REPARACIONES: no pagan decos adicionales (solo valor reparación)
    const esReparacion = mejorMatch && /REPARACIÓN|REPARACION|AVERÍA|AVERIA|AVERA|RESOLUCIÓN|RESOLUCION|RUTINA|PREVENTIV/i.test(categoria);

    // Sumar todos los decos adicionales detectados (WiFi, Cable o Genéricos)
    // Usamos Math.max para WiFi/Adicionales por si son alias, y sumamos Cable por si vienen separados
    const decosEfectivos = !esReparacion && !esAltoValor ? (Math.max(decosWifiAd, decosAd) + decosCableAd) : 0;

    // Determinar contexto para elegir la tarifa correcta de equipo adicional
    // (Ej. "Deco coincidente en Alta" vs "Deco independiente")
    const esAlta = clean.Tipo_Operacion === 'Alta nueva' || 
                   /ALTA/i.test(mejorMatch?.descripcion || '') || 
                   /ALTA/i.test(mejorMatch?.categoria || '');

    function seleccionarTarifaEquipo(tarifasCandidatas) {
        if (!tarifasCandidatas || !tarifasCandidatas.length) return null;
        
        const tarifasEnAlta = tarifasCandidatas.filter(t => /ALTA|COINCIDENTE/i.test(t.descripcion));
        const tarifasNormales = tarifasCandidatas.filter(t => !/ALTA|COINCIDENTE/i.test(t.descripcion));

        if (esAlta) {
            // Si la orden es una Alta, preferimos tarifas específicas de Alta
            if (tarifasEnAlta.length > 0) return tarifasEnAlta.sort((a, b) => b.puntos - a.puntos)[0];
            return tarifasNormales.sort((a, b) => b.puntos - a.puntos)[0];
        } else {
            // Si NO es un Alta (ej. ticket técnico, visita), preferimos tarifa normal
            if (tarifasNormales.length > 0) return tarifasNormales.sort((a, b) => b.puntos - a.puntos)[0];
            return tarifasCandidatas.sort((a, b) => a.puntos - b.puntos)[0]; // Fallback
        }
    }

    let ptsDecoCable = 0, ptsDecoWifi = 0, ptsRepetidor = 0, ptsTelefono = 0;
    let codigoDecoWifi = '', codigoRepetidor = '';

    // En reparaciones o Alto Valor: no calcular decos ni repetidores
    if (!esReparacion && !esAltoValor) {
        
        // 1. Decodificadores WiFi
        if (decosWifiAd > 0 || decosAd > 0) {
            const qtyWifi = Math.max(decosWifiAd, decosAd); // Compatibilidad legacy
            const tarifasWifi = tarifasEquipos.filter(t => 
                ['Decos_WiFi_Adicionales', 'Decos_Adicionales'].includes(t.mapeo?.campo_cantidad || '') &&
                ((t.mapeo?.con_preco || '').toUpperCase() === conPreco || !(t.mapeo?.con_preco))
            );
            const tarifaWifi = seleccionarTarifaEquipo(tarifasWifi);
            if (tarifaWifi) {
                ptsDecoWifi = tarifaWifi.puntos * qtyWifi;
                codigoDecoWifi = tarifaWifi.codigo;
            }
        }

        // 1.5 Decodificadores Cable
        if (decosCableAd > 0) {
            const tarifasCable = tarifasEquipos.filter(t => 
                t.mapeo?.campo_cantidad === 'Decos_Cable_Adicionales' &&
                ((t.mapeo?.con_preco || '').toUpperCase() === conPreco || !(t.mapeo?.con_preco))
            );
            // Si no hay tarifa de cable específica, hacer fallback a genérica
            const tarifaCable = seleccionarTarifaEquipo(tarifasCable.length > 0 ? tarifasCable : tarifasEquipos.filter(t => t.mapeo?.campo_cantidad === 'Decos_Adicionales'));
            if (tarifaCable) {
                ptsDecoCable = tarifaCable.puntos * decosCableAd;
            }
        }

        // 2. Repetidores y Teléfonos
        const tarifasRepetidores = tarifasEquipos.filter(t => 
            t.mapeo?.campo_cantidad === 'Repetidores_WiFi' && 
            ((t.mapeo?.con_preco || '').toUpperCase() === conPreco || !(t.mapeo?.con_preco))
        );
        const repTarifa = seleccionarTarifaEquipo(tarifasRepetidores);
        if (repTarifa && repetidores > 0) {
            ptsRepetidor = repTarifa.puntos * repetidores;
            codigoRepetidor = repTarifa.codigo;
        }

        const tarifasTelefonos = tarifasEquipos.filter(t => 
            t.mapeo?.campo_cantidad === 'Telefonos' && 
            ((t.mapeo?.con_preco || '').toUpperCase() === conPreco || !(t.mapeo?.con_preco))
        );
        const telTarifa = seleccionarTarifaEquipo(tarifasTelefonos);
        if (telTarifa && telefonos > 0) {
            ptsTelefono = telTarifa.puntos * telefonos;
        }
    }

    const ptsTotal = Math.round((ptsBase + ptsDecoCable + ptsDecoWifi + ptsRepetidor + ptsTelefono) * 100) / 100;

    return {
        ...clean,
        // Campos baremos (números para cálculos downstream)
        'Pts_Actividad_Base':   ptsBase,
        'Codigo_LPU_Base':      codigoBase,
        'Desc_LPU_Base':        descBase,
        'Grupo_LPU_Base':       grupoBase,
        'Categoria_LPU_Base':   catBase,
        'Pts_Deco_Cable':       ptsDecoCable,
        'Pts_Deco_Adicional':   ptsDecoCable + ptsDecoWifi,   // alias legacy
        'Pts_Deco_WiFi':        ptsDecoWifi,
        'Codigo_LPU_Deco_WiFi': codigoDecoWifi,
        'Pts_Repetidor_WiFi':   ptsRepetidor,
        'Codigo_LPU_Repetidor': codigoRepetidor,
        'Pts_Telefono':         ptsTelefono,
        // Nombre canónico del campo total (ambas variantes para compatibilidad)
        'Pts_Total_Baremo':     ptsTotal,   // nombre usado en DB (legacy)
        'ptsTotalBaremo':       ptsTotal,   // nombre usado en DB (canonico)
        'PTS_TOTAL_BAREMO':     ptsTotal,   // alias UPPER para rutas legacy
        'Total_Puntos_Baremo':  ptsTotal,   // alias alternativo
        
        // Cantidades efectivas procesadas (para mostrar en Descarga TOA)
        'Decos_Efectivos':      decosEfectivos,
        'Repetidores_Efectivos': repetidores,
        'Telefonos_Efectivos':  telefonos
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
    invalidarCacheTarifas,
    parsearProductosServiciosTOA,
    calcularBaremos,
    valorizarBaremos,
    construirMapaValorizacion,
    invalidarCacheValorizacion
};
