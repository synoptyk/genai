import React, { useState, useEffect, useRef } from 'react';
import telecomApi from './telecomApi';
import * as XLSX from 'xlsx';
import {
  UserPlus, Upload, Download,
  Calendar, Users, Briefcase, MapPin,
  Heart, Truck, DollarSign, X, Plus, User,
  Hash, Flag, Building, Activity, UserCheck,
  FileText, Award, Loader2, CheckCircle2,
  Landmark, CreditCard, ShieldCheck
} from 'lucide-react';
import { formatRut, validateRut } from '../../../utils/rutUtils';

// --- LISTAS MAESTRAS ---
const AFPS = ["CAPITAL", "CUPRUM", "HABITAT", "MODELO", "PLANVITAL", "PROVIDA", "UNO"];
const ISAPRES = ["FONASA", "BANMEDICA", "COLMENA", "CONSALUD", "CRUZ BLANCA", "NUEVA MASVIDA", "VIDA TRES"];
const CONTRATOS = ["PLAZO FIJO", "INDEFINIDO", "HONORARIOS", "POR FAENA"];
const ESTADO_CIVIL = ["SOLTERO", "CASADO", "DIVORCIADO", "VIUDO", "CONVIVIENTE CIVIL"];
const BONOS = ["NO APLICA", "FIJO", "VARIABLE", "MIXTO (FIJO + VARIABLE)"];
const BANCOS = ["BANCO ESTADO", "BANCO DE CHILE", "SANTANDER", "BCI", "SCOTIABANK", "ITAÚ", "FALABELLA", "RIPLEY", "CONSORCIO", "SECURITY", "INTERNACIONAL", "BICE"];
const TIPOS_CUENTA = ["CUENTA CORRIENTE", "CUENTA VISTA / RUT", "AHORRO"];
const MANDANTES = ["TIGO", "MOVISTAR", "ENTEL", "CLARO", "WOM", "VTR", "INTERNO"]; // Generic placeholders

