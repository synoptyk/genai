import React, { useState, useEffect, useRef } from 'react';
import API_URL from '../../config';

import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx'; // <--- MOTOR EXCEL
import { 
  Upload, Database, FileSpreadsheet, Calculator, Save, 
  AlertCircle, CheckCircle2, Loader2, Download, FileText 
} from 'lucide-react';

const Baremos = () => {
  const [baremos, setBaremos] = useState([]);
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Obtener Datos Reales de MongoDB
  const fetchBaremos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/baremos');
      setBaremos(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBaremos(); }, []);

  // 2. Lógica Excel (Motor Importación)
  const descargarPlantilla = () => {
    const datosEjemplo = [
      { codigo: "INST_01", descripcion: "Instalación Fibra Óptica", puntos: 1.5 },
      { codigo: "REP_02", descripcion: "Reparación Acometida", puntos: 0.8 },
      { codigo: "BAJA_03", descripcion: "Retiro de Equipos", puntos: 0.5 }
    ];

    const ws = XLSX.utils.json_to_sheet(datosEjemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Baremos");
    XLSX.writeFile(wb, "Plantilla_Baremos.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      // Normalizar para coincidir con Schema de MongoDB (codigoActividad, descripcion, puntos)
      const dataNormalizada = data.map(row => {
          const newRow = {};
          // Mapeo inteligente de columnas
          if(row.codigo) newRow.codigoActividad = row.codigo;
          else if(row.CODIGO) newRow.codigoActividad = row.CODIGO;
          else newRow.codigoActividad = row.codigoActividad || "SIN_CODIGO";

          if(row.descripcion) newRow.descripcion = row.descripcion;
          else if(row.DESCRIPCION) newRow.descripcion = row.DESCRIPCION;
          
          if(row.puntos) newRow.puntos = row.puntos;
          else if(row.PUNTOS) newRow.puntos = row.PUNTOS;

          return newRow;
      });

      setJsonInput(JSON.stringify(dataNormalizada, null, 2));
      alert(`✅ Excel procesado: ${dataNormalizada.length} baremos detectados.`);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // 3. Guardar en Base de Datos
  const handleUpload = async () => {
    if (!jsonInput) return alert("No hay datos para cargar.");
    
    try {
      setSaving(true);
      const payload = JSON.parse(jsonInput);
      
      // Enviamos a la API Real
      await api.post('/baremos/bulk', { baremos: payload });
      
      alert('Matriz de Baremos Actualizada Exitosamente');
      fetchBaremos();
      setJsonInput('');
    } catch (e) {
      alert('Error: Datos inválidos. Verifique el formato.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black italic text-slate-800 flex items-center gap-3">
            <Calculator className="text-blue-600" size={32} />
            Matriz de <span className="text-blue-600">Baremos</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold tracking-widest mt-2">
            CONFIGURACIÓN MAESTRA DE ACTIVIDADES Y PUNTAJES
          </p>
        </div>
        <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2">
           <Database size={16} className="text-emerald-500"/>
           <span className="text-xs font-bold text-slate-600">MongoDB Atlas: <span className="text-emerald-600">Conectado</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
        
        {/* COLUMNA 1: EDITOR DE CARGA (EXCEL) */}
        <div className="flex flex-col h-full">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 flex-1 flex flex-col relative overflow-hidden group">
            
            {/* Decoración de fondo */}
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
               <FileSpreadsheet size={100} className="text-emerald-600"/>
            </div>

            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3 text-emerald-800">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                   <Upload size={20} />
                </div>
                <span className="font-black text-sm uppercase tracking-widest">Carga Masiva Excel</span>
              </div>
              
              {/* Input Oculto */}
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 z-10">
               <button 
                 onClick={descargarPlantilla}
                 className="w-full bg-slate-50 border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 text-slate-500 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 transition-all"
               >
                 <Download size={14}/> Plantilla .xlsx
               </button>
               <button 
                 onClick={() => fileInputRef.current.click()}
                 className="w-full bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 transition-all"
               >
                 <FileText size={14}/> Cargar Excel
               </button>
            </div>

            <div className="flex-1 relative mb-6 z-10">
              <textarea 
                className="w-full h-full bg-slate-50 border border-slate-200 rounded-2xl p-6 font-mono text-[10px] text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none resize-none custom-scrollbar transition-all shadow-inner"
                placeholder="Los datos del Excel aparecerán aquí..."
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>

            <button 
              onClick={handleUpload} 
              disabled={saving}
              className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg transition-all z-10 ${saving ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30 hover:scale-[1.02]'}`}
            >
              {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />} 
              {saving ? 'Procesando...' : 'Actualizar Base de Datos'}
            </button>
          </div>
        </div>

        {/* COLUMNA 2: LISTADO EN TIEMPO REAL */}
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4 px-2">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500"/> Baremos Activos
            </h2>
            <span className="bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-[10px] font-black text-slate-600">
              {baremos.length} REGISTROS
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden flex-1 relative flex flex-col">
            
            {/* Cabecera Tabla */}
            <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
               <div className="col-span-3">Código</div>
               <div className="col-span-7">Descripción</div>
               <div className="col-span-2 text-right">Puntos</div>
            </div>

            {/* Cuerpo Tabla Scrollable */}
            <div className="overflow-y-auto custom-scrollbar flex-1 relative">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                   <Loader2 size={40} className="animate-spin text-blue-500 mb-4"/>
                   <p className="text-xs font-bold uppercase tracking-widest">Cargando Matriz...</p>
                </div>
              ) : baremos.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 opacity-60">
                   <AlertCircle size={48} className="mb-4"/>
                   <p className="text-xs font-bold">No hay baremos configurados</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {baremos.map((b, i) => (
                    <div key={i} className="grid grid-cols-12 px-6 py-4 hover:bg-blue-50 transition-colors group items-center">
                      <div className="col-span-3 font-mono text-xs font-bold text-blue-600 group-hover:text-blue-700">
                        {b.codigoActividad}
                      </div>
                      <div className="col-span-7 text-xs font-medium text-slate-600 group-hover:text-slate-800">
                        {b.descripcion || '---'}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="bg-slate-100 text-slate-700 font-black text-xs px-2 py-1 rounded border border-slate-200 group-hover:bg-white group-hover:border-blue-200 group-hover:text-blue-600 transition-all">
                          {b.puntos}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Baremos;