import re

file_path = "src/platforms/rrhh/pages/ControlAsistencia.jsx"

with open(file_path, "r") as f:
    content = f.read()

# Replace handleSyncProduccion function
pattern_sync = re.compile(
    r"    // ── Sincronización con Producción Telecom \(auto \+ manual\) ────────────────.*?(?=\n    // Aprobar/rechazar HE)",
    re.DOTALL
)

replacement_sync = """    // ── Sincronización Estados Contractuales (auto + manual) ────────────────
    // isAuto=true → silenciosa (no muestra alertas, no abre/cierra modal)
    // isAuto=false → flujo manual (modal confirmación, alertas de resultado)
    const handleSyncEstados = async (isAuto = false) => {
        if (!isAuto) setSyncModal(false);
        if (isAuto) setAutoSyncing(true);
        else setSyncing(true);
        try {
            const [y, m] = period.split('-').map(Number);
            
            // Llama a la nueva ruta centralizada del backend que aplica la lógica de estados
            const res = await asistenciaApi.syncEstadosContractuales(m, y);
            
            await fetchMes();
            if (!isAuto) {
                showAlert(res.data?.mensaje || `✓ Sincronización completada exitosamente.`);
            } else {
                console.log(`[ControlAsistencia] Auto-sync ✓ — ${res.data?.total || 0} registros actualizados.`);
            }
        } catch (e) {
            console.error('[ControlAsistencia] Sync estados error:', e);
            if (!isAuto) showAlert('Error al ejecutar la sincronización de estados.', 'error');
        } finally {
            if (isAuto) setAutoSyncing(false);
            else setSyncing(false);
        }
    };"""

content = pattern_sync.sub(replacement_sync, content)

# Update onClick={handleSyncProduccion} -> onClick={() => handleSyncEstados(false)}
content = content.replace("onClick={handleSyncProduccion}", "onClick={() => handleSyncEstados(false)}")

# Update modal text
content = content.replace("Sincronizar desde Producción", "Sincronizar Estados Contractuales")

old_ul = """<p className="text-sm font-bold text-slate-700 mb-2">⚙️ Qué hará esta sincronización:</p>
                                <ul className="text-[12px] text-slate-600 space-y-1 list-none">
                                    <li>✓ Lee todos los registros de <strong>Producción Día</strong></li>
                                    <li>✓ Marca <strong>NC (No Contratado)</strong> antes de fecha de contrato</li>
                                    <li>✓ Identifica <strong>Feriados y Domingos</strong> automáticamente</li>
                                    <li>✓ Si hay producción → <strong>Presente</strong></li>
                                    <li>✓ Si NO hay producción → <strong>Ausente</strong> (descuenta)</li>
                                </ul>"""

new_ul = """<p className="text-sm font-bold text-slate-700 mb-2">⚙️ Qué hará esta sincronización:</p>
                                <ul className="text-[12px] text-slate-600 space-y-1 list-none">
                                    <li>✓ Lee todos los ingresos de <strong>Captura de Talento</strong></li>
                                    <li>✓ Lee todos los ceses de la <strong>Bóveda de Desvinculados</strong></li>
                                    <li>✓ Marca <strong>NC (No Contratado)</strong> y <strong>Finiquitado</strong></li>
                                    <li>✓ Identifica <strong>Feriados y Domingos</strong> automáticamente</li>
                                    <li>✓ Si tiene marcaje manual → <strong>Presente</strong></li>
                                    <li>✓ Si NO tiene marcaje → <strong>Ausente</strong> (descuenta)</li>
                                </ul>"""
content = content.replace(old_ul, new_ul)

old_hibrido = """💡 <strong>Comportamiento Híbrido:</strong> Los registros manuales ya ingresados por RRHH (Licencias, Vacaciones, etc.) <strong>NO se sobrescribirán</strong>. La sincronización avanzada solo rellenará las celdas vacías basándose en los días con y sin producción."""
new_hibrido = """💡 <strong>Comportamiento Híbrido:</strong> Los registros manuales ya ingresados por RRHH (Licencias, Vacaciones, etc.) <strong>NO se sobrescribirán</strong>."""
content = content.replace(old_hibrido, new_hibrido)

content = content.replace("Forzar re-sincronización con producción Telecom", "Sincronizar estados contractuales y feriados")
content = content.replace("Re-Sincronizar", "Re-Sincronizar Estados")
content = content.replace("setTimeout(() => handleSyncProduccion(true), 0);", "setTimeout(() => handleSyncEstados(true), 0);")

with open(file_path, "w") as f:
    f.write(content)

print("ControlAsistencia.jsx updated successfully.")
