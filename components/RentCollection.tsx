
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
  Wallet,
  CalendarDays,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  RotateCcw,
  Activity,
  UserPlus,
  AlertCircle,
  Check,
  ArrowUpRight,
  Landmark,
  History,
  ArrowRight,
  ChevronDown,
  Info,
  Calendar,
  Filter,
  MoreVertical,
  Undo2,
  Zap,
  Briefcase,
  Layers,
  Sparkles,
  Save,
  User,
  MapPin,
  ClipboardList,
  Settings,
  Plus,
  Trash2
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { PaymentStatus, ColumnType, Payment, UnitHistory, ColumnDefinition, RecordValue, Property, UserRole } from '../types';

const RentCollection: React.FC = () => {
  const store = useRentalStore();
  const isAdmin = store.user?.role === UserRole.ADMIN;
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  
  const [paymentModal, setPaymentModal] = useState<any>({ 
    isOpen: false, 
    record: null, 
    type: 'RENT', 
    amount: 0, 
    paidTo: store.config.paidToOptions?.[0] || '', 
    mode: store.config.paymentModeOptions?.[0] || '', 
    date: new Date().toISOString().split('T')[0] 
  });

  const [revertModal, setRevertModal] = useState<any>({
    isOpen: false,
    record: null,
    type: 'RENT',
    monthKey: ''
  });

  const [configModal, setConfigModal] = useState({
    isOpen: false,
    newPaidTo: '',
    newMode: ''
  });

  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; record: any | null }>({
    isOpen: false,
    record: null
  });

  const [temporalAction, setTemporalAction] = useState<any>({ 
    isOpen: false, 
    type: 'STATUS', 
    record: null, 
    formValues: {}, 
    effectiveDate: new Date().toISOString().split('T')[0] 
  });

  const navigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1);
    date.setMonth(date.getMonth() + direction);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const jumpToToday = () => {
    // Corrected 'date' to 'd' to correctly reference the local Date instance.
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleAddPaidTo = () => {
    if (!configModal.newPaidTo.trim()) return;
    store.updateConfig({ paidToOptions: [...(store.config.paidToOptions || []), configModal.newPaidTo.trim()] });
    setConfigModal({ ...configModal, newPaidTo: '' });
  };

  const handleRemovePaidTo = (val: string) => {
    store.updateConfig({ paidToOptions: (store.config.paidToOptions || []).filter((o: string) => o !== val) });
  };

  const handleAddMode = () => {
    if (!configModal.newMode.trim()) return;
    store.updateConfig({ paymentModeOptions: [...(store.config.paymentModeOptions || []), configModal.newMode.trim()] });
    setConfigModal({ ...configModal, newMode: '' });
  };

  const handleRemoveMode = (val: string) => {
    store.updateConfig({ paymentModeOptions: (store.config.paymentModeOptions || []).filter((o: string) => o !== val) });
  };

  const visibleProperties = useMemo(() => {
    return (store.properties || []).filter((p: Property) => 
      isAdmin || (p.allowedUserIds || []).includes(store.user?.id || '')
    );
  }, [store.properties, store.user, isAdmin]);

  const visiblePropertyIds = useMemo(() => visibleProperties.map((p: any) => p.id), [visibleProperties]);

  const dynamicLedgerHeaders = useMemo(() => {
    const typesToConsider = selectedPropertyId === 'all' 
      ? store.propertyTypes.filter((t: any) => visibleProperties.some((p: any) => p.propertyTypeId === t.id))
      : store.propertyTypes.filter((t: any) => store.properties.find((p: any) => p.id === selectedPropertyId)?.propertyTypeId === t.id);

    const columns: { name: string; id: string }[] = [];
    const seenNames = new Set<string>();

    typesToConsider.forEach((type: any) => {
      type.columns.forEach((col: ColumnDefinition) => {
        if (col.isDefaultInLedger && !seenNames.has(col.name.toLowerCase())) {
          const lowerName = col.name.toLowerCase();
          const excluded = ['tenant name', 'unit', 'occupancy', 'electricity bill', 'elec. reading'];
          if (!excluded.some(ex => lowerName.includes(ex))) {
             columns.push({ name: col.name, id: col.id });
             seenNames.add(lowerName);
          }
        }
      });
    });

    return columns;
  }, [store.propertyTypes, store.properties, selectedPropertyId, visibleProperties]);

  const recordsWithRent = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const [y, m] = selectedMonth.split('-').map(Number);
    const contextDate = new Date(y, m, 0, 23, 59, 59);

    return store.records
      .filter((r: any) => visiblePropertyIds.includes(r.propertyId))
      .map((record: any) => {
        const property = store.properties.find((p: any) => p.id === record.propertyId);
        const propertyType = store.propertyTypes.find((t: any) => t.id === property?.propertyTypeId);
        
        const historicalState = store.unitHistory.find((h: UnitHistory) => {
          if (h.recordId !== record.id) return false;
          const from = new Date(h.effectiveFrom);
          const to = h.effectiveTo ? new Date(h.effectiveTo) : new Date(8640000000000000);
          return contextDate >= from && contextDate <= to;
        });

        const activeValues = historicalState?.values || store.recordValues.filter((v: any) => v.recordId === record.id).reduce((acc: any, v: any) => ({...acc, [v.columnId]: v.value}), {});
        const rentCol = propertyType?.columns.find(c => c.isRentCalculatable);
        const depositCol = propertyType?.columns.find(c => c.type === ColumnType.SECURITY_DEPOSIT);
        const occupancyCol = propertyType?.columns.find(c => c.type === ColumnType.OCCUPANCY_STATUS);
        const nameCol = propertyType?.columns.find(c => c.name.toLowerCase().includes('name'));
        
        const rentValue = activeValues[rentCol?.id || ''] || '0';
        const depositValue = activeValues[depositCol?.id || ''] || '0';
        const occupancyValue = activeValues[occupancyCol?.id || ''] || 'Active';
        const tenantName = activeValues[nameCol?.id || ''] || 'Unknown';
        const isVacant = occupancyValue.toLowerCase().includes('vacant');

        const monthlyPayment = store.payments.find((p: any) => p.recordId === record.id && p.month === selectedMonth && p.type === 'RENT');
        const isRentPaid = !!monthlyPayment && monthlyPayment.status === PaymentStatus.PAID;

        const electricityPayment = store.payments.find((p: any) => p.recordId === record.id && p.month === selectedMonth && p.type === 'ELECTRICITY');
        const isElectricityPaid = !!electricityPayment && electricityPayment.status === PaymentStatus.PAID;

        const depositPayment = store.payments.find((p: any) => p.recordId === record.id && p.type === 'DEPOSIT');
        const isDepositPaid = !!depositPayment && depositPayment.status === PaymentStatus.PAID;

        let statusBadge: any = 'PENDING';
        if (isVacant) statusBadge = 'VACANT';
        else if (isRentPaid) statusBadge = 'PAID';
        else {
          const deadline = new Date(y, m - 1, propertyType?.defaultDueDateDay || 5, 23, 59, 59);
          if (today > deadline) statusBadge = 'OVERDUE';
        }

        return { ...record, property, propertyType, tenantName, rentAmount: parseFloat(rentValue), depositAmount: parseFloat(depositValue), isRentPaid, isElectricityPaid, electricityPaidAmount: electricityPayment?.amount || 0, isDepositPaid, isVacant, statusBadge, rawValuesMap: activeValues };
      })
      .filter((r: any) => {
        const matchesProp = selectedPropertyId === 'all' || r.propertyId === selectedPropertyId;
        const matchesSearch = searchTerm === '' || Object.values(r.rawValuesMap).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesProp && matchesSearch;
      });
  }, [store.records, store.properties, store.propertyTypes, store.recordValues, store.unitHistory, store.payments, selectedMonth, searchTerm, selectedPropertyId, visiblePropertyIds]);

  const ledgerStats = useMemo(() => {
    let collected = 0;
    let pending = 0;
    let heldDeposits = 0;

    recordsWithRent.forEach(r => {
      if (!r.isVacant) {
        if (r.isRentPaid) collected += r.rentAmount;
        else pending += r.rentAmount;
      }
      if (r.isDepositPaid) heldDeposits += r.depositAmount;
    });

    return { collected, pending, heldDeposits };
  }, [recordsWithRent]);

  const unitTimeline = useMemo(() => {
    if (!historyModal.record) return [];
    
    const recordId = historyModal.record.id;
    const pHistory = store.payments
      .filter((p: Payment) => p.recordId === recordId)
      .map(p => ({ 
        ...p, 
        eventType: 'PAYMENT', 
        timestamp: new Date(p.paidAt || p.dueDate).getTime() 
      }));

    const uHistory = store.unitHistory
      .filter((h: UnitHistory) => h.recordId === recordId)
      .map(h => ({ 
        ...h, 
        eventType: 'TENANT_CHANGE', 
        timestamp: new Date(h.effectiveFrom).getTime() 
      }));

    return [...pHistory, ...uHistory].sort((a, b) => b.timestamp - a.timestamp);
  }, [store.payments, store.unitHistory, historyModal.record]);

  const handleOpenPayment = (record: any, type: 'RENT' | 'DEPOSIT' | 'ELECTRICITY') => {
    let amount = 0;
    if (type === 'RENT') amount = record.rentAmount;
    else if (type === 'DEPOSIT') amount = record.depositAmount;
    else amount = 0;

    setPaymentModal({
      isOpen: true,
      record,
      type,
      amount,
      paidTo: store.config.paidToOptions?.[0] || '',
      mode: store.config.paymentModeOptions?.[0] || '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleOpenRevert = (record: any, type: 'RENT' | 'DEPOSIT' | 'ELECTRICITY') => {
    setRevertModal({
      isOpen: true,
      record,
      type,
      monthKey: (type === 'RENT' || type === 'ELECTRICITY') ? selectedMonth : 'ONE_TIME'
    });
  };

  const handleConfirmRevert = () => {
    const { record, monthKey, type } = revertModal;
    store.togglePayment(record.id, monthKey, 0, '', {}, type);
    setRevertModal({ ...revertModal, isOpen: false });
  };

  const handleCollect = () => {
    const { record, type, amount, paidTo, mode, date } = paymentModal;
    const monthKey = (type === 'RENT' || type === 'ELECTRICITY') ? selectedMonth : 'ONE_TIME';
    
    store.togglePayment(record.id, monthKey, amount, date, {
      status: PaymentStatus.PAID,
      paidTo,
      paymentMode: mode,
      paidAt: date
    }, type);
    
    setPaymentModal({ ...paymentModal, isOpen: false });
  };

  const handleSaveTemporalAction = () => {
    const { record, formValues, effectiveDate } = temporalAction;
    const values: RecordValue[] = Object.entries(formValues).map(([colId, val]) => ({
      id: 'v' + Date.now() + Math.random().toString(36).substr(2, 5),
      recordId: record.id,
      columnId: colId,
      value: String(val)
    }));
    
    store.updateRecord(record.id, values, effectiveDate);
    setTemporalAction({ ...temporalAction, isOpen: false });
  };

  const [monthYearName, yearName] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1);
    return [date.toLocaleString('default', { month: 'long' }), y];
  }, [selectedMonth]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
             <div className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Ledger Engine
             </div>
             {isAdmin && (
               <button 
                onClick={() => setConfigModal({ ...configModal, isOpen: true })}
                className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-lg shadow-sm transition-all hover:bg-indigo-50"
               >
                 <Settings className="w-4 h-4" />
               </button>
             )}
          </div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">
            Rent Collection
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button onClick={jumpToToday} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg">Today</button>
          
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
             <button onClick={() => navigateMonth(-1)} className="p-2.5 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all">
                <ChevronLeft className="w-5 h-5" />
             </button>
             <div className="px-6 flex flex-col items-center min-w-[140px]">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{yearName}</span>
                <span className="text-sm font-black text-slate-900 uppercase">{monthYearName}</span>
             </div>
             <button onClick={() => navigateMonth(1)} className="p-2.5 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all">
                <ChevronRight className="w-5 h-5" />
             </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              className="pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all min-w-[280px] shadow-sm"
              placeholder="Search units or tenants..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* COLLECTION CONFIG MODAL */}
      {configModal.isOpen && isAdmin && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <Settings className="w-6 h-6 text-indigo-200" />
                    <h3 className="text-xl font-black uppercase tracking-tight">Collection Parameters</h3>
                 </div>
                 <button onClick={() => setConfigModal({...configModal, isOpen: false})} className="p-2 hover:bg-white/10 rounded-full transition-colors text-indigo-100"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                 {/* Paid To Config */}
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Recipients</label>
                       <div className="flex gap-2">
                          <input 
                             className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
                             placeholder="e.g. Petty Cash"
                             value={configModal.newPaidTo}
                             onChange={e => setConfigModal({...configModal, newPaidTo: e.target.value})}
                          />
                          <button onClick={handleAddPaidTo} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-95 transition-all"><Plus className="w-5 h-5" /></button>
                       </div>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                       {(store.config.paidToOptions || []).map((opt: string) => (
                          <div key={opt} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 group">
                             <span className="text-[11px] font-black uppercase text-slate-600">{opt}</span>
                             <button onClick={() => handleRemovePaidTo(opt)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                       ))}
                    </div>
                 </div>

                 {/* Modes Config */}
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Channels</label>
                       <div className="flex gap-2">
                          <input 
                             className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
                             placeholder="e.g. UPI/QR"
                             value={configModal.newMode}
                             onChange={e => setConfigModal({...configModal, newMode: e.target.value})}
                          />
                          <button onClick={handleAddMode} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-95 transition-all"><Plus className="w-5 h-5" /></button>
                       </div>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                       {(store.config.paymentModeOptions || []).map((opt: string) => (
                          <div key={opt} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 group">
                             <span className="text-[11px] font-black uppercase text-slate-600">{opt}</span>
                             <button onClick={() => handleRemoveMode(opt)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50/50">
                 <button onClick={() => setConfigModal({...configModal, isOpen: false})} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Close Settings</button>
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Settled Revenue', value: ledgerStats.collected, icon: Wallet, color: 'emerald', sub: `${Math.round((ledgerStats.collected / (ledgerStats.collected + ledgerStats.pending || 1)) * 100)}% Collection Rate` },
          { label: 'Pending Liquidity', value: ledgerStats.pending, icon: ArrowUpRight, color: 'rose', sub: 'Receivables Outstanding' },
          { label: 'Security Escrow', value: ledgerStats.heldDeposits, icon: ShieldCheck, color: 'indigo', sub: 'Protected Funds' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all">
             <div className="flex items-center gap-5">
                <div className={`w-14 h-14 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl flex items-center justify-center shadow-inner`}>
                   <stat.icon className="w-7 h-7" />
                </div>
                <div>
                   <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                   <h3 className="text-2xl font-black text-slate-950">${stat.value.toLocaleString()}</h3>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{stat.sub}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg"><Landmark className="w-5 h-5" /></div>
               <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Financial Unit Ledger</h2>
            </div>
            <div className="flex items-center gap-3">
               <Filter className="w-4 h-4 text-slate-400" />
               <select 
                 className="text-xs font-black uppercase text-slate-700 outline-none bg-transparent cursor-pointer hover:text-indigo-600 transition-colors"
                 value={selectedPropertyId}
                 onChange={e => setSelectedPropertyId(e.target.value)}
               >
                 <option value="all">View All Properties</option>
                 {visibleProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
            </div>
         </div>

         <div className="overflow-x-auto max-h-[800px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
               <thead className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
                  <tr className="bg-white">
                     <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest sticky left-0 z-20 bg-white shadow-[3px_0_10px_rgba(0,0,0,0.05)]">Unit & Member</th>
                     
                     {dynamicLedgerHeaders.map(header => (
                        <th key={header.id} className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                           {header.name}
                        </th>
                     ))}

                     <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Rent Status</th>
                     <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Electricity</th>
                     <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Security</th>
                     <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Ops</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {recordsWithRent.map((record) => (
                    <tr key={record.id} className={`group hover:bg-slate-50/50 transition-all ${record.isVacant ? 'opacity-50' : ''}`}>
                       <td className="px-8 py-6 sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[3px_0_10px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 shadow-inner group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                <Building2 className="w-6 h-6" />
                             </div>
                             <div>
                                <h4 className="text-sm font-black text-slate-900 uppercase truncate max-w-[200px]">{record.property?.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                   <span className="text-[11px] font-black text-indigo-500 uppercase tracking-tight">{record.tenantName}</span>
                                   <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{record.isVacant ? 'Vacant' : 'Active'}</span>
                                </div>
                             </div>
                          </div>
                       </td>

                       {dynamicLedgerHeaders.map(header => {
                          const matchingCol = record.propertyType?.columns.find((c: any) => c.name.toLowerCase() === header.name.toLowerCase());
                          const val = matchingCol ? record.rawValuesMap[matchingCol.id] : '-';
                          return (
                            <td key={header.id} className="px-8 py-6 text-center">
                               <span className="text-sm font-bold text-slate-600 uppercase tracking-tight">{val || '-'}</span>
                            </td>
                          );
                       })}
                       
                       <td className="px-8 py-6 text-center">
                          <button 
                            disabled={record.isVacant}
                            onClick={() => record.isRentPaid ? handleOpenRevert(record, 'RENT') : handleOpenPayment(record, 'RENT')}
                            className={`min-w-[140px] px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2.5 mx-auto ${record.isRentPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-rose-50 hover:text-rose-700 group/rev' : record.statusBadge === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}
                          >
                             {record.isRentPaid ? (
                               <>
                                 <span className="group-hover/rev:hidden flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Settled</span>
                                 <span className="hidden group-hover/rev:flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Reverse</span>
                               </>
                             ) : (
                               <>
                                 {record.statusBadge === 'OVERDUE' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                 {record.isVacant ? 'N/A' : 'Collect'}
                               </>
                             )}
                          </button>
                       </td>

                       <td className="px-8 py-6 text-center">
                          <button 
                            disabled={record.isVacant}
                            onClick={() => record.isElectricityPaid ? handleOpenRevert(record, 'ELECTRICITY') : handleOpenPayment(record, 'ELECTRICITY')}
                            className={`min-w-[140px] px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2.5 mx-auto ${record.isElectricityPaid ? 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-rose-50 hover:text-rose-700 group/rev-elec' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                          >
                             {record.isElectricityPaid ? (
                               <>
                                 <span className="group-hover/rev-elec:hidden flex items-center gap-2"><Zap className="w-4 h-4" /> ${record.electricityPaidAmount}</span>
                                 <span className="hidden group-hover/rev-elec:flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Reverse</span>
                               </>
                             ) : (
                               <>
                                 <Zap className="w-4 h-4" />
                                 {record.isVacant ? 'N/A' : 'Bill'}
                               </>
                             )}
                          </button>
                       </td>

                       <td className="px-8 py-6 text-center">
                          <button 
                            disabled={record.isVacant}
                            onClick={() => record.isDepositPaid ? handleOpenRevert(record, 'DEPOSIT') : handleOpenPayment(record, 'DEPOSIT')}
                            className={`min-w-[140px] px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2.5 mx-auto ${record.isDepositPaid ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-rose-50 hover:text-rose-700 group/rev-dep' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                          >
                             {record.isDepositPaid ? (
                               <>
                                 <span className="group-hover/rev-dep:hidden flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Secured</span>
                                 <span className="hidden group-hover/rev-dep:flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Reverse</span>
                               </>
                             ) : (
                               <>
                                 <Landmark className="w-4 h-4" />
                                 {record.isVacant ? 'N/A' : 'Escrow'}
                               </>
                             )}
                          </button>
                       </td>

                       <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                             <button onClick={() => setHistoryModal({ isOpen: true, record })} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors bg-white rounded-lg shadow-sm"><History className="w-5 h-5" /></button>
                             <button 
                               onClick={() => {
                                 const freshValues: any = {};
                                 record.propertyType?.columns.forEach((col: any) => { freshValues[col.id] = ''; });
                                 const statusCol = record.propertyType?.columns.find((c: any) => c.type === ColumnType.OCCUPANCY_STATUS);
                                 if (statusCol) freshValues[statusCol.id] = 'Active';
                                 setTemporalAction({ isOpen: true, type: 'TENANT', record, formValues: freshValues, effectiveDate: new Date().toISOString().split('T')[0] });
                               }} 
                               className="p-2.5 text-slate-400 hover:text-emerald-600 transition-colors bg-white rounded-lg shadow-sm"
                             >
                               <UserPlus className="w-5 h-5" />
                             </button>
                             <button 
                               onClick={() => {
                                 const statusCol = record.propertyType?.columns.find((c: any) => c.type === ColumnType.OCCUPANCY_STATUS);
                                 const vacatingValues = { ...record.rawValuesMap };
                                 if (statusCol) vacatingValues[statusCol.id] = 'Vacant';
                                 setTemporalAction({ isOpen: true, type: 'STATUS', record, formValues: vacatingValues, effectiveDate: new Date().toISOString().split('T')[0] });
                               }} 
                               className="p-2.5 text-slate-400 hover:text-rose-600 transition-colors bg-white rounded-lg shadow-sm"
                             >
                               <Activity className="w-5 h-5" />
                             </button>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* REVERT DIALOG */}
      {revertModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-10 text-center bg-rose-50 border-b border-rose-100">
                 <div className="w-20 h-20 bg-rose-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-600/20">
                    <RotateCcw className="w-10 h-10" />
                 </div>
                 <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Reverse Protocol?</h3>
                 <p className="text-sm font-bold text-slate-500 mt-3 leading-relaxed">
                   Roll back transaction for <strong>{revertModal.record.tenantName}</strong>? This cannot be easily undone.
                 </p>
              </div>
              <div className="p-8 flex gap-4 bg-white">
                 <button onClick={() => setRevertModal({...revertModal, isOpen: false})} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-200">Abort</button>
                 <button onClick={handleConfirmRevert} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">Confirm Rollback</button>
              </div>
           </div>
        </div>
      )}

      {/* SETTLEMENT MODAL */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className={`p-10 text-white flex justify-between items-center ${paymentModal.type === 'RENT' ? 'bg-indigo-600' : paymentModal.type === 'ELECTRICITY' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                 <div className="flex items-center gap-5">
                    <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                       {paymentModal.type === 'RENT' ? <Wallet className="w-7 h-7" /> : paymentModal.type === 'ELECTRICITY' ? <Zap className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
                    </div>
                    <div>
                       <h3 className="text-2xl font-black uppercase leading-none tracking-tight">Settle {paymentModal.type}</h3>
                       <p className="text-[11px] font-bold text-white/60 uppercase mt-2">Member: {paymentModal.record.tenantName}</p>
                    </div>
                 </div>
                 <button onClick={() => setPaymentModal({...paymentModal, isOpen: false})} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/60"><X className="w-7 h-7" /></button>
              </div>

              <div className="p-10 space-y-8">
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Capital Amount</label>
                    <div className="relative">
                       <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" />
                       <input 
                         type="number" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] pl-16 pr-6 py-6 text-3xl font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-inner" 
                         value={paymentModal.amount}
                         placeholder="0"
                         onChange={e => setPaymentModal({...paymentModal, amount: parseFloat(e.target.value) || 0})}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Channel</label>
                       <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all cursor-pointer" value={paymentModal.mode} onChange={e => setPaymentModal({...paymentModal, mode: e.target.value})}>
                          {(store.config.paymentModeOptions || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Account</label>
                       <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all cursor-pointer" value={paymentModal.paidTo} onChange={e => setPaymentModal({...paymentModal, paidTo: e.target.value})}>
                          {(store.config.paidToOptions || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500" /> Settlement Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                      value={paymentModal.date} 
                      onChange={e => setPaymentModal({...paymentModal, date: e.target.value})} 
                    />
                 </div>

                 <button onClick={handleCollect} className={`w-full py-6 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-xl transition-all active:scale-95 ${paymentModal.type === 'RENT' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : paymentModal.type === 'ELECTRICITY' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'}`}>
                    Authorize Transaction
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* UNIFIED AUDIT TIMELINE MODAL */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-[1200] flex justify-end p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-lg h-full rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in slide-in-from-right-8 duration-500">
              <div className="p-10 bg-slate-950 text-white flex justify-between items-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full"></div>
                 <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/5 backdrop-blur-md">
                       <History className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                       <h3 className="text-2xl font-black uppercase tracking-tight">Audit Trail</h3>
                       <p className="text-[11px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">Unit History & Financials</p>
                    </div>
                 </div>
                 <button onClick={() => setHistoryModal({ isOpen: false, record: null })} className="p-3 hover:bg-white/10 rounded-full transition-colors text-slate-400 relative z-10"><X className="w-7 h-7" /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50/30">
                 {unitTimeline.length > 0 ? (
                    unitTimeline.map((item: any, idx) => {
                       const isTenantChange = item.eventType === 'TENANT_CHANGE';
                       const pType = item.type; // RENT, DEPOSIT, ELECTRICITY
                       
                       const getPaymentIcon = () => {
                         if (isTenantChange) return <User className="w-4 h-4 text-white" />;
                         if (pType === 'RENT') return <Wallet className="w-4 h-4 text-white" />;
                         if (pType === 'ELECTRICITY') return <Zap className="w-4 h-4 text-white" />;
                         if (pType === 'DEPOSIT') return <Landmark className="w-4 h-4 text-white" />;
                         return <DollarSign className="w-4 h-4 text-white" />;
                       };

                       const getBadgeConfig = () => {
                         if (isTenantChange) return { label: 'Migration Event', bg: 'bg-slate-900' };
                         if (pType === 'RENT') return { label: 'Rent Collection', bg: 'bg-emerald-600' };
                         if (pType === 'ELECTRICITY') return { label: 'Electricity Bill', bg: 'bg-amber-600' };
                         if (pType === 'DEPOSIT') return { label: 'Security Deposit', bg: 'bg-indigo-600' };
                         return { label: (pType || 'Payment') + ' Settlement', bg: 'bg-slate-500' };
                       };

                       const config = getBadgeConfig();

                       return (
                        <div key={idx} className="relative pl-10">
                           {idx !== unitTimeline.length - 1 && <div className="absolute left-[13px] top-8 bottom-[-32px] w-0.5 bg-slate-200"></div>}
                           <div className={`absolute left-0 top-1 w-8 h-8 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 ${config.bg}`}>
                              {getPaymentIcon()}
                           </div>

                           <div className="bg-white border border-slate-100 rounded-[2rem] p-7 shadow-sm hover:shadow-md transition-all">
                              <div className="flex items-center justify-between mb-4">
                                 <span className={`text-[9px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full text-white ${config.bg}`}>
                                    {config.label}
                                 </span>
                                 <span className="text-xs font-black text-slate-400 uppercase">{new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>

                              {isTenantChange ? (
                                 <div className="space-y-4">
                                    <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                                       <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Historical Snapshot</p>
                                       <div className="grid grid-cols-2 gap-y-4">
                                          {Object.entries(item.values).map(([colId, val]: [string, any]) => {
                                             const col = historyModal.record?.propertyType?.columns.find((c: any) => c.id === colId);
                                             if (!col || !val) return null;
                                             return (
                                               <div key={colId} className="space-y-1">
                                                  <p className="text-[8px] font-black text-slate-400 uppercase">{col.name}</p>
                                                  <p className="text-sm font-black text-slate-900 truncate">{val}</p>
                                               </div>
                                             );
                                          })}
                                       </div>
                                    </div>
                                 </div>
                              ) : (
                                 <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                       <div className="flex flex-col">
                                          <p className="text-sm font-black text-slate-900">{item.paymentMode || 'Direct Channel'}</p>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.paidTo || 'Default Account'}</p>
                                       </div>
                                       <div className="text-right">
                                          <p className="text-base font-black text-indigo-600">${item.amount.toLocaleString()}</p>
                                          {item.month !== 'ONE_TIME' && <p className="text-[9px] font-black text-slate-400 uppercase">{item.month}</p>}
                                       </div>
                                    </div>
                                 </div>
                              )}
                           </div>
                        </div>
                       );
                    })
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-24 opacity-40">
                       <History className="w-20 h-20 text-slate-200 mb-8" />
                       <p className="text-sm font-black uppercase tracking-widest text-slate-400">Zero Historical Footprint</p>
                    </div>
                 )}
              </div>

              <div className="p-8 bg-white border-t border-slate-100">
                 <button onClick={() => setHistoryModal({ isOpen: false, record: null })} className="w-full py-5 bg-slate-950 text-white rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">Close Log</button>
              </div>
           </div>
        </div>
      )}

      {/* TEMPORAL ACTION MODAL (Onboard/Vacate) */}
      {temporalAction.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className={`p-10 text-white flex justify-between items-center ${temporalAction.type === 'TENANT' ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                 <div className="flex items-center gap-5">
                    <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                       {temporalAction.type === 'TENANT' ? <UserPlus className="w-7 h-7" /> : <Activity className="w-7 h-7" />}
                    </div>
                    <div>
                       <h3 className="text-2xl font-black uppercase leading-none tracking-tight">{temporalAction.type === 'TENANT' ? 'Member Onboarding' : 'Occupancy Update'}</h3>
                       <p className="text-[11px] font-bold text-white/60 uppercase mt-2">Unit: {temporalAction.record.property?.name}</p>
                    </div>
                 </div>
                 <button onClick={() => setTemporalAction({...temporalAction, isOpen: false})} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/60"><X className="w-7 h-7" /></button>
              </div>

              <div className="p-10 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                 <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-3 shadow-inner">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500" /> Contract Effective Date</label>
                    <input 
                      type="date"
                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/5 transition-all"
                      value={temporalAction.effectiveDate}
                      onChange={e => setTemporalAction({...temporalAction, effectiveDate: e.target.value})}
                    />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight text-center mt-1">This shift creates a permanent history snapshot.</p>
                 </div>

                 <div className="space-y-6">
                    {temporalAction.record.propertyType?.columns.map((col: ColumnDefinition) => {
                      const isStatus = col.type === ColumnType.OCCUPANCY_STATUS;
                      const isRelevant = temporalAction.type === 'TENANT' ? true : isStatus;

                      if (!isRelevant) return null;

                      return (
                        <div key={col.id} className="space-y-2 animate-in slide-in-from-top-3">
                           <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{col.name}</label>
                           {col.options ? (
                             <select 
                               className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all cursor-pointer shadow-sm"
                               value={temporalAction.formValues[col.id] || ''}
                               onChange={e => setTemporalAction({
                                 ...temporalAction, 
                                 formValues: { ...temporalAction.formValues, [col.id]: e.target.value }
                               })}
                             >
                               <option value="">Select Protocol...</option>
                               {col.options.map(o => <option key={o} value={o}>{o}</option>)}
                             </select>
                           ) : (
                             <div className="relative group">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                                   {col.name.toLowerCase().includes('phone') ? <RotateCcw className="w-5 h-5 rotate-90" /> : col.name.toLowerCase().includes('name') ? <User className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                                </div>
                                <input 
                                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] pl-14 pr-6 py-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all shadow-sm"
                                  placeholder={`Enter ${col.name} value`}
                                  value={temporalAction.formValues[col.id] || ''}
                                  onChange={e => setTemporalAction({
                                    ...temporalAction, 
                                    formValues: { ...temporalAction.formValues, [col.id]: e.target.value }
                                  })}
                                />
                             </div>
                           )}
                        </div>
                      );
                    })}
                 </div>

                 <button 
                  onClick={handleSaveTemporalAction}
                  className={`w-full py-6 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-4 ${temporalAction.type === 'TENANT' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                 >
                    <Save className="w-6 h-6" /> {temporalAction.type === 'TENANT' ? 'Authorize Onboarding' : 'Execute Status Shift'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RentCollection;
