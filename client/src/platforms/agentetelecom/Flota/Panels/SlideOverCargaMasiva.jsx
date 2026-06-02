import React, { useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import telecomApi from '../../telecomApi';
import * as XLSX from 'xlsx';

export default function SlideOverCargaMasiva({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { patente: 'AAAA-11', marca: 'Toyota', modelo: 'Hilux', anio: 2024, proveedor: 'Mitta', tipoContrato: 'Leasing', valor: 500000, moneda: 'CLP', zona: 'Norte', estadoOperativo: 'Operativa', estadoLogistico: 'En Patio', tieneReemplazo: 'NO', patenteReemplazo: '', cuponElectronico: 'Cupón Titular', numeroCupon: '123456789' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Carga_Flota.xlsx");
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          setError("El archivo está vacío.");
          return;
        }
        const formattedData = data.map(row => ({
          patente: String(row.patente || '').trim().toUpperCase(),
          marca: String(row.marca || '').trim(),
          modelo: String(row.modelo || '').trim(),
          anio: parseInt(row.anio) || new Date().getFullYear(),
          proveedor: String(row.proveedor || '').trim(),
          tipoContrato: String(row.tipoContrato || 'Leasing').trim(),
          valor: parseFloat(row.valor) || 0,
          moneda: String(row.moneda || 'CLP').trim(),
          zona: String(row.zona || 'Metropolitana').trim(),
          estadoOperativo: String(row.estadoOperativo || 'Operativa').trim(),
          estadoLogistico: String(row.estadoLogistico || 'En Patio').trim(),
          tieneReemplazo: String(row.tieneReemplazo || 'NO').trim().toUpperCase(),
          patenteReemplazo: String(row.patenteReemplazo || '').trim().toUpperCase(),
          cuponElectronico: String(row.cuponElectronico || 'Sin Cupón').trim(),
          numeroCupon: String(row.numeroCupon || '').trim()
        })).filter(v => v.patente && v.marca);

        if (formattedData.length === 0) {
          setError("No se encontraron registros válidos. Asegúrate de incluir columnas 'patente' y 'marca'.");
          setPreview([]);
        } else {
          setPreview(formattedData);
        }
      } catch (err) {
        setError("Error al leer el archivo Excel. Asegúrate de usar la plantilla.");
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleProcess = async () => {
    if (preview.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await telecomApi.post('/vehiculos/bulk', { flota: preview });
      alert(`✅ Carga masiva completada: ${res.data.message || 'Éxito'}`);
      onSuccess();
    } catch (e) {
      if (e.response?.status === 207) {
        alert("⚠️ Carga parcial completada. Se omitieron patentes duplicadas.");
        onSuccess();
      } else {
        setError(e.response?.data?.error || e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-end">
      <div className="h-full w-full max-w-xl bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-400">
        <div className="p-8 bg-emerald-600 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-1 flex items-center gap-1">
              <UploadCloud size={12} /> Importación
            </div>
            <h2 className="text-2xl font-black tracking-tight">Carga Masiva Flota</h2>
            <p className="text-sm text-emerald-100">Sube múltiples vehículos usando un archivo Excel.</p>
          </div>
          <button onClick={onClose} className="p-3 bg-black/20 rounded-full hover:bg-black/30 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <FileSpreadsheet size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">1. Descarga la plantilla</h3>
              <p className="text-xs text-slate-500 mb-3 mt-1">Usa nuestro formato predeterminado para asegurar que los datos se importen correctamente sin errores de formato.</p>
              <button onClick={downloadTemplate} className="inline-flex items-center gap-2 text-xs font-black bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm">
                <Download size={14} /> Descargar Plantilla .XLSX
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">2. Sube tu archivo</h3>
            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${file ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:bg-slate-50 bg-white'}`}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className={`mb-2 ${file ? 'text-emerald-500' : 'text-slate-400'}`} size={28} />
                <p className="text-sm font-bold text-slate-700">{file ? file.name : "Haz clic o arrastra un archivo Excel"}</p>
                {!file && <p className="text-xs text-slate-400 mt-1">.xlsx, .xls</p>}
              </div>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <p className="text-xs font-bold text-red-700">{error}</p>
            </div>
          )}

          {preview.length > 0 && !error && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" /> 
                  Vista Previa ({preview.length} válidos)
                </h3>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white sticky top-0 border-b border-slate-100 shadow-sm">
                    <tr>
                      <th className="px-4 py-2 font-bold text-slate-500">Patente</th>
                      <th className="px-4 py-2 font-bold text-slate-500">Vehículo</th>
                      <th className="px-4 py-2 font-bold text-slate-500">Contrato / Costo</th>
                      <th className="px-4 py-2 font-bold text-slate-500">Cupón Elec.</th>
                      <th className="px-4 py-2 font-bold text-slate-500">Estado Op. / Log.</th>
                      <th className="px-4 py-2 font-bold text-slate-500">Zona</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((v, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-2 font-black text-slate-700">{v.patente}</td>
                        <td className="px-4 py-2 text-slate-600">{v.marca} {v.modelo} <span className="text-slate-400">({v.anio})</span></td>
                        <td className="px-4 py-2 text-slate-600">{v.proveedor} • {v.moneda} {v.valor}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {v.cuponElectronico !== 'Sin Cupón' ? <span className="font-medium text-purple-600">{v.cuponElectronico}</span> : 'Sin Cupón'}
                          {v.numeroCupon && <span className="block text-[10px] text-slate-400">Nº: {v.numeroCupon}</span>}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          <span className="font-medium text-emerald-600">{v.estadoOperativo}</span> / {v.estadoLogistico}
                          {v.tieneReemplazo === 'SI' && <span className="block text-[10px] text-slate-400">Rmplz: {v.patenteReemplazo}</span>}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{v.zona}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-white">
          <button type="button" onClick={onClose} className="px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-all">
            Cancelar
          </button>
          <button type="button" onClick={handleProcess} disabled={loading || preview.length === 0} 
            className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            <UploadCloud size={18} />
            {loading ? 'Procesando...' : `Importar ${preview.length} Vehículos`}
          </button>
        </div>
      </div>
    </div>
  );
}
