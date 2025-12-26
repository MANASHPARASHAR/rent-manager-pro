
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Building2,
  DollarSign,
  X,
  ShieldCheck,
  RefreshCw,
  Target,
  AlertTriangle,
  Landmark,
  Edit2,
  History,
  Calendar,
  Wallet,
  ArrowRight,
  Save,
  User,
  CalendarDays,
  TrendingUp,
  Filter,
  ChevronDown,
  Plus,
  Undo2,
  Settings,
  Trash2
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { PaymentStatus, UserRole, ColumnType, ColumnDefinition, Payment } from '../types';

type FilterType = 'monthly' | 'annual' | 'custom';

const RentCollection: React.FC = () => {
  const store = useRentalStore();
  const isAdmin = store.user?.role === UserRole.ADMIN;
  const isManager = store.user?.role === UserRole.MANAGER;
  
  const [filterType, setFilterType] = useState<FilterType>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  const [showSettings, setShowSettings] = useState(false);
  const [newPaidTo, setNewPaidTo] = useState('');
  const [newPaymentMode, setNewPaymentMode] = useState('');
  
  // Modals state
  const [historyRecord, setHistoryRecord] = useState<any | null>(null);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const visibleProperties = useMemo(() => {
    if (!isManager) return store.properties;
    return store.properties.filter((p: any) => p.isVisibleToManager);
  }, [store.properties, isManager]);

  const visiblePropertyIds = useMemo(() => visibleProperties.map((p: any) => p.id), [visibleProperties]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  
  const [collectingRecord, setCollectingRecord] = useState<any | null>(null);
  const [collectionData, setCollectionData] = useState({
    paidTo: '',
    paymentMode: '',
    month: '',
    type: 'RENT' as 'RENT' | 'DEPOSIT',
    amount: 0
  });

  const isPaidInScope = (recordId: string, type: 'RENT' | 'DEPOSIT') => {
    const payments = store.payments.filter((p: Payment) => p.recordId === recordId && p.type === type && p.status === PaymentStatus.PAID);
    
    if (filterType === 'monthly') {
      return payments.some(p => p.month === selectedMonth);
    } else if (filterType === 'annual') {
      return payments.some(p => p.month.startsWith(selectedYear) || (p.type === 'DEPOSIT' && p.paidAt?.startsWith(selectedYear)));
    } else {
      const start = new Date(startDate); start.setHours(0,0,0,0);
      const end = new Date(endDate); end.setHours(23,59,59,999);
      return payments.some(p => {
        if (!p.paidAt) return false;
        const paidDate = new Date(p.paidAt);
        return paidDate >= start && paidDate <= end;
      });
    }
  };

  const recordsWithRent = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return store.records
      .filter((r: any) => visiblePropertyIds.includes(r.propertyId))
      .map((record: any) => {
        const property = store.properties.find((p: any) => p.id === record.propertyId);
        const propertyType = store.propertyTypes.find((t: any) => t.id === property?.propertyTypeId);
        
        const rentColumn = propertyType?.columns.find((c: any) => c.isRentCalculatable);
        const depositColumn = propertyType?.columns.find((c: any) => c.type === ColumnType.SECURITY_DEPOSIT);
        const dueDayColumn = propertyType?.columns.find((c: any) => c.type === ColumnType.RENT_DUE_DAY);
        const tenantNameColumn = propertyType?.columns.find((c: any) => c.name.toLowerCase().includes('name')) || propertyType?.columns[0];

        const recordValues = store.recordValues.filter((v: any) => v.recordId === record.id);
        
        const rentValue = recordValues.find((v: any) => v.columnId === rentColumn?.id)?.value || '0';
        const depositValue = recordValues.find((v: any) => v.columnId === depositColumn?.id)?.value || '0';
        const tenantName = recordValues.find((v: any) => v.columnId === tenantNameColumn?.id)?.value || 'Unit ' + record.id.slice(-3);
        
        const dueDay = parseInt(recordValues.find((v: any) => v.columnId === dueDayColumn?.id)?.value || '') || propertyType?.defaultDueDateDay || 5;

        const isRentPaid = isPaidInScope(record.id, 'RENT');
        const depositPayment = store.payments.find(p => p.recordId === record.id && p.type === 'DEPOSIT' && p.status === PaymentStatus.PAID);
        const isDepositPaid = !!depositPayment;
        const isDepositRefunded = depositPayment?.isRefunded || false;

        let status: 'PAID' | 'PENDING' | 'OVERDUE' = 'PENDING';
        if (filterType === 'monthly') {
          const [year, month] = selectedMonth.split('-').map(Number);
          const deadline = new Date(year, month - 1, dueDay, 23, 59, 59);
          if (isRentPaid) status = 'PAID';
          else if (today > deadline) status = 'OVERDUE';
        } else {
          status = isRentPaid ? 'PAID' : 'PENDING';
        }

        return {
          ...record, 
          property, 
          propertyType,
          tenantName,
          rentAmount: parseFloat(rentValue),
          depositAmount: parseFloat(depositValue),
          isRentPaid, 
          isDepositPaid,
          isDepositRefunded,
          hasDepositOwed: parseFloat(depositValue) > 0,
          dueDay,
          status,
          recordValues,
          paymentHistory: store.payments.filter(p => p.recordId === record.id)
        };
      }).filter((r: any) => {
        const matchesSearch = r.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) || r.property?.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProperty = selectedPropertyId === 'all' || r.propertyId === selectedPropertyId;
        return matchesSearch && matchesProperty;
      });
  }, [store.records, store.properties, store.propertyTypes, store.recordValues, store.payments, filterType, selectedMonth, selectedYear, startDate, endDate, searchTerm, selectedPropertyId, visiblePropertyIds]);

  const stats = useMemo(() => {
    let rangeMultiplier = 1;
    if (filterType === 'annual') {
      const now = new Date();
      rangeMultiplier = selectedYear === now.getFullYear().toString() ? now.getMonth() + 1 : 12;
    } else if (filterType === 'custom') {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      rangeMultiplier = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)));
    }

    const expected = recordsWithRent.reduce((sum, r) => sum + (r.rentAmount * rangeMultiplier), 0);
    const actualCollected = store.payments
      .filter((p: Payment) => {
        if (!visiblePropertyIds.includes(store.records.find(r => r.id === p.recordId)?.propertyId)) return false;
        if (p.status !== PaymentStatus.PAID || p.type !== 'RENT') return false;
        if (filterType === 'monthly') return p.month === selectedMonth;
        if (filterType === 'annual') return p.month.startsWith(selectedYear);
        if (filterType === 'custom') {
           if (!p.paidAt) return false;
           const pd = new Date(p.paidAt);
           return pd >= new Date(startDate) && pd <= new Date(endDate);
        }
        return false;
      })
      .reduce((sum: number, p: Payment) => sum + p.amount, 0);

    const heldAssets = store.payments.filter((p: any) => p.type === 'DEPOSIT' && p.status === PaymentStatus.PAID && !p.isRefunded).reduce((sum: number, p: any) => sum + p.amount, 0);
    
    return {
      expected,
      collected: actualCollected,
      pending: Math.max(0, expected - actualCollected),
      progress: expected > 0 ? (actualCollected / expected) * 100 : 0,
      heldAssets
    };
  }, [recordsWithRent, store.payments, filterType, selectedMonth, selectedYear, startDate, endDate, visiblePropertyIds]);

  const handleAction = (record: any, type: 'RENT' | 'DEPOSIT') => {
    if (type === 'RENT' && record.isRentPaid && filterType === 'monthly') {
      setConfirmConfig({
        isOpen: true,
        isDanger: true,
        title: "Revert Payment",
        message: `Reset rent for "${record.tenantName}" for ${selectedMonth} to unpaid status?`,
        actionLabel: "Revert Payment",
        icon: <RefreshCw className="w-10 h-10 text-red-500" />,
        onConfirm: () => {
          store.togglePayment(record.id, selectedMonth, record.rentAmount, 'N/A', {}, 'RENT');
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }

    if (type === 'DEPOSIT' && record.isDepositPaid && !record.isDepositRefunded) {
      setConfirmConfig({
        isOpen: true,
        isDanger: true,
        title: "Refund Security Deposit",
        message: `Mark security deposit for "${record.tenantName}" as refunded?`,
        actionLabel: "Confirm Refund",
        icon: <Undo2 className="w-10 h-10 text-red-500" />,
        onConfirm: () => {
          store.refundDeposit(record.id);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }

    setCollectingRecord(record);
    setCollectionData({
      paidTo: store.config.paidToOptions[0] || '',
      paymentMode: store.config.paymentModeOptions[0] || '',
      month: type === 'RENT' ? selectedMonth : 'ONE_TIME',
      type,
      amount: type === 'RENT' ? record.rentAmount : record.depositAmount
    });
  };

  const confirmCollection = () => {
    if (!collectingRecord) return;
    const { paidTo, paymentMode, amount, type, month } = collectionData;
    const { id: recordId, tenantName, dueDay } = collectingRecord;

    setConfirmConfig({
      isOpen: true,
      title: `Confirm Settlement`,
      message: `Mark $${amount.toLocaleString()} as received from ${tenantName}?`,
      actionLabel: "Confirm Receipt",
      icon: type === 'DEPOSIT' ? <ShieldCheck className="w-10 h-10 text-amber-500" /> : <DollarSign className="w-10 h-10 text-indigo-500" />,
      onConfirm: () => {
        const dueDateString = type === 'RENT' ? `${month}-${String(dueDay).padStart(2, '0')}` : 'N/A';
        store.togglePayment(recordId, month, amount, dueDateString, { paidTo, paymentMode }, type);
        setCollectingRecord(null);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addPaidToOption = () => {
    if (!newPaidTo.trim()) return;
    store.updateConfig({ paidToOptions: [...store.config.paidToOptions, newPaidTo.trim()] });
    setNewPaidTo('');
  };

  const removePaidToOption = (option: string) => {
    store.updateConfig({ paidToOptions: store.config.paidToOptions.filter((o: string) => o !== option) });
  };

  const addPaymentModeOption = () => {
    if (!newPaymentMode.trim()) return;
    store.updateConfig({ paymentModeOptions: [...store.config.paymentModeOptions, newPaymentMode.trim()] });
    setNewPaymentMode('');
  };

  const removePaymentModeOption = (option: string) => {
    store.updateConfig({ paymentModeOptions: store.config.paymentModeOptions.filter((o: string) => o !== option) });
  };

  const handleEditUnit = (record: any) => {
    const initial = record.recordValues.reduce((acc: any, v: any) => ({...acc, [v.columnId]: v.value}), {});
    setEditFormData(initial);
    setEditingUnit(record);
    setFormErrors({});
  };

  const saveUnitChanges = () => {
    if (!editingUnit) return;
    const errors: Record<string, string> = {};
    editingUnit.propertyType.columns.forEach((col: ColumnDefinition) => {
      const val = editFormData[col.id]?.trim() || "";
      if (col.required && val === "") errors[col.id] = "Required";
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: "Update Unit Record",
      message: `Save changes for ${editingUnit.tenantName}?`,
      actionLabel: "Save Changes",
      onConfirm: () => {
        const updatedValues = Object.entries(editFormData).map(([colId, value]) => ({
          id: 'v_' + Math.random().toString(36).substr(2, 9), 
          recordId: editingUnit.id, 
          columnId: colId, 
          value
        }));
        store.updateRecord(editingUnit.id, updatedValues);
        setEditingUnit(null);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const navigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1);
    date.setMonth(date.getMonth() + direction);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const navigateYear = (direction: number) => {
    const year = parseInt(selectedYear);
    setSelectedYear((year + direction).toString());
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear); 
    store.payments.forEach((p: Payment) => {
      if (p.paidAt) years.add(new Date(p.paidAt).getFullYear());
      if (p.month && p.month !== 'ONE_TIME') {
        const yearPart = parseInt(p.month.split('-')[0]);
        if (!isNaN(yearPart)) years.add(yearPart);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [store.payments]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95">
            <div className={`p-10 text-center ${confirmConfig.isDanger ? 'bg-red-50/50' : 'bg-indigo-50/50'}`}>
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmConfig.isDanger ? 'bg-red-500 text-white' : 'bg-white text-indigo-600'}`}>
                {confirmConfig.icon}
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">{confirmConfig.title}</h3>
              <p className="text-slate-500 font-medium">{confirmConfig.message}</p>
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
              <button onClick={confirmConfig.onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all ${confirmConfig.isDanger ? 'bg-red-500' : 'bg-indigo-600'}`}>{confirmConfig.actionLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyRecord && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-lg animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div>
                    <h3 className="text-xl font-black text-gray-900 uppercase">Settlement History</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{historyRecord.tenantName} • {historyRecord.property.name}</p>
                 </div>
                 <button onClick={() => setHistoryRecord(null)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
              </div>
              <div className="p-0 max-h-[60vh] overflow-auto">
                 <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                       <tr>
                          <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type / Date</th>
                          <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mode</th>
                          <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {historyRecord.paymentHistory.length > 0 ? historyRecord.paymentHistory.sort((a,b) => new Date(b.paidAt || '').getTime() - new Date(a.paidAt || '').getTime()).map((p: Payment) => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-3">
                                   <div className={`p-2 rounded-lg ${p.type === 'DEPOSIT' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                      {p.type === 'DEPOSIT' ? <ShieldCheck className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                                   </div>
                                   <div>
                                      <p className="text-sm font-black text-gray-900">{p.type === 'RENT' ? `Rent (${p.month})` : 'Security Deposit'}</p>
                                      <p className="text-[10px] font-bold text-gray-400">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'N/A'}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-5">
                                <p className="text-xs font-black text-gray-600">{p.paymentMode || 'N/A'}</p>
                                <p className="text-[9px] font-bold text-gray-400">{p.paidTo}</p>
                             </td>
                             <td className="px-8 py-5 text-right">
                                <p className={`text-sm font-black ${p.isRefunded ? 'text-red-500 line-through' : 'text-gray-900'}`}>${p.amount.toLocaleString()}</p>
                                {p.isRefunded && <p className="text-[9px] font-black text-red-500 uppercase">Refunded</p>}
                             </td>
                          </tr>
                       )) : (
                          <tr><td colSpan={3} className="px-8 py-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest italic">No settlement activity recorded</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
              <div className="p-8 bg-gray-50 border-t border-gray-100">
                 <button onClick={() => setHistoryRecord(null)} className="w-full py-4 bg-white border border-gray-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">Close History</button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Unit Modal */}
      {editingUnit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-lg animate-in fade-in">
           <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div>
                    <h3 className="text-xl font-black text-gray-900 uppercase">Edit Unit Details</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{editingUnit.property.name}</p>
                 </div>
                 <button onClick={() => setEditingUnit(null)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-auto">
                 {editingUnit.propertyType.columns.map((col: ColumnDefinition) => (
                    <div key={col.id} className="space-y-1.5">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{col.name} {col.required && <span className="text-red-500">*</span>}</label>
                       {col.type === ColumnType.DROPDOWN ? (
                          <select 
                             className={`w-full bg-gray-50 border ${formErrors[col.id] ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200'} rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer`} 
                             value={editFormData[col.id] || ''} 
                             onChange={e => setEditFormData({...editFormData, [col.id]: e.target.value})}
                          >
                             <option value="">Select...</option>
                             {col.options?.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                       ) : (
                          <input 
                             className={`w-full bg-gray-50 border ${formErrors[col.id] ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200'} rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all`} 
                             type={col.type === ColumnType.DATE ? 'date' : 'text'} 
                             value={editFormData[col.id] || ''} 
                             onChange={e => setEditFormData({...editFormData, [col.id]: e.target.value})} 
                             placeholder={col.name}
                          />
                       )}
                       {formErrors[col.id] && <p className="text-[9px] font-black text-red-500 uppercase tracking-tighter ml-1">{formErrors[col.id]}</p>}
                    </div>
                 ))}
              </div>
              <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                 <button onClick={() => setEditingUnit(null)} className="flex-1 py-4 bg-white border border-gray-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">Cancel</button>
                 <button onClick={saveUnitChanges} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Save Changes</button>
              </div>
           </div>
        </div>
      )}

      {/* Admin Settings Panel */}
      {isAdmin && showSettings && (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-2xl animate-in slide-in-from-top-4 duration-500 space-y-8">
           <div className="flex justify-between items-center">
              <div>
                 <h2 className="text-2xl font-black text-gray-900 uppercase">Ledger Configuration</h2>
                 <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Manage valid recipients and transfer modes.</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all"><X className="w-5 h-5 text-gray-500" /></button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Paid To Options */}
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Recipient Accounts</label>
                 <div className="flex gap-2 mb-4">
                    <input 
                       className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                       placeholder="Add new account..."
                       value={newPaidTo}
                       onChange={e => setNewPaidTo(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && addPaidToOption()}
                    />
                    <button onClick={addPaidToOption} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-all"><Plus className="w-5 h-5" /></button>
                 </div>
                 <div className="space-y-2">
                    {store.config.paidToOptions.map((opt: string) => (
                       <div key={opt} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                          <span className="text-sm font-bold text-gray-700">{opt}</span>
                          <button onClick={() => removePaidToOption(opt)} className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    ))}
                 </div>
              </div>

              {/* Payment Mode Options */}
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Transfer Methods</label>
                 <div className="flex gap-2 mb-4">
                    <input 
                       className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                       placeholder="Add new method..."
                       value={newPaymentMode}
                       onChange={e => setNewPaymentMode(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && addPaymentModeOption()}
                    />
                    <button onClick={addPaymentModeOption} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-all"><Plus className="w-5 h-5" /></button>
                 </div>
                 <div className="space-y-2">
                    {store.config.paymentModeOptions.map((opt: string) => (
                       <div key={opt} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                          <span className="text-sm font-bold text-gray-700">{opt}</span>
                          <button onClick={() => removePaymentModeOption(opt)} className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Collection Ledger</h1>
          <p className="text-gray-500 mt-1 font-medium">Monitoring settlements for your active portfolio.</p>
        </div>
        
        <div className="flex flex-col lg:flex-row items-center gap-4">
          {isAdmin && (
             <button onClick={() => setShowSettings(!showSettings)} className={`p-4 rounded-2xl border transition-all ${showSettings ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-white hover:text-indigo-600'}`}>
                <Settings className="w-6 h-6" />
             </button>
          )}

          <div className="bg-gray-100 p-1.5 rounded-2xl flex items-center">
             {['monthly', 'annual', 'custom'].map((type) => (
               <button 
                key={type}
                onClick={() => setFilterType(type as FilterType)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === type ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 {type}
               </button>
             ))}
          </div>

          <div className="bg-gray-50 border border-gray-100 px-4 py-2 rounded-2xl flex items-center gap-2 min-h-[50px]">
            {filterType === 'monthly' && (
              <div className="flex items-center gap-2">
                <button onClick={() => navigateMonth(-1)} className="p-1 hover:text-indigo-600 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 text-indigo-500" />
                  <input 
                    type="month"
                    className="bg-transparent border-none text-xs font-black uppercase text-gray-900 outline-none cursor-pointer"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
                </div>
                <button onClick={() => navigateMonth(1)} className="p-1 hover:text-indigo-600 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {filterType === 'annual' && (
              <div className="flex items-center gap-2">
                <button onClick={() => navigateYear(-1)} className="p-1 hover:text-indigo-600 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <select 
                    className="bg-transparent border-none text-xs font-black uppercase text-gray-900 outline-none cursor-pointer appearance-none pr-8"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year.toString()}>{year}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-400 -ml-7 pointer-events-none" />
                </div>
                <button onClick={() => navigateYear(1)} className="p-1 hover:text-indigo-600 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {filterType === 'custom' && (
              <div className="flex items-center gap-3">
                <CalendarDays className="w-4 h-4 text-indigo-500" />
                <div className="flex items-center gap-2">
                  <input type="date" className="bg-transparent border-none text-[10px] font-black uppercase text-gray-900 outline-none cursor-pointer" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <ArrowRight className="w-3 h-3 text-gray-300" />
                  <input type="date" className="bg-transparent border-none text-[10px] font-black uppercase text-gray-900 outline-none cursor-pointer" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <Target className="w-3 h-3 text-indigo-500" /> Goal: {Math.round(stats.progress)}%
           </div>
           <div className="w-64 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-inner">
              <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${stats.progress}%` }}></div>
           </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Scope Target</p>
           <p className="text-2xl font-black text-gray-900">${stats.expected.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
           <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Inflow</p>
           <p className="text-2xl font-black text-emerald-600">${stats.collected.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
           <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Deficit</p>
           <p className="text-2xl font-black text-amber-600">${stats.pending.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
           <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Deposits</p>
           <p className="text-2xl font-black text-indigo-900">${stats.heldAssets.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-10 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl text-sm outline-none font-bold placeholder:text-gray-400" placeholder="Filter records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className="bg-gray-50 border-none px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-gray-100 transition-colors" value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)}>
             <option value="all">All Properties</option>
             {visibleProperties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Unit / Tenant</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Base Rent</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Current Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recordsWithRent.map((record: any) => (
                <tr key={record.id} className="hover:bg-indigo-50/10 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                       <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <User className="w-5 h-5" />
                       </div>
                       <div className="flex-1">
                          <div className="flex items-center gap-2">
                             <p className="font-black text-gray-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{record.tenantName}</p>
                             <button onClick={() => handleEditUnit(record)} className="p-1.5 text-gray-300 hover:text-indigo-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className="flex items-center gap-3">
                             <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {record.property?.name} • Due: {record.dueDay}</p>
                             <button onClick={() => setHistoryRecord(record)} className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-600 flex items-center gap-1"><History className="w-3 h-3" /> History</button>
                          </div>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="font-black text-gray-900 text-lg">${record.rentAmount.toLocaleString()}</p>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter flex items-center gap-1.5 shadow-sm ${
                         record.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                         record.status === 'OVERDUE' ? 'bg-red-50 text-red-700 border-red-100 animate-pulse' : 
                         'bg-amber-50 text-amber-700 border-amber-100'
                       }`}>
                         {record.status === 'PAID' ? <CheckCircle2 className="w-3 h-3" /> : record.status === 'OVERDUE' ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                         {record.status === 'PAID' ? 'Settled' : record.status === 'OVERDUE' ? 'Overdue' : 'Pending'}
                       </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-3">
                      {record.hasDepositOwed && (
                        <button 
                          onClick={() => handleAction(record, 'DEPOSIT')} 
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            record.isDepositPaid && !record.isDepositRefunded ? 'bg-rose-500 text-white shadow-xl hover:bg-rose-600' : 'bg-amber-500 text-white shadow-lg hover:bg-amber-600'
                          }`}
                        >
                           {record.isDepositPaid && !record.isDepositRefunded ? <Undo2 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                           {record.isDepositPaid && !record.isDepositRefunded ? 'Refund Deposit' : 'Deposit'}
                        </button>
                      )}
                      
                      {filterType === 'monthly' && (
                        <button onClick={() => handleAction(record, 'RENT')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${record.isRentPaid ? 'bg-gray-100 text-gray-400 hover:text-red-500 border border-transparent' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95'}`}>
                          {record.isRentPaid ? 'Unmark Settlement' : 'Confirm Rent'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {collectingRecord && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-lg animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-black text-gray-900 uppercase">Settlement Portal</h3>
                 <button onClick={() => setCollectingRecord(null)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className={`${collectionData.type === 'DEPOSIT' ? 'bg-amber-50 border-amber-100 text-amber-900' : 'bg-indigo-50 border-indigo-100 text-indigo-900'} p-8 rounded-[2.5rem] border text-center shadow-inner animate-in zoom-in-95 duration-500`}>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{collectionData.type} Amount</p>
                    <p className="text-5xl font-black tracking-tighter animate-in slide-in-from-bottom-2">${collectionData.amount.toLocaleString()}</p>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Receive Into Account</label>
                       <select className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer" value={collectionData.paidTo} onChange={e => setCollectionData({...collectionData, paidTo: e.target.value})}>
                          {store.config.paidToOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Method of Transfer</label>
                       <select className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer" value={collectionData.paymentMode} onChange={e => setCollectionData({...collectionData, paymentMode: e.target.value})}>
                          {store.config.paymentModeOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                 <button onClick={() => setCollectingRecord(null)} className="flex-1 py-4 bg-white border border-gray-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">Cancel</button>
                 <button onClick={confirmCollection} className={`flex-1 py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 ${collectionData.type === 'DEPOSIT' ? 'bg-amber-500 shadow-amber-200' : 'bg-indigo-600 shadow-indigo-200'}`}>Confirm Receipt</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RentCollection;
