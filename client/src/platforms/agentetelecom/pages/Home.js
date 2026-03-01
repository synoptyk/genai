import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  TrendingUp, Users, Activity, 
  Clock, DollarSign, Calendar, 
  Server, PieChart as PieIcon, BarChart3, Target, AlertTriangle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  PieChart, Pie, Cell 
} from 'recharts';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Estado de Datos Reales
  const [rankingTecnicos, setRankingTecnicos] = useState([]);
  const [distribucionClientes, setDistribucionClientes] = useState([]);
  
  // Métricas Inteligentes (Sincronizadas con Producción)
  const [metrics, setMetrics] = useState({ 
    ingresoReal: 0,
    ingresoProyectado: 0,
    puntosReales: 0,
    puntosMeta: 0,
    cumplimiento: 0,
    dotacion: { sobre: 0, dentro: 0, bajo: 0, total: 0 }
  });

  const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

  // --- 1. MOTOR DE INTELIGENCIA DE NEGOCIOS ---
  const fetchData = async () => {
    try {
      // Cargamos en paralelo Producción Real y Configuración de Clientes (Metas)
      const [resProd, resClientes] = await Promise.all([
        axios.get('http://localhost:5001/api/produccion'),
        axios.get('http://localhost:5001/api/clientes')
      ]);

      const dataRaw = resProd.data || [];
      const clientesConfig = resClientes.data || [];

      // Mapa de Metas por Cliente (Para calcular semáforo)
      const metasMap = {};
      clientesConfig.forEach(c => {
          metasMap[c.nombre] = c.metaDiariaActual || 175; // Default 175 si no existe config
      });

      if (dataRaw.length > 0) {
        // --- VARIABLES DE TIEMPO ---
        const now = new Date();
        const diaActual = Math.min(now.getDate(), 30); // Día del mes (tope 30 para cálculo)
        
        // --- CÁLCULOS GLOBALES ---
        const totalIngreso = dataRaw.reduce((acc, cur) => acc + (cur.totalIngresos || 0), 0);
        const totalPuntos = dataRaw.reduce((acc, cur) => acc + (cur.totalPuntos || 0), 0);

        // Proyección Lineal Inteligente: (Lo que llevo / días que pasaron) * 30 días
        const ingresoProyectado = diaActual > 0 ? (totalIngreso / diaActual) * 30 : 0;

        // --- ANÁLISIS DOTACIÓN (SEMÁFORO DE RENDIMIENTO) ---
        let sobre = 0, dentro = 0, bajo = 0;
        
        dataRaw.forEach(tec => {
            // Meta Individual Ajustada al día de hoy (Ej: Si es día 15, la meta es el 50% del total)
            const metaMensualCliente = metasMap[tec.cliente] || 175;
            const metaAlDiaDeHoy = (metaMensualCliente / 30) * diaActual;
            
            // Rendimiento del técnico vs lo que debería llevar hoy
            const rendimiento = metaAlDiaDeHoy > 0 ? (tec.totalPuntos / metaAlDiaDeHoy) * 100 : 0;

            if (rendimiento >= 100) sobre++;       // Zona Verde (Bonos)
            else if (rendimiento >= 70) dentro++;  // Zona Azul (Estándar)
            else bajo++;                           // Zona Roja (Riesgo)
        });

        // --- PROCESAMIENTO GRÁFICOS ---
        // 1. Torta Ingresos (Share of Wallet)
        const clienteMap = {};
        dataRaw.forEach(item => {
            const clienteName = item.cliente || 'SIN ASIGNAR';
            if(!clienteMap[clienteName]) clienteMap[clienteName] = 0;
            clienteMap[clienteName] += item.totalIngresos;
        });
        const pieData = Object.keys(clienteMap).map(key => ({ name: key, value: clienteMap[key] })).sort((a, b) => b.value - a.value);

        // 2. Ranking Top 8 Productividad
        const topTecnicos = [...dataRaw].sort((a, b) => b.totalPuntos - a.totalPuntos).slice(0, 8);

        // ACTUALIZAR ESTADOS
        setMetrics({
            ingresoReal: totalIngreso,
            ingresoProyectado: ingresoProyectado,
            puntosReales: totalPuntos,
            puntosMeta: 0, 
            cumplimiento: 0, 
            dotacion: { sobre, dentro, bajo, total: dataRaw.length }
        });

        setRankingTecnicos(topTecnicos);
        setDistribucionClientes(pieData);
        setLastUpdate(new Date());

      } else {
        // Reset si no hay datos en DB
        setMetrics({ ingresoReal: 0, ingresoProyectado: 0, puntosReales: 0, puntosMeta: 0, cumplimiento: 0, dotacion: { sobre: 0, dentro: 0, bajo: 0, total: 0 } });
        setRankingTecnicos([]);
        setDistribucionClientes([]);
      }

    } catch (error) { 
      console.error("Error Critical Dashboard:", error); 
    } finally {
      setLoading(false);
    }
  };

  // Ciclo de vida: Carga inicial y refresco cada 15 segundos
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); 
    return () => clearInterval(interval);
  }, []);

  // Formateadores de Moneda y Números
  const formatMoney = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);
  const formatNum = (val) => val.toLocaleString('es-CL', { maximumFractionDigits: 1 });

  // Componente Reutilizable: Tarjeta KPI
  const KpiCard = ({ label, value, sub, icon, color, bg, trend }) => (
    <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
       <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-${color}-600`}>
          {icon}
       </div>
       <div className="flex flex-col h-full justify-between">
          <div>
             <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${bg} text-${color}-600`}>
                   {React.cloneElement(icon, { size: 20 })}
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
             </div>
             <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
                {loading ? <span className="animate-pulse opacity-50">...</span> : value}
             </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
             <span className="text-[10px] font-bold text-slate-500">{sub}</span>
             {trend && (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded ${trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                   {trend === 'up' ? 'PROYECCIÓN' : 'REAL'}
                </span>
             )}
          </div>
       </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-700 pb-10">
      
      {/* HEADER EJECUTIVO */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-800 italic tracking-tighter">
            Dashboard <span className="text-blue-600">Master</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold tracking-widest mt-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            CONEXIÓN DB ACTIVA • {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Sincronizando...'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 px-5 py-2 rounded-xl shadow-sm flex items-center gap-3 text-slate-600 text-sm font-bold">
          <Calendar size={18} className="text-blue-500"/>
          {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
        </div>
      </div>

      {/* 1. SECCIÓN FINANCIERA (REAL VS PROYECTADO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Ingreso Real */}
        <KpiCard 
          label="Facturación Acumulada" 
          value={formatMoney(metrics.ingresoReal)}
          sub="Cierre al día de hoy"
          icon={<DollarSign size={40}/>}
          color="emerald"
          bg="bg-emerald-50"
          trend="real"
        />
        {/* Card 2: Proyección */}
        <KpiCard 
          label="Proyección Cierre Mes" 
          value={formatMoney(metrics.ingresoProyectado)}
          sub="Estimación lineal (Tendencia)"
          icon={<TrendingUp size={40}/>}
          color="blue"
          bg="bg-blue-50"
          trend="up"
        />
        {/* Card 3: Producción Física */}
        <KpiCard 
          label="Puntos Baremos" 
          value={formatNum(metrics.puntosReales)}
          sub="Producción técnica neta"
          icon={<Activity size={40}/>}
          color="indigo"
          bg="bg-indigo-50"
        />
        {/* Card 4: Fuerza Laboral */}
        <KpiCard 
          label="Técnicos Activos" 
          value={metrics.dotacion.total}
          sub="Dotación con producción > 0"
          icon={<Users size={40}/>}
          color="amber"
          bg="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* 2. SEMÁFORO DE SALUD OPERATIVA (TRAÍDO DE PRODUCCIÓN) */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Target className="text-purple-600" size={20}/> Salud de la Dotación
                </h3>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">
                    VS METAS MENSUALES
                </span>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-6">
                {/* Sobre Meta (Verde) */}
                <div className="relative">
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Sobre Meta (Bonos)</span>
                        <span>{metrics.dotacion.total > 0 ? Math.round((metrics.dotacion.sobre / metrics.dotacion.total) * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(metrics.dotacion.sobre / metrics.dotacion.total) * 100}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{metrics.dotacion.sobre} Técnicos con excelente rendimiento</p>
                </div>

                {/* En Rango (Azul) */}
                <div className="relative">
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> En Rango (Estándar)</span>
                        <span>{metrics.dotacion.total > 0 ? Math.round((metrics.dotacion.dentro / metrics.dotacion.total) * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(metrics.dotacion.dentro / metrics.dotacion.total) * 100}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{metrics.dotacion.dentro} Técnicos cumpliendo lo esperado</p>
                </div>

                {/* Bajo Meta (Rojo) */}
                <div className="relative">
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Riesgo / Bajo</span>
                        <span>{metrics.dotacion.total > 0 ? Math.round((metrics.dotacion.bajo / metrics.dotacion.total) * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${(metrics.dotacion.bajo / metrics.dotacion.total) * 100}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{metrics.dotacion.bajo} Técnicos requieren supervisión</p>
                </div>
            </div>
        </div>

        {/* 3. SHARE DE INGRESOS (TORTA) */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                 <PieIcon className="text-blue-600" size={20}/> Composición de Ingresos
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">
                 POR MANDANTE
              </span>
           </div>

           <div className="flex flex-col md:flex-row items-center h-full">
              <div className="flex-1 h-[250px] w-full">
                  {distribucionClientes.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={distribucionClientes}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={5}
                              dataKey="value"
                           >
                              {distribucionClientes.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                           </Pie>
                           <Tooltip formatter={(value) => formatMoney(value)} />
                        </PieChart>
                     </ResponsiveContainer>
                  ) : (
                     <div className="h-full flex items-center justify-center text-slate-300 text-xs font-bold">SIN DATOS PARA GRÁFICO</div>
                  )}
              </div>
              
              {/* Leyenda Personalizada */}
              <div className="flex-1 grid grid-cols-1 gap-3 w-full pl-0 md:pl-8">
                  {distribucionClientes.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                              <span className="text-xs font-bold text-slate-700">{entry.name}</span>
                          </div>
                          <div className="text-right">
                              <span className="block text-xs font-black text-slate-800">{formatMoney(entry.value)}</span>
                              <span className="text-[10px] text-slate-400">
                                  {metrics.ingresoReal > 0 ? Math.round((entry.value / metrics.ingresoReal) * 100) : 0}% del total
                              </span>
                          </div>
                      </div>
                  ))}
              </div>
           </div>
        </div>

      </div>

      {/* 4. RANKING EJECUTIVO (BARRAS HORIZONTALES) */}
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <BarChart3 className="text-emerald-600" size={20}/> Top Productividad (Puntos Baremos)
             </h3>
             <button className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-default">
                MEJORES TÉCNICOS DEL MES <TrendingUp size={12}/>
             </button>
          </div>

          <div className="h-[300px] w-full">
             {rankingTecnicos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={rankingTecnicos} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="nombre" tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} tickFormatter={(val) => val.split(' ')[0]} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip 
                         cursor={{fill: '#f8fafc', radius: 8}}
                         contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                         formatter={(value) => [`${value} Pts`, 'Puntos']}
                      />
                      <Bar dataKey="totalPuntos" fill="#3b82f6" radius={[8, 8, 8, 8]} barSize={40}>
                        {rankingTecnicos.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index < 3 ? '#10b981' : '#3b82f6'} />
                        ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             ) : (
                <div className="h-full flex items-center justify-center text-slate-300 text-xs font-bold">
                    EJECUTA EL AGENTE TOA PARA CARGAR DATOS
                </div>
             )}
          </div>
      </div>

      {/* FOOTER ESTADO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
         <div className="bg-slate-900 rounded-2xl p-5 flex items-center gap-4 text-white shadow-lg">
            <div className="p-3 bg-white/10 rounded-xl"><Server size={20}/></div>
            <div>
               <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Infraestructura</p>
               <p className="font-bold text-sm">MongoDB Atlas <span className="text-emerald-400">● Online</span></p>
            </div>
         </div>
         <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Clock size={20}/></div>
            <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronización</p>
               <p className="font-bold text-sm text-slate-700">Bot Programado: <span className="text-blue-600">23:00 hrs</span></p>
            </div>
         </div>
         
         {/* Alerta si no hay ingresos */}
         {metrics.ingresoReal === 0 && !loading && (
             <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm animate-pulse">
                <div className="p-3 bg-white rounded-xl text-amber-500"><AlertTriangle size={20}/></div>
                <div>
                   <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Sin Datos</p>
                   <p className="font-bold text-xs text-amber-800">Ve a Ajustes y ejecuta "Forzar Bot"</p>
                </div>
             </div>
         )}
      </div>

    </div>
  );
};

export default Dashboard;