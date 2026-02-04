
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
  Briefcase
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
      {/* PREMIUM HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                <Zap className="w-3 h-3" /> Live Transaction Engine
             </div>
          </div>
          <h1 className="text-5xl lg:text-7xl font-black text-slate-900 uppercase tracking-tighter leading-[0.9] transform-gpu">
            Collection <br /> Desk
          </h1>
          <p className="text-slate-500 font-medium text-lg max-w-lg">
            Manage settlements, track security deposits, and oversee occupancy timelines with atomic precision.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white/50 backdrop-blur-xl p-4 rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40">
          <button onClick={jumpToToday} className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95">Today</button>
          
          <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
             <button onClick={() => navigateMonth(-1)} className="p-3 hover:bg-white hover:text-indigo-600 rounded-xl transition-all shadow-sm">
                <ChevronLeft className="w-5 h-5" />
             </button>
             <div className="px-6 py-1 flex flex-col items-center min-w-[140px]">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-0.5">{yearName}</span>
                <span className="text-lg font-black text-slate-900 uppercase tracking-tight">
                   {monthYearName}
                </span>
             </div>
             <button onClick={() => navigateMonth(1)} className="p-3 hover:bg-white hover:text-indigo-600 rounded-xl transition-all shadow-sm">
                <ChevronRight className="w-5 h-5" />
             </button>
          </div>

          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all min-w-[280px] shadow-sm"
              placeholder="Search resident or property..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* FINTECH STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Settled Revenue', value: ledgerStats.collected, icon: Wallet, color: 'emerald', sub: `${monthYearName} Collection` },
          { label: 'Outstanding Balance', value: ledgerStats.pending, icon: ArrowUpRight, color: 'rose', sub: 'Pending Action' },
          { label: 'Security Assets', value: ledgerStats.heldDeposits, icon: ShieldCheck, color: 'indigo', sub: 'Total Funds Held' }
        ].map((stat, i) => (
          <div key={i} className="group relative bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500 overflow-hidden">
             <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-50 rounded-bl-[100px] -mr-8 -mt-8 opacity-40 transition-transform group-hover:scale-110`}></div>
             <div className="flex items-center gap-6 relative z-10">
                <div className={`w-20 h-20 bg-${stat.color}-50 text-${stat.color}-600 rounded-[2rem] flex items-center justify-center shadow-inner group-hover:rotate-6 transition-transform`}>
                   <stat.icon className="w-9 h-9" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                   <h3 className="text-4xl font-black text-slate-950 tracking-tighter">${stat.value.toLocaleString()}</h3>
                   <div className="flex items-center gap-2 mt-2">
                      <div className={`w-1.5 h-1.5 rounded-full bg-${stat.color}-500 animate-pulse`}></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.sub}</span>
                   </div>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* LEDGER WORKSPACE */}
      <div className="bg-white rounded-[4rem] border border-slate-100 shadow-[0_20px_80px_rgba(0,0,0,0.04)] overflow-hidden">
         <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                  <Landmark className="w-5 h-5" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Financial Ledger</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{recordsWithRent.length} Units Found</p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    className="text-[10px] font-black uppercase text-slate-600 outline-none bg-transparent cursor-pointer"
                    value={selectedPropertyId}
                    onChange={e => setSelectedPropertyId(e.target.value)}
                  >
                    <option value="all">All Properties</option>
                    {visibleProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
               </div>
            </div>
         </div>

         <div className="overflow-x-auto max-h-[800px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
               <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-md">
                  <tr className="border-b border-slate-100">
                     <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Resident & Asset</th>
                     <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Payment Loop</th>
                     <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Security Asset</th>
                     <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Operations</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {recordsWithRent.map((record) => (
                    <tr key={record.id} className={`group hover:bg-indigo-50/30 transition-all duration-300 ${record.isVacant ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                       <td className="px-12 py-10">
                          <div className="flex items-center gap-6">
                             <div className="relative">
                                <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-md border border-slate-100 flex items-center justify-center text-slate-300 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                   <Building2 className="w-7 h-7" />
                                </div>
                                {!record.isVacant && (
                                   <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full shadow-lg"></div>
                                )}
                             </div>
                             <div>
                                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5 group-hover:text-indigo-600 transition-colors">{record.property?.name}</h4>
                                <div className="flex items-center gap-3">
                                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{record.tenantName}</span>
                                   <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{record.isVacant ? 'VACANT' : 'OCCUPIED'}</span>
                                </div>
                             </div>
                          </div>
                       </td>
                       
                       <td className="px-12 py-10 text-center">
                          <button 
                            disabled={record.isVacant}
                            onClick={() => record.isRentPaid ? handleOpenRevert(record, 'RENT') : handleOpenPayment(record, 'RENT')}
                            className={`min-w-[160px] px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all duration-300 flex items-center justify-center gap-3 mx-auto shadow-sm active:scale-95 ${record.isRentPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 hover:shadow-rose-100 group/rev' : record.statusBadge === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 hover:shadow-amber-100'}`}
                          >
                             {record.isRentPaid ? (
                               <>
                                 <span className="flex items-center gap-2 group-hover/rev:hidden animate-in fade-in"><Check className="w-4 h-4" /> Paid</span>
                                 <span className="hidden items-center gap-2 group-hover/rev:flex animate-in slide-in-from-bottom-2"><RotateCcw className="w-4 h-4" /> Revert</span>
                               </>
                             ) : (
                               <>
                                 {record.statusBadge === 'OVERDUE' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                 {record.isVacant ? 'Vacant' : 'Collect Rent'}
                               </>
                             )}
                          </button>
                       </td>

                       <td className="px-12 py-10 text-center">
                          <button 
                            disabled={record.isVacant}
                            onClick={() => record.isDepositPaid ? handleOpenRevert(record, 'DEPOSIT') : handleOpenPayment(record, 'DEPOSIT')}
                            className={`min-w-[160px] px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all duration-300 flex items-center justify-center gap-3 mx-auto shadow-sm active:scale-95 ${record.isDepositPaid ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 hover:shadow-rose-100 group/rev-dep' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100 hover:text-slate-600'}`}
                          >
                             {record.isDepositPaid ? (
                               <>
                                 <span className="flex items-center gap-2 group-hover/rev-dep:hidden animate-in fade-in"><ShieldCheck className="w-4 h-4" /> Held</span>
                                 <span className="hidden items-center gap-2 group-hover/rev-dep:flex animate-in slide-in-from-bottom-2"><RotateCcw className="w-4 h-4" /> Revert</span>
                               </>
                             ) : (
                               <>
                                 <Landmark className="w-4 h-4" />
                                 {record.isVacant ? 'N/A' : 'Collect Dep.'}
                               </>
                             )}
                          </button>
                       </td>

                       <td className="px-12 py-10 text-right">
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                             <button onClick={() => setHistoryModal({ isOpen: true, record })} className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-indigo-600 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all active:scale-90" title="Audit Log"><History className="w-5 h-5" /></button>
                             <button onClick={() => setTemporalAction({isOpen: true, type: 'TENANT', record, formValues: record.rawValuesMap, effectiveDate: new Date().toISOString().split('T')[0]})} className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-emerald-600 hover:border-emerald-100 hover:shadow-xl hover:shadow-emerald-50 transition-all active:scale-90" title="Move-In / Update"><UserPlus className="w-5 h-5" /></button>
                             <button onClick={() => setTemporalAction({isOpen: true, type: 'STATUS', record, formValues: record.rawValuesMap, effectiveDate: new Date().toISOString().split('T')[0]})} className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-rose-600 hover:border-rose-100 hover:shadow-xl hover:shadow-rose-50 transition-all active:scale-90" title="Move-Out"><Activity className="w-5 h-5" /></button>
                          </div>
                       </td>
                    </tr>
                  ))}
                  {recordsWithRent.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-40 text-center opacity-30">
                        <Briefcase className="w-20 h-20 mx-auto mb-6 text-slate-200" />
                        <h3 className="text-2xl font-black uppercase tracking-tighter">No Units Discovered</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2">Adjust your filters or asset search</p>
                      </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* REVERT DIALOG */}
      {revertModal.isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500">
           <div className="bg-white w-full max-w-md rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-12 bg-rose-600 text-white text-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[40px] rounded-full -mr-16 -mt-16"></div>
                 <div className="w-24 h-24 bg-white/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 backdrop-blur-md shadow-2xl group border border-white/10">
                    <RotateCcw className="w-12 h-12 animate-in spin-in-180" />
                 </div>
                 <h3 className="text-3xl font-black uppercase tracking-tighter mb-3">Revert Entry?</h3>
                 <p className="text-rose-100 font-medium text-sm leading-relaxed max-w-[280px] mx-auto">
                   This action will reset the settlement status for <strong>{revertModal.record.tenantName}</strong> back to pending.
                 </p>
              </div>
              <div className="p-10 flex gap-4">
                 <button onClick={() => setRevertModal({...revertModal, isOpen: false})} className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all">Cancel</button>
                 <button onClick={handleConfirmRevert} className="flex-1 py-5 bg-rose-600 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95">Yes, Revert</button>
              </div>
           </div>
        </div>
      )}

      {/* COLLECTION MODAL */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500">
           <div className="bg-white w-full max-w-lg rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className={`p-12 text-white flex justify-between items-center relative overflow-hidden ${paymentModal.type === 'RENT' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                 <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 blur-[60px] rounded-full -mr-24 -mt-24"></div>
                 <div className="flex items-center gap-6 relative z-10">
                    <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-md border border-white/10 shadow-2xl">
                       {paymentModal.type === 'RENT' ? <Wallet className="w-9 h-9" /> : <ShieldCheck className="w-9 h-9" />}
                    </div>
                    <div>
                       <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">Collect {paymentModal.type}</h3>
                       <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Settlement with {paymentModal.record.tenantName}</p>
                    </div>
                 </div>
                 <button onClick={() => setPaymentModal({...paymentModal, isOpen: false})} className="p-3 hover:bg-white/10 rounded-full transition-colors relative z-10"><X className="w-8 h-8" /></button>
              </div>

              <div className="p-12 space-y-10">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><DollarSign className="w-3 h-3" /> Exact Amount Received</label>
                    <div className="relative">
                       <DollarSign className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" />
                       <input 
                         type="number" 
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] pl-16 pr-10 py-6 text-3xl font-black outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-slate-900" 
                         value={paymentModal.amount}
                         onChange={e => setPaymentModal({...paymentModal, amount: parseFloat(e.target.value) || 0})}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Method</label>
                       <div className="relative">
                          <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-8 py-5 text-[11px] font-black uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all cursor-pointer appearance-none" value={paymentModal.mode} onChange={e => setPaymentModal({...paymentModal, mode: e.target.value})}>
                             {store.config.paymentModeOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                       </div>
                    </div>
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination Account</label>
                       <div className="relative">
                          <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-8 py-5 text-[11px] font-black uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all cursor-pointer appearance-none" value={paymentModal.paidTo} onChange={e => setPaymentModal({...paymentModal, paidTo: e.target.value})}>
                             {store.config.paidToOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Received Date</label>
                    <div className="relative">
                       <input 
                         type="date" 
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-8 py-5 text-sm font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" 
                         value={paymentModal.date} 
                         onChange={e => setPaymentModal({...paymentModal, date: e.target.value})} 
                       />
                    </div>
                 </div>

                 <button onClick={handleCollect} className={`w-full py-7 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 ${paymentModal.type === 'RENT' ? 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700' : 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700'}`}>
                    <CheckCircle2 className="w-7 h-7" /> Confirm Settlement
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* HISTORY DRAWER */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-end p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500">
           <div className="bg-white w-full max-w-2xl h-full max-h-[96vh] rounded-[4rem] shadow-2xl overflow-hidden animate-in slide-in-from-right-12 duration-700 flex flex-col border border-white/20">
              <div className="p-14 bg-slate-900 text-white flex justify-between items-center shrink-0 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full -mr-32 -mt-32"></div>
                 <div className="flex items-center gap-8 relative z-10">
                    <div className="p-5 bg-white/10 rounded-[2.5rem] backdrop-blur-md border border-white/5 shadow-2xl">
                       <History className="w-10 h-10 text-indigo-400" />
                    </div>
                    <div>
                       <h3 className="text-4xl font-black uppercase tracking-tighter">Transaction Log</h3>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Audit History for {historyModal.record?.tenantName}</p>
                    </div>
                 </div>
                 <button onClick={() => setHistoryModal({ isOpen: false, record: null })} className="p-4 hover:bg-white/10 rounded-full transition-colors relative z-10 text-slate-400"><X className="w-10 h-10" /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-14 space-y-12 bg-slate-50/30">
                 {unitPayments.length > 0 ? (
                    <div className="relative">
                       <div className="absolute left-[34px] top-0 bottom-0 w-1.5 bg-slate-100 rounded-full"></div>
                       <div className="space-y-10">
                          {unitPayments.map((payment: any) => (
                             <div key={payment.id} className="relative pl-24 group">
                                <div className={`absolute left-[24px] top-1 w-6 h-6 rounded-full border-[6px] border-white shadow-xl z-10 transition-transform group-hover:scale-125 ${payment.type === 'RENT' ? 'bg-indigo-600' : 'bg-emerald-600'}`}></div>
                                <div className="p-8 bg-white border border-slate-100 rounded-[3rem] group-hover:shadow-2xl group-hover:border-indigo-100 transition-all duration-500 hover:translate-x-2">
                                   <div className="flex items-center justify-between mb-6">
                                      <div className="flex items-center gap-4">
                                         <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl ${payment.type === 'RENT' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'}`}>
                                            {payment.type}
                                         </span>
                                         {payment.month !== 'ONE_TIME' && (
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                               <Calendar className="w-3 h-3" /> {payment.month}
                                            </div>
                                         )}
                                      </div>
                                      <p className="text-2xl font-black text-slate-900 tracking-tighter">${payment.amount.toLocaleString()}</p>
                                   </div>

                                   <div className="grid grid-cols-2 gap-8 border-t border-slate-50 pt-6 mt-6">
                                      <div className="space-y-1">
                                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Received On</p>
                                         <p className="text-xs font-black text-slate-700">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Pending'}</p>
                                      </div>
                                      <div className="space-y-1">
                                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Payment Loop</p>
                                         <p className="text-xs font-black text-slate-700">{payment.paymentMode || 'Direct Cash'}</p>
                                      </div>
                                      <div className="space-y-1">
                                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Target Account</p>
                                         <p className="text-xs font-black text-slate-700">{payment.paidTo || 'Default Ledger'}</p>
                                      </div>
                                      <div className="space-y-1">
                                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Audit Status</p>
                                         <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Verified
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center py-40 text-center animate-in zoom-in-95">
                       <div className="w-32 h-32 bg-white rounded-[3rem] shadow-inner flex items-center justify-center mb-10">
                          <History className="w-12 h-12 text-slate-200" />
                       </div>
                       <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-3">Void Ledger</h3>
                       <p className="text-sm font-medium text-slate-400 max-w-[280px] mx-auto leading-relaxed uppercase tracking-tighter">
                         No financial transactions recorded for this asset in the current history cluster.
                       </p>
                    </div>
                 )}
              </div>

              <div className="p-14 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                       <Info className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">End of verifiable <br /> transaction stream</p>
                 </div>
                 <button onClick={() => setHistoryModal({ isOpen: false, record: null })} className="px-12 py-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-slate-800">Close Timeline</button>
              </div>
           </div>
        </div>
      )}

      {/* TEMPORAL ACTIONS (MOVE-IN/OUT) */}
      {temporalAction.isOpen && temporalAction.record && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
           <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className={`p-14 text-white flex justify-between items-center relative overflow-hidden ${temporalAction.type === 'STATUS' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                 <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 blur-[60px] rounded-full -mr-24 -mt-24"></div>
                 <div className="flex items-center gap-8 relative z-10">
                    <div className="p-5 bg-white/20 rounded-[2.5rem] backdrop-blur-md border border-white/10 shadow-2xl">
                       {temporalAction.type === 'STATUS' ? <Activity className="w-10 h-10" /> : <UserPlus className="w-10 h-10" />}
                    </div>
                    <div>
                       <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">{temporalAction.type === 'STATUS' ? 'Close Residency' : 'Residency Update'}</h3>
                       <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">{temporalAction.record.property?.name}</p>
                    </div>
                 </div>
                 <button onClick={() => setTemporalAction({...temporalAction, isOpen: false})} className="p-3 hover:bg-white/10 rounded-full transition-colors relative z-10"><X className="w-10 h-10" /></button>
              </div>
              
              <div className="p-14 space-y-10">
                 <div className="p-10 bg-slate-50 border-2 border-slate-100 rounded-[3rem] space-y-4 shadow-inner">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                       <Calendar className="w-4 h-4" /> Timeline Effective Date
                    </label>
                    <input type="date" className="w-full bg-white border-2 border-slate-200 rounded-[2rem] px-8 py-6 text-sm font-black outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-sm" value={temporalAction.effectiveDate} onChange={e => setTemporalAction({...temporalAction, effectiveDate: e.target.value})} />
                 </div>

                 {temporalAction.type === 'STATUS' ? (
                   <div className="p-8 bg-rose-50 text-rose-700 rounded-[3rem] flex items-start gap-6 border-2 border-rose-100 animate-in slide-in-from-bottom-4">
                      <AlertCircle className="w-8 h-8 shrink-0 mt-1" />
                      <div>
                         <h4 className="font-black uppercase text-xs tracking-widest mb-1">Move-Out Warning</h4>
                         <p className="text-xs font-bold leading-relaxed opacity-80 uppercase tracking-tight">Terminating this residency will archive all current resident data and reset the unit to VACANT status in the core timeline.</p>
                      </div>
                   </div>
                 ) : (
                   <div className="p-8 bg-emerald-50 text-emerald-700 rounded-[3rem] flex items-start gap-6 border-2 border-emerald-100 animate-in slide-in-from-bottom-4">
                      <CheckCircle2 className="w-8 h-8 shrink-0 mt-1" />
                      <div>
                         <h4 className="font-black uppercase text-xs tracking-widest mb-1">Timeline Branch</h4>
                         <p className="text-xs font-bold leading-relaxed opacity-80 uppercase tracking-tight">This operation will fork the unit history, creating a new temporal entry for the updated resident profile.</p>
                      </div>
                   </div>
                 )}

                 <div className="flex gap-6">
                    <button onClick={() => setTemporalAction({...temporalAction, isOpen: false})} className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase text-[11px] tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                    <button onClick={confirmTemporalAction} className={`flex-1 py-6 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all active:scale-95 ${temporalAction.type === 'STATUS' ? 'bg-rose-600 shadow-rose-200 hover:bg-rose-700' : 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700'}`}>Confirm State Change</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RentCollection;
