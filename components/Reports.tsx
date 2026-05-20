
import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, TrendingDown, IndianRupee, PieChart as PieIcon, 
  Calendar, Download, ArrowUpRight, Wallet, 
  ChevronLeft, ChevronRight, Zap, History, User,
  CalendarDays, ChevronDown, Landmark, CreditCard, ShieldCheck,
  Building2, Layers, Filter, Users, Receipt, Trash2, Check, X
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { useLanguageStore } from '../lib/i18n';
import { PaymentStatus, Payment, UserRole, Property, User as UserType } from '../types';

type FilterType = 'monthly' | 'annual' | 'custom';
type Modality = 'RENT' | 'DEPOSIT' | 'ELECTRICITY';

const Reports: React.FC = () => {
  const store = useRentalStore();
  const { t } = useLanguageStore();
  const isAdmin = store.user?.role === UserRole.ADMIN;
  const effectiveUser = store.effectiveUser;
  const effectiveIsAdmin = effectiveUser?.role === UserRole.ADMIN;
  
  const [activeModality, setActiveModality] = useState<Modality>('RENT');
  const [filterType, setFilterType] = useState<FilterType>('monthly');
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  
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

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6', '#f43f5e'];

  const managers = useMemo(() => {
    return (store.users || []).filter((u: UserType) => u.role === UserRole.MANAGER);
  }, [store.users]);

  const analyticsData = useMemo(() => {
    // STRICTOR VISIBILITY: Filter properties based on assigned access
    const visibleProps = (store.properties || []).filter((p: Property) => {
      if (effectiveIsAdmin) return true;
      return (effectiveUser?.assignedPropertyIds || []).includes(p.id) ||
             (p.allowedUserIds || []).includes(effectiveUser?.id || '') ||
             (p.allowedUserIds || []).includes(effectiveUser?.username || '');
    });

    const visibleIds = visibleProps.map((p: any) => p.id);
    const records = store.records.filter((r: any) => visibleIds.includes(r.propertyId));
    const recordIds = records.map((r: any) => r.id);
    
    let filteredPayments = store.payments.filter((p: any) => 
      recordIds.includes(p.recordId) && p.status === PaymentStatus.PAID
    );

    // Strict deduplication by ID to prevent repeated entries and inflated totals
    const uniqueMap = new Map();
    filteredPayments.forEach(p => {
      if (!uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    });
    filteredPayments = Array.from(uniqueMap.values());

    if (filterType === 'monthly') {
      filteredPayments = filteredPayments.filter(p => {
        if (p.type === 'RENT' || p.type === 'ELECTRICITY') return p.month === selectedMonth;
        return p.paidAt?.startsWith(selectedMonth);
      });
    } else if (filterType === 'annual') {
      filteredPayments = filteredPayments.filter(p => {
        if (p.type === 'RENT' || p.type === 'ELECTRICITY') return p.month.startsWith(selectedYear);
        return p.paidAt?.startsWith(selectedYear);
      });
    } else if (filterType === 'custom') {
      const start = new Date(startDate); start.setHours(0,0,0,0);
      const end = new Date(endDate); end.setHours(23,59,59,999);
      filteredPayments = filteredPayments.filter(p => {
        if (!p.paidAt) return false;
        const pd = new Date(p.paidAt);
        return pd >= start && pd <= end;
      });
    }

    const byDate: Record<string, any> = {};
    const byMode: Record<string, number> = {};
    const byRecipient: Record<string, number> = {};
    const byProperty: Record<string, number> = {};
    const attributionMatrix: Record<string, Record<string, { total: number, breakdown: Record<string, { property: string, tenant: string, amount: number }> }>> = {};

    let totalRent = 0;
    let totalDeposits = 0;
    let totalElectricity = 0;
    let totalRefunds = 0;
    let totalExpenses = 0;

    // Filter and aggregate regular collections
    filteredPayments.forEach((p: Payment) => {
      const date = p.paidAt ? p.paidAt.split('T')[0] : 'Unknown';
      const record = store.records.find(r => r.id === p.recordId);
      const property = visibleProps.find(pr => pr.id === record?.propertyId);
      const prop = property?.name || 'Unknown';
      const recipient = p.paidTo || 'Unassigned';
      const mode = p.paymentMode || 'Cash';
      
      // Get Tenant Name from History for accurate reporting
      const pDateString = p.paidAt || (p.month !== 'ONE_TIME' ? `${p.month}-15` : new Date().toISOString());
      const pDate = new Date(pDateString);
      
      const recordHists = store.unitHistory
        .filter((h: any) => h.recordId === p.recordId)
        .sort((a: any, b: any) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
      
      // Find the history that was active when this payment was made/applied
      let historicalState = recordHists.find((h: any) => {
        const from = new Date(h.effectiveFrom);
        const to = h.effectiveTo ? new Date(h.effectiveTo) : new Date(8640000000000000);
        return pDate >= from && pDate <= to;
      });

      // Fallback: If no history state found for that exact time, check if it's a rent payment for a previous month
      // that was recorded later. Use the history of that specific month.
      if (!historicalState && p.month && p.month !== 'ONE_TIME') {
          const [y, m] = p.month.split('-').map(Number);
          const midMonth = new Date(y, m - 1, 15);
          historicalState = recordHists.find((h: any) => {
            const from = new Date(h.effectiveFrom);
            const to = h.effectiveTo ? new Date(h.effectiveTo) : new Date(8640000000000000);
            return midMonth >= from && midMonth <= to;
          });
      }

      const activeValues = historicalState?.values || store.recordValues.filter(v => v.recordId === p.recordId).reduce((acc: any, v: any) => ({...acc, [v.columnId]: v.value}), {});
      
      const propertyType = store.propertyTypes.find(pt => pt.id === property?.propertyTypeId);
      const nameCol = propertyType?.columns.find(c => 
        c.name.toLowerCase().includes('name') || 
        c.name.toLowerCase().includes('tenant') ||
        c.name.toLowerCase().includes('holder')
      );
      
      const tenantName = nameCol 
        ? activeValues[nameCol.id]?.toString() || 'Unnamed' 
        : (record?.id ? 'Unit ' + record.id.substring(0, 4) : 'Unknown Unit');
      
      if (!byDate[date]) byDate[date] = { date, rent: 0, deposit: 0, electricity: 0, refund: 0 };
      
      if (p.type === 'RENT') {
        const amt = Number(p.amount) || 0;
        totalRent += amt;
        byDate[date].rent += amt;
        if (activeModality === 'RENT') {
          byProperty[prop] = (Number(byProperty[prop]) || 0) + amt;
          byMode[mode] = (Number(byMode[mode]) || 0) + amt;
          byRecipient[recipient] = (Number(byRecipient[recipient]) || 0) + amt;
          
          if (!attributionMatrix[recipient]) attributionMatrix[recipient] = {};
          if (!attributionMatrix[recipient][mode]) attributionMatrix[recipient][mode] = { total: 0, breakdown: {} };
          attributionMatrix[recipient][mode].total += amt;
          
          const bKey = `${prop}-${tenantName}`;
          if (!attributionMatrix[recipient][mode].breakdown[bKey]) {
            attributionMatrix[recipient][mode].breakdown[bKey] = { property: prop, tenant: tenantName, amount: 0 };
          }
          attributionMatrix[recipient][mode].breakdown[bKey].amount += amt;
        }
      } else if (p.type === 'ELECTRICITY') {
        const amt = Number(p.amount) || 0;
        totalElectricity += amt;
        byDate[date].electricity += amt;
        if (activeModality === 'ELECTRICITY') {
          byProperty[prop] = (Number(byProperty[prop]) || 0) + amt;
          byMode[mode] = (Number(byMode[mode]) || 0) + amt;
          byRecipient[recipient] = (Number(byRecipient[recipient]) || 0) + amt;
          
          if (!attributionMatrix[recipient]) attributionMatrix[recipient] = {};
          if (!attributionMatrix[recipient][mode]) attributionMatrix[recipient][mode] = { total: 0, breakdown: {} };
          attributionMatrix[recipient][mode].total += amt;

          const bKey = `${prop}-${tenantName}`;
          if (!attributionMatrix[recipient][mode].breakdown[bKey]) {
            attributionMatrix[recipient][mode].breakdown[bKey] = { property: prop, tenant: tenantName, amount: 0 };
          }
          attributionMatrix[recipient][mode].breakdown[bKey].amount += amt;
        }
      } else if (p.type === 'DEPOSIT') {
        const amt = Number(p.amount) || 0;
        if (p.isRefunded || amt < 0) {
          const absAmt = Math.abs(amt);
          totalRefunds += absAmt;
          byDate[date].refund += absAmt;
          // For net calculations in charts
          byDate[date].deposit += amt; 

          if (activeModality === 'DEPOSIT') {
            byProperty[prop] = (Number(byProperty[prop]) || 0) + amt;
            byRecipient[recipient] = (Number(byRecipient[recipient]) || 0) + amt;
            // Subtract from mode if we had a mode
            if (mode && mode !== 'Cash') {
               byMode[mode] = (Number(byMode[mode]) || 0) + amt;
            }
            
            // Track negative collection in matrix for accuracy
            if (!attributionMatrix[recipient]) attributionMatrix[recipient] = {};
            if (!attributionMatrix[recipient][mode]) attributionMatrix[recipient][mode] = { total: 0, breakdown: {} };
            attributionMatrix[recipient][mode].total += amt;

            const bKey = `${prop}-${tenantName}`;
            if (!attributionMatrix[recipient][mode].breakdown[bKey]) {
              attributionMatrix[recipient][mode].breakdown[bKey] = { property: prop, tenant: tenantName, amount: 0 };
            }
            attributionMatrix[recipient][mode].breakdown[bKey].amount += amt;
          }
        } else {
          totalDeposits += amt;
          byDate[date].deposit += amt;
          if (activeModality === 'DEPOSIT') {
            byProperty[prop] = (Number(byProperty[prop]) || 0) + amt;
            byMode[mode] = (Number(byMode[mode]) || 0) + amt;
            byRecipient[recipient] = (Number(byRecipient[recipient]) || 0) + amt;

            if (!attributionMatrix[recipient]) attributionMatrix[recipient] = {};
            if (!attributionMatrix[recipient][mode]) attributionMatrix[recipient][mode] = { total: 0, breakdown: {} };
            attributionMatrix[recipient][mode].total += amt;

            const bKey = `${prop}-${tenantName}`;
            if (!attributionMatrix[recipient][mode].breakdown[bKey]) {
              attributionMatrix[recipient][mode].breakdown[bKey] = { property: prop, tenant: tenantName, amount: 0 };
            }
            attributionMatrix[recipient][mode].breakdown[bKey].amount += amt;
          }
        }
      }
    });

    // Aggregate Expenses
    let expenseList = store.expenses.filter((e: any) => visibleIds.includes(e.propertyId));
    if (filterType === 'monthly') {
      expenseList = expenseList.filter(e => e.month === selectedMonth);
    } else if (filterType === 'annual') {
      expenseList = expenseList.filter(e => e.month.startsWith(selectedYear));
    } else if (filterType === 'custom') {
      const start = new Date(startDate); start.setHours(0,0,0,0);
      const end = new Date(endDate); end.setHours(23,59,59,999);
      expenseList = expenseList.filter(e => {
        const ed = new Date(e.date);
        return ed >= start && ed <= end;
      });
    }

    expenseList.forEach(e => {
      totalExpenses += (Number(e.amount) || 0);
      const date = e.date;
      if (!byDate[date]) byDate[date] = { date, rent: 0, deposit: 0, electricity: 0, refund: 0, expense: 0 };
      byDate[date].expense = (byDate[date].expense || 0) + (Number(e.amount) || 0);
    });

    const timeSeries = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    const propertyData = Object.entries(byProperty).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const modeData = Object.entries(byMode).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const recipientData = Object.entries(byRecipient).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return {
      totalRent, totalDeposits, totalElectricity, totalRefunds, totalExpenses,
      netFlow: totalRent + totalDeposits + totalElectricity - totalRefunds - totalExpenses,
      timeSeries, propertyData, modeData, recipientData, attributionMatrix, filteredPayments
    };
  }, [store, filterType, selectedMonth, selectedYear, startDate, endDate, activeModality, effectiveIsAdmin, effectiveUser]);

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
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 max-w-[1400px] mx-auto">
      {/* HEADER SECTION */}
      <header className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 font-bold">
              <PieIcon className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-black text-indigo-400">{t('financial_audit_engine')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase">{t('capital_analysis')}</h1>
            <p className="text-slate-500 font-medium text-sm">{t('reports_desc')}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <button className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg self-start">
              <Download className="w-4 h-4" /> {t('export_report')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-slate-50 pt-8">
          <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner min-w-fit overflow-hidden">
             {(['RENT', 'ELECTRICITY', 'DEPOSIT'] as Modality[]).map((m) => (
               <button 
                key={m}
                onClick={() => setActiveModality(m)}
                className={`px-4 md:px-6 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeModality === m ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {m}
               </button>
             ))}
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner min-w-fit overflow-hidden">
             {(['monthly', 'annual', 'custom'] as FilterType[]).map((type) => (
               <button 
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${filterType === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {type}
               </button>
             ))}
          </div>

          <div className="flex-1 min-w-[280px] bg-slate-50 border border-slate-100 px-4 py-1.5 rounded-2xl flex items-center justify-center lg:justify-start gap-4">
            {filterType === 'monthly' && (
              <div className="flex items-center gap-3 w-full justify-between lg:justify-start">
                <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-indigo-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 flex-1 lg:flex-none justify-center">
                  <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
                  <input 
                    type="month"
                    className="bg-transparent border-none text-[11px] font-black uppercase text-slate-900 outline-none cursor-pointer min-w-[120px]"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
                </div>
                <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-indigo-600">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {filterType === 'annual' && (
              <div className="flex items-center gap-3 w-full justify-between lg:justify-start">
                <button onClick={() => navigateYear(-1)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-indigo-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 flex-1 lg:flex-none justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
                  <select 
                    className="bg-transparent border-none text-[11px] font-black uppercase text-slate-900 outline-none cursor-pointer appearance-none pr-8"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year.toString()}>{year}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 -ml-7 pointer-events-none" />
                </div>
                <button onClick={() => navigateYear(1)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-indigo-600">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {filterType === 'custom' && (
              <div className="flex items-center gap-4 w-full overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <input type="date" className="bg-transparent border-none text-[9px] font-black uppercase text-slate-900 outline-none cursor-pointer" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="text-slate-300 font-bold">→</div>
                <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <input type="date" className="bg-transparent border-none text-[9px] font-black uppercase text-slate-900 outline-none cursor-pointer" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          
          <button className="flex lg:hidden items-center justify-center gap-2 w-full mt-2 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </header>

      {/* STAT CARDS SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: t('rent_collected'), val: analyticsData.totalRent, sub: 'Base rental income', icon: IndianRupee, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: t('electricity_billing'), val: analyticsData.totalElectricity, sub: t('utility_collections'), icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('security_held'), val: (analyticsData.totalDeposits - analyticsData.totalRefunds), sub: t('held_refunds'), icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: t('expenses'), val: analyticsData.totalExpenses, sub: t('operational_costs'), icon: Receipt, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((item, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className={`${item.bg} ${item.color} p-4 rounded-2xl`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500">
                <ArrowUpRight className="w-3 h-3" /> LIVE
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">₹{item.val.toLocaleString()}</h3>
            <p className="text-[11px] text-slate-400 font-bold mt-2">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('settlement_velocity')}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('daily_liquidity_flow')} {activeModality}</p>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData.timeSeries}>
                <defs>
                  <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} tickFormatter={v => `₹${v}`} />
                <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '1rem', color: '#fff'}} />
                <Area type="monotone" dataKey={activeModality === 'RENT' ? 'rent' : activeModality === 'ELECTRICITY' ? 'electricity' : 'deposit'} stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorMain)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-12 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
           <div className="flex items-center gap-3 mb-10">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><Layers className="w-6 h-6" /></div>
              <div>
                 <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('channel_attribution')}</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('recipient_distribution')}</p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar border-t border-slate-50 pt-8 mt-4">
              {Object.entries(analyticsData.attributionMatrix).map(([recipient, modes], idx) => (
                 <div key={recipient} className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex flex-col hover:bg-white hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                       <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{recipient}</span>
                       <User className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="space-y-3 flex-1">
                       {Object.entries(modes).sort((a,b) => b[1].total - a[1].total).map(([mode, data], i) => (
                          <div key={mode} className="group/item relative flex flex-col gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
                             <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-600">{mode}</span>
                                 <span className="text-xs font-black text-slate-900">₹{data.total.toLocaleString()}</span>
                             </div>
                             <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                                <div 
                                   className="h-full bg-indigo-500 rounded-full" 
                                   style={{ width: `${(data.total / (Object.values(modes).reduce((a,b) => a+b.total, 0))) * 100}%` }}
                                ></div>
                             </div>

                             {/* Tooltip on hover */}
                             <div className="invisible group-hover/item:visible absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-3 w-max max-w-[280px] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 border-b border-white/10 pb-2">Collection Detail</p>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                   {Object.values(data.breakdown).sort((a,b) => b.amount - a.amount).map((item, bIdx) => (
                                      <div key={bIdx} className="flex flex-col gap-0.5 border-b border-white/5 last:border-0 pb-2 last:pb-0">
                                         <div className="flex items-center justify-between gap-6">
                                            <span className="text-[10px] font-black text-white truncate max-w-[140px]">{item.tenant}</span>
                                            <span className="text-[10px] font-black text-indigo-400 shrink-0">₹{item.amount.toLocaleString()}</span>
                                         </div>
                                         <div className="flex items-center gap-1.5 opacity-50">
                                            <Building2 className="w-2.5 h-2.5" />
                                            <span className="text-[8px] font-bold uppercase tracking-tight truncate max-w-[120px]">{item.property}</span>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                             </div>
                          </div>
                       ))}
                    </div>
                    <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center">
                       <span className="text-[9px] font-black text-slate-400 uppercase">Subtotal</span>
                       <span className="text-lg font-black text-indigo-600">₹{Object.values(modes).reduce((a,b) => a+b.total, 0).toLocaleString()}</span>
                    </div>
                 </div>
              ))}
              {Object.keys(analyticsData.attributionMatrix).length === 0 && (
                 <div className="col-span-full py-20 text-center opacity-40">
                    <Layers className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No Attribution Data Found</p>
                 </div>
              )}
           </div>
        </div>

        <div className="lg:col-span-6 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><User className="w-6 h-6" /></div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t('collected_by')}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('recipients_distribution')}</p>
               </div>
            </div>
          </div>
          <div className="flex-1 h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.recipientData} layout="vertical">
                   <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f1f5f9" />
                   <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                   <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} width={100} />
                   <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '1rem', color: '#fff'}} />
                   <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24}>
                      {analyticsData.recipientData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                   </Bar>
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 bg-slate-900 text-white p-10 rounded-[3rem] shadow-xl flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/10 text-indigo-400 rounded-2xl"><Landmark className="w-6 h-6" /></div>
                  <div>
                     <h2 className="text-xl font-black uppercase tracking-tight">{t('channel_audit')}</h2>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('payment_mode_efficiency')}</p>
                  </div>
               </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
               <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={analyticsData.modeData} 
                        cx="50%" cy="50%" 
                        innerRadius="65%" outerRadius="90%" 
                        paddingAngle={6} 
                        dataKey="value"
                        label={{ fill: '#FFFFFF', fontSize: 10, fontWeight: 900 }}
                      >
                        {analyticsData.modeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '0.75rem', color: '#fff'}} />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="space-y-3">
                  {analyticsData.modeData.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{item.name}</span>
                      </div>
                      <span className="text-xs font-black">₹{item.value.toLocaleString()}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('revenue_vectors')}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('property_performance')} {activeModality}</p>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
            <Download className="w-4 h-4" /> {t('export_report')}
          </button>
        </div>

        <div className="overflow-x-auto -mx-10 px-10 max-h-[500px] overflow-y-auto custom-scrollbar">
           <table className="w-full text-left">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                 <tr className="border-b border-slate-50">
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"> {t('asset_name')}</th>
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right"> {t('settled_amount')}</th>
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right"> {t('contribution')}</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {analyticsData.propertyData.length > 0 ? analyticsData.propertyData.map((item, i) => {
                    const totalVal = activeModality === 'RENT' ? analyticsData.totalRent : activeModality === 'ELECTRICITY' ? analyticsData.totalElectricity : (analyticsData.totalDeposits - analyticsData.totalRefunds);
                    const pct = totalVal > 0 ? (item.value / totalVal) * 100 : 0;
                    return (
                       <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-6">
                             <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                   <Building2 className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.name}</span>
                             </div>
                          </td>
                          <td className="py-6 text-right">
                             <span className="text-sm font-black text-slate-900">₹{item.value.toLocaleString()}</span>
                          </td>
                          <td className="py-6 text-right">
                             <div className="flex flex-col items-end gap-1.5">
                                <span className="text-[10px] font-black text-indigo-600">{pct.toFixed(1)}%</span>
                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }}></div>
                                </div>
                             </div>
                          </td>
                       </tr>
                    );
                 }) : (
                    <tr><td colSpan={3} className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">No financial data within selected range</td></tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm mt-10 overflow-hidden">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-black text-rose-900 uppercase tracking-tight flex items-center gap-3">
              <Zap className="w-6 h-6 text-rose-500" /> {t('data_audit_ledger')}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Reviewing All Individual Transactions for this range.
              <span className="block text-rose-500/80 normal-case mt-1 font-semibold italic text-[11px]">
                💡 Delete button action: Deleting a record permanently removes it from the database and reverses its amount, restoring the due rent/electricity balance of the primary unit.
              </span>
            </p>
          </div>
          <div className="bg-rose-50 px-4 py-2 rounded-xl border border-rose-100">
             <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{analyticsData.filteredPayments.length} Transactions</span>
          </div>
        </div>

        <div className="overflow-x-auto -mx-10 px-10 max-h-[600px] overflow-y-auto custom-scrollbar">
           <table className="w-full text-left">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                 <tr className="border-b border-slate-100">
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source/Tenant</th>
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Reference</th>
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Collector / Role</th>
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    {(isAdmin || effectiveIsAdmin) && <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>}
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {analyticsData.filteredPayments.length > 0 ? [...analyticsData.filteredPayments].sort((a,b) => (b.paidAt||'').localeCompare(a.paidAt||'')).map((p: any, i) => {
                    const record = store.records.find(r => r.id === p.recordId);
                    const prop = store.properties.find(pr => pr.id === record?.propertyId);
                    const pt = store.propertyTypes.find(t => t.id === prop?.propertyTypeId);
                    const nameCol = pt?.columns.find(c => c.name.toLowerCase().includes('name'));
                    const vMap = store.unitHistory.find(h => h.id === p.historyId)?.values || store.recordValues.filter(v => v.recordId === p.recordId).reduce((acc: any, v: any) => ({...acc, [v.columnId]: v.value}), {});
                    const tName = nameCol ? vMap[nameCol.id] || 'Unknown' : 'Unit ' + (record?.id?.substring(0,4)||'??');

                    // Resolve collector user details
                    const collectorUser = store.users.find((u: any) => 
                      u.name === p.createdBy || 
                      u.username === p.createdBy || 
                      u.name === p.paidTo || 
                      u.username === p.paidTo
                    );
                    const collectorName = p.createdBy || p.paidTo || 'Root Account';
                    const collectorRole = p.createdByRole || collectorUser?.role || 'ADMIN';

                    return (
                       <tr key={p.id} className="group hover:bg-rose-50/10 transition-colors">
                          <td className="py-5">
                             <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg w-fit ${p.type === 'RENT' ? 'bg-indigo-50 text-indigo-600' : p.type === 'ELECTRICITY' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                   {p.type}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'No Date'}</span>
                             </div>
                          </td>
                          <td className="py-5">
                             <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-900 uppercase truncate max-w-[200px]">{tName}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[200px]">{prop?.name}</span>
                             </div>
                          </td>
                          <td className="py-5 text-center">
                             <span className="text-[10px] font-mono text-slate-500 uppercase">{p.month || '-'}</span>
                          </td>
                          <td className="py-5 text-center">
                             <div className="flex flex-col items-center">
                                <span className="text-xs font-black text-indigo-600 uppercase tracking-tight">{collectorName}</span>
                                <span className="text-[9px] font-black bg-indigo-50 text-indigo-500 px-2.5 py-0.5 rounded-lg mt-1 tracking-wider uppercase">{collectorRole}</span>
                             </div>
                          </td>
                          <td className="py-5 text-right">
                             <span className={`text-sm font-black ${p.amount < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                               ₹{Math.abs(p.amount).toLocaleString()}
                               {p.amount < 0 && <span className="text-[9px] ml-1 uppercase">Refund</span>}
                             </span>
                          </td>
                          {(isAdmin || effectiveIsAdmin) && (
                            <td className="py-5 text-right whitespace-nowrap">
                              {deletingPaymentId === p.id ? (
                                <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-100 rounded-xl p-1 shadow-sm">
                                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-2">Confirm?</span>
                                  <button 
                                    onClick={async () => {
                                      await store.deletePayment(p.id);
                                      setDeletingPaymentId(null);
                                    }}
                                    className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
                                    title="Yes, Delete Record"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => setDeletingPaymentId(null)}
                                    className="p-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setDeletingPaymentId(p.id)}
                                  className="p-3 bg-white border border-slate-100 text-slate-300 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 rounded-xl transition-all shadow-sm"
                                  title="Delete Records"
                                >
                                   <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          )}
                       </tr>
                    );
                 }) : (
                     <tr><td colSpan={(isAdmin || effectiveIsAdmin) ? 6 : 5} className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">No transactions found</td></tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
