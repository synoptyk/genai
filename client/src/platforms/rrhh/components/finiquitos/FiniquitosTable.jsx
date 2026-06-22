import React, { useState } from 'react';
import { Search, Loader2, Eye } from 'lucide-react';
import SearchableSelect from '../../../../components/SearchableSelect';

const formatDateUTC = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return \`\${day}/\${month}/\${year}\`;
    } catch (e) {
        return '';
    }
};

export default function FiniquitosTable({ candidatos, loading, projects, onOpenDetalle }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const filtered = candidatos.filter(c => {
        const matchText = [c.fullName, c.rut, c.position, c.projectName, c.projectId?.nombreProyecto]
            .filter(Boolean).join(' ').toLowerCase();
        if (searchTerm && !matchText.includes(searchTerm.toLowerCase())) return false;
        if (filterProject !== 'all' && (c.projectId?._id || c.projectId) !== filterProject) return false;
        if (filterDateFrom) {
            const dd = new Date(c.fechaFiniquito || c.updatedAt);
            if (dd < new Date(filterDateFrom)) return false;
        }
        if (filterDateTo) {
            const dd = new Date(c.fechaFiniquito || c.updatedAt);
            if (dd > new Date(filterDateTo)) return false;
        }
        return true;
    });

    return (
        <>
            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nombre, RUT, proyecto"
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                    </div>
                </div>
                <div>
                    <SearchableSelect
                        value={filterProject}
                        onChange={val => setFilterProject(val)}
                        placeholder="Todos los proyectos"
                        options={[
                            { value: 'all', label: 'Todos los proyectos' },
                            ...projects.map(p => ({ value: p.id, label: p.name }))
                        ]}
                    />
                </div>
                <div>
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                </div>
                <div>
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                </div>
            </div>

            {/* Tabla */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-violet-500" size={36} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-20 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 font-bold text-sm">
                    No hay finiquitos registrados para estos filtros
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Colaborador</th>
                                    <th className="px-4 py-3">Proyecto</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Fecha Finiquito</th>
                                    <th className="px-4 py-3">Motivo</th>
                                    <th className="px-4 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => (
                                    <tr key={c._id} className="border-t border-slate-100 hover:bg-slate-50 transition-all">
                                        <td className="px-4 py-3">
                                            <p className="font-black text-slate-800">{c.fullName}</p>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">{c.rut}</p>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {c.projectName || c.projectId?.nombreProyecto || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <span className="text-xs font-black uppercase bg-red-100 text-red-600 px-2 py-1 rounded-full">
                                                    {c.status}
                                                </span>
                                                {c.finiquitoDetalle?.procesadoEn === 'Notaria' ? (
                                                    <span className={\`text-[9px] font-black uppercase px-2 py-0.5 rounded-md \${
                                                        c.finiquitoDetalle?.notariaEstado === 'Firmado' 
                                                            ? 'bg-emerald-100 text-emerald-700' 
                                                            : c.finiquitoDetalle?.notariaEstado === 'En Notaria'
                                                            ? 'bg-violet-100 text-violet-700'
                                                            : c.finiquitoDetalle?.notariaEstado === 'Rechazado'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-slate-100 text-slate-600'
                                                    }\`}>
                                                        🏛️ Notaría: {c.finiquitoDetalle?.notariaEstado || 'Pendiente'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                                                        📁 Módulo Interno
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {c.fechaFiniquito ? formatDateUTC(c.fechaFiniquito) : 'Sin fecha'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate">
                                            {c.finiquitoMotivo || 'No informado'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end">
                                                <button
                                                    onClick={() => onOpenDetalle(c)}
                                                    className="h-8 px-4 rounded-xl bg-slate-900 text-white text-[10px] uppercase font-black tracking-wider flex items-center justify-center gap-1.5 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
                                                >
                                                    <Eye size={14} /> Detalle / Editar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}
