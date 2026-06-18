import React, { useState } from 'react';
import { Users, X, Search, ArrowRight } from 'lucide-react';

const DirectoryModal = ({ contacts = [], onClose, onSelect, actionText = "Añadir Destinatarios", headerContent }) => {
    const [selectedItems, setSelectedItems] = useState(new Set()); // Pueden ser emails o _ids dependiendo de lo que reciba contacts
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPosition, setFilterPosition] = useState('Todos');
    const [filterArea, setFilterArea] = useState('Todas');

    // Mapeo seguro de atributos (Email vs Chat Contact)
    // En Webmail: fullName o name, email, position, departamento
    // En Chat: name, email, cargo, role, empresaRef
    const getPos = (c) => c.position || c.cargo || c.role || '';
    const getArea = (c) => c.departamento || '';
    const getId = (c) => c.email || c._id; // Usar email para webmail, _id para chat

    const positions = ['Todos', ...new Set(contacts.map(c => getPos(c)).filter(Boolean))].sort();
    const areas = ['Todas', ...new Set(contacts.map(c => getArea(c)).filter(Boolean))].sort();

    const filteredContacts = contacts.filter(c => {
        if (filterPosition !== 'Todos' && getPos(c) !== filterPosition) return false;
        if (filterArea !== 'Todas' && getArea(c) !== filterArea) return false;
        
        const nameSearch = (c.name || c.fullName || '').toLowerCase();
        const emailSearch = (c.email || '').toLowerCase();
        const searchLow = searchTerm.toLowerCase();

        if (searchTerm && !nameSearch.includes(searchLow) && !emailSearch.includes(searchLow)) return false;
        return true;
    });

    const handleToggle = (id) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    const handleToggleAll = () => {
        if (selectedItems.size === filteredContacts.length && filteredContacts.length > 0) {
            setSelectedItems(new Set());
        } else {
            const newSet = new Set(selectedItems);
            filteredContacts.forEach(c => newSet.add(getId(c)));
            setSelectedItems(newSet);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-4xl h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight">Directorio 360</h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Selección masiva de la organización</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                {headerContent && (
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                        {headerContent}
                    </div>
                )}
                
                <div className="flex flex-col sm:flex-row p-4 gap-3 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Buscar por nombre o correo..." 
                            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex gap-3">
                        <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            value={filterPosition} onChange={e => setFilterPosition(e.target.value)}>
                            {positions.map(p => <option key={p} value={p}>{p === 'Todos' ? 'Cargos (Todos)' : p}</option>)}
                        </select>
                        <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            value={filterArea} onChange={e => setFilterArea(e.target.value)}>
                            {areas.map(a => <option key={a} value={a}>{a === 'Todas' ? 'Áreas (Todas)' : a}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar p-2">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white/90 backdrop-blur-md shadow-sm z-10 text-[10px] uppercase font-black tracking-widest text-slate-400">
                            <tr>
                                <th className="p-3 w-12 text-center border-b border-slate-100">
                                    <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                        checked={filteredContacts.length > 0 && selectedItems.size === filteredContacts.length}
                                        onChange={handleToggleAll} />
                                </th>
                                <th className="p-3 border-b border-slate-100">Trabajador</th>
                                <th className="p-3 border-b border-slate-100">Cargo</th>
                                <th className="p-3 border-b border-slate-100">Área/Depto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredContacts.map((c, idx) => {
                                const id = getId(c);
                                const isSelected = selectedItems.has(id);
                                return (
                                <tr key={`${id}-${idx}`} className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`} onClick={() => handleToggle(id)}>
                                    <td className="p-3 text-center">
                                        <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                            checked={isSelected} onChange={() => {}} />
                                    </td>
                                    <td className="p-3">
                                        <p className="text-sm font-bold text-slate-700">{c.fullName || c.name}</p>
                                        <p className="text-[11px] text-slate-500">{c.email || ''}</p>
                                    </td>
                                    <td className="p-3 text-xs font-semibold text-slate-600">
                                        <span className="bg-slate-100 px-2 py-1 rounded text-slate-500">{getPos(c) || 'N/A'}</span>
                                    </td>
                                    <td className="p-3 text-xs font-semibold text-slate-600">
                                        {getArea(c) || 'N/A'}
                                    </td>
                                </tr>
                            )})}
                            {filteredContacts.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center py-16 text-slate-400">
                                        <Users size={32} className="mx-auto mb-3 opacity-20" />
                                        <span className="text-sm font-bold uppercase tracking-widest">No se encontraron resultados</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-white shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.02)] z-20">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">{selectedItems.size}</span>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Seleccionados</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
                        <button onClick={() => { 
                                // Para enviar los objetos completos seleccionados, no solo IDs
                                const selectedObjects = contacts.filter(c => selectedItems.has(getId(c)));
                                onSelect(Array.from(selectedItems), selectedObjects); 
                                onClose(); 
                            }} 
                            disabled={selectedItems.size === 0}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:shadow-none flex items-center gap-2">
                            {actionText} <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DirectoryModal;
