
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
  Sparkles
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { PaymentStatus, ColumnType, Payment, UnitHistory, ColumnDefinition } from '../types';

const RentCollection: React.FC = () => {
  const store = useRentalStore();
  const isAdmin = store.user?.role === 'ADMIN';
  const isManager = store.user?.role === 'MANAGER';
  
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
    paidTo: store.config.paidToOptions[0], 
    mode: store.config.paymentModeOptions[0], 
    date: new Date().toISOString().split('T')[0] 
  });

  const [revertModal, setRevertModal] = useState<any>({
    isOpen: false,
    record: null,
    type: 'RENT',
    monthKey: ''
  });

  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; record: any | null }>({
    isOpen: false,
    record: null
  });

  const [temporalAction, setTemporalAction] = useState<any>({ isOpen: false, type: 'STATUS', record: null, formValues: {}, effectiveDate: '' });

  const navigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1);
    date.setMonth(date.getMonth() + direction);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const jumpToToday = () => {
    const d = new Date();
    // Fix: replaced 'date' with 'd' to match variable definition
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const visibleProperties = useMemo(() => {
    if (!isManager) return store.properties;
    return store.properties.filter((p: any) => p.isVisibleToManager !== false);
  }, [store.properties, isManager]);

  const visiblePropertyIds = useMemo(() => visibleProperties.map((p: any) => p.id), [visibleProperties]);

  // DYNAMIC COLUMN LOGIC
  // 1. Find all columns across visible properties that have isDefaultInLedger: true
  // 2. We deduplicate them by name so "Phone" from Type A and "Phone" from Type B share a column
  const dynamicLedgerHeaders = useMemo(() => {
    const typesToConsider = selectedPropertyId === 'all' 
      ? store.propertyTypes.filter((t: any) => visibleProperties.some((p: any) => p.propertyTypeId === t.id))
      : store.propertyTypes.filter((t: any) => store.properties.find((p: any) => p.id === selectedPropertyId)?.propertyTypeId === t.id);

    const columns: { name: string; id: string }[] = [];
    const seenNames = new Set<string>();

    typesToConsider.forEach((type: any) => {
      type.columns.forEach((col: ColumnDefinition) => {
        if (col.isDefaultInLedger && !seenNames.has(col.name.toLowerCase())) {
          // Special Case: We skip things already in the "Unit & Tenant" core column (like Tenant Name)
          const lowerName = col.name.toLowerCase();
          if (lowerName !== 'tenant name' && lowerName !== 'unit' && lowerName !== 'occupancy') {
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

        const depositPayment = store.payments.find((p: any) => p.recordId === record.id && p.type === 'DEPOSIT');
        const isDepositPaid = !!depositPayment && depositPayment.status === PaymentStatus.PAID;

        let statusBadge: any = 'PENDING';
        if (isVacant) statusBadge = 'VACANT';
        else if (isRentPaid) statusBadge = 'PAID';
        else {
          const deadline = new Date(y, m - 1, propertyType?.defaultDueDateDay || 5, 23, 59, 59);
          if (today > deadline) statusBadge = 'OVERDUE';
        }

        return { ...record, property, propertyType, tenantName, rentAmount: parseFloat(rentValue), depositAmount: parseFloat(depositValue), isRentPaid, isDepositPaid, isVacant, statusBadge, rawValuesMap: activeValues };
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

  const unitPayments = useMemo(() => {
    if (!historyModal.record) return [];
    return store.payments.filter((p: Payment) => p.recordId === historyModal.record.id)
      .sort((a: any, b: any) => {
        const dateA = new Date(a.paidAt || a.dueDate).getTime();
        const dateB = new Date(b.paidAt || b.dueDate).getTime();
        return dateB - dateA;
      });
  }, [store.payments, historyModal.record]);

  const handleOpenPayment = (record: any, type: 'RENT' | 'DEPOSIT') => {
    setPaymentModal({
      isOpen: true,
      record,
      type,
      amount: type === 'RENT' ? record.rentAmount : record.depositAmount,
      paidTo: store.config.paidToOptions[0],
      mode: store.config.paymentModeOptions[0],
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleOpenRevert = (record: any, type: 'RENT' | 'DEPOSIT') => {
    setRevertModal({
      isOpen: true,
      record,
      type,
      monthKey: type === 'RENT' ? selectedMonth : 'ONE_TIME'
    });
  };

  const handleConfirmRevert = () => {
    const { record, monthKey, type } = revertModal;
    store.togglePayment(record.id, monthKey, 0, '', {}, type);
    setRevertModal({ ...revertModal, isOpen: false });
  };

  const handleCollect = () => {
    const { record, type, amount, paidTo, mode, date } = paymentModal;
    const monthKey = type === 'RENT' ? selectedMonth : 'ONE_TIME';
    
    store.togglePayment(record.id, monthKey, amount, date, {
      status: PaymentStatus.PAID,
      paidTo,
      paymentMode: mode,
      paidAt: date
    }, type);
    
    setPaymentModal({ ...paymentModal, isOpen: false });
  };

  const [monthYearName, yearName] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1);
    return [date.toLocaleString('default', { month: 'long' }), y];
  }, [selectedMonth]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      {/* HEADER SECTION - Compacted */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
             <div className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Ledger
             </div>
             {store.isCloudSyncing && (
               <div className="flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase tracking-widest animate-pulse">
                  <RotateCcw className="w-2.5 h-2.5 animate-spin" /> Syncing
               </div>
             )}
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
            Rent Collection
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={jumpToToday} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95">Today</button>
          
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
             <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-all">
                <ChevronLeft className="w-4 h-4" />
             </button>
             <div className="px-4 flex flex-col items-center min-w-[120px]">
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{yearName}</span>
                <span className="text-xs font-black text-slate-900 uppercase">{monthYearName}</span>
             </div>
             <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-all">
                <ChevronRight className="w-4 h-4" />
             </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all min-w-[240px] shadow-sm"
              placeholder="Filter units..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* STATS OVERVIEW - Smaller Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Settled', value: ledgerStats.collected, icon: Wallet, color: 'emerald', sub: `${Math.round((ledgerStats.collected / (ledgerStats.collected + ledgerStats.pending || 1)) * 100)}% Rate` },
          { label: 'Pending', value: ledgerStats.pending, icon: ArrowUpRight, color: 'rose', sub: 'Action Required' },
          { label: 'Security', value: ledgerStats.heldDeposits, icon: ShieldCheck, color: 'indigo', sub: 'Escrow Funds' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
             <div className="flex items-center gap-4">
                <div className={`w-12 h-12 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl flex items-center justify-center`}>
                   <stat.icon className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                   <h3 className="text-xl font-black text-slate-950">${stat.value.toLocaleString()}</h3>
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{stat.sub}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* MAIN LEDGER AREA - DYNAMIC COLUMNS IMPLEMENTED */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
         <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-slate-900 text-white rounded-lg"><Landmark className="w-4 h-4" /></div>
               <h2 className="text-sm font-black text-slate-900 uppercase">Unit Ledger</h2>
            </div>
            <div className="flex items-center gap-3">
               <Filter className="w-3.5 h-3.5 text-slate-400" />
               <select 
                 className="text-[10px] font-black uppercase text-slate-700 outline-none bg-transparent cursor-pointer"
                 value={selectedPropertyId}
                 onChange={e => setSelectedPropertyId(e.target.value)}
               >
                 <option value="all">All Properties</option>
                 {visibleProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
            </div>
         </div>

         <div className="overflow-x-auto max-h-[700px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
               <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
                  <tr className="bg-white">
                     <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky left-0 z-20 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Unit & Tenant</th>
                     
                     {/* RENDER CHECKED DYNAMIC COLUMNS FROM SCHEMA */}
                     {dynamicLedgerHeaders.map(header => (
                        <th key={header.id} className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                           {header.name}
                        </th>
                     ))}

                     <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Rent Status</th>
                     <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Security</th>
                     <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {recordsWithRent.map((record) => (
                    <tr key={record.id} className={`group hover:bg-slate-50/50 transition-all ${record.isVacant ? 'opacity-50' : ''}`}>
                       <td className="px-6 py-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300">
                                <Building2 className="w-5 h-5" />
                             </div>
                             <div>
                                <h4 className="text-xs font-black text-slate-900 uppercase truncate max-w-[150px]">{record.property?.name}</h4>
                                <div className="flex items-center gap-2">
                                   <span className="text-[9px] font-black text-indigo-500 uppercase">{record.tenantName}</span>
                                   <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                   <span className="text-[8px] font-black text-slate-400 uppercase">{record.isVacant ? 'Vacant' : 'Active'}</span>
                                </div>
                             </div>
                          </div>
                       </td>

                       {/* RENDER VALUES FOR CHECKED DYNAMIC COLUMNS */}
                       {dynamicLedgerHeaders.map(header => {
                          // We need to find the specific column ID in THIS record's property type that matches the header name
                          const matchingCol = record.propertyType?.columns.find((c: any) => c.name.toLowerCase() === header.name.toLowerCase());
                          const val = matchingCol ? record.rawValuesMap[matchingCol.id] : '-';
                          
                          return (
                            <td key={header.id} className="px-6 py-4 text-center">
                               <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{val || '-'}</span>
                            </td>
                          );
                       })}
                       
                       <td className="px-6 py-4 text-center">
                          <button 
                            disabled={record.isVacant}
                            onClick={() => record.isRentPaid ? handleOpenRevert(record, 'RENT') : handleOpenPayment(record, 'RENT')}
                            className={`min-w-[120px] px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 mx-auto ${record.isRentPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-rose-50 hover:text-rose-700 group/rev' : record.statusBadge === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}
                          >
                             {record.isRentPaid ? (
                               <>
                                 <span className="group-hover/rev:hidden flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Paid</span>
                                 <span className="hidden group-hover/rev:flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Revert</span>
                               </>
                             ) : (
                               <>
                                 {record.statusBadge === 'OVERDUE' ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                 {record.isVacant ? 'N/A' : 'Collect'}
                               </>
                             )}
                          </button>
                       </td>

                       <td className="px-6 py-4 text-center">
                          <button 
                            disabled={record.isVacant}
                            onClick={() => record.isDepositPaid ? handleOpenRevert(record, 'DEPOSIT') : handleOpenPayment(record, 'DEPOSIT')}
                            className={`min-w-[120px] px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 mx-auto ${record.isDepositPaid ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-rose-50 hover:text-rose-700 group/rev-dep' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                          >
                             {record.isDepositPaid ? (
                               <>
                                 <span className="group-hover/rev-dep:hidden flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Held</span>
                                 <span className="hidden group-hover/rev-dep:flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Revert</span>
                               </>
                             ) : (
                               <>
                                 <Landmark className="w-3.5 h-3.5" />
                                 {record.isVacant ? 'N/A' : 'Deposit'}
                               </>
                             )}
                          </button>
                       </td>

                       <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => setHistoryModal({ isOpen: true, record })} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><History className="w-4 h-4" /></button>
                             <button onClick={() => setTemporalAction({isOpen: true, type: 'TENANT', record, formValues: record.rawValuesMap, effectiveDate: new Date().toISOString().split('T')[0]})} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><UserPlus className="w-4 h-4" /></button>
                             <button onClick={() => setTemporalAction({isOpen: true, type: 'STATUS', record, formValues: record.rawValuesMap, effectiveDate: new Date().toISOString().split('T')[0]})} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Activity className="w-4 h-4" /></button>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* REVERT DIALOG - Compact */}
      {revertModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 text-center bg-rose-50 border-b border-rose-100">
                 <div className="w-16 h-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <RotateCcw className="w-8 h-8" />
                 </div>
                 <h3 className="text-xl font-black uppercase text-slate-900">Undo Payment?</h3>
                 <p className="text-xs font-medium text-slate-500 mt-2">
                   Mark this transaction as pending again for <strong>{revertModal.record.tenantName}</strong>?
                 </p>
              </div>
              <div className="p-6 flex gap-3 bg-white">
                 <button onClick={() => setRevertModal({...revertModal, isOpen: false})} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
                 <button onClick={handleConfirmRevert} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Yes, Undo</button>
              </div>
           </div>
        </div>
      )}

      {/* SETTLEMENT MODAL - Compact */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className={`p-8 text-white flex justify-between items-center ${paymentModal.type === 'RENT' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                       {paymentModal.type === 'RENT' ? <Wallet className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                    </div>
                    <div>
                       <h3 className="text-xl font-black uppercase leading-none">Settle {paymentModal.type}</h3>
                       <p className="text-[10px] font-bold text-white/60 uppercase mt-1">Tenant: {paymentModal.record.tenantName}</p>
                    </div>
                 </div>
                 <button onClick={() => setPaymentModal({...paymentModal, isOpen: false})} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6 text-white/60" /></button>
              </div>

              <div className="p-8 space-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount to Settle</label>
                    <div className="relative">
                       <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                       <input 
                         type="number" 
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-2xl font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                         value={paymentModal.amount}
                         onChange={e => setPaymentModal({...paymentModal, amount: parseFloat(e.target.value) || 0})}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Channel</label>
                       <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black uppercase outline-none" value={paymentModal.mode} onChange={e => setPaymentModal({...paymentModal, mode: e.target.value})}>
                          {store.config.paymentModeOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Account</label>
                       <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black uppercase outline-none" value={paymentModal.paidTo} onChange={e => setPaymentModal({...paymentModal, paidTo: e.target.value})}>
                          {store.config.paidToOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none" 
                      value={paymentModal.date} 
                      onChange={e => setPaymentModal({...paymentModal, date: e.target.value})} 
                    />
                 </div>

                 <button onClick={handleCollect} className={`w-full py-5 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all active:scale-95 ${paymentModal.type === 'RENT' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                    Confirm Settlement
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* HISTORY AUDIT PANEL - Compact Sidebar Style */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-[1200] flex justify-end p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-lg h-full rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <History className="w-6 h-6 text-indigo-400" />
                    <div>
                       <h3 className="text-xl font-black uppercase">Audit Trail</h3>
                       <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{historyModal.record?.tenantName}</p>
                    </div>
                 </div>
                 <button onClick={() => setHistoryModal({ isOpen: false, record: null })} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6 bg-slate-50/30">
                 {unitPayments.length > 0 ? (
                    unitPayments.map((payment: any) => (
                       <div key={payment.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${payment.type === 'RENT' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                   {payment.type}
                                </span>
                                {payment.month !== 'ONE_TIME' && <span className="text-[9px] font-black text-slate-400 uppercase">{payment.month}</span>}
                             </div>
                             <span className="text-sm font-black text-slate-900">${payment.amount.toLocaleString()}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                             <div className="space-y-0.5">
                                <p className="text-[7px] font-black text-slate-300 uppercase">Paid At</p>
                                <p className="text-[10px] font-bold text-slate-600">{new Date(payment.paidAt || payment.dueDate).toLocaleDateString()}</p>
                             </div>
                             <div className="space-y-0.5">
                                <p className="text-[7px] font-black text-slate-300 uppercase">Mode</p>
                                <p className="text-[10px] font-bold text-slate-600">{payment.paymentMode || 'N/A'}</p>
                             </div>
                          </div>
                       </div>
                    ))
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                       <History className="w-12 h-12 text-slate-200 mb-4" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No History</p>
                    </div>
                 )}
              </div>

              <div className="p-6 bg-white border-t border-slate-100">
                 <button onClick={() => setHistoryModal({ isOpen: false, record: null })} className="w-full py-4 bg-slate-950 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Close Log</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RentCollection;
