import React, { useState, useEffect } from 'react';
import { FileText, Search, Loader2, Eye, Download, Upload, X, UserMinus, CheckCircle } from 'lucide-react';
import { candidatosApi, proyectosApi } from '../rrhhApi';

const MOTIVOS = [
    'Renuncia voluntaria (Art. 159 N°2)',
    'Mutuo acuerdo (Art. 159 N°1)',
    'Vencimiento del plazo (Art. 159 N°4)',
    'Necesidades de la empresa (Art. 161)',
    'Caso fortuito o fuerza mayor (Art. 159 N°6)',
    'Falta de probidad (Art. 160)',
    'Abandono del trabajo (Art. 160 N°4)',
    'Otro',
];

const Finiquitos = () => {
    const [candidatos, setCandidatos] = useState([]);
    const [contratados, setContratados] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [showDetail, setShowDetail] = useState(null);
    const [showFiniquitoModal, setShowFiniquitoModal] = useState(false);
    const [finiquitoTarget, setFiniquitoTarget] = useState(null);
    const [finiquitoData, setFiniquitoData] = useState({ fechaFiniquito: '', finiquitoMotivo: '' });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [legalFile, setLegalFile] = useState(null);
    const [contratadoSearch, setContratadoSearch] = useState('');

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [finiquitadosResp, contratadosResp, proyectosResp] = await Promise.all([
                candidatosApi.getFiniquitos(),
                candidatosApi.getAll({ status: 'Contratado' }),
                proyectosApi.getAll(),
            ]);
            setCandidatos(finiquitadosResp.data || []);
            setContratados(contratadosResp.data || []);
            const projs = (proyectosResp.data || []).map(p => ({
                id: p._id,
                name: p.nombreProyecto || p.projectName || p._id,
            }));
            setProjects(projs);
        } catch (err) {
            console.error('Error cargando datos de finiquitos', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRegistrarFiniquito = async () => {
        if (!finiquitoTarget) return alert('Selecciona un colaborador.');
        if (!finiquitoData.fechaFiniquito) return alert('Ingresa la fecha de finiquito.');
        if (!finiquitoData.finiquitoMotivo) return alert('Selecciona el motivo.');
        setSaving(true);
        try {
            await candidatosApi.updateStatus(finiquitoTarget._id, {
                status: 'Finiquitado',
                fechaFiniquito: finiquitoData.fechaFiniquito,
                finiquitoMotivo: finiquitoData.finiquitoMotivo,
                user: 'RRHH',
            });
            setShowFiniquitoModal(false);
            setFiniquitoTarget(null);
            setFiniquitoData({ fechaFiniquito: '', finiquitoMotivo: '' });
            setContratadoSearch('');
            await cargarDatos();
        } catch (err) {
            console.error(err);
            alert('Error al registrar finiquito.');
        } finally {
            setSaving(false);
        }
    };

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

    const total = candidatos.length;
    const recientes = candidatos.filter(c => {
        if (!c.fechaFiniquito) return false;
        const days = (Date.now() - new Date(c.fechaFiniquito).getTime()) / (1000 * 60 * 60 * 24);
        return days <= 30;
    }).length;

    const handleUpload = async (candidatoId) => {
        if (!legalFile) return alert('Adjunta un archivo primero.');
        const formData = new FormData();
        formData.append('file', legalFile);
        try {
            setUploading(true);
            await candidatosApi.uploadDocument(candidatoId, formData);
            alert('Documento legal subido con éxito');
            await cargarDatos();
        } catch (err) {
            console.error(err);
            alert('Error subiendo documento');
        } finally {
            setUploading(false);
            setLegalFile(null);
        }
    };

    const generateFiniquitoPdf = (candidato) => {
        const fechaFiniquito = candidato.fechaFiniquito
            ? new Date(candidato.fechaFiniquito).toLocaleDateString()
            : 'No disponible';
        const projectName = candidato.projectName || candidato.projectId?.nombreProyecto || 'No asignado';
        const html = `
            <html>
            <head>
                <title>Acta de Finiquito - ${candidato.fullName}</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #1f2937; margin: 40px; }
                    h1 { font-size: 22px; letter-spacing: 0.02em; margin-bottom: 12px; }
                    .meta { margin-bottom: 20px; }
                    .meta span { display: inline-block; min-width: 170px; font-weight: 700; }
                    .section { margin-top: 24px; }
                    .section-title { font-size: 14px; font-weight: 900; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
                    .text { line-height: 1.6; font-size: 13px; }
                    .firmas { display: flex; justify-content: space-between; margin-top: 50px; }
                    .firma-box { width: 45%; text-align: center; margin-top: 30px; }
                    .linea { border-top: 1px solid #666; margin-top: 40px; }
                </style>
            </head>
            <body>
                <h1>Acta de Finiquito</h1>
                <div class="meta">
                    <p><span>Nombre:</span> ${candidato.fullName || 'No informado'}</p>
                    <p><span>RUT:</span> ${candidato.rut || 'No informado'}</p>
                    <p><span>Proyecto:</span> ${projectName}</p>
                    <p><span>Fecha de finiquito:</span> ${fechaFiniquito}</p>
                    <p><span>Motivo:</span> ${candidato.finiquitoMotivo || 'No informado'}</p>
                    <p><span>Estado:</span> ${candidato.status || 'No informado'}</p>
                </div>
                <div class="section">
                    <div class="section-title">Detalle legal</div>
                    <div class="text">
                        Se deja constancia que el colaborador arriba mencionado ha finalizado su relación laboral con la empresa bajo condiciones mutuamente acordadas.
                        El pago de remuneraciones y beneficios ha sido verificado; la documentación contractual elaborada y recibida se adjunta al presente acta.
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">Certificación del proceso</div>
                    <div class="text">
                        El proceso de finiquito se realizó en conformidad con la normativa vigente y con la supervisión del área de RRHH.
                        Esta acta sirve como comprobante formal de terminación laboral y cobertura de obligaciones legales.
                    </div>
                </div>
                <div class="firmas">
                    <div class="firma-box">
                        <div class="linea"></div>
                        <p>Firma Colaborador</p>
                    </div>
                    <div class="firma-box">
                        <div class="linea"></div>
                        <p>Firma RRHH</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return alert('No se pudo abrir ventana de impresión, verifica el bloqueador de popups.');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    const contratadosFiltrados = contratados.filter(c => {
        if (!contratadoSearch) return true;
        const q = contratadoSearch.toLowerCase();
        return [c.fullName, c.rut, c.position].filter(Boolean).join(' ').toLowerCase().includes(q);
    });

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg shadow-slate-200">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">Finiquitos</h1>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Gestión integral de desvinculaciones y legalización</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFiniquitoModal(true)}
                        className="px-4 py-2 rounded-xl bg-red-500 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 transition-colors"
                    >
                        <UserMinus size={14} /> Registrar Finiquito
                    </button>
                    <span className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest">Total: {total}</span>
                    <span className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest">Últimos 30d: {recientes}</span>
                </div>
            </div>

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
                    <select
                        value={filterProject}
                        onChange={e => setFilterProject(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        <option value="all">Todos los proyectos</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Colaborador</th>
                                    <th className="px-4 py-3">Proyecto</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Fecha Finiquito</th>
                                    <th className="px-4 py-3">Motivo</th>
                                    <th className="px-4 py-3">Acciones</th>
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
                                            <span className="text-xs font-black uppercase bg-red-100 text-red-600 px-2 py-1 rounded-full">
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {c.fechaFiniquito ? new Date(c.fechaFiniquito).toLocaleDateString() : 'Sin fecha'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate">
                                            {c.finiquitoMotivo || 'No informado'}
                                        </td>
                                        <td className="px-4 py-3 flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setShowDetail(c)}
                                                className="px-2 py-1 rounded-lg bg-violet-600 text-white text-[10px] uppercase font-black flex items-center gap-1 hover:bg-violet-700 transition-colors"
                                            >
                                                <Eye size={12} /> Detalle
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal: Registrar Finiquito */}
            {showFiniquitoModal && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowFiniquitoModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <UserMinus size={18} className="text-red-500" />
                                <h3 className="text-lg font-black uppercase text-slate-800">Registrar Finiquito</h3>
                            </div>
                            <button onClick={() => setShowFiniquitoModal(false)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Buscar colaborador */}
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Colaborador Contratado</label>
                                <input
                                    value={contratadoSearch}
                                    onChange={e => { setContratadoSearch(e.target.value); setFiniquitoTarget(null); }}
                                    placeholder="Buscar por nombre o RUT..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                />
                                {contratadoSearch && !finiquitoTarget && (
                                    <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                                        {contratadosFiltrados.length === 0 ? (
                                            <p className="text-xs text-slate-400 p-3">Sin resultados</p>
                                        ) : contratadosFiltrados.map(c => (
                                            <button
                                                key={c._id}
                                                onClick={() => { setFiniquitoTarget(c); setContratadoSearch(c.fullName); }}
                                                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                                            >
                                                <p className="text-sm font-bold text-slate-800">{c.fullName}</p>
                                                <p className="text-[10px] text-slate-400 uppercase">{c.rut} · {c.position}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {finiquitoTarget && (
                                    <div className="mt-2 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                                        <CheckCircle size={14} className="text-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-700">{finiquitoTarget.fullName} — {finiquitoTarget.rut}</span>
                                    </div>
                                )}
                            </div>

                            {/* Fecha */}
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Fecha de Finiquito</label>
                                <input
                                    type="date"
                                    value={finiquitoData.fechaFiniquito}
                                    onChange={e => setFiniquitoData(d => ({ ...d, fechaFiniquito: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                />
                            </div>

                            {/* Motivo */}
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Motivo</label>
                                <select
                                    value={finiquitoData.finiquitoMotivo}
                                    onChange={e => setFiniquitoData(d => ({ ...d, finiquitoMotivo: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                >
                                    <option value="">Seleccionar motivo...</option>
                                    {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                            <button
                                onClick={() => setShowFiniquitoModal(false)}
                                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-black uppercase"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRegistrarFiniquito}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60 hover:bg-red-600 transition-colors"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                                {saving ? 'Guardando...' : 'Confirmar Finiquito'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Detalle */}
            {showDetail && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowDetail(null)}
                >
                    <div
                        className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-black uppercase text-slate-800">Ficha de finiquito — {showDetail.fullName}</h3>
                            <button onClick={() => setShowDetail(null)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase text-slate-400">Datos laborales</p>
                                <div className="space-y-1 text-sm">
                                    <p><span className="font-bold text-slate-600">Cargo:</span> {showDetail.cargo || showDetail.position || 'N/A'}</p>
                                    <p><span className="font-bold text-slate-600">Contrato:</span> {showDetail.contractType || 'No definido'}</p>
                                    <p><span className="font-bold text-slate-600">Ingreso:</span> {showDetail.contractStartDate ? new Date(showDetail.contractStartDate).toLocaleDateString() : 'N/A'}</p>
                                    <p><span className="font-bold text-slate-600">Finiquito:</span> {showDetail.fechaFiniquito ? new Date(showDetail.fechaFiniquito).toLocaleDateString() : 'N/A'}</p>
                                    <p><span className="font-bold text-slate-600">Motivo:</span> {showDetail.finiquitoMotivo || 'N/A'}</p>
                                    <p><span className="font-bold text-slate-600">Proyecto:</span> {showDetail.projectName || showDetail.projectId?.nombreProyecto || 'N/A'}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-black uppercase text-slate-400 mb-2">Documentos asociados</p>
                                <div className="space-y-2">
                                    {(showDetail.documents || [])
                                        .filter(d => d.docType?.toLowerCase().includes('finiquito') || d.docType?.toLowerCase().includes('legal'))
                                        .map((doc, i) => (
                                            <div key={i} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                                                <span className="text-xs font-bold uppercase text-slate-600">{doc.docType}</span>
                                                <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600 hover:underline">Ver</a>
                                            </div>
                                        ))}
                                    {(!showDetail.documents || showDetail.documents.filter(d => d.docType?.toLowerCase().includes('finiquito') || d.docType?.toLowerCase().includes('legal')).length === 0) && (
                                        <p className="text-xs text-slate-400">No hay documentos cargados.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50">
                            <div className="flex flex-col gap-2 md:flex-row items-center flex-wrap">
                                <input
                                    type="file"
                                    onChange={e => setLegalFile(e.target.files[0] || null)}
                                    className="text-xs"
                                />
                                <button
                                    onClick={() => handleUpload(showDetail._id)}
                                    disabled={uploading || !legalFile}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60 hover:bg-emerald-700 transition-colors"
                                >
                                    <Upload size={14} /> {uploading ? 'Subiendo...' : 'Subir doc. legal'}
                                </button>
                                <button
                                    onClick={() => generateFiniquitoPdf(showDetail)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-colors"
                                >
                                    <FileText size={14} /> Generar Acta PDF
                                </button>
                                <a
                                    href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(showDetail, null, 2))}`}
                                    download={`finiquito-${showDetail.rut || showDetail._id}.json`}
                                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-colors"
                                >
                                    <Download size={14} /> Exportar JSON
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Finiquitos;
