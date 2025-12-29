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
  History,
  CalendarDays,
  TrendingUp,
  ChevronDown,
  Settings,
  Trash2,
  Wallet,
  ArrowRight,
  User,
  PlusCircle,
  CreditCard,
  Landmark,
  Undo2,
  Phone,
  Calendar,
  UserPlus,
  Activity,
  Save,
  AlertCircle
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { PaymentStatus, UserRole, ColumnType, Payment, UnitHistory, ColumnDefinition } from '../types';

type FilterType = 'monthly' | 'annual' | 'custom';
type TemporalActionType = 'STATUS' | 'TENANT';

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

  const [temporalAction, setTemporalAction] = useState<{
    isOpen: boolean;
    type: TemporalActionType;
    record: any | null;
    formValues: Record<string, string>;
    formErrors: Record<string, string>;
    effectiveDate: string;
  }>({
    isOpen: false,
    type: 'STATUS',
    record: null,
    formValues: {},
    formErrors: {},
    effectiveDate: new Date().toISOString().split('T')[0]
  });

  const [showSettings, setShowSettings] = useState(false);
  const [newPaidTo, setNewPaidTo] = useState('');
  const [newPaymentMode, setNewPaymentMode] = useState('');

  const addPaidToOption = () => {
    if (!newPaidTo.trim()) return;
    if (store.config.paidToOptions.includes(newPaidTo.trim())) return;
    store.updateConfig({ paidToOptions: [...store.config.paidToOptions, newPaidTo.trim()] });
    setNewPaidTo('');
  };

  const removePaidToOption = (opt: string) => {
    store.updateConfig({ paidToOptions: store.config.paidToOptions.filter((o: string) => o !== opt) });
  };

  const addPaymentModeOption = () => {
    if (!newPaymentMode.trim()) return;
    if (store.config.paymentModeOptions.includes(newPaymentMode.trim())) return;
    store.updateConfig({ paymentModeOptions: [...store.config.paymentModeOptions, newPaymentMode.trim()] });
    setNewPaymentMode('');
  };

  const removePaymentModeOption = (opt: string) => {
    store.updateConfig({ paymentModeOptions: store.config.paymentModeOptions.filter((o: string) => o !== opt) });
  };
  
  const [historyRecord, setHistoryRecord] = useState<any | null>(null);

  const visibleProperties = useMemo(() => {
    if (!isManager) return store.properties;
    return store.properties.filter((p: any) => p.isVisibleToManager !== false);
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

  const isPaidInScope = (recordId: string, type: 'RENT' | 'DEPOSIT') => {
    const paymentsInScope = store.payments.filter((p: Payment) => 
      p.recordId === recordId && 
      p.type === type && 
      (p.status === PaymentStatus.PAID || p.status === PaymentStatus.VACANT)
    );
    
    if (filterType === 'monthly') {
      return paymentsInScope.some(p => p.month === selectedMonth);
    } else if (filterType === 'annual') {
      return paymentsInScope.some(p => p.month.startsWith(selectedYear) || (p.type === 'DEPOSIT' && p.paidAt?.startsWith(selectedYear)));
    } else {
      const start = new Date(startDate); start.setHours(0,0,0,0);
      const end = new Date(endDate); end.setHours(23,59,59,999);
      return paymentsInScope.some(p => {
        if (!p.paidAt) return false;
        const pd = new Date(p.paidAt);
        return pd >= start && pd <= end;
      });
    }
  };

  const getMonthlyPayment = (recordId: string, month: string) => {
    return store.payments.find(p => p.recordId === recordId && p.month === month && p.type === 'RENT');
  };

  const recordsWithRent = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let contextDate: Date;
    if (filterType === 'monthly') {
      const [y, m] = selectedMonth.split('-').map(Number);
      contextDate = new Date(y, m, 0, 23, 59, 59);
    } else if (filterType === 'annual') {
      contextDate = new Date(parseInt(selectedYear), 11, 31, 23, 59, 59);
    } else {
      contextDate = new Date(endDate);
      contextDate.setHours(23, 59, 59);
    }

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
        
        const rentColId = propertyType?.columns.find(c => c.name.toLowerCase() === 'monthly rent')?.id;
        const depositColId = propertyType?.columns.find(c => c.type === ColumnType.SECURITY_DEPOSIT)?.id;
        const occupancyColId = propertyType?.columns.find(c => c.type === ColumnType.OCCUPANCY_STATUS)?.id;

        const rentValue = activeValues[rentColId || ''] || '0';
        const depositValue = activeValues[depositColId || ''] || '0';
        const occupancyValue = activeValues[occupancyColId || ''] || 'Active';
        
        const isGloballyVacant = occupancyValue.toLowerCase().includes('vacant');
        const monthlyPayment = getMonthlyPayment(record.id, selectedMonth);
        const isMonthVacant = monthlyPayment?.status === PaymentStatus.VACANT;

        const dueDay = propertyType?.defaultDueDateDay || 5;
        const isRentPaid = isPaidInScope(record.id, 'RENT');
        
        // Find if deposit is paid for the current TENANCY (within historical period)
        const depositPayment = store.payments.find(p => p.recordId === record.id && p.type === 'DEPOSIT' && p.status === PaymentStatus.PAID);
        const isDepositPaid = !!depositPayment;
        const isDepositRefunded = depositPayment?.isRefunded || false;

        let statusBadge: 'PAID' | 'PENDING' | 'OVERDUE' | 'VACANT' = 'PENDING';
        if (isMonthVacant || isGloballyVacant) {
          statusBadge = 'VACANT';
        } else if (filterType === 'monthly') {
          const [year, month] = selectedMonth.split('-').map(Number);
          const deadline = new Date(year, month - 1, dueDay, 23, 59, 59);
          if (isRentPaid) statusBadge = 'PAID';
          else if (today > deadline) statusBadge = 'OVERDUE';
        } else {
          statusBadge = isRentPaid ? 'PAID' : 'PENDING';
        }

        return {
          ...record, 
          property, 
          propertyType,
          rentAmount: parseFloat(rentValue),
          depositAmount: parseFloat(depositValue),
          isRentPaid, 
          isDepositPaid,
          isDepositRefunded,
          hasDepositOwed: parseFloat(depositValue) > 0,
          isVacant: statusBadge === 'VACANT',
          dueDay,
          statusBadge,
          rawValuesMap: activeValues,
          assignmentHistory: store.unitHistory.filter((h: any) => h.recordId === record.id).sort((a: any, b: any) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()),
          paymentHistory: store.payments.filter(p => p.recordId === record.id)
        };
      }).filter((r: any) => {
        const matchesProperty = selectedPropertyId === 'all' || r.propertyId === selectedPropertyId;
        const matchesSearch = searchTerm === '' || Object.values(r.rawValuesMap).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())) || r.property?.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch && matchesProperty;
      });
  }, [store.records, store.properties, store.propertyTypes, store.recordValues, store.unitHistory, store.payments, filterType, selectedMonth, selectedYear, endDate, searchTerm, selectedPropertyId, visiblePropertyIds]);

  const ledgerColumns = useMemo(() => {
    const relevantTypes = selectedPropertyId === 'all' 
      ? store.propertyTypes.filter(pt => store.properties.some(p => p.propertyTypeId === pt.id && visiblePropertyIds.includes(p.id)))
      : store.propertyTypes.filter(pt => pt.id === store.properties.find(p => p.id === selectedPropertyId)?.propertyTypeId);

    const cols: ColumnDefinition[] = [];
    const colNames = new Set<string>();

    relevantTypes.forEach(pt => {
      pt.columns.filter(c => c.isDefaultInLedger).forEach(c => {
        if (!colNames.has(c.name)) {
          cols.push(c);
          colNames.add(c.name);
        }
      });
    });

    return cols.sort((a, b) => a.order - b.order);
  }, [selectedPropertyId, store.propertyTypes, store.properties, visiblePropertyIds]);

  const handleAction = (record: any, type: 'RENT' | 'DEPOSIT') => {
    if (record.isVacant) return;
    
    if (type === 'RENT' && record.isRentPaid && filterType === 'monthly') {
      setConfirmConfig({
        isOpen: true,
        isDanger: true,
        title: "Revert Transaction",
        message: `Reset ledger status in ${selectedMonth}?`,
        actionLabel: "Revert Status",
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
        message: `Confirm that the security deposit for the current tenancy is being returned?`,
        actionLabel: "Issue Refund",
        icon: <Undo2 className="w-10 h-10 text-amber-500" />,
        onConfirm: () => {
          store.refundDeposit(record.id);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    } else if (type === 'DEPOSIT' && record.isDepositRefunded) {
        // Prevent action on already refunded deposits
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

  const handleTemporalAction = (record: any, type: TemporalActionType) => {
    // REQ: Default Effective Event Date as rent date for onboarding
    const rentDateCol = record.propertyType.columns.find((c: any) => c.name.toLowerCase().includes('rent date'));
    const initialEffectiveDate = (type === 'TENANT' && rentDateCol && record.rawValuesMap[rentDateCol.id]) 
      ? record.rawValuesMap[rentDateCol.id] 
      : new Date().toISOString().split('T')[0];

    setTemporalAction({
      isOpen: true,
      type,
      record,
      formValues: { ...record.rawValuesMap },
      formErrors: {},
      effectiveDate: initialEffectiveDate
    });
  };

  const confirmTemporalAction = () => {
    if (!temporalAction.record) return;
    const { record, type, formValues, effectiveDate } = temporalAction;
    const errors: Record<string, string> = {};

    if (type === 'TENANT') {
      record.propertyType.columns.forEach((col: any) => {
        if (col.required && !formValues[col.id]?.trim()) {
           errors[col.id] = "Required field";
        }
      });
      if (Object.keys(errors).length > 0) {
        setTemporalAction(prev => ({ ...prev, formErrors: errors }));
        return;
      }
    }

    const updatedMap = { ...formValues };
    const statusColId = record.propertyType.columns.find((c: any) => c.type === ColumnType.OCCUPANCY_STATUS)?.id;

    if (type === 'STATUS') {
       updatedMap[statusColId] = 'Vacant';
       // Empty all fields except occupancy status when shifting to vacant
       record.propertyType.columns.forEach((col: any) => {
         if (col.type !== ColumnType.OCCUPANCY_STATUS) {
            updatedMap[col.id] = '';
         }
       });
    } else {
       updatedMap[statusColId] = 'Active';
    }

    const finalValues = Object.entries(updatedMap).map(([cid, val]) => ({
      id: 'v_' + Math.random().toString(36).substr(2, 5),
      recordId: record.id,
      columnId: cid,
      value: val as string
    }));

    store.updateRecord(record.id, finalValues, effectiveDate);
    setTemporalAction({ ...temporalAction, isOpen: false, record: null });
  };

  const renderCellContent = (record: any, col: any) => {
    const colIdForRecord = record.propertyType?.columns.find((c: any) => c.name === col.name)?.id;
    const value = record.rawValuesMap[colIdForRecord] || '';

    // STRICT REQ: Empty all dynamic columns if unit is vacant
    if (record.isVacant && col.type !== ColumnType.OCCUPANCY_STATUS) {
       return <span className="text-slate-200">-</span>;
    }

    if (col.type === ColumnType.CURRENCY || col.type === ColumnType.SECURITY_DEPOSIT) {
       return <p className="font-black text-slate-950 text-sm tracking-tight">${parseFloat(value || '0').toLocaleString()}</p>;
    }
    if (col.type === ColumnType.OCCUPANCY_STATUS) {
      return (
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-widest flex items-center gap-2 shadow-sm mx-auto w-fit ${
          record.statusBadge === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
          record.statusBadge === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse' : 
          record.statusBadge === 'VACANT' ? 'bg-slate-100 text-slate-400 border-slate-200' :
          'bg-amber-50 text-amber-700 border-amber-100'
        }`}>
          {record.statusBadge === 'PAID' ? <CheckCircle2 className="w-3.5 h-3.5" /> : record.statusBadge === 'OVERDUE' ? <AlertTriangle className="w-3.5 h-3.5" /> : record.statusBadge === 'VACANT' ? <X className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          {record.statusBadge === 'PAID' ? 'Settled' : record.statusBadge === 'OVERDUE' ? 'Overdue' : record.statusBadge === 'VACANT' ? 'Vacant' : 'Awaiting'}
        </span>
      );
    }
    if (col.name.toLowerCase().includes('number') || (col.type === ColumnType.TEXT && String(value).match(/^\+?[0-9- ]{7,}$/)) || col.type === ColumnType.NUMBER) {
       if (col.name.toLowerCase().includes('tenant number')) {
          return <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-indigo-500"><Phone className="w-3 h-3" /> {value || '-'}</div>;
       }
    }
    return <p className="font-bold text-slate-700 text-xs uppercase">{value || '-'}</p>;
  };

  const confirmCollection = () => {
    if (!collectingRecord) return;
    const { paidTo, paymentMode, amount, type, month } = collectionData;
    const { id: recordId, dueDay } = collectingRecord;
    const dueDateString = type === 'RENT' ? `${month}-${String(dueDay).padStart(2, '0')}` : 'N/A';
    store.togglePayment(recordId, month, amount, dueDateString, { paidTo, paymentMode }, type);
    setCollectingRecord(null);
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

      {temporalAction.isOpen && temporalAction.record && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                       {temporalAction.type === 'STATUS' ? <Activity className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                    </div>
                    <div>
                       <h3 className="text-2xl font-black uppercase tracking-tight">
                         {temporalAction.type === 'STATUS' ? 'Unit Vacancy Shift' : 'Onboard New Tenant'}
                       </h3>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Timeline Splitting • Historical Integrity</p>
                    </div>
                 </div>
                 <button onClick={() => setTemporalAction({...temporalAction, isOpen: false})} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              
              <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                 <div className="space-y-6">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Effective Event Date</label>
                       <div className="relative">
                          <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-indigo-900 outline-none focus:ring-4 focus:ring-indigo-500/10" value={temporalAction.effectiveDate} onChange={e => setTemporalAction({...temporalAction, effectiveDate: e.target.value})} />
                          <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                       </div>
                       <p className="text-[9px] text-slate-400 font-bold uppercase ml-1 italic">* Ledger data prior to this date remains preserved as per history.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                        {temporalAction.record.propertyType.columns.map((col: any) => {
                            if (col.type === ColumnType.OCCUPANCY_STATUS) return null;
                            const isVacancy = temporalAction.type === 'STATUS';
                            return (
                            <div key={col.id} className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{col.name} {col.required && !isVacancy && <span className="text-rose-500">*</span>}</label>
                                <input 
                                    className={`w-full bg-slate-50 border ${temporalAction.formErrors[col.id] ? 'border-red-500' : 'border-slate-200'} rounded-2xl px-5 py-4 text-sm font-bold outline-none ${isVacancy ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                    placeholder={isVacancy ? 'Wipe Field' : `Enter ${col.name.toLowerCase()}...`}
                                    type={col.type === ColumnType.CURRENCY || col.type === ColumnType.SECURITY_DEPOSIT || col.type === ColumnType.NUMBER ? 'number' : col.type === ColumnType.DATE ? 'date' : 'text'}
                                    disabled={isVacancy}
                                    value={isVacancy ? '' : (temporalAction.formValues[col.id] || '')}
                                    onChange={e => {
                                        const newVal = e.target.value;
                                        setTemporalAction(prev => {
                                            const updatedValues = { ...prev.formValues, [col.id]: newVal };
                                            // Special Logic: If user updates Rent Date, sync the Effective Event Date by default
                                            let updatedEffDate = prev.effectiveDate;
                                            if (col.name.toLowerCase().includes('rent date') && prev.type === 'TENANT') {
                                                updatedEffDate = newVal;
                                            }
                                            return {
                                                ...prev,
                                                formValues: updatedValues,
                                                effectiveDate: updatedEffDate,
                                                formErrors: { ...prev.formErrors, [col.id]: '' }
                                            };
                                        });
                                    }}
                                />
                                {temporalAction.formErrors[col.id] && <p className="text-[9px] text-rose-500 font-black uppercase mt-1 ml-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {temporalAction.formErrors[col.id]}</p>}
                            </div>
                            );
                        })}
                    </div>
                 </div>

                 {temporalAction.type === 'STATUS' && (
                    <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex gap-5">
                       <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
                       <p className="text-[11px] font-bold text-amber-800 leading-relaxed uppercase">
                          Action confirmed: This shift will empty all profile data and functionally lock rent collection for this unit until a new resident is onboarded.
                       </p>
                    </div>
                 )}
              </div>

              <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4">
                 <button onClick={() => setTemporalAction({...temporalAction, isOpen: false})} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest">Discard</button>
                 <button onClick={confirmTemporalAction} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> Save Timeline Transition
                 </button>
              </div>
           </div>
        </div>
      )}

      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-10 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
             <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Wallet className="w-4 h-4" /></div>
             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Portfolio Ledger</span>
          </div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight uppercase leading-none">Collection Engine</h1>
          <p className="text-slate-500 mt-2 font-medium">Monitoring real-time settlements across all assets.</p>
        </div>
        <div className="flex flex-col items-center xl:items-end gap-6">
          <div className="flex flex-wrap items-center justify-center xl:justify-end gap-4">
            {isAdmin && (
               <button onClick={() => setShowSettings(true)} className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95 flex items-center gap-2"><Settings className="w-5 h-5" /></button>
            )}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center shadow-inner overflow-hidden">
               {['monthly', 'annual', 'custom'].map((type) => (
                 <button key={type} onClick={() => setFilterType(type as FilterType)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === type ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{type}</button>
               ))}
            </div>
          </div>
          <div className="flex flex-col items-center xl:items-end gap-4 w-full">
            {filterType === 'monthly' && (
              <div className="bg-white border border-slate-100 px-4 py-2 rounded-2xl flex items-center gap-2 min-h-[50px] shadow-sm whitespace-nowrap">
                <button onClick={() => navigateMonth(-1)} className="p-1 hover:text-indigo-600 transition-colors active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
                <label className="flex items-center gap-2 cursor-pointer group/date" onClick={(e) => { try { (e.currentTarget.querySelector('input') as any)?.showPicker(); } catch(e) {} }}>
                  <CalendarDays className="w-4 h-4 text-indigo-500 group-hover/date:scale-110 transition-transform" />
                  <input type="month" className="bg-transparent border-none text-[10px] font-black uppercase text-slate-900 outline-none cursor-pointer" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                </label>
                <button onClick={() => navigateMonth(1)} className="p-1 hover:text-indigo-600 transition-colors active:scale-90"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl text-sm outline-none font-bold placeholder:text-slate-400" placeholder="Filter ledger..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Asset / Portfolio</th>
                {ledgerColumns.map(col => (
                  <th key={col.id} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{col.name}</th>
                ))}
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recordsWithRent.map((record: any) => (
                <tr key={record.id} className={`hover:bg-indigo-50/10 transition-colors group ${record.isVacant ? 'opacity-60 bg-slate-50/30' : ''}`}>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                       <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <Building2 className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="font-black text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{record.property?.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                             <button onClick={() => setHistoryRecord(record)} className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-600 flex items-center gap-1.5 active:scale-95 transition-colors"><History className="w-3.5 h-3.5" /> Timeline</button>
                          </div>
                       </div>
                    </div>
                  </td>
                  {ledgerColumns.map(col => (
                    <td key={col.id} className="px-8 py-6 text-center align-middle">
                      {renderCellContent(record, col)}
                    </td>
                  ))}
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <div className="flex bg-white shadow-sm p-1 rounded-xl border border-slate-100 mr-2">
                         <button onClick={() => handleTemporalAction(record, 'STATUS')} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Mark Vacant"><Activity className="w-4 h-4" /></button>
                         <button onClick={() => handleTemporalAction(record, 'TENANT')} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Onboard Tenant"><UserPlus className="w-4 h-4" /></button>
                      </div>
                      
                      <div className="flex gap-2">
                          {filterType === 'monthly' && (
                            <button 
                              disabled={record.isVacant}
                              onClick={() => handleAction(record, 'RENT')} 
                              className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${record.isRentPaid ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : record.isVacant ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-950 text-white shadow-xl hover:bg-indigo-700'}`}
                            >
                              {record.isRentPaid ? 'Rent Settled' : record.isVacant ? 'LOCKED' : 'Collect Rent'}
                            </button>
                          )}
                          
                          <button 
                            disabled={record.isVacant}
                            onClick={() => handleAction(record, 'DEPOSIT')} 
                            className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                record.isDepositPaid 
                                ? (record.isDepositRefunded ? 'bg-slate-100 text-slate-400 border-slate-200 grayscale cursor-not-allowed' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100') 
                                : record.isVacant ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50' : 'bg-white text-indigo-600 border border-indigo-200 shadow-sm hover:bg-indigo-50'
                            }`}
                          >
                            {record.isDepositPaid ? (record.isDepositRefunded ? 'Refunded' : 'Held / Refund?') : record.isVacant ? 'N/A' : 'Deposit Owed'}
                          </button>
                      </div>
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

      {historyRecord && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase">Unit Timeline Analysis</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historical State Chain</p>
                 </div>
                 <button onClick={() => setHistoryRecord(null)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                 <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                       <History className="w-4 h-4 text-indigo-500" />
                       <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Assignment History</h4>
                    </div>
                    <div className="space-y-4">
                       {historyRecord.assignmentHistory.map((h: UnitHistory) => {
                          const tenantCol = historyRecord.propertyType.columns.find((c: any) => c.name.toLowerCase().includes('name'))?.id;
                          const statusCol = historyRecord.propertyType.columns.find((c: any) => c.type === ColumnType.OCCUPANCY_STATUS)?.id;
                          const tName = h.values[tenantCol || ''] || 'No Resident';
                          const status = h.values[statusCol || ''] || 'Active';
                          const isCurrent = h.effectiveTo === null;
                          const isVacant = status.toLowerCase().includes('vacant');
                          return (
                             <div key={h.id} className={`p-5 rounded-[2rem] border relative ${isCurrent ? 'bg-indigo-50/50 border-indigo-100 ring-2 ring-indigo-500/10' : 'bg-slate-50 border-slate-100'}`}>
                                {isCurrent && <span className="absolute top-4 right-4 bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm">Current</span>}
                                <p className="text-xs font-black text-slate-900 uppercase mb-1">{isVacant ? 'VACANT PERIOD' : tName}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase">
                                   {new Date(h.effectiveFrom).toLocaleDateString()} - {h.effectiveTo ? new Date(h.effectiveTo).toLocaleDateString() : 'Present'}
                                </p>
                             </div>
                          );
                       })}
                    </div>
                 </section>
                 <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                       <CreditCard className="w-4 h-4 text-emerald-500" />
                       <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Payment Ledger</h4>
                    </div>
                    <div className="space-y-3">
                       {historyRecord.paymentHistory.length > 0 ? historyRecord.paymentHistory.sort((a: any, b: any) => b.month.localeCompare(a.month)).map((pay: Payment) => (
                          <div key={pay.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                             <div><p className="text-xs font-black text-slate-900 uppercase tracking-tight">{pay.type} - {pay.month}</p></div>
                             <div className="text-right">
                                <p className={`text-sm font-black text-indigo-600`}>${pay.amount.toLocaleString()}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{pay.paidAt ? new Date(pay.paidAt).toLocaleDateString() : 'N/A'}</p>
                             </div>
                          </div>
                       )) : <div className="py-20 text-center opacity-40 text-[10px] font-black uppercase tracking-widest text-slate-400">No payment logs detected</div>}
                    </div>
                 </section>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RentCollection;