
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Building2,
  DollarSign,
  X,
  ShieldCheck,
  RefreshCw,
  Target,
  AlertTriangle,
  Edit2,
  History,
  CalendarDays,
  TrendingUp,
  ChevronDown,
  Plus,
  Undo2,
  Settings,
  Trash2,
  ShieldAlert,
  Wallet,
  ArrowRight,
  User,
  PlusCircle,
  CreditCard,
  Landmark,
  ArrowDownRight
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
        const pd = new Date(p.paidAt);
        return pd >= start && pd <= end;
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
    
    const pendingByProperty: Record<string, { name: string, amount: number }> = {};
    recordsWithRent.forEach(r => {
      if (!r.isRentPaid) {
        if (!pendingByProperty[r.propertyId]) {
          pendingByProperty[r.propertyId] = { name: r.property?.name || 'Unknown', amount: 0 };
        }
        pendingByProperty[r.propertyId].amount += r.rentAmount * rangeMultiplier;
      }
    });

    return {
      expected,
      collected: actualCollected,
      pending: Math.max(0, expected - actualCollected),
      progress: expected > 0 ? (actualCollected / expected) * 100 : 0,
      heldAssets,
      rangeMultiplier,
      pendingByProperty: Object.values(pendingByProperty).sort((a, b) => b.amount - a.amount)
    };
  }, [recordsWithRent, store.payments, filterType, selectedMonth, selectedYear, startDate, endDate, visiblePropertyIds]);

  const handleEditUnit = (record: any) => {
    setEditingUnit(record);
    const initial = record.recordValues.reduce((acc: any, v: any) => ({...acc, [v.columnId]: v.value}), {});
    setEditFormData(initial);
    setFormErrors({});
  };

  const handleSaveUnit = () => {
    if (!editingUnit) return;
    const errors: Record<string, string> = {};
    const columns = editingUnit.propertyType.columns;
    
    columns.forEach((col: any) => {
      const val = editFormData[col.id]?.trim() || "";
      if (col.required && val === "") {
        errors[col.id] = `${col.name} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const updatedValues = Object.entries(editFormData).map(([colId, value]) => ({
      id: 'v_' + Math.random().toString(36).substr(2, 9), 
      recordId: editingUnit.id, 
      columnId: colId, 
      value
    }));
    
    store.updateRecord(editingUnit.id, updatedValues);
    setEditingUnit(null);
  };

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
    const { id: recordId, dueDay } = collectingRecord;

    const dueDateString = type === 'RENT' ? `${month}-${String(dueDay).padStart(2, '0')}` : 'N/A';
    store.togglePayment(recordId, month, amount, dueDateString, { paidTo, paymentMode }, type);
    setCollectingRecord(null);
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

  const addPaidToOption = () => {
    if (!newPaidTo.trim()) return;
    if (store.config.paidToOptions.includes(newPaidTo.trim())) return;
    store.updateConfig({ paidToOptions: [...store.config.paidToOptions, newPaidTo.trim()] });
    setNewPaidTo('');
  };

  const removePaidToOption = (option: string) => {
    store.updateConfig({ paidToOptions: store.config.paidToOptions.filter((o: string) => o !== option) });
  };

  const addPaymentModeOption = () => {
    if (!newPaymentMode.trim()) return;
    if (store.config.paymentModeOptions.includes(newPaymentMode.trim())) return;
    store.updateConfig({ paymentModeOptions: [...store.config.paymentModeOptions, newPaymentMode.trim()] });
    setNewPaymentMode('');
  };

  const removePaymentModeOption = (option: string) => {
    store.updateConfig({ paymentModeOptions: store.config.paymentModeOptions.filter((o: string) => o !== option) });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-24">
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-10 text-center ${confirmConfig.isDanger ? 'bg-red-50/50' : 'bg-indigo-50/50'}`}>
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmConfig.isDanger ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-indigo-600 text-white shadow-indigo-500/20'}`}>
                {confirmConfig.icon}
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">{confirmConfig.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed">{confirmConfig.message}</p>
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Cancel</button>
              <button onClick={confirmConfig.onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 ${confirmConfig.isDanger ? 'bg-red-500' : 'bg-indigo-600'}`}>{confirmConfig.actionLabel}</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && isAdmin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3.5 rounded-2xl shadow-xl shadow-indigo-600/20"><Settings className="w-7 h-7" /></div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Ledger Controls</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Global Collection Configuration</p>
                  </div>
               </div>
               <button onClick={() => setShowSettings(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors text-slate-500"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar flex-1">
               <div className="space-y-6">
                  <div className="flex items-center gap-3">
                     <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Landmark className="w-5 h-5" /></div>
                     <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Settlement Accounts</h4>
                  </div>
                  <div className="flex gap-3">
                     <input 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        placeholder="e.g. Corporate Bank Account"
                        value={newPaidTo}
                        onChange={e => setNewPaidTo(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && addPaidToOption()}
                     />
                     <button onClick={addPaidToOption} className="bg-indigo-600 text-white px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                        <PlusCircle className="w-4 h-4" /> Add
                     </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {store.config.paidToOptions.map((opt: string) => (
                        <div key={opt} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all shadow-sm">
                           <span className="text-xs font-bold text-slate-700">{opt}</span>
                           <button onClick={() => removePaidToOption(opt)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                     <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><CreditCard className="w-5 h-5" /></div>
                     <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Inflow Channels</h4>
                  </div>
                  <div className="flex gap-3">
                     <input 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        placeholder="e.g. Digital Transfer"
                        value={newPaymentMode}
                        onChange={e => setNewPaymentMode(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && addPaymentModeOption()}
                     />
                     <button onClick={addPaymentModeOption} className="bg-emerald-600 text-white px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2">
                        <PlusCircle className="w-4 h-4" /> Add
                     </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {store.config.paymentModeOptions.map((opt: string) => (
                        <div key={opt} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-emerald-200 transition-all shadow-sm">
                           <span className="text-xs font-bold text-slate-700">{opt}</span>
                           <button onClick={() => removePaymentModeOption(opt)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 text-center">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configurations are synchronized globally across all team members.</p>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
             <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Wallet className="w-4 h-4" /></div>
             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Portfolio Ledger</span>
          </div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight uppercase leading-none">Collection Engine</h1>
          <p className="text-slate-500 mt-2 font-medium">Monitoring real-time settlements across all assets.</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4">
          {isAdmin && (
             <button 
                onClick={() => setShowSettings(true)}
                className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                title="Manage Ledger Settings"
             >
                <Settings className="w-5 h-5" />
             </button>
          )}

          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center shadow-inner">
             {['monthly', 'annual', 'custom'].map((type) => (
               <button 
                key={type}
                onClick={() => setFilterType(type as FilterType)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === type ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {type}
               </button>
             ))}
          </div>

          <div className="bg-white border border-slate-100 px-4 py-2 rounded-2xl flex items-center gap-2 min-h-[50px] shadow-sm">
            {filterType === 'monthly' && (
              <div className="flex items-center gap-2 whitespace-nowrap">
                <button onClick={() => navigateMonth(-1)} className="p-1 hover:text-indigo-600 transition-colors active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
                <label 
                   className="flex items-center gap-2 cursor-pointer group/date"
                   onClick={(e) => {
                     try { (e.currentTarget.querySelector('input') as any)?.showPicker(); } catch(e) {}
                   }}
                >
                  <CalendarDays className="w-4 h-4 text-indigo-500 group-hover/date:scale-110 transition-transform" />
                  <input type="month" className="bg-transparent border-none text-[10px] font-black uppercase text-slate-900 outline-none cursor-pointer" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                </label>
                <button onClick={() => navigateMonth(1)} className="p-1 hover:text-indigo-600 transition-colors active:scale-90"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
            {filterType === 'annual' && (
               <div className="flex items-center gap-2 whitespace-nowrap">
                 <button onClick={() => navigateYear(-1)} className="p-1 hover:text-indigo-600 transition-colors active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
                 <div className="flex items-center gap-2">
                   <TrendingUp className="w-4 h-4 text-indigo-500" />
                   <select className="bg-transparent border-none text-[10px] font-black uppercase text-slate-900 outline-none cursor-pointer appearance-none pr-6" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                     {availableYears.map(year => (
                       <option key={year} value={year.toString()}>{year}</option>
                     ))}
                   </select>
                   <ChevronDown className="w-3 h-3 text-slate-400 -ml-6 pointer-events-none" />
                 </div>
                 <button onClick={() => navigateYear(1)} className="p-1 hover:text-indigo-600 transition-colors active:scale-90"><ChevronRight className="w-4 h-4" /></button>
               </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center lg:items-end gap-2 w-full lg:w-auto relative">
           <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
              <Target className="w-4 h-4 text-indigo-500" /> Goal: <span className="text-indigo-600 font-black">{Math.round(stats.progress)}%</span>
           </div>
           <div className="w-full sm:w-64 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-1000" 
                style={{ width: `${Math.min(100, stats.progress)}%` }}
              ></div>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Target Scope', val: stats.expected, icon: Target, color: 'text-slate-400', bg: 'bg-white' },
          { label: 'Inflow', val: stats.collected, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50/50' },
          { label: 'Deficit', val: stats.pending, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50/50' },
          { label: 'Escrow Deposits', val: stats.heldAssets, icon: ShieldCheck, color: 'text-indigo-500', bg: 'bg-indigo-50/50' },
        ].map((item, i) => (
          <div key={i} className={`p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center ${item.bg}`}>
             <div className={`p-3 rounded-xl mb-4 shadow-sm bg-white ${item.color}`}>
                <item.icon className="w-6 h-6" />
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
             <p className="text-3xl font-black text-slate-950 tracking-tight">${item.val.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Arrears Breakdown Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shadow-sm">
            <ArrowDownRight className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Deficit Breakdown</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Uncollected rent by asset</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.pendingByProperty.length > 0 ? stats.pendingByProperty.map((item, i) => (
            <div key={i} className="bg-rose-50/30 border border-rose-100/50 p-6 rounded-[2rem] flex flex-col justify-between hover:bg-rose-50/50 transition-all group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest opacity-60">Asset</span>
                  <Building2 className="w-4 h-4 text-rose-300 group-hover:text-rose-400 transition-colors" />
                </div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-tight leading-tight truncate">{item.name}</p>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div className="text-lg font-black text-rose-600 tracking-tight">${item.amount.toLocaleString()}</div>
                <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Pending</div>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-12 text-center opacity-40">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-widest">Global Collections Settled</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl text-sm outline-none font-bold placeholder:text-slate-400" placeholder="Filter ledger..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className="bg-gray-50 border-none px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-slate-100 transition-colors appearance-none min-w-[200px]" value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)}>
             <option value="all">Global Portfolio</option>
             {visibleProperties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit / Tenant</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Base Yield</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recordsWithRent.map((record: any) => (
                <tr key={record.id} className="hover:bg-indigo-50/10 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                       <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <User className="w-5 h-5" />
                       </div>
                       <div>
                          <div className="flex items-center gap-2">
                             <p className="font-black text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{record.tenantName}</p>
                             <button onClick={() => handleEditUnit(record)} className="p-1 text-slate-300 hover:text-indigo-600 transition-colors active:scale-90"><Edit2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {record.property?.name}</p>
                             <button onClick={() => setHistoryRecord(record)} className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-600 flex items-center gap-1.5 active:scale-95 transition-colors"><History className="w-3.5 h-3.5" /> History</button>
                          </div>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <p className="font-black text-slate-950 text-lg tracking-tight">${record.rentAmount.toLocaleString()}</p>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                       <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-widest flex items-center gap-2 shadow-sm ${
                         record.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                         record.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse' : 
                         'bg-amber-50 text-amber-700 border-amber-100'
                       }`}>
                         {record.status === 'PAID' ? <CheckCircle2 className="w-3.5 h-3.5" /> : record.status === 'OVERDUE' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                         {record.status === 'PAID' ? 'Settled' : record.status === 'OVERDUE' ? 'Default' : 'Awaiting'}
                       </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-3">
                      {record.hasDepositOwed && (
                        <button 
                          onClick={() => handleAction(record, 'DEPOSIT')} 
                          className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 ${
                            record.isDepositPaid && !record.isDepositRefunded ? 'bg-rose-500 text-white shadow-lg hover:bg-rose-600' : 'bg-amber-500 text-white shadow-lg hover:bg-amber-600'
                          }`}
                        >
                           {record.isDepositPaid && !record.isDepositRefunded ? <Undo2 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                           {record.isDepositPaid && !record.isDepositRefunded ? 'Refund' : 'Deposit'}
                        </button>
                      )}
                      
                      {filterType === 'monthly' && (
                        <button onClick={() => handleAction(record, 'RENT')} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${record.isRentPaid ? 'bg-slate-100 text-slate-400 hover:text-rose-500 border border-transparent border-slate-200' : 'bg-slate-950 text-white shadow-xl hover:bg-indigo-700'}`}>
                          {record.isRentPaid ? 'Revert Settlement' : 'Confirm Inflow'}
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase">Settlement Portal</h3>
                 <button onClick={() => setCollectingRecord(null)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className={`${collectionData.type === 'DEPOSIT' ? 'bg-amber-50 border-amber-100 text-amber-900' : 'bg-indigo-50 border-indigo-100 text-indigo-900'} p-8 rounded-[2.5rem] border text-center shadow-inner`}>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{collectionData.type} Amount</p>
                    <p className="text-5xl font-black tracking-tighter">${collectionData.amount.toLocaleString()}</p>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Receive Into Account</label>
                       <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none cursor-pointer" value={collectionData.paidTo} onChange={e => setCollectionData({...collectionData, paidTo: e.target.value})}>
                          {store.config.paidToOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Method of Transfer</label>
                       <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none cursor-pointer" value={collectionData.paymentMode} onChange={e => setCollectionData({...collectionData, paymentMode: e.target.value})}>
                          {store.config.paymentModeOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                 <button onClick={() => setCollectingRecord(null)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">Cancel</button>
                 <button onClick={confirmCollection} className={`flex-1 py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 ${collectionData.type === 'DEPOSIT' ? 'bg-amber-500 shadow-amber-200' : 'bg-indigo-600 shadow-indigo-200'}`}>Confirm Receipt</button>
              </div>
           </div>
        </div>
      )}

      {editingUnit && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase">Edit Unit: {editingUnit.tenantName}</h3>
                 <button onClick={() => setEditingUnit(null)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {editingUnit.propertyType.columns.map((col: any) => (
                       <div key={col.id} className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{col.name} {col.required && '*'}</label>
                          {col.type === ColumnType.DROPDOWN ? (
                            <select 
                               className={`w-full bg-slate-50 border ${formErrors[col.id] ? 'border-red-500' : 'border-slate-100'} rounded-2xl px-5 py-4 text-sm font-bold outline-none`}
                               value={editFormData[col.id] || ''}
                               onChange={e => {
                                 setEditFormData({...editFormData, [col.id]: e.target.value});
                                 if(formErrors[col.id]) {
                                   const newErrors = {...formErrors};
                                   delete newErrors[col.id];
                                   setFormErrors(newErrors);
                                 }
                               }}
                            >
                               <option value="">Select...</option>
                               {col.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <div 
                               className={`w-full bg-slate-50 border ${formErrors[col.id] ? 'border-red-500' : 'border-slate-100'} rounded-2xl relative cursor-pointer`}
                               onClick={(e) => {
                                 if (col.type === ColumnType.DATE) {
                                   try { (e.currentTarget.querySelector('input') as any)?.showPicker(); } catch(err) {}
                                 }
                               }}
                            >
                              <input 
                                 type={col.type === ColumnType.CURRENCY || col.type === ColumnType.NUMBER || col.type === ColumnType.RENT_DUE_DAY || col.type === ColumnType.SECURITY_DEPOSIT ? 'number' : col.type === ColumnType.DATE ? 'date' : 'text'}
                                 className="w-full bg-transparent px-5 py-4 text-sm font-bold outline-none cursor-pointer"
                                 value={editFormData[col.id] || ''}
                                 onChange={e => {
                                   setEditFormData({...editFormData, [col.id]: e.target.value});
                                   if(formErrors[col.id]) {
                                     const newErrors = {...formErrors};
                                     delete newErrors[col.id];
                                     setFormErrors(newErrors);
                                   }
                                 }}
                              />
                            </div>
                          )}
                          {formErrors[col.id] && <p className="text-[10px] text-red-500 font-black uppercase ml-1">{formErrors[col.id]}</p>}
                       </div>
                    ))}
                 </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                 <button onClick={() => setEditingUnit(null)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">Cancel</button>
                 <button onClick={handleSaveUnit} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-200">Save Changes</button>
              </div>
           </div>
        </div>
      )}

      {historyRecord && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase">Transaction History: {historyRecord.tenantName}</h3>
                 <button onClick={() => setHistoryRecord(null)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                 {historyRecord.paymentHistory.length > 0 ? historyRecord.paymentHistory.map((pay: Payment) => (
                    <div key={pay.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                       <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{pay.type} - {pay.month === 'ONE_TIME' ? 'Security' : pay.month}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{pay.paymentMode} via {pay.paidTo}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-sm font-black text-indigo-600">${pay.amount.toLocaleString()}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{pay.paidAt ? new Date(pay.paidAt).toLocaleDateString() : 'N/A'}</p>
                       </div>
                    </div>
                 )) : (
                    <div className="py-20 text-center opacity-40">
                       <History className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No transaction history detected</p>
                    </div>
                 )}
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100">
                 <button onClick={() => setHistoryRecord(null)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Close History</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RentCollection;
