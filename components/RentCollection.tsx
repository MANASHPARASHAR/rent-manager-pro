
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

type FilterType = 'monthly' | 'annual' | 'custom';
type TemporalActionType = 'STATUS' | 'TENANT';

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
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const visibleProperties = useMemo(() => {
    if (!isManager) return store.properties;
    return store.properties.filter((p: any) => p.isVisibleToManager !== false);
  }, [store.properties, isManager]);

  const visiblePropertyIds = useMemo(() => visibleProperties.map((p: any) => p.id), [visibleProperties]);

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

  const confirmTemporalAction = () => {
    const { record, type, formValues, effectiveDate } = temporalAction;
    const updatedMap = { ...formValues };
    const statusColId = record.propertyType.columns.find((c: any) => c.type === ColumnType.OCCUPANCY_STATUS)?.id;

    if (type === 'STATUS') {
       updatedMap[statusColId] = 'Vacant';
       record.propertyType.columns.forEach((col: any) => { if (col.type !== ColumnType.OCCUPANCY_STATUS) updatedMap[col.id] = ''; });
    } else {
       updatedMap[statusColId] = 'Active';
    }

    const finalValues = Object.entries(updatedMap).map(([cid, val]) => ({ id: 'v_' + Math.random().toString(36).substr(2, 5), recordId: record.id, columnId: cid, value: val as string }));
    store.updateRecord(record.id, finalValues, effectiveDate);
    setTemporalAction({ ...temporalAction, isOpen: false });
  };

  const unitPayments = useMemo(() => {
    if (!historyModal.record) return [];
    return store.payments
      .filter((p: any) => p.recordId === historyModal.record.id)
      .sort((a: any, b: any) => new Date(b.paidAt || b.dueDate).getTime() - new Date(a.paidAt || a.dueDate).getTime());
  }, [store.payments, historyModal.record]);

  const [monthYearName, yearName] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1);
    return [date.toLocaleString('default', { month: 'long' }), y];
  }, [selectedMonth]);

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 max-w-[1500px] mx-auto pb-40">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 relative">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
             <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Premium Settlement Engine
             </div>
             {store.isCloudSyncing && (
               <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 text-[9px] font-black uppercase tracking-widest animate-pulse">
                  <RotateCcw className="w-3 h-3 animate-spin" /> Syncing with Sheet...
               </div>
             )}
          </div>
          <h1 className="text-5xl lg:text-8xl font-black text-slate-950 uppercase tracking-tighter leading-[0.85] transform-gpu">
            Treasury <br /> Control
          </h1>
          <p className="text-slate-500 font-medium text-xl max-w-xl leading-relaxed">
            High-precision ledger management for portfolio-wide rental collections, security assets, and residency audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white/70 backdrop-blur-3xl p-5 rounded-[3rem] border border-white shadow-[0_15px_50px_rgba(0,0,0,0.05)]">
          <button onClick={jumpToToday} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95">Today</button>
          
          <div className="flex items-center gap-1 bg-slate-50 p-2 rounded-2xl border border-slate-200">
             <button onClick={() => navigateMonth(-1)} className="p-3.5 hover:bg-white hover:text-indigo-600 rounded-xl transition-all shadow-sm">
                <ChevronLeft className="w-6 h-6" />
             </button>
             <div className="px-8 py-1 flex flex-col items-center min-w-[160px]">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-1">{yearName}</span>
                <span className="text-xl font-black text-slate-900 uppercase tracking-tight">
                   {monthYearName}
                </span>
             </div>
             <button onClick={() => navigateMonth(1)} className="p-3.5 hover:bg-white hover:text-indigo-600 rounded-xl transition-all shadow-sm">
                <ChevronRight className="w-6 h-6" />
             </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              className="pl-14 pr-8 py-4.5 bg-white border border-slate-200 rounded-[2rem] text-sm font-bold outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all min-w-[320px] shadow-sm"
              placeholder="Search resident, unit, or ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Settled Revenue', value: ledgerStats.collected, icon: Wallet, color: 'emerald', sub: `Collection Efficiency: ${Math.round((ledgerStats.collected / (ledgerStats.collected + ledgerStats.pending || 1)) * 100)}%` },
          { label: 'Pending Liquidity', value: ledgerStats.pending, icon: ArrowUpRight, color: 'rose', sub: 'Awaiting Settlement' },
          { label: 'Security Assets', value: ledgerStats.heldDeposits, icon: ShieldCheck, color: 'indigo', sub: 'Total Escrow Balance' }
        ].map((stat, i) => (
          <div key={i} className="group relative bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-700 overflow-hidden">
             <div className={`absolute top-0 right-0 w-40 h-40 bg-${stat.color}-500/5 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-125`}></div>
             <div className="flex items-center gap-8 relative z-10">
                <div className={`w-24 h-24 bg-${stat.color}-50 text-${stat.color}-600 rounded-[2.5rem] flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] group-hover:rotate-6 transition-transform`}>
                   <stat.icon className="w-10 h-10" />
                </div>
                <div>
                   <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">{stat.label}</p>
                   <h3 className="text-5xl font-black text-slate-950 tracking-tighter leading-none">${stat.value.toLocaleString()}</h3>
                   <div className="flex items-center gap-2.5 mt-4">
                      <div className={`w-2 h-2 rounded-full bg-${stat.color}-500 animate-pulse`}></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.sub}</span>
                   </div>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* MAIN LEDGER AREA */}
      <div className="bg-white rounded-[5rem] border border-slate-100 shadow-[0_30px_100px_rgba(0,0,0,0.04)] overflow-hidden">
         <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <div className="flex items-center gap-6">
               <div className="p-4 bg-slate-950 text-white rounded-[1.5rem] shadow-2xl">
                  <Landmark className="w-6 h-6" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Active Financial Ledger</h2>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{recordsWithRent.length} Tracked Units</p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-3 px-6 py-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm group">
                  <Filter className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  <select 
                    className="text-[11px] font-black uppercase text-slate-700 outline-none bg-transparent cursor-pointer"
                    value={selectedPropertyId}
                    onChange={e => setSelectedPropertyId(e.target.value)}
                  >
                    <option value="all">Global Portfolio</option>
                    {visibleProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
               </div>
            </div>
         </div>

         <div className="overflow-x-auto max-h-[900px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
               <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-2xl">
                  <tr className="border-b border-slate-100">
                     <th className="px-14 py-10 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Resident & Unit</th>
                     <th className="px-14 py-10 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Settlement Status</th>
                     <th className="px-14 py-10 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Security Asset</th>
                     <th className="px-14 py-10 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Operations</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {recordsWithRent.map((record) => (
                    <tr key={record.id} className={`group hover:bg-indigo-50/40 transition-all duration-500 ${record.isVacant ? 'opacity-40 grayscale-[0.8]' : ''}`}>
                       <td className="px-14 py-12">
                          <div className="flex items-center gap-8">
                             <div className="relative">
                                <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl border border-slate-100 flex items-center justify-center text-slate-300 group-hover:scale-110 group-hover:rotate-2 transition-all duration-700">
                                   <Building2 className="w-10 h-10" />
                                </div>
                                {!record.isVacant && (
                                   <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 border-[6px] border-white rounded-full shadow-lg"></div>
                                )}
                             </div>
                             <div>
                                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2 group-hover:text-indigo-600 transition-colors">{record.property?.name}</h4>
                                <div className="flex items-center gap-4">
                                   <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">{record.tenantName}</span>
                                   <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{record.isVacant ? 'Vacant' : 'Occupied'}</span>
                                </div>
                             </div>
                          </div>
                       </td>
                       
                       <td className="px-14 py-12 text-center">
                          <button 
                            disabled={record.isVacant}
                            onClick={() => record.isRentPaid ? handleOpenRevert(record, 'RENT') : handleOpenPayment(record, 'RENT')}
                            className={`min-w-[180px] px-8 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest border-2 transition-all duration-500 flex items-center justify-center gap-3 mx-auto shadow-sm active:scale-95 ${record.isRentPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 hover:shadow-rose-100 group/rev' : record.statusBadge === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 hover:shadow-amber-100'}`}
                          >
                             {record.isRentPaid ? (
                               <>
                                 <span className="flex items-center gap-2 group-hover/rev:hidden animate-in fade-in duration-300"><CheckCircle2 className="w-5 h-5" /> Settled</span>
                                 <span className="hidden items-center gap-2 group-hover/rev:flex animate-in slide-in-from-bottom-2 duration-300"><RotateCcw className="w-5 h-5" /> Revert</span>
                               </>
                             ) : (
                               <>
                                 {record.statusBadge === 'OVERDUE' ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                 {record.isVacant ? 'N/A' : 'Collect Rent'}
                               </>
                             )}
                          </button>
                       </td>

                       <td className="px-14 py-12 text-center">
                          <button 
                            disabled={record.isVacant}
                            onClick={() => record.isDepositPaid ? handleOpenRevert(record, 'DEPOSIT') : handleOpenPayment(record, 'DEPOSIT')}
                            className={`min-w-[180px] px-8 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest border-2 transition-all duration-500 flex items-center justify-center gap-3 mx-auto shadow-sm active:scale-95 ${record.isDepositPaid ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 hover:shadow-rose-100 group/rev-dep' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100 hover:text-slate-600'}`}
                          >
                             {record.isDepositPaid ? (
                               <>
                                 <span className="flex items-center gap-2 group-hover/rev-dep:hidden animate-in fade-in duration-300"><ShieldCheck className="w-5 h-5" /> Verified</span>
                                 <span className="hidden items-center gap-2 group-hover/rev-dep:flex animate-in slide-in-from-bottom-2 duration-300"><RotateCcw className="w-5 h-5" /> Revert</span>
                               </>
                             ) : (
                               <>
                                 <Landmark className="w-5 h-5" />
                                 {record.isVacant ? 'N/A' : 'Security Fund'}
                               </>
                             )}
                          </button>
                       </td>

                       <td className="px-14 py-12 text-right">
                          <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 translate-x-6 group-hover:translate-x-0 transition-all duration-700">
                             <button onClick={() => setHistoryModal({ isOpen: true, record })} className="p-5 bg-white border border-slate-200 text-slate-400 rounded-3xl hover:text-indigo-600 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-50 transition-all active:scale-90" title="Full Financial Audit"><History className="w-6 h-6" /></button>
                             <button onClick={() => setTemporalAction({isOpen: true, type: 'TENANT', record, formValues: record.rawValuesMap, effectiveDate: new Date().toISOString().split('T')[0]})} className="p-5 bg-white border border-slate-200 text-slate-400 rounded-3xl hover:text-emerald-600 hover:border-emerald-100 hover:shadow-2xl hover:shadow-emerald-50 transition-all active:scale-90" title="Lease Transition"><UserPlus className="w-6 h-6" /></button>
                             <button onClick={() => setTemporalAction({isOpen: true, type: 'STATUS', record, formValues: record.rawValuesMap, effectiveDate: new Date().toISOString().split('T')[0]})} className="p-5 bg-white border border-slate-200 text-slate-400 rounded-3xl hover:text-rose-600 hover:border-rose-100 hover:shadow-2xl hover:shadow-rose-50 transition-all active:scale-90" title="Terminate Residency"><Activity className="w-6 h-6" /></button>
                          </div>
                       </td>
                    </tr>
                  ))}
                  {recordsWithRent.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-48 text-center opacity-20">
                        <Layers className="w-24 h-24 mx-auto mb-8 text-slate-200" />
                        <h3 className="text-3xl font-black uppercase tracking-tighter">No Active Assets</h3>
                        <p className="text-[12px] font-black uppercase tracking-[0.4em] mt-3">Reset filters or initialize property data</p>
                      </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* REVERT DIALOG */}
      {revertModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-700">
           <div className="bg-white w-full max-w-lg rounded-[5rem] shadow-[0_50px_150px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500">
              <div className="p-16 bg-rose-600 text-white text-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full -mr-32 -mt-32"></div>
                 <div className="w-32 h-32 bg-white/20 rounded-[3rem] flex items-center justify-center mx-auto mb-10 backdrop-blur-3xl shadow-2xl border border-white/20">
                    <RotateCcw className="w-16 h-16 animate-in spin-in-180 duration-1000" />
                 </div>
                 <h3 className="text-4xl font-black uppercase tracking-tighter mb-4">Undo Settlement?</h3>
                 <p className="text-rose-100 font-medium text-lg leading-relaxed max-w-[320px] mx-auto opacity-90">
                   This will reset the transaction status for <strong>{revertModal.record.tenantName}</strong> and mark the unit as <span className="font-black text-white underline underline-offset-4 decoration-2">Awaiting Payment</span>.
                 </p>
              </div>
              <div className="p-12 flex gap-6 bg-slate-50">
                 <button onClick={() => setRevertModal({...revertModal, isOpen: false})} className="flex-1 py-6 bg-white border-2 border-slate-100 text-slate-500 rounded-[2.5rem] font-black uppercase text-[11px] tracking-widest hover:bg-slate-100 transition-all">Keep Paid</button>
                 <button onClick={handleConfirmRevert} className="flex-1 py-6 bg-rose-600 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95">Yes, Revert</button>
              </div>
           </div>
        </div>
      )}

      {/* SETTLEMENT MODAL */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-700">
           <div className="bg-white w-full max-w-xl rounded-[5rem] shadow-[0_50px_150px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500">
              <div className={`p-14 text-white flex justify-between items-center relative overflow-hidden ${paymentModal.type === 'RENT' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                 <div className="flex items-center gap-8 relative z-10">
                    <div className="p-6 bg-white/20 rounded-[2.5rem] backdrop-blur-3xl border border-white/10 shadow-2xl">
                       {paymentModal.type === 'RENT' ? <Wallet className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
                    </div>
                    <div>
                       <h3 className="text-4xl font-black uppercase tracking-tighter leading-none mb-3">Settle {paymentModal.type}</h3>
                       <p className="text-[12px] font-black text-white/50 uppercase tracking-[0.3em]">Transaction with {paymentModal.record.tenantName}</p>
                    </div>
                 </div>
                 <button onClick={() => setPaymentModal({...paymentModal, isOpen: false})} className="p-4 hover:bg-white/10 rounded-full transition-colors relative z-10 text-white/50 hover:text-white"><X className="w-10 h-10" /></button>
              </div>

              <div className="p-16 space-y-12">
                 <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                       <DollarSign className="w-4 h-4" /> Settlement Value
                    </label>
                    <div className="relative">
                       <DollarSign className="absolute left-10 top-1/2 -translate-y-1/2 w-8 h-8 text-slate-300" />
                       <input 
                         type="number" 
                         className="w-full bg-slate-50 border-4 border-slate-100 rounded-[3.5rem] pl-20 pr-12 py-8 text-4xl font-black outline-none focus:bg-white focus:border-indigo-600 transition-all shadow-inner text-slate-950" 
                         value={paymentModal.amount}
                         onChange={e => setPaymentModal({...paymentModal, amount: parseFloat(e.target.value) || 0})}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Channel</label>
                       <div className="relative">
                          <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-10 py-6 text-[12px] font-black uppercase outline-none focus:bg-white focus:border-indigo-600 transition-all cursor-pointer appearance-none" value={paymentModal.mode} onChange={e => setPaymentModal({...paymentModal, mode: e.target.value})}>
                             {store.config.paymentModeOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <ChevronDown className="absolute right-8 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                       </div>
                    </div>
                    <div className="space-y-4">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Ledger Target</label>
                       <div className="relative">
                          <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-10 py-6 text-[12px] font-black uppercase outline-none focus:bg-white focus:border-indigo-600 transition-all cursor-pointer appearance-none" value={paymentModal.paidTo} onChange={e => setPaymentModal({...paymentModal, paidTo: e.target.value})}>
                             {store.config.paidToOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <ChevronDown className="absolute right-8 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Value Date</label>
                    <div className="relative group">
                       <CalendarDays className="absolute left-10 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                       <input 
                         type="date" 
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] pl-20 pr-10 py-7 text-sm font-black outline-none focus:bg-white focus:border-indigo-600 transition-all" 
                         value={paymentModal.date} 
                         onChange={e => setPaymentModal({...paymentModal, date: e.target.value})} 
                       />
                    </div>
                 </div>

                 <button onClick={handleCollect} className={`w-full py-8 text-white rounded-[3rem] font-black uppercase text-sm tracking-[0.3em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-5 ${paymentModal.type === 'RENT' ? 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700' : 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700'}`}>
                    <CheckCircle2 className="w-8 h-8" /> Finalize Transaction
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* HISTORY AUDIT PANEL */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-end p-8 bg-slate-950/90 backdrop-blur-3xl animate-in fade-in duration-700">
           <div className="bg-white w-full max-w-3xl h-full max-h-[96vh] rounded-[5rem] shadow-[0_50px_150px_rgba(0,0,0,0.5)] overflow-hidden animate-in slide-in-from-right-20 duration-1000 flex flex-col border border-white/20">
              <div className="p-16 bg-slate-900 text-white flex justify-between items-center shrink-0 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full -mr-40 -mt-40"></div>
                 <div className="flex items-center gap-10 relative z-10">
                    <div className="p-6 bg-white/10 rounded-[3rem] backdrop-blur-3xl border border-white/5 shadow-2xl">
                       <History className="w-12 h-12 text-indigo-400" />
                    </div>
                    <div>
                       <h3 className="text-5xl font-black uppercase tracking-tighter">Treasury Log</h3>
                       <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3">Full Audit History for {historyModal.record?.tenantName}</p>
                    </div>
                 </div>
                 <button onClick={() => setHistoryModal({ isOpen: false, record: null })} className="p-5 hover:bg-white/10 rounded-full transition-colors relative z-10 text-slate-500 hover:text-white"><X className="w-12 h-12" /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-16 space-y-16 bg-slate-50/50">
                 {unitPayments.length > 0 ? (
                    <div className="relative">
                       <div className="absolute left-[44px] top-0 bottom-0 w-2 bg-slate-100 rounded-full"></div>
                       <div className="space-y-14">
                          {unitPayments.map((payment: any) => (
                             <div key={payment.id} className="relative pl-32 group">
                                <div className={`absolute left-[33px] top-2 w-8 h-8 rounded-full border-[8px] border-white shadow-2xl z-10 transition-transform group-hover:scale-150 duration-500 ${payment.type === 'RENT' ? 'bg-indigo-600' : 'bg-emerald-600'}`}></div>
                                <div className="p-10 bg-white border border-slate-100 rounded-[4rem] group-hover:shadow-[0_20px_80px_rgba(0,0,0,0.06)] group-hover:border-indigo-200 transition-all duration-700 hover:-translate-x-2">
                                   <div className="flex items-center justify-between mb-8">
                                      <div className="flex items-center gap-6">
                                         <span className={`text-[11px] font-black uppercase tracking-widest px-6 py-2 rounded-2xl ${payment.type === 'RENT' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-emerald-600 text-white shadow-xl shadow-emerald-100'}`}>
                                            {payment.type}
                                         </span>
                                         {payment.month !== 'ONE_TIME' && (
                                            <div className="flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                               <Calendar className="w-4 h-4" /> {payment.month} Settlement
                                            </div>
                                         )}
                                      </div>
                                      <p className="text-3xl font-black text-slate-950 tracking-tighter leading-none">${payment.amount.toLocaleString()}</p>
                                   </div>

                                   <div className="grid grid-cols-2 gap-10 border-t border-slate-50 pt-10 mt-2">
                                      <div className="space-y-2">
                                         <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Value Date</p>
                                         <p className="text-sm font-black text-slate-700">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString(undefined, { dateStyle: 'full' }) : 'Pending Review'}</p>
                                      </div>
                                      <div className="space-y-2">
                                         <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Audit Mode</p>
                                         <p className="text-sm font-black text-slate-700">{payment.paymentMode || 'Direct Entry'}</p>
                                      </div>
                                      <div className="space-y-2">
                                         <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Destination</p>
                                         <p className="text-sm font-black text-slate-700">{payment.paidTo || 'Treasury Default'}</p>
                                      </div>
                                      <div className="space-y-2">
                                         <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Verification</p>
                                         <div className="flex items-center gap-3 text-emerald-600 font-black text-[11px] uppercase tracking-widest">
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div> Integrity Checked
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center py-48 text-center animate-in zoom-in-95 duration-700">
                       <div className="w-40 h-40 bg-white rounded-[4rem] shadow-inner flex items-center justify-center mb-12">
                          <History className="w-16 h-16 text-slate-100" />
                       </div>
                       <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-950 mb-4">Empty Statement</h3>
                       <p className="text-lg font-medium text-slate-400 max-w-sm mx-auto leading-relaxed uppercase tracking-tight">
                         No verifiable financial transactions found for this asset in the current cluster history.
                       </p>
                    </div>
                 )}
              </div>

              <div className="p-16 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 shadow-[0_-20px_80px_rgba(0,0,0,0.02)]">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center">
                       <Info className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">System-generated <br /> financial audit trail</p>
                 </div>
                 <button onClick={() => setHistoryModal({ isOpen: false, record: null })} className="px-16 py-6 bg-slate-950 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl active:scale-95 transition-all hover:bg-slate-800">Close Statement</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RentCollection;
