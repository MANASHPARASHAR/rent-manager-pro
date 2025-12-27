
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
  AlertTriangle
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { ColumnType, ColumnDefinition, UserRole, PaymentStatus } from '../types';

const PropertyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const store = useRentalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Confirmation Modal State
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

  const isViewer = store.user.role === UserRole.VIEWER;
  const canEdit = store.user.role === UserRole.ADMIN || store.user.role === UserRole.MANAGER;

  const property = store.properties.find((p: any) => p.id === id);
  const propertyType = store.propertyTypes.find((t: any) => t.id === property?.propertyTypeId);
  
  const columns = useMemo(() => {
    if (!propertyType) return [];
    return [...propertyType.columns].sort((a, b) => a.order - b.order);
  }, [propertyType]);
  
  const records = store.records.filter((r: any) => r.propertyId === id);
  const values = store.recordValues;

  const summaryStats = useMemo(() => {
    if (!propertyType) return { totalRent: 0, activeUnits: 0, vacantUnits: 0, heldDeposits: 0, totalUnits: 0 };
    
    const rentColIds = propertyType.columns.filter(c => c.isRentCalculatable).map(c => c.id);
    const occupancyColId = propertyType.columns.find(c => c.name.toLowerCase().includes('occupancy') || c.name.toLowerCase().includes('status'))?.id;
    
    let totalRent = 0;
    let activeUnits = 0;
    let vacantUnits = 0;
    let heldDeposits = 0;

    records.forEach(record => {
      const rValues = values.filter((v: any) => v.recordId === record.id);
      const status = rValues.find((v: any) => v.columnId === occupancyColId)?.value || 'Active';
      const isVacant = status.toLowerCase().includes('vacant');

      const depositPayment = store.payments.find((p: any) => p.recordId === record.id && p.type === 'DEPOSIT' && p.status === PaymentStatus.PAID);
      if (depositPayment && !depositPayment.isRefunded) {
        heldDeposits += depositPayment.amount;
      }

      if (isVacant) {
        vacantUnits++;
      } else {
        activeUnits++;
        rentColIds.forEach(cid => {
          const val = rValues.find((v: any) => v.columnId === cid)?.value;
          totalRent += parseFloat(val || '0') || 0;
        });
      }
    });

    return { totalRent, activeUnits, vacantUnits, heldDeposits, totalUnits: records.length };
  }, [records, values, propertyType, store.payments]);

  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleInputChange = (colId: string, value: string) => {
    setFormData(prev => ({ ...prev, [colId]: value }));
    // Clear error for this field when user starts typing
    if (formErrors[colId]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[colId];
        return next;
      });
    }
  };

  if (!property || !propertyType) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 uppercase">Property Not Found</h2>
        <Link to="/properties" className="text-indigo-600 font-bold hover:underline mt-6 inline-block uppercase tracking-widest text-xs">Return to Properties</Link>
      </div>
    );
  }

  const handleSave = () => {
    if (!canEdit) return;
    const errors: Record<string, string> = {};
    
    columns.forEach(col => {
      const val = formData[col.id]?.trim() || "";
      
      // Basic required check
      if (col.required && val === "") {
        errors[col.id] = `${col.name} is required`;
      } 
      // Numeric/Currency validation
      else if (val !== "" && (col.type === ColumnType.CURRENCY || col.type === ColumnType.NUMBER || col.type === ColumnType.RENT_DUE_DAY || col.type === ColumnType.SECURITY_DEPOSIT)) {
        const numVal = Number(val);
        if (isNaN(numVal)) {
          errors[col.id] = `Please enter a valid number`;
        } else if (numVal < 0) {
          errors[col.id] = `Amount cannot be negative`;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const title = editingRecordId ? "Update Unit Record" : "Add New Unit";
    const message = editingRecordId 
      ? "Are you sure you want to save the changes to this unit record? The unit details will be updated across the system."
      : "Are you sure you want to add this new unit to the property inventory?";

    setConfirmConfig({
      isOpen: true,
      title,
      message,
      actionLabel: editingRecordId ? "Update Record" : "Add Unit",
      icon: <ShieldCheck className="w-10 h-10" />,
      onConfirm: () => {
        if (editingRecordId) {
          const updatedValues = Object.entries(formData).map(([colId, value]) => ({
            id: 'v_' + Math.random().toString(36).substr(2, 9), 
            recordId: editingRecordId, 
            columnId: colId, 
            value
          }));
          store.updateRecord(editingRecordId, updatedValues);
          setEditingRecordId(null);
        } else {
          const recordId = 'r' + Date.now();
          const newValues = Object.entries(formData).map(([colId, value]) => ({
            id: 'v_' + Math.random().toString(36).substr(2, 9), 
            recordId, 
            columnId: colId, 
            value
          }));
          store.addRecord({ 
            id: recordId, 
            propertyId: property.id, 
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
          }, newValues);
          setIsAdding(false);
        }
        setFormData({});
        setFormErrors({});
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleRefund = (recordId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Confirm Refund",
      message: "Confirm security deposit refund? This signifies assets have been returned to the tenant and will be removed from held totals.",
      actionLabel: "Confirm Refund",
      icon: <DollarSign className="w-10 h-10" />,
      onConfirm: () => {
        store.refundDeposit(recordId);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteRecord = (recordId: string) => {
    setConfirmConfig({
      isOpen: true,
      isDanger: true,
      title: "Delete Unit Record",
      message: "CRITICAL: Permanent deletion of unit record. This action is permanent and will remove all associated payment history for this unit. Are you absolutely sure?",
      actionLabel: "Permanently Delete",
      icon: <AlertTriangle className="w-10 h-10" />,
      onConfirm: () => {
        store.deleteRecord(recordId);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const renderCellContent = (value: string, col: ColumnDefinition, recordId: string) => {
    if (col.type === ColumnType.CURRENCY || col.type === ColumnType.SECURITY_DEPOSIT) {
      return (
        <div className="flex items-center gap-2">
          {col.type === ColumnType.SECURITY_DEPOSIT && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />}
          <span className="text-indigo-600 font-black">${parseFloat(value || '0').toLocaleString()}</span>
        </div>
      );
    }
    if (col.type === ColumnType.DROPDOWN) {
      const lowerVal = value.toLowerCase();
      const style = lowerVal.includes('active') || lowerVal.includes('paid') || lowerVal.includes('occupied') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100';
      return <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter ${style}`}>{value}</span>;
    }
    return value || <span className="text-gray-300 italic">-</span>;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Confirmation Modal Overlay */}
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-10 text-center ${confirmConfig.isDanger ? 'bg-red-50/50' : 'bg-indigo-50/50'}`}>
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmConfig.isDanger ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}>
                {confirmConfig.icon}
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">{confirmConfig.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed">{confirmConfig.message}</p>
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button 
                onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmConfig.onConfirm}
                className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 ${confirmConfig.isDanger ? 'bg-red-500 shadow-red-200 hover:bg-red-600' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'}`}
              >
                {confirmConfig.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Link to="/properties" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 mb-6 group transition-colors">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Properties
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase">{property.name}</h1>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase border border-indigo-100 tracking-widest">{propertyType.name}</span>
          </div>
          <p className="text-gray-500 mt-2 font-medium flex items-center gap-2 uppercase tracking-widest text-[10px]"><MapPin className="w-3 h-3 text-indigo-400" /> {property.address || 'No Address Assigned'}</p>
        </div>
        {canEdit && (
          <button onClick={() => { setFormData({}); setIsAdding(true); setEditingRecordId(null); setFormErrors({}); }} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
            <Plus className="w-5 h-5" /> Add New Unit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm flex items-center gap-6">
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600"><DollarSign className="w-8 h-8" /></div>
          <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Rent</p><p className="text-2xl font-black text-gray-900">${summaryStats.totalRent.toLocaleString()}</p></div>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm flex items-center gap-6">
          <div className="bg-amber-50 p-4 rounded-2xl text-amber-600"><ShieldCheck className="w-8 h-8" /></div>
          <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Held Assets</p><p className="text-2xl font-black text-gray-900">${summaryStats.heldDeposits.toLocaleString()}</p></div>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm flex items-center gap-6">
          <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600"><Home className="w-8 h-8" /></div>
          <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Occupancy</p><p className="text-2xl font-black text-gray-900">{summaryStats.activeUnits}/{summaryStats.totalUnits}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-gray-100">
          <div className="relative w-full max-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold" placeholder="Filter inventory..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Added max-height and custom-scrollbar to units management table container */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="bg-gray-50 border-b border-gray-100">
                {columns.map(col => <th key={col.id} className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{col.name} {col.required && <span className="text-red-500">*</span>}</th>)}
                {canEdit && <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isAdding && (
                <tr className="bg-indigo-50/20">
                  {columns.map(col => (
                    <td key={col.id} className="px-8 py-6 align-top">
                      <div className="space-y-1">
                        {col.type === ColumnType.DROPDOWN ? (
                          <select 
                            className={`w-full bg-white border ${formErrors[col.id] ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200'} rounded-xl px-4 py-3 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all`} 
                            value={formData[col.id] || ''} 
                            onChange={e => handleInputChange(col.id, e.target.value)}
                          >
                            <option value="">Select...</option>
                            {col.options?.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input 
                            className={`w-full bg-white border ${formErrors[col.id] ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200'} rounded-xl px-4 py-3 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all`} 
                            type={col.type === ColumnType.CURRENCY || col.type === ColumnType.NUMBER || col.type === ColumnType.RENT_DUE_DAY || col.type === ColumnType.SECURITY_DEPOSIT ? 'number' : col.type === ColumnType.DATE ? 'date' : 'text'} 
                            value={formData[col.id] || ''} 
                            onChange={e => handleInputChange(col.id, e.target.value)} 
                            placeholder={col.name} 
                            min={col.type === ColumnType.CURRENCY || col.type === ColumnType.NUMBER || col.type === ColumnType.SECURITY_DEPOSIT ? "0" : undefined}
                          />
                        )}
                        {formErrors[col.id] && (
                          <div className="flex items-center gap-1.5 px-1 py-0.5">
                            <AlertCircle className="w-3 h-3 text-red-500" />
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-tight">{formErrors[col.id]}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-8 py-6 text-right align-top">
                    <div className="flex justify-end gap-2">
                      <button onClick={handleSave} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-90" title="Save New Unit"><Save className="w-5 h-5" /></button>
                      <button onClick={() => { setIsAdding(false); setFormData({}); setFormErrors({}); }} className="p-3 bg-white text-gray-400 border border-gray-200 rounded-xl hover:text-red-500 transition-all" title="Cancel"><X className="w-5 h-5" /></button>
                    </div>
                  </td>
                </tr>
              )}
              {records.filter((r: any) => {
                const rValues = values.filter((v: any) => v.recordId === r.id);
                return rValues.some((v: any) => v.value.toLowerCase().includes(searchTerm.toLowerCase()));
              }).map((record: any) => {
                const isEditing = editingRecordId === record.id;
                const recordValues = values.filter((v: any) => v.recordId === record.id);
                return (
                  <tr key={record.id} className={`${isEditing ? 'bg-indigo-50/20' : 'hover:bg-indigo-50/10'} group transition-all duration-300`}>
                    {columns.map(col => {
                      const val = recordValues.find((v: any) => v.columnId === col.id)?.value || '';
                      return (
                        <td key={col.id} className="px-8 py-7 text-sm font-bold text-gray-700 whitespace-nowrap align-top">
                          {isEditing ? (
                            <div className="space-y-1">
                              {col.type === ColumnType.DROPDOWN ? (
                                <select 
                                  className={`w-full bg-white border ${formErrors[col.id] ? 'border-red-500 ring-2 ring-red-500/20' : 'border-indigo-200'} rounded-xl px-3 py-2 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all`} 
                                  value={formData[col.id] || ''} 
                                  onChange={e => handleInputChange(col.id, e.target.value)}
                                >
                                  <option value="">Select...</option>
                                  {col.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input 
                                  className={`w-full bg-white border ${formErrors[col.id] ? 'border-red-500 ring-2 ring-red-500/20' : 'border-indigo-200'} rounded-xl px-3 py-2 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all`} 
                                  type={col.type === ColumnType.CURRENCY || col.type === ColumnType.NUMBER || col.type === ColumnType.RENT_DUE_DAY || col.type === ColumnType.SECURITY_DEPOSIT ? 'number' : col.type === ColumnType.DATE ? 'date' : 'text'}
                                  value={formData[col.id] || ''} 
                                  onChange={e => handleInputChange(col.id, e.target.value)} 
                                  min={col.type === ColumnType.CURRENCY || col.type === ColumnType.NUMBER || col.type === ColumnType.SECURITY_DEPOSIT ? "0" : undefined}
                                />
                              )}
                              {formErrors[col.id] && (
                                <div className="flex items-center gap-1.5 px-1 py-0.5">
                                  <AlertCircle className="w-3 h-3 text-red-500" />
                                  <p className="text-[10px] font-black text-red-500 uppercase tracking-tight">{formErrors[col.id]}</p>
                                </div>
                              )}
                            </div>
                          ) : renderCellContent(val, col, record.id)}
                        </td>
                      );
                    })}
                    {canEdit && (
                      <td className="px-8 py-7 text-right align-top">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={handleSave} className="p-2 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-all active:scale-95"><Save className="w-4 h-4" /></button>
                            <button onClick={() => { setEditingRecordId(null); setFormData({}); setFormErrors({}); }} className="p-2 bg-white text-gray-400 border border-gray-100 rounded-xl hover:text-red-500 transition-all active:scale-95"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { 
                              const initial = recordValues.reduce((acc: any, v: any) => ({...acc, [v.columnId]: v.value}), {});
                              setFormData(initial);
                              setEditingRecordId(record.id); 
                              setIsAdding(false);
                              setFormErrors({});
                            }} className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-indigo-100 shadow-sm" title="Edit Unit"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteRecord(record.id)} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-red-100 shadow-sm" title="Delete Unit"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {records.length === 0 && !isAdding && (
            <div className="py-32 text-center animate-in fade-in zoom-in">
              <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Home className="w-10 h-10 text-gray-200" /></div>
              <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight">No Units Registered</h4>
              <p className="text-gray-400 font-medium max-w-xs mx-auto mt-2">Start by adding your first rental unit to this property.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyDetails;
