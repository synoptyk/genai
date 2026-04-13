import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  X,
  XCircle
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import api from '../../../api/api';
import { candidatosApi } from '../../rrhh/rrhhApi';
import logisticaApi from '../../logistica/logisticaApi';
import FichaIngresoPremium from '../../../components/FichaIngresoPremium';
import FirmaAvanzada from '../../../components/FirmaAvanzada';
import { useCheckPermission } from '../../../hooks/useCheckPermission';

const PURCHASE_STATUS_BADGE = {
  Pendiente: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pendiente' },
  'Revision Gerencia': { cls: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Revisión Gerencia' },
  Aprobada: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Aprobada' },
  Rechazada: { cls: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Rechazada' },
  Ordenada: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'OC Emitida' }
};

const PRIORITY_STYLES = {
  alta: 'bg-rose-50 text-rose-700 border-rose-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  baja: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

const SLA_STYLES = {
  vencido: 'bg-rose-50 text-rose-700 border-rose-200',
  riesgo: 'bg-amber-50 text-amber-700 border-amber-200',
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

const DOMAIN_META = {
  rrhh: {
    label: 'RRHH',
    icon: CheckSquare,
    badge: 'bg-violet-50 text-violet-700 border-violet-200'
  },
  compras: {
    label: 'Compras',
    icon: ShoppingCart,
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  operaciones: {
    label: 'Operaciones',
    icon: AlertCircle,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
};

const matchesApprovalUser = (step, user) => {
  if (!step || !user) return false;
  return step.email === user.email || (user.corporateEmail && step.email === user.corporateEmail);
};

const buildSla = (createdAt) => {
  if (!createdAt) return { bucket: 'normal', label: 'Sin SLA', hours: 0 };

  const hours = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 3600000));
  if (hours >= 72) return { bucket: 'vencido', label: `SLA vencido · ${hours}h`, hours };
  if (hours >= 24) return { bucket: 'riesgo', label: `En riesgo · ${hours}h`, hours };
  return { bucket: 'normal', label: `En tiempo · ${hours}h`, hours };
};

const getRrhhPriority = (approvalType, details) => {
  if (approvalType === 'Ingreso') return 'alta';
  if ((details?.diasHabiles || 0) >= 10) return 'alta';
  if ((details?.diasHabiles || 0) >= 5) return 'media';
  return 'baja';
};

const getPurchasePriority = (prioridad) => {
  if (prioridad === 'Urgente') return 'alta';
  if (prioridad === 'Media') return 'media';
  return 'baja';
};

const getRrhhStatus = (item) => {
  const rejected = item.currentChain?.some((step) => step.status === 'Rechazado');
  if (rejected) return 'Rechazado';
  const approvedCount = item.currentChain?.filter((step) => step.status === 'Aprobado').length || 0;
  return `${approvedCount}/${item.currentChain?.length || 0} aprobaciones`;
};

const clonePurchase = (purchase) => ({
  ...purchase,
  items: (purchase.items || []).map((item) => ({ ...item })),
  historial: Array.isArray(purchase.historial) ? [...purchase.historial] : [],
  _original: {
    items: (purchase.items || []).map((item) => ({ ...item }))
  }
});

const normalizeRrhhItems = (candidates) => {
  const pending = [];

  (candidates || []).forEach((person) => {
    if (person.validationRequested && person.status !== 'Contratado' && person.status !== 'Rechazado') {
      pending.push({
        id: `${person._id}-ingreso`,
        domain: 'rrhh',
        _id: person._id,
        fullName: person.fullName,
        rut: person.rut,
        position: person.position,
        createdAt: person.createdAt,
        status: person.status,
        approvalType: 'Ingreso',
        currentChain: person.approvalChain || [],
        priority: getRrhhPriority('Ingreso'),
        sla: buildSla(person.createdAt),
        raw: person
      });
    }

    (person.vacaciones || []).forEach((vacacion) => {
      if (vacacion.validationRequested && vacacion.estado === 'Pendiente') {
        pending.push({
          id: `${person._id}-${vacacion.id || vacacion._id || 'vacacion'}`,
          domain: 'rrhh',
          _id: person._id,
          fullName: person.fullName,
          rut: person.rut,
          position: person.position,
          createdAt: vacacion.createdAt || person.updatedAt || person.createdAt,
          approvalType: vacacion.tipo,
          currentChain: vacacion.approvalChain || [],
          vacacionId: vacacion.id || vacacion._id,
          details: vacacion,
          priority: getRrhhPriority(vacacion.tipo, vacacion),
          sla: buildSla(vacacion.createdAt || person.updatedAt || person.createdAt),
          raw: person
        });
      }
    });
  });

  return pending;
};

const normalizePurchaseItems = (purchases) => {
  return (purchases || []).map((purchase) => ({
    ...clonePurchase(purchase),
    id: purchase._id,
    domain: 'compras',
    priorityBucket: getPurchasePriority(purchase.prioridad),
    priority: purchase.prioridad || 'Normal',
    sla: buildSla(purchase.createdAt)
  }));
};

const normalizeOperationItems = (inspecciones, combustibles) => {
  const inspectionItems = (inspecciones || [])
    .filter((i) => ['En Revisión', 'Revision Jefatura', 'Revision Gerencia'].includes(i.estado))
    .map((i) => ({
      id: `insp-${i._id}`,
      domain: 'operaciones',
      opType: 'inspeccion',
      _id: i._id,
      fullName: i.nombreTrabajador,
      rut: i.rutTrabajador,
      approvalType: i.tipo === 'epp' ? 'Inspección EPP' : 'Cumplimiento Prevención',
      createdAt: i.createdAt,
      status: i.estado,
      resultado: i.resultado,
      detalle: i.detalleAlerta,
      observaciones: i.observaciones,
      prioridadRaw: i.alertaHse ? 'alta' : 'media',
      priority: i.alertaHse ? 'alta' : 'media',
      sla: buildSla(i.createdAt),
      raw: i
    }));

  const fuelItems = (combustibles || [])
    .filter((f) => ['Pendiente', 'Revision Gerencia'].includes(f.estado))
    .map((f) => ({
      id: `fuel-${f._id}`,
      domain: 'operaciones',
      opType: 'combustible',
      _id: f._id,
      fullName: f.nombre,
      rut: f.rut,
      approvalType: 'Solicitud Combustible',
      createdAt: f.createdAt || f.fecha,
      status: f.estado,
      patente: f.patente,
      kmActual: f.kmActual,
      comentarioSupervisor: f.comentarioSupervisor,
      priority: f.estado === 'Pendiente' ? 'alta' : 'media',
      sla: buildSla(f.createdAt || f.fecha),
      raw: f
    }));

  return [...inspectionItems, ...fuelItems];
};

const Aprobaciones360 = () => {
  const { user } = useAuth();
  const { hasPermission } = useCheckPermission();
  const canApproveRrhh = hasPermission('admin_aprobaciones', 'editar');
  const canApproveCompras = hasPermission('admin_aprobaciones_compras', 'editar');
  const canApproveOperaciones = hasPermission('admin_aprobaciones', 'editar') || hasPermission('admin_aprobaciones_compras', 'editar');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState('all');
  const [rrhhItems, setRrhhItems] = useState([]);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [operationItems, setOperationItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchaseComment, setPurchaseComment] = useState('');
  const [purchaseObservation, setPurchaseObservation] = useState('');
  const [rrhhComment, setRrhhComment] = useState('');
  const [currentStepFirma, setCurrentStepFirma] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const fetchAll = async (selectionToKeep = null) => {
    setLoading(true);
    try {
      const [rrhhRes, purchaseRes, inspeccionesRes, combustibleRes] = await Promise.all([
        candidatosApi.getAll(),
        logisticaApi.get('/solicitudes-compra'),
        api.get('/api/prevencion/inspecciones').catch(() => ({ data: [] })),
        api.get('/api/operaciones/combustible/aprobaciones').catch(() => ({ data: [] }))
      ]);

      const nextRrhh = normalizeRrhhItems(rrhhRes.data || []);
      const nextPurchases = normalizePurchaseItems(purchaseRes.data || []);
      const nextOperations = normalizeOperationItems(inspeccionesRes.data || [], combustibleRes.data || []);

      setRrhhItems(nextRrhh);
      setPurchaseItems(nextPurchases);
      setOperationItems(nextOperations);

      const nextCombined = [...nextRrhh, ...nextPurchases, ...nextOperations].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      const targetSelection = selectionToKeep || selectedItem;
      if (targetSelection) {
        const found = nextCombined.find((item) => item.id === targetSelection.id && item.domain === targetSelection.domain);
        setSelectedItem(found || nextCombined[0] || null);
      } else {
        setSelectedItem(nextCombined[0] || null);
      }
    } catch (error) {
      console.error('Error loading approvals center', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    setPurchaseComment('');
    setPurchaseObservation('');
    setRrhhComment('');
    setCurrentStepFirma(null);
  }, [selectedItem?.id, selectedItem?.domain]);

  const allItems = useMemo(() => {
    return [...rrhhItems, ...purchaseItems, ...operationItems].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [operationItems, purchaseItems, rrhhItems]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return allItems.filter((item) => {
      const matchesDomain = domainFilter === 'all' || item.domain === domainFilter;
      const itemPriority = item.domain === 'compras' ? item.priorityBucket : item.priority;
      const matchesPriority = priorityFilter === 'all' || itemPriority === priorityFilter;
      const matchesSla = slaFilter === 'all' || item.sla.bucket === slaFilter;

      if (!matchesDomain || !matchesPriority || !matchesSla) return false;

      if (!term) return true;

      const haystack = [
        item.fullName,
        item.rut,
        item.position,
        item.approvalType,
        item.motivo,
        item.patente,
        item.detalle,
        item.solicitante?.name,
        item.tipoCompra,
        item.status,
        item.priority
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(term);
    });
  }, [allItems, domainFilter, priorityFilter, searchTerm, slaFilter]);

  const currentRrhhStep = useMemo(() => {
    if (!selectedItem || selectedItem.domain !== 'rrhh') return null;
    return selectedItem.currentChain?.find((step) => step.status === 'Pendiente' && matchesApprovalUser(step, user)) || null;
  }, [selectedItem, user]);

  const pendingCount = useMemo(() => {
    return allItems.filter((item) => {
      if (item.domain === 'compras') return ['Pendiente', 'Revision Gerencia'].includes(item.status);
      if (item.domain === 'operaciones') return ['Pendiente', 'En Revisión', 'Revision Jefatura', 'Revision Gerencia'].includes(item.status);
      return item.currentChain?.some((step) => step.status === 'Pendiente');
    }).length;
  }, [allItems]);

  const executiveMetrics = useMemo(() => ({
    rrhh: rrhhItems.length,
    compras: purchaseItems.length,
    operaciones: operationItems.length,
    riesgo: allItems.filter((item) => item.sla.bucket === 'riesgo').length,
    vencido: allItems.filter((item) => item.sla.bucket === 'vencido').length
  }), [allItems, operationItems.length, purchaseItems.length, rrhhItems.length]);

  const updatePurchaseQuantity = (idx, value) => {
    setSelectedItem((prev) => {
      if (!prev || prev.domain !== 'compras') return prev;
      const nextItems = [...prev.items];
      nextItems[idx] = {
        ...nextItems[idx],
        cantidadAutorizada: Number.isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10)
      };
      return { ...prev, items: nextItems };
    });
  };

  const detectPurchaseQuantityChange = (purchase) => {
    if (!purchase || purchase.domain !== 'compras') return false;
    return (purchase.items || []).some((item, idx) => {
      const original = purchase._original?.items?.[idx];
      return original && parseInt(item.cantidadAutorizada || item.cantidadSolicitada, 10) !== parseInt(original.cantidadSolicitada, 10);
    });
  };

  const handlePurchaseDecision = async (status) => {
    if (!canApproveCompras) { window.alert('No tienes permiso para gestionar aprobaciones de compras.'); return; }
    if (!selectedItem || selectedItem.domain !== 'compras') return;

    const changed = detectPurchaseQuantityChange(selectedItem);
    if (changed && !purchaseObservation.trim()) {
      window.alert('Debes ingresar una justificación cuando modificas cantidades.');
      return;
    }

    setSaving(true);
    try {
      await logisticaApi.put(`/solicitudes-compra/${selectedItem._id}`, {
        status,
        items: selectedItem.items,
        comentarioAprobador: purchaseComment,
        observacionModificacion: purchaseObservation || undefined
      });
      await fetchAll(selectedItem);
    } catch (error) {
      window.alert(`Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleApproveRrhhStep = async () => {
    if (!canApproveRrhh) { window.alert('No tienes permiso para aprobar solicitudes RRHH.'); return; }
    if (!selectedItem || selectedItem.domain !== 'rrhh' || !currentRrhhStep) return;
    if (!currentStepFirma) {
      window.alert('La firma es obligatoria para aprobar.');
      return;
    }

    setSaving(true);
    try {
      const newChain = selectedItem.currentChain.map((step) =>
        step.id === currentRrhhStep.id
          ? {
            ...step,
            status: 'Aprobado',
            comment: rrhhComment,
            updatedAt: new Date().toISOString(),
            firmaBase64: currentStepFirma.imagenBase64,
            firmaPayload: currentStepFirma
          }
          : step
      );

      const allApproved = newChain.every((step) => step.status === 'Aprobado');

      if (selectedItem.approvalType === 'Ingreso') {
        await candidatosApi.updateStatus(selectedItem._id, {
          approvalChain: newChain,
          status: allApproved ? 'Contratado' : selectedItem.status
        });
      } else {
        const updatedVacaciones = (selectedItem.raw.vacaciones || []).map((vacacion) =>
          (vacacion.id || vacacion._id) === selectedItem.vacacionId
            ? { ...vacacion, approvalChain: newChain, estado: allApproved ? 'Aprobado' : vacacion.estado }
            : vacacion
        );
        await candidatosApi.update(selectedItem._id, { vacaciones: updatedVacaciones });
      }

      await fetchAll(selectedItem);
    } catch (error) {
      console.error(error);
      window.alert('No se pudo aprobar este paso.');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectRrhhStep = async () => {
    if (!canApproveRrhh) { window.alert('No tienes permiso para rechazar solicitudes RRHH.'); return; }
    if (!selectedItem || selectedItem.domain !== 'rrhh' || !currentRrhhStep) return;

    setSaving(true);
    try {
      const newChain = selectedItem.currentChain.map((step) =>
        step.id === currentRrhhStep.id
          ? { ...step, status: 'Rechazado', comment: rrhhComment, updatedAt: new Date().toISOString() }
          : step
      );

      if (selectedItem.approvalType === 'Ingreso') {
        await candidatosApi.updateStatus(selectedItem._id, {
          approvalChain: newChain,
          status: 'Rechazado'
        });
      } else {
        const updatedVacaciones = (selectedItem.raw.vacaciones || []).map((vacacion) =>
          (vacacion.id || vacacion._id) === selectedItem.vacacionId
            ? { ...vacacion, approvalChain: newChain, estado: 'Rechazado' }
            : vacacion
        );
        await candidatosApi.update(selectedItem._id, { vacaciones: updatedVacaciones });
      }

      await fetchAll(selectedItem);
    } catch (error) {
      console.error(error);
      window.alert('No se pudo rechazar este paso.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetRrhhStep = async (stepId) => {
    if (!canApproveRrhh) { window.alert('No tienes permiso para reiniciar firmas.'); return; }
    if (!selectedItem || selectedItem.domain !== 'rrhh') return;
    if (!window.confirm('¿Deseas desaprobar esta firma y devolverla a pendiente?')) return;

    setSaving(true);
    try {
      const newChain = selectedItem.currentChain.map((step) =>
        step.id === stepId
          ? { ...step, status: 'Pendiente', comment: '', updatedAt: null, firmaBase64: null, firmaPayload: null }
          : step
      );

      if (selectedItem.approvalType === 'Ingreso') {
        await candidatosApi.updateStatus(selectedItem._id, {
          approvalChain: newChain,
          status: 'En Acreditación'
        });
      } else {
        const updatedVacaciones = (selectedItem.raw.vacaciones || []).map((vacacion) =>
          (vacacion.id || vacacion._id) === selectedItem.vacacionId
            ? { ...vacacion, approvalChain: newChain, estado: 'Pendiente' }
            : vacacion
        );
        await candidatosApi.update(selectedItem._id, { vacaciones: updatedVacaciones });
      }

      await fetchAll(selectedItem);
    } catch (error) {
      console.error(error);
      window.alert('No se pudo reiniciar esta firma.');
    } finally {
      setSaving(false);
    }
  };

  const handleOperationDecision = async (status) => {
    if (!canApproveOperaciones) { window.alert('No tienes permiso para gestionar aprobaciones operativas.'); return; }
    if (!selectedItem || selectedItem.domain !== 'operaciones') return;

    setSaving(true);
    try {
      if (selectedItem.opType === 'inspeccion') {
        await api.put(`/api/prevencion/inspecciones/${selectedItem._id}`, { estado: status });
      } else {
        await api.put(`/api/operaciones/combustible/${selectedItem._id}/estado`, {
          estado: status,
          comentarioSupervisor: purchaseComment || selectedItem.comentarioSupervisor || ''
        });
      }
      await fetchAll(selectedItem);
    } catch (error) {
      console.error(error);
      window.alert(`No se pudo actualizar el estado: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const renderMasterItem = (item) => {
    const meta = DOMAIN_META[item.domain];
    const Icon = meta.icon;
    const isSelected = selectedItem?.id === item.id && selectedItem?.domain === item.domain;
    const priorityClass = PRIORITY_STYLES[item.domain === 'compras' ? item.priorityBucket : item.priority] || PRIORITY_STYLES.media;
    const slaClass = SLA_STYLES[item.sla.bucket] || SLA_STYLES.normal;
    const title = item.domain === 'rrhh' ? item.fullName : item.domain === 'compras' ? item.motivo : (item.fullName || item.approvalType);
    const subtitle = item.domain === 'rrhh'
      ? `${item.rut || 'Sin RUT'} · ${item.approvalType}`
      : item.domain === 'compras'
        ? `${item.solicitante?.name || 'Sistema'} · ${item.tipoCompra || 'Compra'}`
        : `${item.rut || 'Sin RUT'} · ${item.approvalType}`;
    const statusLabel = item.domain === 'rrhh'
      ? getRrhhStatus(item)
      : item.domain === 'compras'
        ? (PURCHASE_STATUS_BADGE[item.status]?.label || item.status)
        : item.status;

    return (
      <button
        key={`${item.domain}-${item.id}`}
        onClick={() => setSelectedItem(item.domain === 'compras' ? clonePurchase(item) : item)}
        className={`w-full p-5 text-left transition-all border-l-4 ${isSelected ? 'bg-indigo-50/60 border-indigo-500' : 'border-transparent hover:bg-slate-50'}`}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest ${meta.badge}`}>{meta.label}</span>
              <span className={`px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest ${priorityClass}`}>Prioridad {item.domain === 'compras' ? item.priorityBucket : item.priority}</span>
            </div>
            <p className="mt-2 text-xs font-black text-slate-800 uppercase truncate">{title}</p>
            <p className="text-[10px] font-bold text-slate-400 truncate mt-1">{subtitle}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest ${slaClass}`}>{item.sla.label}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase">{statusLabel}</span>
            </div>
          </div>
          <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-1" />
        </div>
      </button>
    );
  };

  const renderRrhhDetail = () => {
    if (!selectedItem || selectedItem.domain !== 'rrhh') return null;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-slate-900 text-white rounded-[2rem] p-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl">
              {selectedItem.fullName?.charAt(0) || 'R'}
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">{selectedItem.fullName}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400">{selectedItem.rut || 'Sin RUT'}</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full" />
                <span className="text-violet-300 text-[10px] font-black uppercase">{selectedItem.position || 'Sin cargo'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-violet-500/20 text-violet-200 border-violet-500/30">
              {selectedItem.approvalType}
            </span>
            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${SLA_STYLES[selectedItem.sla.bucket]}`}>
              {selectedItem.sla.label}
            </span>
            {selectedItem.approvalType === 'Ingreso' && (
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest"
              >
                <FileText size={12} /> Ver ficha de ingreso
              </button>
            )}
          </div>
        </div>

        {selectedItem.approvalType !== 'Ingreso' && selectedItem.details && (
          <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl text-cyan-600 shadow-sm"><Clock size={20} /></div>
              <div>
                <p className="text-[9px] font-black text-cyan-600 uppercase mb-1">Período solicitado</p>
                <p className="font-black text-slate-800">
                  {new Date(`${selectedItem.details.fechaInicio}T12:00:00`).toLocaleDateString()} → {new Date(`${selectedItem.details.fechaFin}T12:00:00`).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase">Días hábiles</p>
              <p className="text-2xl font-black text-slate-800">{selectedItem.details.diasHabiles}</p>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-violet-50 text-violet-600 rounded-xl"><ShieldCheck size={18} /></div>
            <div>
              <p className="text-xs font-black text-slate-800 uppercase tracking-wide">Flujo de aprobación</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Aprobación directa desde la bandeja ejecutiva</p>
            </div>
          </div>

          <div className="space-y-6">
            {selectedItem.currentChain?.map((step, idx) => (
              <div
                key={step.id || idx}
                className={`relative flex gap-6 p-6 rounded-2xl border ${step.status === 'Aprobado' ? 'bg-emerald-50/40 border-emerald-100' : step.status === 'Rechazado' ? 'bg-rose-50/40 border-rose-100' : 'bg-slate-50 border-slate-100'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm ${step.status === 'Aprobado' ? 'bg-emerald-600 text-white' : step.status === 'Rechazado' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'}`}>
                  {step.status === 'Aprobado' ? <CheckCircle2 size={20} /> : step.status === 'Rechazado' ? <XCircle size={20} /> : idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="font-black text-slate-800 text-sm uppercase">{step.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{step.position}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${step.status === 'Aprobado' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : step.status === 'Rechazado' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-white text-slate-400 border-slate-200'}`}>{step.status}</span>
                      {(user?.role === 'ceo' || user?.role === 'ceo_genai' || user?.role === 'admin') && step.status !== 'Pendiente' && (
                        <button
                          disabled={!canApproveRrhh}
                          onClick={() => handleResetRrhhStep(step.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Desaprobar firma"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {step.status === 'Pendiente' && matchesApprovalUser(step, user) ? (
                    <div className="space-y-4">
                      <textarea
                        value={rrhhComment}
                        onChange={(event) => setRrhhComment(event.target.value)}
                        placeholder="Escribe comentario u observación de la aprobación..."
                        className="w-full bg-white border border-slate-200 p-4 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-violet-300 min-h-[90px] resize-none shadow-inner"
                      />

                      <div className="bg-white border border-slate-100 rounded-2xl p-4">
                        <FirmaAvanzada
                          label="Sello de aprobación gerencial"
                          onSave={(payload) => setCurrentStepFirma(payload)}
                          rutFirmante={user?.rut}
                          nombreFirmante={user?.name}
                          emailFirmante={user?.email}
                          colorAccent="indigo"
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          disabled={saving || !currentStepFirma || !canApproveRrhh}
                          onClick={handleApproveRrhhStep}
                          className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-700/20 disabled:opacity-50"
                        >
                          {saving ? 'Procesando...' : 'Validar y firmar paso'}
                        </button>
                        <button
                          disabled={saving || !canApproveRrhh}
                          onClick={handleRejectRrhhStep}
                          className="flex-1 bg-white text-rose-600 border border-rose-100 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ) : step.status === 'Pendiente' ? (
                    <div className="bg-white/60 p-4 rounded-xl border border-white/50 text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Esperando acción de {step.name}</p>
                    </div>
                  ) : (
                    <div className="bg-white/60 p-4 rounded-xl border border-white/50">
                      <p className="text-xs text-slate-600 font-bold uppercase italic">{step.comment || 'Sin comentarios registrados'}</p>
                      {step.updatedAt && (
                        <p className="text-[8px] text-slate-400 mt-1.5 font-black uppercase tracking-widest">
                          Actualizado: {new Date(step.updatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPurchaseDetail = () => {
    if (!selectedItem || selectedItem.domain !== 'compras') return null;

    const badge = PURCHASE_STATUS_BADGE[selectedItem.status] || PURCHASE_STATUS_BADGE.Pendiente;
    const isGerencia = ['ceo_genai', 'ceo', 'gerencia'].includes(user?.role);
    const quantityChanged = detectPurchaseQuantityChange(selectedItem);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-slate-900 text-white rounded-[2rem] p-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-2xl flex items-center justify-center shadow-xl">
              <ShoppingCart size={26} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">{selectedItem.motivo}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400">{selectedItem.solicitante?.name || 'Sistema'}</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full" />
                <span className="text-indigo-300 text-[10px] font-black uppercase">{selectedItem.tipoCompra || 'Compra'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${badge.cls}`}>{badge.label}</span>
            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${PRIORITY_STYLES[selectedItem.priorityBucket]}`}>Prioridad {selectedItem.priorityBucket}</span>
            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${SLA_STYLES[selectedItem.sla.bucket]}`}>{selectedItem.sla.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Solicitante</p>
            <p className="text-sm font-black text-slate-800">{selectedItem.solicitante?.name || 'No definido'}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">{selectedItem.solicitante?.email || 'Sin correo'}</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tipo / Prioridad</p>
            <p className="text-sm font-black text-slate-800">{selectedItem.tipoCompra || 'Compra'}</p>
            <p className={`text-xs font-black mt-1 uppercase ${selectedItem.priorityBucket === 'alta' ? 'text-rose-500' : selectedItem.priorityBucket === 'media' ? 'text-amber-500' : 'text-emerald-500'}`}>{selectedItem.priority}</p>
          </div>
        </div>

        {selectedItem.observacionModificacion && (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertCircle size={12} /> Justificación de modificación anterior
            </p>
            <p className="text-sm text-amber-900 font-medium italic">"{selectedItem.observacionModificacion}"</p>
          </div>
        )}

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2 flex items-center gap-2">
            <FileText size={14} /> Cantidades autorizadas
          </h4>
          {(selectedItem.items || []).map((item, idx) => {
            const original = selectedItem._original?.items?.[idx];
            const changed = original && parseInt(item.cantidadAutorizada || item.cantidadSolicitada, 10) !== parseInt(original.cantidadSolicitada, 10);
            return (
              <div key={idx} className={`bg-white p-6 rounded-3xl border transition-all shadow-sm flex items-center justify-between gap-6 ${changed ? 'border-amber-300 shadow-amber-50' : 'border-slate-100'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{item.productoRef?.nombre || 'Producto'}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">SKU: {item.productoRef?.sku || 'N/D'}</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl">
                  <div className="text-center px-4 border-r border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Solicitado</p>
                    <p className="text-sm font-black text-slate-800">{item.cantidadSolicitada}</p>
                  </div>
                  <div className="px-4">
                    <p className="text-[9px] font-black text-indigo-600 uppercase mb-1">Autorizar</p>
                    <input
                      type="number"
                      min="0"
                      value={item.cantidadAutorizada ?? item.cantidadSolicitada}
                      onChange={(event) => updatePurchaseQuantity(idx, event.target.value)}
                      className="w-16 bg-white p-2 rounded-xl text-xs font-black text-center shadow-inner outline-none ring-2 ring-transparent focus:ring-indigo-200"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1 flex items-center gap-2">
              <AlertCircle size={12} /> Justificación de modificación
            </label>
            <textarea
              placeholder="Explica el motivo de la alteración de cantidades..."
              className="w-full p-6 bg-amber-50 border border-amber-100 rounded-3xl text-sm font-bold h-28 resize-none outline-none focus:ring-4 focus:ring-amber-100 transition-all"
              value={purchaseObservation}
              onChange={(event) => setPurchaseObservation(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comentario / instrucciones</label>
            <textarea
              placeholder="Instrucciones o notas adicionales..."
              className="w-full p-6 bg-slate-50 border-none rounded-3xl text-sm font-bold h-28 resize-none outline-none focus:ring-4 focus:ring-indigo-900/5 transition-all"
              value={purchaseComment}
              onChange={(event) => setPurchaseComment(event.target.value)}
            />
          </div>
        </div>

        {quantityChanged && !purchaseObservation.trim() && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[10px] font-black uppercase tracking-widest text-amber-700">
            Debes justificar cualquier cambio de cantidades antes de aprobar o escalar.
          </div>
        )}

        {selectedItem.historial && selectedItem.historial.length > 0 && (
          <div className="space-y-3 border-t border-slate-50 pt-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Clock size={14} /> Historial de eventos
            </h4>
            <div className="space-y-3">
              {[...selectedItem.historial].reverse().map((entry, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                    {index < selectedItem.historial.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-black text-slate-800 uppercase">{entry.accion}</span>
                      <span className="text-[9px] text-slate-400">· {entry.usuario}</span>
                      <span className="text-[9px] text-slate-300">· {new Date(entry.fecha).toLocaleDateString('es-CL')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{entry.detalle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {['Pendiente', 'Revision Gerencia'].includes(selectedItem.status) && (
          <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between gap-4 flex-col md:flex-row">
            <button
              onClick={() => handlePurchaseDecision('Rechazada')}
              disabled={saving || !canApproveCompras}
              className="w-full md:flex-1 px-8 py-4 bg-white text-rose-500 border-2 border-rose-50 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40"
            >
              Rechazar
            </button>
            {!isGerencia && (
              <button
                onClick={() => handlePurchaseDecision('Revision Gerencia')}
                disabled={saving || !canApproveCompras}
                className="w-full md:flex-1 px-8 py-4 bg-purple-100 text-purple-700 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all disabled:opacity-40"
              >
                Escalar a gerencia
              </button>
            )}
            {isGerencia && (
              <button
                onClick={() => handlePurchaseDecision('Aprobada')}
                disabled={saving || !canApproveCompras}
                className="w-full md:flex-[2] px-10 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl shadow-indigo-600/20 disabled:opacity-40 flex items-center justify-center gap-3"
              >
                <CheckCircle2 size={18} /> {saving ? 'Procesando...' : 'Aprobar compra'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOperationDetail = () => {
    if (!selectedItem || selectedItem.domain !== 'operaciones') return null;

    const isInspection = selectedItem.opType === 'inspeccion';
    const isGerencia = ['ceo_genai', 'ceo', 'gerencia', 'system_admin'].includes(user?.role);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-slate-900 text-white rounded-[2rem] p-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-xl">
              <AlertCircle size={26} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">{isInspection ? 'Inspección Operativa' : 'Solicitud de Combustible'}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400">{selectedItem.fullName || 'Sin nombre'}</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full" />
                <span className="text-emerald-300 text-[10px] font-black uppercase">{selectedItem.status}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${SLA_STYLES[selectedItem.sla.bucket]}`}>{selectedItem.sla.label}</span>
            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${PRIORITY_STYLES[selectedItem.priority] || PRIORITY_STYLES.media}`}>Prioridad {selectedItem.priority}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Trabajador / RUT</p>
            <p className="text-sm font-black text-slate-800">{selectedItem.fullName || 'No definido'}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">{selectedItem.rut || 'Sin RUT'}</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tipo / Fecha</p>
            <p className="text-sm font-black text-slate-800">{selectedItem.approvalType}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">{selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString('es-CL') : 'Sin fecha'}</p>
          </div>
        </div>

        {isInspection ? (
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detalle de inspección</p>
            <p className="text-sm font-bold text-slate-700">Resultado: <span className="font-black">{selectedItem.resultado || 'Observado'}</span></p>
            <p className="text-sm text-slate-600">{selectedItem.detalle || selectedItem.observaciones || 'Sin detalle adicional'}</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detalle combustible</p>
            <p className="text-sm font-bold text-slate-700">Patente: <span className="font-black">{selectedItem.patente || 'N/D'}</span></p>
            <p className="text-sm font-bold text-slate-700">KM actual: <span className="font-black">{selectedItem.kmActual || 0}</span></p>
            <textarea
              placeholder="Comentario para trazabilidad de aprobación..."
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium h-24 resize-none outline-none focus:ring-4 focus:ring-indigo-900/5 transition-all"
              value={purchaseComment}
              onChange={(event) => setPurchaseComment(event.target.value)}
            />
          </div>
        )}

        <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between gap-4 flex-col md:flex-row">
          <button
            onClick={() => handleOperationDecision('Rechazado')}
            disabled={saving || !canApproveOperaciones}
            className="w-full md:flex-1 px-8 py-4 bg-white text-rose-500 border-2 border-rose-50 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40"
          >
            Rechazar
          </button>

          {!isGerencia && (
            <button
              onClick={() => handleOperationDecision('Revision Gerencia')}
              disabled={saving || !canApproveOperaciones}
              className="w-full md:flex-1 px-8 py-4 bg-purple-100 text-purple-700 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all disabled:opacity-40"
            >
              Escalar a gerencia
            </button>
          )}

          <button
            onClick={() => handleOperationDecision('Aprobado')}
            disabled={saving || !canApproveOperaciones}
            className="w-full md:flex-[2] px-10 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-600/20 disabled:opacity-40 flex items-center justify-center gap-3"
          >
            <CheckCircle2 size={18} /> {saving ? 'Procesando...' : 'Aprobar'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-col lg:flex-row">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-indigo-600" size={30} /> Aprobaciones 360
          </h1>
          <p className="text-slate-500 text-sm font-medium">Centro unificado de aprobaciones RRHH, Compras y Operaciones con resolución directa.</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 text-xs font-black text-amber-700 uppercase tracking-widest">
          {pendingCount} pendientes en bandeja
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendientes RRHH</p>
          <p className="text-3xl font-black text-violet-600 mt-1">{executiveMetrics.rrhh}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendientes Compras</p>
          <p className="text-3xl font-black text-indigo-600 mt-1">{executiveMetrics.compras}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendientes Operaciones</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{executiveMetrics.operaciones}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SLA en riesgo</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{executiveMetrics.riesgo}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SLA vencido</p>
          <p className="text-3xl font-black text-rose-600 mt-1">{executiveMetrics.vencido}</p>
        </div>
      </div>

      <div className="flex gap-3 flex-col xl:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por colaborador, motivo, tipo, solicitante o estado..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-3xl text-sm font-medium shadow-sm outline-none focus:ring-4 focus:ring-indigo-900/5 transition-all"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)} className="px-6 py-3 bg-white border border-slate-100 rounded-3xl text-sm font-bold text-slate-600 shadow-sm outline-none">
          <option value="all">Todos los dominios</option>
          <option value="rrhh">RRHH</option>
          <option value="compras">Compras</option>
          <option value="operaciones">Operaciones</option>
        </select>

        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="px-6 py-3 bg-white border border-slate-100 rounded-3xl text-sm font-bold text-slate-600 shadow-sm outline-none">
          <option value="all">Todas las prioridades</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>

        <select value={slaFilter} onChange={(event) => setSlaFilter(event.target.value)} className="px-6 py-3 bg-white border border-slate-100 rounded-3xl text-sm font-bold text-slate-600 shadow-sm outline-none">
          <option value="all">Todo SLA</option>
          <option value="vencido">Vencido</option>
          <option value="riesgo">En riesgo</option>
          <option value="normal">En tiempo</option>
        </select>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="flex flex-col lg:flex-row overflow-hidden" style={{ minHeight: '720px' }}>
          <div className="lg:w-[26rem] border-r border-slate-50 flex-shrink-0 overflow-y-auto custom-scrollbar" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 sticky top-0 bg-white z-10">
              <div>
                <p className="text-sm font-black text-slate-800 uppercase tracking-wide">Bandeja maestra</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{filteredItems.length} resultados filtrados</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileCheck size={18} />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="animate-spin text-indigo-500" size={28} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando bandeja...</span>
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map(renderMasterItem)
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                <FileCheck size={40} className="opacity-30 mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin aprobaciones para estos filtros</p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50/40">
            {!selectedItem ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-indigo-300/20 blur-3xl rounded-full" />
                  <FileCheck size={64} className="relative opacity-20" />
                </div>
                <p className="text-lg font-black uppercase tracking-tight text-slate-400">Panel de aprobación</p>
                <p className="text-sm font-bold text-slate-400 mt-2 text-center max-w-xs leading-relaxed">
                  Selecciona un elemento de la bandeja para revisarlo y resolverlo aquí mismo.
                </p>
              </div>
            ) : selectedItem.domain === 'rrhh' ? renderRrhhDetail() : selectedItem.domain === 'compras' ? renderPurchaseDetail() : renderOperationDetail()}
          </div>
        </div>
      </div>

      {showProfileModal && selectedItem?.domain === 'rrhh' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowProfileModal(false)}>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[95vh]" onClick={(event) => event.stopPropagation()}>
            <div className="p-8 bg-gradient-to-br from-slate-800 to-slate-900 text-white relative flex-shrink-0 print:hidden">
              <button onClick={() => setShowProfileModal(false)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/30 rounded-full transition-all text-white">
                <X size={20} />
              </button>
              <div className="flex items-center justify-between mr-12 gap-4">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center font-black text-2xl shadow-xl">
                    {selectedItem.fullName?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-xl uppercase tracking-tighter">Vista previa de ficha</h3>
                    <p className="text-white/60 font-bold text-xs mt-1">Formato ejecutivo de alta de personal</p>
                  </div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-900/40"
                >
                  <Printer size={16} /> Imprimir ficha
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 md:p-8 bg-slate-50 print:bg-white print:p-0">
              <div className="print:m-0">
                <FichaIngresoPremium data={selectedItem.raw} approvalChain={selectedItem.currentChain || []} />
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex justify-end bg-white flex-shrink-0 print:hidden">
              <button onClick={() => setShowProfileModal(false)} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Aprobaciones360;