// --- COMPONENTES DE UI PERSONALIZADOS (GLASSMORPHISM) ---
const SectionCard = ({ title, icon: Icon, children, colorCls = "from-blue-600 to-indigo-600" }) => (
  <div className="bg-white/90 backdrop-blur-md rounded-[1.5rem] border border-white/40 shadow-xl shadow-slate-200/40 overflow-hidden relative group hover:shadow-2xl hover:shadow-blue-200/20 transition-all duration-500 mb-8 transform hover:-translate-y-1">
    <div className={`h-1.5 w-full bg-gradient-to-r ${colorCls}`}></div>
    <div className="p-8">
      <h3 className="text-base font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-3 pb-4 border-b border-slate-100/50">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colorCls} text-white shadow-md transform -rotate-3 group-hover:rotate-0 transition-transform duration-300`}>
          <Icon size={20} />
        </div>
        {title}
      </h3>
      <div className="grid gap-6 animate-in fade-in duration-500">{children}</div>
    </div>
  </div>
);

const InputField = ({ label, icon: Icon, ...props }) => (
  <div className="relative group transistion-all duration-300">
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1 group-focus-within:text-blue-500 transition-colors">{label}</label>
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-300" size={18} />}
      <input {...props} className={`w-full bg-slate-50/50 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl py-3.5 ${Icon ? 'pl-11' : 'pl-4'} pr-4 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-300/80 shadow-sm ${props.className || ''}`} />
    </div>
  </div>
);

const SelectField = ({ label, icon: Icon, children, ...props }) => (
  <div className="relative group">
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1 group-focus-within:text-blue-500 transition-colors">{label}</label>
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-300" size={18} />}
      <select {...props} className={`w-full bg-slate-50/50 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl py-3.5 ${Icon ? 'pl-11' : 'pl-4'} pr-10 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none shadow-sm cursor-pointer ${props.className || ''}`}>
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
      </div>
    </div>
  </div>
);


const FichaIngreso = () => {
  // --- ESTADOS ---
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const initialForm = {
    // 1. Identidad
    rut: '', nombres: '', apellidos: '',
    fechaNacimiento: '', nacionalidad: 'CHILENA', estadoCivil: '',
    // 2. Contacto/Domicilio
    calle: '', numero: '', deptoBlock: '', comuna: '', region: '',
    telefono: '', email: '',
    // 3. Previsión
    previsionSalud: 'FONASA', isapreNombre: '', valorPlan: '', monedaPlan: 'UF',
    afp: '', pensionado: 'NO',
    tieneCargas: 'NO', listaCargas: [],
    // 4. Contractuales
    fechaIngreso: '', duracionContrato: '', tipoContrato: 'PLAZO FIJO', fechaTerminoCalculada: '',
    cargo: '', area: '', ceco: '', mandantePrincipal: '',
    // 5. Financieros
    banco: '', tipoCuenta: '', numeroCuenta: '',
    sueldoBase: '', tipoBonificacion: 'NO APLICA', montoBonoFijo: '', descripcionBonoVariable: '',
    // 6. Otros
    requiereLicencia: 'NO', fechaVencimientoLicencia: ''
  };

  const [form, setForm] = useState(initialForm);
  const [cargaTemp, setCargaTemp] = useState({ rut: '', nombre: '', parentesco: '' });

  // --- LÓGICA AUTOMÁTICA ---
  useEffect(() => {
    // Cálculo automático de Fin de Contrato
    if (form.fechaIngreso && form.duracionContrato && form.tipoContrato === 'PLAZO FIJO') {
      const fecha = new Date(form.fechaIngreso);
      const meses = parseInt(form.duracionContrato) || 0;
      // Add months safely handles year rollover automatically
      fecha.setMonth(fecha.getMonth() + meses);

      // Format to YYYY-MM-DD
      const year = fecha.getFullYear();
      const month = String(fecha.getMonth() + 1).padStart(2, '0');
      const day = String(fecha.getDate()).padStart(2, '0');

      if (!isNaN(fecha.getTime())) {
        setForm(prev => ({ ...prev, fechaTerminoCalculada: `${year}-${month}-${day}` }));
      }
    } else {
      setForm(prev => ({ ...prev, fechaTerminoCalculada: '' }));
    }
  }, [form.fechaIngreso, form.duracionContrato, form.tipoContrato]);

  // --- MANEJADORES ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCargaAdd = () => {
    if (cargaTemp.rut && cargaTemp.nombre) {
      setForm(prev => ({ ...prev, listaCargas: [...prev.listaCargas, cargaTemp] }));
      setCargaTemp({ rut: '', nombre: '', parentesco: '' });
    }
  };

  const handleCargaRemove = (idx) => {
    setForm(prev => ({ ...prev, listaCargas: prev.listaCargas.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.rut || !form.nombres || !form.apellidos || !form.fechaIngreso) return alert("Faltan datos obligatorios (RUT, Nombre, Ingreso).");
    try {
      setLoading(true);
      await telecomApi.post('/tecnicos', form);
      alert("✅ Ficha de Ingreso Creada Exitosamente");
      setForm(initialForm);
    } catch (error) {
      console.error(error);
      alert("Error al guardar ficha: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA EXCEL (Bulk Upload) ---
  const descargarPlantilla = () => {
    const headers = [
      "RUT", "NOMBRES", "APELLIDOS", "FECHA_NACIMIENTO", "NACIONALIDAD", "ESTADO_CIVIL",
      "CALLE", "NUMERO", "DEPTO_BLOCK", "PREVISION", "NOMBRE_ISAPRE", "VALOR_PLAN", "AFP",
      "PENSIONADO", "FECHA_INGRESO", "DURACION_MESES", "TIPO_CONTRATO", "CARGO", "AREA",
      "CECO", "MANDANTE", "BANCO", "TIPO_CUENTA", "NUMERO_CUENTA",
      "SUELDO_BASE", "TIPO_BONO", "MONTO_BONO_FIJO", "DESC_BONO_VARIABLE",
      "REQUIERE_LICENCIA", "VENCIMIENTO_LICENCIA"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Ficha");
    XLSX.writeFile(wb, "Plantilla_Ficha_Ingreso_V2.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        const fichasImportadas = data.map(row => ({
          ...initialForm, // Defaults
          rut: row["RUT"], nombres: row["NOMBRES"], apellidos: row["APELLIDOS"],
          fechaNacimiento: row["FECHA_NACIMIENTO"], nacionalidad: row["NACIONALIDAD"],
          estadoCivil: row["ESTADO_CIVIL"], calle: row["CALLE"], numero: row["NUMERO"],
          deptoBlock: row["DEPTO_BLOCK"], previsionSalud: row["PREVISION"],
          isapreNombre: row["NOMBRE_ISAPRE"], valorPlan: row["VALOR_PLAN"],
          afp: row["AFP"], pensionado: row["PENSIONADO"],
          fechaIngreso: row["FECHA_INGRESO"], duracionContrato: row["DURACION_MESES"],
          tipoContrato: row["TIPO_CONTRATO"], cargo: row["CARGO"], area: row["AREA"],
          ceco: row["CECO"], mandantePrincipal: row["MANDANTE"],
          banco: row["BANCO"], tipoCuenta: row["TIPO_CUENTA"], numeroCuenta: row["NUMERO_CUENTA"],
          sueldoBase: row["SUELDO_BASE"], tipoBonificacion: row["TIPO_BONO"],
          montoBonoFijo: row["MONTO_BONO_FIJO"], descripcionBonoVariable: row["DESC_BONO_VARIABLE"],
          requiereLicencia: row["REQUIERE_LICENCIA"], fechaVencimientoLicencia: row["VENCIMIENTO_LICENCIA"]
        }));

        await telecomApi.post('/tecnicos/bulk', { tecnicos: fichasImportadas });
        alert(`✅ ${fichasImportadas.length} Fichas Cargadas Correctamente`);
      } catch (err) {
        alert("Error procesando archivo");
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };


  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 max-w-7xl mx-auto px-4">

      {/* HEADER ESPECTACULAR */}
      <div className="relative p-10 rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 shadow-2xl shadow-blue-900/40 mb-12 overflow-hidden border border-white/10">
        {/* Background Decors */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 text-white/5 animate-pulse"><UserPlus size={240} /></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 bg-blue-500/20 blur-[100px] rounded-full w-80 h-80"></div>

        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-end gap-8">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3.5 bg-white/10 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
                <UserPlus className="text-blue-300" size={36} />
              </div>
              <h1 className="text-5xl font-black italic text-white tracking-tighter">
                Ficha de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-300">Ingreso Digital</span>
              </h1>
            </div>
            <p className="text-blue-200/70 text-sm font-bold tracking-[0.2em] ml-2 uppercase">
              Plataforma Centralizada de Registro de Talento • GenAI
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <button type="button" onClick={descargarPlantilla} className="group bg-white/5 hover:bg-white/10 border border-white/20 text-blue-100 px-6 py-4 rounded-2xl font-bold text-xs uppercase flex items-center gap-3 transition-all backdrop-blur-md hover:border-white/40">
              <Download size={18} className="group-hover:-translate-y-1 transition-transform text-blue-300" /> Plantilla Excel
            </button>
            <button type="button" onClick={() => fileInputRef.current.click()} className="group bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-3 shadow-xl shadow-emerald-500/20 transition-all transform hover:scale-105 active:scale-95 border-t border-white/20">
              <Upload size={20} className="group-hover:animate-bounce" /> Carga Masiva
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".xlsx" />
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* COLUMNA IZQUIERDA (PRINCIPAL) */}
        <div className="xl:col-span-8 space-y-8">

          {/* SECCIÓN 1: IDENTIDAD */}
          <SectionCard title="Identificación del Colaborador" icon={User} colorCls="from-blue-500 to-cyan-500">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4">
                <InputField label="R.U.T (Identificador)" name="rut" value={form.rut} onChange={(e) => handleChange({ target: { name: 'rut', value: formatRut(e.target.value) } })} placeholder="12.345.678-9" icon={Hash} required className={`${form.rut && !validateRut(form.rut) ? '!border-rose-400 !bg-rose-50 text-rose-600' : ''}`} />
              </div>
              <div className="md:col-span-4">
                <InputField label="Nombres" name="nombres" value={form.nombres} onChange={handleChange} icon={User} required />
              </div>
              <div className="md:col-span-4">
                <InputField label="Apellidos" name="apellidos" value={form.apellidos} onChange={handleChange} icon={User} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputField type="date" label="Fecha Nacimiento" name="fechaNacimiento" value={form.fechaNacimiento} onChange={handleChange} icon={Calendar} />
              <InputField label="Nacionalidad" name="nacionalidad" value={form.nacionalidad} onChange={handleChange} icon={Flag} />
              <SelectField label="Estado Civil" name="estadoCivil" value={form.estadoCivil} onChange={handleChange} icon={Heart}>
                <option value="">Seleccione...</option>
                {ESTADO_CIVIL.map(e => <option key={e} value={e}>{e}</option>)}
              </SelectField>
            </div>
          </SectionCard>

          {/* SECCIÓN 2: CONTRACTUAL (INC. MANDANTE/CECO) */}
          <SectionCard title="Datos Contractuales & Operativos" icon={Briefcase} colorCls="from-indigo-600 to-violet-600">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputField type="date" label="Fecha de Ingreso" name="fechaIngreso" value={form.fechaIngreso} onChange={handleChange} icon={Calendar} required className="bg-indigo-50/50 border-indigo-200" />
              <SelectField label="Tipo de Contrato" name="tipoContrato" value={form.tipoContrato} onChange={handleChange} icon={FileText} className="bg-indigo-50/50 border-indigo-200">
                {CONTRATOS.map(c => <option key={c} value={c}>{c}</option>)}
              </SelectField>

              {form.tipoContrato === 'PLAZO FIJO' ? (
                <div className="flex gap-4 p-1 bg-slate-50 rounded-xl border border-slate-200 items-end">
                  <div className="flex-1">
                    <InputField type="number" label="Duración (Meses)" name="duracionContrato" value={form.duracionContrato} onChange={handleChange} placeholder="Meses" className="bg-white" />
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Fin Est.</div>
                    <div className="text-sm font-black text-slate-600 bg-slate-200/50 px-3 py-3 rounded-xl border border-slate-200 truncate">
                      {form.fechaTerminoCalculada || '-'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                  Contrato Indefinido
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <InputField label="Cargo / Rol" name="cargo" value={form.cargo} onChange={handleChange} icon={Briefcase} />
              <InputField label="Área / Departamento" name="area" value={form.area} onChange={handleChange} icon={Building} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2 pt-6 border-t border-dashed border-slate-200">
              <InputField label="Centro de Costo (CECO)" name="ceco" value={form.ceco} onChange={handleChange} icon={Hash} placeholder="Ej: CC-1020" />
              <SelectField label="Mandante Principal" name="mandantePrincipal" value={form.mandantePrincipal} onChange={handleChange} icon={ShieldCheck}>
                <option value="">Seleccione Mandante...</option>
                {MANDANTES.map(m => <option key={m} value={m}>{m}</option>)}
              </SelectField>
            </div>
          </SectionCard>

          {/* SECCIÓN 3: PREVISIÓN Y SALUD (Full Width in Col 1) */}
          <SectionCard title="Seguridad Social & Beneficios" icon={ShieldCheck} colorCls="from-rose-500 to-pink-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <SelectField label="Sistema Salud" name="previsionSalud" value={form.previsionSalud} onChange={handleChange} icon={Activity}>
                <option value="FONASA">FONASA</option>
                <option value="ISAPRE">ISAPRE</option>
              </SelectField>

              {form.previsionSalud === 'ISAPRE' && (
                <>
                  <SelectField label="Isapre" name="isapreNombre" value={form.isapreNombre} onChange={handleChange} className="bg-rose-50/30 border-rose-200">
                    <option value="">Seleccione...</option>
                    {ISAPRES.filter(i => i !== 'FONASA').map(i => <option key={i} value={i}>{i}</option>)}
                  </SelectField>
                  <div className="md:col-span-2 flex gap-4">
                    <InputField type="number" label="Valor Plan" name="valorPlan" value={form.valorPlan} onChange={handleChange} className="bg-rose-50/30 border-rose-200" icon={DollarSign} />
                    <SelectField label="Moneda" name="monedaPlan" value={form.monedaPlan} onChange={handleChange} className="w-24 bg-rose-50/30 border-rose-200">
                      <option value="UF">UF</option>
                      <option value="CLP">$</option>
                    </SelectField>
                  </div>
                </>
              )}

              <SelectField label="AFP" name="afp" value={form.afp} onChange={handleChange} icon={Briefcase}>
                <option value="">Seleccione AFP...</option>
                {AFPS.map(a => <option key={a} value={a}>{a}</option>)}
              </SelectField>
              <SelectField label="Pensionado" name="pensionado" value={form.pensionado} onChange={handleChange} icon={UserCheck}>
                <option value="NO">No</option>
                <option value="SI">Sí</option>
              </SelectField>
            </div>

            {/* CARGAS FAMILIARES */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2 tracking-widest">
                  <Users size={16} className="text-rose-400" /> Cargas Familiares
                </h4>
                <SelectField label="¿Tiene Cargas?" name="tieneCargas" value={form.tieneCargas} onChange={handleChange} className="w-32 py-2" icon={Users}>
                  <option value="NO">No</option>
                  <option value="SI">Sí</option>
                </SelectField>
              </div>

              {form.tieneCargas === 'SI' && (
                <div className="bg-rose-50/40 p-6 rounded-2xl border border-rose-100/50 animate-in slide-in-from-top-4">
                  <div className="flex flex-col md:flex-row gap-3 items-end mb-6">
                    <InputField placeholder="RUT Carga" value={cargaTemp.rut} onChange={e => setCargaTemp({ ...cargaTemp, rut: formatRut(e.target.value) })} className={`bg-white py-2.5 text-xs ${cargaTemp.rut && !validateRut(cargaTemp.rut) ? '!border-rose-400 !bg-rose-50 text-rose-600' : ''}`} />
                    <InputField placeholder="Nombre Completo" value={cargaTemp.nombre} onChange={e => setCargaTemp({ ...cargaTemp, nombre: e.target.value })} className="flex-[2] bg-white py-2.5 text-xs" />
                    <InputField placeholder="Parentesco" value={cargaTemp.parentesco} onChange={e => setCargaTemp({ ...cargaTemp, parentesco: e.target.value })} className="bg-white py-2.5 text-xs" />
                    <button type="button" onClick={handleCargaAdd} className="bg-rose-500 text-white p-2.5 rounded-xl hover:bg-rose-600 shadow-lg shadow-rose-500/20 transition-all hover:scale-105 active:scale-95 mb-[1px]">
                      <Plus size={20} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {form.listaCargas.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-rose-100 shadow-sm">
                        <User size={14} className="text-rose-400" />
                        <span className="text-xs font-bold text-slate-600">{c.nombre} <span className="text-slate-400 font-normal">({c.parentesco})</span></span>
                        <button type="button" onClick={() => handleCargaRemove(idx)} className="text-slate-300 hover:text-red-500 ml-2"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>


        {/* COLUMNA DERECHA (FINANCIERO / CONTACTO) */}
        <div className="xl:col-span-4 space-y-8">

          {/* SECCIÓN 4: FINANCIERO (BANCARIO) */}
          <SectionCard title="Datos Bancarios" icon={Landmark} colorCls="from-emerald-600 to-green-600">
            <SelectField label="Banco" name="banco" value={form.banco} onChange={handleChange} icon={Landmark}>
              <option value="">Seleccione Banco...</option>
              {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
            </SelectField>
            <div className="mt-4">
              <SelectField label="Tipo de Cuenta" name="tipoCuenta" value={form.tipoCuenta} onChange={handleChange} icon={CreditCard}>
                <option value="">Seleccione Tipo...</option>
                {TIPOS_CUENTA.map(t => <option key={t} value={t}>{t}</option>)}
              </SelectField>
            </div>
            <div className="mt-4">
              <InputField label="Número de Cuenta" name="numeroCuenta" value={form.numeroCuenta} onChange={handleChange} icon={Hash} placeholder="Ej: 123456789" />
            </div>
          </SectionCard>

          {/* SECCIÓN 5: REMUNERACIÓN */}
          <SectionCard title="Remuneración & Bonos" icon={DollarSign} colorCls="from-amber-500 to-orange-500">
            <div className="relative group mb-6">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Sueldo Base Liq. Pactado</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-lg">$</span>
                <input type="number" name="sueldoBase" value={form.sueldoBase} onChange={handleChange} className="w-full bg-amber-50/50 border border-amber-200 text-amber-700 font-black text-xl rounded-xl py-4 pl-10 pr-4 outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all placeholder:text-amber-300/50" />
              </div>
            </div>

            <SelectField label="Esquema Bonos" name="tipoBonificacion" value={form.tipoBonificacion} onChange={handleChange} icon={Award}>
              {BONOS.map(b => <option key={b} value={b}>{b}</option>)}
            </SelectField>

            {(form.tipoBonificacion.includes("FIJO") || form.tipoBonificacion.includes("MIXTO")) && (
              <div className="mt-4 animate-in slide-in-from-top-2">
                <label className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest block mb-1.5 ml-1">Monto Fijo Adicional</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black">$</span>
                  <input type="number" name="montoBonoFijo" value={form.montoBonoFijo} onChange={handleChange} className="w-full bg-white border border-amber-200 text-amber-700 font-bold rounded-xl py-3 pl-8 pr-4" />
                </div>
              </div>
            )}
          </SectionCard>

          {/* SECCIÓN 6: UBICACIÓN */}
          <SectionCard title="Domicilio" icon={MapPin} colorCls="from-purple-500 to-fuchsia-500">
            <InputField label="Calle / Pasaje" name="calle" value={form.calle} onChange={handleChange} icon={MapPin} />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <InputField label="Número" name="numero" value={form.numero} onChange={handleChange} icon={Hash} />
              <InputField label="Depto/Block" name="deptoBlock" value={form.deptoBlock} onChange={handleChange} icon={Building} />
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4">
              <InputField label="Comuna" name="comuna" value={form.comuna} onChange={handleChange} icon={MapPin} />
            </div>
          </SectionCard>

          {/* SECCIÓN 7: OTROS */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Truck size={20} /></div>
                <div>
                  <p className="text-xs font-black text-slate-700 uppercase">Licencia Conducir</p>
                  <p className="text-[10px] text-slate-400">Requerido para flota</p>
                </div>
              </div>
              <SelectField name="requiereLicencia" value={form.requiereLicencia} onChange={handleChange} className="w-24 py-2 text-xs">
                <option value="NO">No</option>
                <option value="SI">Sí</option>
              </SelectField>
            </div>
            {form.requiereLicencia === 'SI' && (
              <div className="mt-4 animate-in zoom-in">
                <InputField type="date" label="Vencimiento" name="fechaVencimientoLicencia" value={form.fechaVencimientoLicencia} onChange={handleChange} className="bg-red-50 border-red-100 text-red-800 focus:border-red-300 py-2 text-xs" />
              </div>
            )}
          </div>

          {/* ACTION BUTTON */}
          <button type="submit" disabled={loading} className="w-full group relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-5 rounded-2xl font-black text-sm uppercase shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-3 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 mt-8 overflow-hidden">
            <div className="absolute inset-0 w-full h-full bg-white/20 group-hover:animate-ping opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
            {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
            Registrar Ficha Oficial
          </button>

        </div>
      </form>
    </div >
  );
};

export default FichaIngreso;