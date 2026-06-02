import React, { useState, useRef } from 'react';
import { UploadCloud, X, FileText, CheckCircle, AlertCircle, RefreshCw, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const BulkUploadModal = ({ isOpen, onClose, onUpload, templateHeaders, templateData, title = "Carga Masiva" }) => {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState([]);
    const [errors, setErrors] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet(templateData || [templateHeaders.reduce((acc, h) => ({ ...acc, [h]: '' }), {})]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
        XLSX.writeFile(wb, `Plantilla_${title.replace(/\s+/g, '_')}.xlsx`);
    };

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;
        setFile(selected);
        setErrors([]);
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
                
                // Validate headers
                if (data.length > 0) {
                    const fileHeaders = Object.keys(data[0]);
                    const missing = templateHeaders.filter(h => !fileHeaders.includes(h));
                    if (missing.length > 0) {
                        setErrors([`Faltan columnas requeridas: ${missing.join(', ')}`]);
                        setPreview([]);
                        return;
                    }
                } else {
                    setErrors(["El archivo está vacío."]);
                    return;
                }

                setPreview(data);
            } catch (err) {
                setErrors(["Error al leer el archivo Excel."]);
            }
        };
        reader.readAsBinaryString(selected);
    };

    const handleConfirm = async () => {
        if (!preview.length) return;
        setUploading(true);
        try {
            const result = await onUpload(preview);
            if (result && result.errors && result.errors.length > 0) {
                setErrors(result.errors);
            } else {
                onClose();
            }
        } catch (err) {
            setErrors([err.message || 'Error desconocido al subir los datos.']);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                            <UploadCloud className="text-sky-500" />
                            {title}
                        </h2>
                        <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                            Cargue un archivo Excel (.xlsx) con los datos a importar.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                    {/* Template Download */}
                    <div className="bg-sky-50 p-6 rounded-3xl border border-sky-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-sky-100 text-sky-600 rounded-2xl">
                                <FileSpreadsheet size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-sky-900 uppercase tracking-widest mb-1">Paso 1: Descargar Plantilla</h3>
                                <p className="text-[11px] font-bold text-sky-600/80">Utilice nuestra plantilla oficial para evitar errores de formato.</p>
                            </div>
                        </div>
                        <button onClick={handleDownloadTemplate} className="shrink-0 px-6 py-3 bg-white text-sky-600 rounded-2xl shadow-sm hover:shadow-md transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2">
                            <Download size={16} /> Descargar Plantilla
                        </button>
                    </div>

                    {/* File Upload */}
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3">Paso 2: Subir Archivo</h3>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-3xl cursor-pointer hover:bg-slate-50 hover:border-sky-300 transition-all bg-white group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 mb-3 text-slate-400 group-hover:text-sky-500 transition-colors" />
                                <p className="mb-2 text-sm text-slate-500"><span className="font-bold">Haga clic para subir</span> o arrastre y suelte</p>
                                <p className="text-xs text-slate-400">XLSX, XLS (MAX. 10MB)</p>
                            </div>
                            <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                        </label>
                    </div>

                    {file && (
                        <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div className="flex items-center gap-3">
                                <FileText className="text-emerald-500" size={20} />
                                <div>
                                    <p className="text-xs font-black text-emerald-900">{file.name}</p>
                                    <p className="text-[10px] text-emerald-600 font-bold">{(file.size / 1024).toFixed(2)} KB • {preview.length} filas detectadas</p>
                                </div>
                            </div>
                            <button onClick={() => { setFile(null); setPreview([]); setErrors([]); fileInputRef.current.value = ''; }} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-xl">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                            <div className="flex items-center gap-2 text-rose-700 font-black text-xs uppercase tracking-widest mb-3">
                                <AlertCircle size={16} /> {errors.length} Errores detectados
                            </div>
                            <ul className="text-xs text-rose-600 space-y-1 list-disc list-inside bg-white/50 p-3 rounded-xl max-h-32 overflow-y-auto">
                                {errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}

                    {/* Preview Table */}
                    {preview.length > 0 && errors.length === 0 && (
                        <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3">Vista Previa (Primeras 5 filas)</h3>
                            <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
                                <table className="w-full text-left text-xs text-slate-600">
                                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-black tracking-widest">
                                        <tr>
                                            {templateHeaders.map(h => <th key={h} className="px-4 py-3">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 bg-white">
                                        {preview.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                {templateHeaders.map(h => (
                                                    <td key={h} className="px-4 py-3 truncate max-w-[150px]">{row[h]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 md:p-8 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-[2.5rem]">
                    <button onClick={onClose} className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-200 bg-slate-100 rounded-2xl transition-all">
                        Cancelar
                    </button>
                    <button onClick={handleConfirm} disabled={uploading || !preview.length || errors.length > 0} className="px-8 py-3 text-xs font-black text-white uppercase tracking-widest bg-sky-500 hover:bg-sky-600 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-sky-200">
                        {uploading ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                        Procesar Importación
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkUploadModal;
