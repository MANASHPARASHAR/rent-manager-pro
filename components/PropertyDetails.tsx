
import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  Calendar,
  HelpCircle,
  DollarSign,
  TrendingUp,
  PieChart,
  Home,
  ShieldCheck,
  Undo2,
  MapPin,
  AlertTriangle,
  Settings,
  Eye,
  Check,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { ColumnType, ColumnDefinition, UserRole, PaymentStatus, Property } from '../types';

const PropertyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const store = useRentalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    actionLabel: string;
    isDanger?: boolean;
    icon?: React.ReactNode;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    actionLabel: 'Confirm'
  });

  const isAdmin = store.user?.role === UserRole.ADMIN;
  const isManager = store.user?.role === UserRole.MANAGER;
  const isViewer = store.user?.role === UserRole.VIEWER;
  const isRestricted = isManager || isViewer;
  const canEdit = isAdmin || isManager;

  // INITIAL LOAD GUARD
  if (store.isBooting) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-white rounded-[3rem] border border-gray-100 shadow-sm animate-in fade-in duration-500 text-center">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Accessing Unit Database...</h3>
      </div>
    );
  }

  const property = useMemo(() => {
    const p = (store.properties || []).find((prop: any) => prop.id === id);
    if (!p) return null;
    if (isRestricted && p.isVisibleToManager === false) return null;
    return p;
  }, [store.properties, id, isRestricted]);

  const propertyType = useMemo(() => {
    if (!property) return null;
    return (store.propertyTypes || []).find((t: any) => t.id === property.propertyTypeId);
  }, [store.propertyTypes, property]);
  
  const columns = useMemo(() => {
    if (!propertyType) return [];
    return [...(propertyType.columns || [])].sort((a, b) => a.order - b.order);
  }, [propertyType]);
  
  const records = useMemo(() => {
    return (store.records || []).filter((r: any) => r.propertyId === id);
  }, [store.records, id]);

  const values = store.recordValues || [];

  const [formData, setFormData] = useState<Record<string, string>>({});

  if (!property || !propertyType) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-white rounded-[3rem] border border-gray-100 shadow-sm animate-in fade-in duration-500 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6" />
        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Access Restricted</h2>
        <p className="text-slate-500 font-medium mt-3 max-w-sm mx-auto">
           Property cluster not found or unauthorized for your account.
        </p>
        <Link to="/properties" className="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]">Return to Portfolio</Link>
      </div>
    );
  }

  const handleInputChange = (colId: string, value: string) => {
    setFormData(prev => ({ ...prev, [colId]: value }));
    if (formErrors[colId]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[colId];
        return next;
      });
    }
  };

  const handleSave = () => {
    if (!canEdit) return;
    const errors: Record<string, string> = {};
    columns.forEach(col => {
      const val = formData[col.id]?.trim() || "";
      if (col.required && val === "") {
        errors[col.id] = `${col.name} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: editingRecordId ? "Update Record" : "Add Unit",
      message: "Finalize changes to this property record?",
      actionLabel: "Confirm",
      icon: <ShieldCheck className="w-10 h-10" />,
      onConfirm: () => {
        if (editingRecordId) {
          const updatedValues = Object.entries(formData).map(([colId, value]) => ({ id: 'v_' + Math.random().toString(36).substr(2, 9), recordId: editingRecordId, columnId: colId, value }));
          store.updateRecord(editingRecordId, updatedValues);
          setEditingRecordId(null);
        } else {
          const recordId = 'r' + Date.now();
          const newValues = Object.entries(formData).map(([colId, value]) => ({ id: 'v_' + Math.random().toString(36).substr(2, 9), recordId, columnId: colId, value }));
          store.addRecord({ id: recordId, propertyId: property.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, newValues);
          setIsAdding(false);
        }
        setFormData({});
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteRecord = (id: string) => {
    if (!canEdit) return;
    setConfirmConfig({
      isOpen: true,
      isDanger: true,
      title: "Delete Record",
      message: "Permanently remove this unit record?",
      actionLabel: "Delete Unit",
      icon: <Trash2 className="w-10 h-10" />,
      onConfirm: () => {
        store.deleteRecord(id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const renderCellContent = (value: string, col: ColumnDefinition) => {
    if (col.type === ColumnType.CURRENCY || col.type === ColumnType.SECURITY_DEPOSIT) {
      return <span className="text-indigo-600 font-black">${parseFloat(value || '0').toLocaleString()}</span>;
    }
    if (col.type === ColumnType.DROPDOWN || col.type === ColumnType.OCCUPANCY_STATUS) {
      const lowerVal = (value || '').toLowerCase();
      const style = lowerVal.includes('active') || lowerVal.includes('occupied') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100';
      return <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter ${style}`}>{value}</span>;
    }
    return value || <span className="text-gray-300 italic">-</span>;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95">
            <div className={`p-10 text-center ${confirmConfig.isDanger ? 'bg-red-50/50' : 'bg-indigo-50/50'}`}>
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmConfig.isDanger ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-indigo-600 text-white shadow-indigo-500/20'}`}>{confirmConfig.icon}</div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">{confirmConfig.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed">{confirmConfig.message}</p>
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Cancel</button>
              <button onClick={confirmConfig.onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 ${confirmConfig.isDanger ? 'bg-red-500' : 'bg-indigo-600'}`}>{confirmConfig.actionLabel}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Link to="/properties" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 mb-6 group transition-colors"><ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back</Link>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase">{property.name}</h1>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase border border-indigo-100 tracking-widest">{propertyType.name}</span>
          </div>
          <p className="text-gray-500 mt-2 font-medium flex items-center gap-2 uppercase tracking-widest text-[10px]"><MapPin className="w-3 h-3 text-indigo-400" /> {property.address || 'No Address'}</p>
        </div>
        <div className="flex gap-4">{canEdit && <button onClick={() => { setFormData({}); setIsAdding(true); setEditingRecordId(null); setFormErrors({}); }} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl shadow-indigo-100"><Plus className="w-5 h-5" /> New Unit</button>}</div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-gray-100 relative">
          <Search className="absolute left-12 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl text-sm outline-none font-bold focus:bg-white focus:border-indigo-100 transition-all" placeholder="Filter inventory..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-white"><tr className="bg-gray-50 border-b border-gray-100">{columns.map(col => <th key={col.id} className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap min-w-[200px]">{col.name}</th>)}{canEdit && <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isAdding && (
                <tr className="bg-indigo-50/20 animate-in slide-in-from-top-4">
                  {columns.map(col => (<td key={col.id} className="px-8 py-8 align-top">{(col.type === ColumnType.DROPDOWN || col.type === ColumnType.OCCUPANCY_STATUS) ? (<select className={`w-full bg-white border ${formErrors[col.id] ? 'border-red-500' : 'border-gray-200'} rounded-2xl px-5 py-4 text-sm font-bold outline-none cursor-pointer`} value={formData[col.id] || ''} onChange={e => handleInputChange(col.id, e.target.value)}><option value="">Select...</option>{col.options?.map(o => <option key={o} value={o}>{o}</option>)}</select>) : (<input className={`w-full bg-white border ${formErrors[col.id] ? 'border-red-500' : 'border-gray-200'} rounded-2xl px-5 py-4 text-sm font-bold outline-none`} type={col.type === ColumnType.CURRENCY || col.type === ColumnType.NUMBER || col.type === ColumnType.SECURITY_DEPOSIT ? 'number' : col.type === ColumnType.DATE ? 'date' : 'text'} value={formData[col.id] || ''} onChange={e => handleInputChange(col.id, e.target.value)} placeholder={`Enter ${col.name}`} />)}{formErrors[col.id] && <p className="text-[9px] text-red-500 font-black uppercase mt-2 ml-1">{formErrors[col.id]}</p>}</td>))}<td className="px-8 py-8 text-right align-top"><div className="flex justify-end gap-3"><button onClick={handleSave} className="p-4 bg-indigo-600 text-white rounded-2xl"><Save className="w-6 h-6" /></button><button onClick={() => { setIsAdding(false); setFormData({}); }} className="p-4 bg-white border border-gray-200 rounded-2xl text-gray-400"><X className="w-6 h-6" /></button></div></td></tr>
              )}
              {records.filter((r: any) => {
                const rValues = values.filter((v: any) => v.recordId === r.id);
                const query = (searchTerm || '').toLowerCase();
                return rValues.some((v: any) => (v.value || '').toLowerCase().includes(query));
              }).map((record: any) => {
                const isEditing = editingRecordId === record.id;
                const recordValues = values.filter((v: any) => v.recordId === record.id);
                return (
                  <tr key={record.id} className={`${isEditing ? 'bg-indigo-50/20' : 'hover:bg-indigo-50/10'} group transition-all duration-300`}>
                    {columns.map(col => {
                      const val = recordValues.find((v: any) => v.columnId === col.id)?.value || '';
                      return (<td key={col.id} className="px-8 py-7 text-sm font-bold text-gray-700 align-top">{isEditing ? (<><input className={`w-full bg-white border ${formErrors[col.id] ? 'border-red-500' : 'border-indigo-200'} rounded-2xl px-5 py-4 text-sm font-bold`} type={col.type === ColumnType.CURRENCY || col.type === ColumnType.NUMBER ? 'number' : col.type === ColumnType.DATE ? 'date' : 'text'} value={formData[col.id] || ''} onChange={e => handleInputChange(col.id, e.target.value)} />{formErrors[col.id] && <p className="text-[9px] text-red-500 font-black uppercase mt-2 ml-1">{formErrors[col.id]}</p>}</>) : renderCellContent(val, col)}</td>);
                    })}
                    {canEdit && (<td className="px-8 py-7 text-right align-top">{isEditing ? (<div className="flex justify-end gap-3"><button onClick={handleSave} className="p-4 bg-indigo-600 text-white rounded-2xl"><Save className="w-6 h-6" /></button><button onClick={() => { setEditingRecordId(null); setFormData({}); }} className="p-4 bg-white border border-gray-200 rounded-2xl"><X className="w-6 h-6" /></button></div>) : (<div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => { const initial = recordValues.reduce((acc: any, v: any) => ({...acc, [v.columnId]: v.value}), {}); setFormData(initial); setEditingRecordId(record.id); }} className="p-3 text-gray-400 hover:text-indigo-600"><Edit2 className="w-5 h-5" /></button><button onClick={() => handleDeleteRecord(record.id)} className="p-3 text-gray-400 hover:text-red-600"><Trash2 className="w-5 h-5" /></button></div>)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetails;
