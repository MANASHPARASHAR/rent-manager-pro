
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign,
  Hand,
  CalendarDays,
  ArrowRight,
  TrendingUp,
  Target,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  User,
  Home,
  ArrowRightLeft,
  ShieldCheck,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  History,
  RotateCcw,
  Zap
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell, 
  PieChart, 
  Pie
} from 'recharts';
import { useRentalStore } from '../store/useRentalStore';
import { PaymentStatus, UserRole, Payment, ColumnType } from '../types';

type FilterType = 'monthly' | 'annual' | 'custom';
type ReportView = 'mode' | 'recipient';

const Dashboard: React.FC = () => {
  const store = useRentalStore();
  const navigate = useNavigate();
  const isManager = store.user?.role === UserRole.MANAGER;

  const visibleProperties = useMemo(() => {
    if (!isManager) return store.properties;
    return store.properties.filter((p: any) => p.isVisibleToManager);
  }, [store.properties, isManager]);

  const visiblePropertyIds = useMemo(() => visibleProperties.map((p: any) => p.id), [visibleProperties]);

  const [filterType, setFilterType] = useState<FilterType>('monthly');
  const [reportView, setReportView] = useState<ReportView>('mode');
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

  const [currentMonthKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const stats = useMemo(() => {
    const records = store.records.filter((r: any) => visiblePropertyIds.includes(r.propertyId));
    const recordIds = records.map((r: any) => r.id);
    const values = store.recordValues.filter((v: any) => recordIds.includes(v.recordId));
    const types = store.propertyTypes;

    const rentColIds = types.flatMap(pt => pt.columns.filter(c => c.isRentCalculatable).map(c => c.id));
    const occupancyColIds = types.flatMap(pt => pt.columns.filter(c => c.type === ColumnType.DROPDOWN && (c.name.toLowerCase().includes('status') || c.name.toLowerCase().includes('occupancy'))).map(c => c.id));

    let monthlyRentExpected = 0;
    let activeUnits = 0;
    let vacantUnits = 0;
    const overdueUnitsList: any[] = [];

    records.forEach(record => {
      const recordValues = values.filter(v => v.recordId === record.id);
      const statusValue = recordValues.find(v => occupancyColIds.includes(v.columnId))?.value.toLowerCase() || 'active';
      const isActive = statusValue === 'active' || statusValue === 'occupied';
      
      const rentValue = recordValues.find(v => rentColIds.includes(v.columnId))?.value || '0';
      const amount = parseFloat(rentValue);

      if (isActive) {
        activeUnits++;
        monthlyRentExpected += amount;
        
        const isPaid = store.payments.some((p: Payment) => p.recordId === record.id && p.month === currentMonthKey && p.type === 'RENT' && p.status === PaymentStatus.PAID);
        if (!isPaid) {
          const property = store.properties.find((p: any) => p.id === record.propertyId);
          overdueUnitsList.push({ id: record.id, amount, propertyName: property?.name, tenant: recordValues.find(v => v.columnId.includes('c2'))?.value || 'Unknown' });
        }
      } else if (statusValue === 'vacant') {
        vacantUnits++;
      }
    });

    const collectedThisMonth = store.payments
      .filter((p: Payment) => recordIds.includes(p.recordId) && p.month === currentMonthKey && p.status === PaymentStatus.PAID && p.type === 'RENT')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0);

    const depositsThisMonth = store.payments
      .filter((p: Payment) => recordIds.includes(p.recordId) && p.status === PaymentStatus.PAID && p.type === 'DEPOSIT' && !p.isRefunded)
      .filter((p: Payment) => p.paidAt?.startsWith(currentMonthKey))
      .reduce((sum: number, p: Payment) => sum + p.amount, 0);

    return {
      totalProperties: visiblePropertyIds.length,
      activeUnits,
      vacantUnits,
      monthlyRentExpected,
      monthlyTotalCollected: collectedThisMonth + depositsThisMonth,
      overdueUnitsList: overdueUnitsList.sort((a,b) => b.amount - a.amount).slice(0, 5),
      collectionRate: monthlyRentExpected > 0 ? (collectedThisMonth / monthlyRentExpected) * 100 : 0,
      occupancyRate: (activeUnits + vacantUnits) > 0 ? (activeUnits / (activeUnits + vacantUnits)) * 100 : 0
    };
  }, [store, currentMonthKey, visiblePropertyIds]);

  const propertyChartData = useMemo(() => {
    return visibleProperties.map(p => {
      const propRecords = store.records.filter((r: any) => r.propertyId === p.id);
      const propertyType = store.propertyTypes.find((pt: any) => pt.id === p.propertyTypeId);
      if (!propertyType) return { name: p.name, target: 0, collected: 0 };

      const rentCols = propertyType.columns.filter((c: any) => c.isRentCalculatable).map((c: any) => c.id);
      
      let target = 0;
      propRecords.forEach((r: any) => {
        const rValues = store.recordValues.filter((v: any) => v.recordId === r.id);
        const rent = rValues.filter((v: any) => rentCols.includes(v.columnId));
        target += rent.reduce((sum: number, rv: any) => sum + (parseFloat(rv.value) || 0), 0);
      });

      const collected = store.payments
        .filter((pay: any) => {
          const record = store.records.find((r: any) => r.id === pay.recordId);
          return record?.propertyId === p.id && pay.month === currentMonthKey && pay.status === PaymentStatus.PAID && pay.type === 'RENT';
        })
        .reduce((sum: number, pay: any) => sum + pay.amount, 0);

      return {
        name: p.name.length > 12 ? p.name.substring(0, 10) + '..' : p.name,
        target,
        collected
      };
    });
  }, [store, currentMonthKey, visibleProperties]);

  const reportData = useMemo(() => {
    const records = store.records.filter((r: any) => visiblePropertyIds.includes(r.propertyId));
    const recordIds = records.map((r: any) => r.id);
    let filteredPayments = store.payments.filter((p: any) => recordIds.includes(p.recordId) && p.status === PaymentStatus.PAID);

    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(23,59,59,999);

    filteredPayments = filteredPayments.filter(p => {
      if (filterType === 'monthly') return p.month === selectedMonth;
      if (filterType === 'annual') return p.month.startsWith(selectedYear) || p.paidAt?.startsWith(selectedYear);
      if (filterType === 'custom') {
        if (!p.paidAt) return false;
        const pd = new Date(p.paidAt);
        return pd >= start && pd <= end;
      }
      return false;
    });

    const byMode: Record<string, number> = {};
    const byRecipient: Record<string, number> = {};
    let totalRent = 0;
    let totalDeposits = 0;
    let totalRefunds = 0;

    filteredPayments.forEach((p: Payment) => {
      const mode = p.paymentMode || 'Other';
      const recipient = p.paidTo || 'Unassigned';
      
      if (p.type === 'RENT') {
        totalRent += p.amount;
        byMode[mode] = (byMode[mode] || 0) + p.amount;
        byRecipient[recipient] = (byRecipient[recipient] || 0) + p.amount;
      } else if (p.type === 'DEPOSIT') {
        if (p.isRefunded) {
          totalRefunds += p.amount;
          byMode[mode] = (byMode[mode] || 0) - p.amount;
          byRecipient[recipient] = (byRecipient[recipient] || 0) - p.amount;
        } else {
          totalDeposits += p.amount;
          byMode[mode] = (byMode[mode] || 0) + p.amount;
          byRecipient[recipient] = (byRecipient[recipient] || 0) + p.amount;
        }
      }
    });

    const currentPieData = reportView === 'mode' 
      ? Object.entries(byMode).map(([name, value]) => ({ name, value }))
      : Object.entries(byRecipient).map(([name, value]) => ({ name, value }));

    return {
      pieData: currentPieData.sort((a, b) => b.value - a.value),
      total: totalRent + totalDeposits - totalRefunds,
      totalRent,
      totalDeposits,
      totalRefunds
    };
  }, [store.payments, filterType, selectedMonth, selectedYear, startDate, endDate, visiblePropertyIds, reportView]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];

  const navigateMonth = (dir: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1);
    date.setMonth(date.getMonth() + dir);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 max-w-[1600px] mx-auto px-4 md:px-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest font-black">Settlement Engine Live</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight uppercase">Portfolio Status</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm md:text-base">Managing {stats.totalProperties} properties with real-time settlement tracking.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2.5 rounded-[2.5rem] border border-slate-100 shadow-sm">
           <div className="flex flex-col items-end px-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Collection Rate</span>
              <span className="text-sm font-black text-indigo-600">{Math.round(stats.collectionRate)}% MTD</span>
           </div>
           <div className="w-14 h-14 rounded-full bg-slate-950 flex items-center justify-center font-black text-white text-lg border-4 border-indigo-500/20 shadow-xl">
             {Math.round(stats.occupancyRate)}%
           </div>
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Settled Liquidity', val: `$${stats.monthlyTotalCollected.toLocaleString()}`, sub: 'Rent + Active Deposits', icon: DollarSign, color: 'bg-indigo-600' },
          { label: 'Occupancy', val: `${Math.round(stats.occupancyRate)}%`, sub: `${stats.activeUnits} Units Live`, icon: Home, color: 'bg-emerald-600' },
          { label: 'Target Yield', val: `$${stats.monthlyRentExpected.toLocaleString()}`, sub: 'Portfolio cap (Rent)', icon: Target, color: 'bg-slate-900' },
          { label: 'Efficiency', val: `${Math.round(stats.collectionRate)}%`, sub: 'Payment Velocity', icon: TrendingUp, color: 'bg-amber-500' },
        ].map((item, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-300 group">
            <div className="flex justify-between items-start mb-6">
              <div className={`${item.color} p-4 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform`}>
                <item.icon className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{item.label}</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{item.val}</h3>
            <p className="text-[11px] text-slate-400 font-bold mt-2">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col min-h-[550px]">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-12 gap-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Revenue Vectors</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Target vs Actual Performance</p>
            </div>
            <div className="flex gap-6">
               <div className="flex items-center gap-2 text-[10px] font-black uppercase"><div className="w-3 h-3 rounded-full bg-slate-100"></div> Target</div>
               <div className="flex items-center gap-2 text-[10px] font-black uppercase"><div className="w-3 h-3 rounded-full bg-indigo-500"></div> Collected</div>
            </div>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={propertyChartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }} barGap={12}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1.25rem', color: '#fff' }} />
                <Bar dataKey="target" fill="#f1f5f9" radius={[12, 12, 0, 0]} barSize={32} />
                <Bar dataKey="collected" fill="#6366f1" radius={[12, 12, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Priority Tasks</h2>
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center animate-pulse"><AlertCircle className="w-6 h-6" /></div>
          </div>
          <div className="flex-1 space-y-4">
            {stats.overdueUnitsList.length > 0 ? stats.overdueUnitsList.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] border border-transparent hover:border-red-100 hover:bg-white transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-red-500 group-hover:text-white transition-all"><User className="w-5 h-5" /></div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-black text-slate-900 uppercase truncate">{item.tenant}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">{item.propertyName}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-black text-red-600">${item.amount.toLocaleString()}</p>
                  <p className="text-[9px] font-black text-red-400 uppercase">Settlement Pending</p>
                </div>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-12">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-6" />
                <p className="text-xs font-black uppercase text-slate-900 tracking-widest">Portfolio Healthy</p>
              </div>
            )}
          </div>
          <button onClick={() => navigate('/collection')} className="w-full mt-8 py-5 bg-slate-950 text-white rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 group">
            Open Ledger <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Capital Distribution Section */}
      <div className="bg-slate-950 rounded-[4rem] p-10 lg:p-16 text-white relative overflow-hidden shadow-2xl border border-white/5">
         <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
         
         <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-12 xl:gap-20">
            <div className="xl:col-span-4 flex flex-col justify-center">
               <div className="inline-flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10 text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] mb-8">
                  <BarChart3 className="w-4 h-4" /> Capital Audit
               </div>
               <h2 className="text-5xl font-black tracking-tighter leading-none mb-6 uppercase">Net <br /> <span className="text-indigo-500">Liquidity</span></h2>
               <p className="text-slate-400 text-lg font-medium leading-relaxed mb-12">Aggregate overview of rent collections, held security deposits, and issued refunds across the selected period.</p>
               
               <div className="space-y-4">
                  <div className="bg-white/[0.03] p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                     <div className="flex items-center gap-5">
                        <div className="bg-indigo-600 p-4 rounded-2xl shadow-xl shadow-indigo-600/20"><DollarSign className="w-6 h-6" /></div>
                        <div>
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Gross Rent</p>
                           <p className="text-3xl font-black text-white">${reportData.totalRent.toLocaleString()}</p>
                        </div>
                     </div>
                  </div>
                  <div className="bg-white/[0.03] p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                     <div className="flex items-center gap-5">
                        <div className="bg-emerald-600 p-4 rounded-2xl shadow-xl shadow-emerald-600/20"><ShieldCheck className="w-6 h-6" /></div>
                        <div>
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Deposit Assets</p>
                           <p className="text-3xl font-black text-white">${reportData.totalDeposits.toLocaleString()}</p>
                        </div>
                     </div>
                  </div>
                  <div className="bg-white/[0.03] p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                     <div className="flex items-center gap-5">
                        <div className="bg-rose-600 p-4 rounded-2xl shadow-xl shadow-rose-600/20"><RotateCcw className="w-6 h-6" /></div>
                        <div>
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Refund Outflow</p>
                           <p className="text-3xl font-black text-white">${reportData.totalRefunds.toLocaleString()}</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="xl:col-span-8 bg-white/[0.02] rounded-[3.5rem] border border-white/5 p-8 lg:p-12 backdrop-blur-md flex flex-col min-h-[700px]">
               {/* Controls Restructured: Time Filter -> View Toggle */}
               <div className="flex flex-col gap-10 mb-16">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-white/10">
                      {['monthly', 'annual', 'custom'].map(t => (
                          <button key={t} onClick={() => setFilterType(t as FilterType)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === t ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-slate-500 hover:text-white'}`}>
                            {t}
                          </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-6 bg-white/10 px-6 py-4 rounded-2xl border border-white/10 w-full sm:w-auto">
                        {filterType === 'monthly' && (
                          <div className="flex items-center justify-between w-full gap-8">
                            <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                            <input type="month" className="bg-transparent border-none text-xs font-black text-white outline-none cursor-pointer [color-scheme:dark] uppercase tracking-widest" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                            <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><ChevronRight className="w-5 h-5" /></button>
                          </div>
                        )}
                        {filterType === 'annual' && <span className="text-sm font-black text-white tracking-widest">{selectedYear} Portfolio Audit</span>}
                        {filterType === 'custom' && (
                          <div className="flex items-center gap-6">
                             <input type="date" className="bg-transparent border-none text-[10px] font-black text-white outline-none [color-scheme:dark]" value={startDate} onChange={e => setStartDate(e.target.value)} />
                             <ArrowRightLeft className="w-4 h-4 text-slate-700" />
                             <input type="date" className="bg-transparent border-none text-[10px] font-black text-white outline-none [color-scheme:dark]" value={endDate} onChange={e => setEndDate(e.target.value)} />
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 w-full sm:w-max">
                    <button onClick={() => setReportView('mode')} className={`flex-1 sm:flex-none flex items-center gap-3 px-10 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportView === 'mode' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/30' : 'text-slate-500 hover:text-white'}`}>
                       <CreditCard className="w-4 h-4" /> Transfer Modes
                    </button>
                    <button onClick={() => setReportView('recipient')} className={`flex-1 sm:flex-none flex items-center gap-3 px-10 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportView === 'recipient' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/30' : 'text-slate-500 hover:text-white'}`}>
                       <Building2 className="w-4 h-4" /> Account Groups
                    </button>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 xl:gap-24 items-center flex-1">
                  <div className="h-[350px] xl:h-[450px] relative w-full">
                     {reportData.pieData.length > 0 ? (
                        <div className="h-full w-full relative">
                           <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1">Net Flow</p>
                              <p className="text-4xl font-black text-white tracking-tighter">${reportData.total.toLocaleString()}</p>
                           </div>
                           <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                 <Pie data={reportData.pieData} cx="50%" cy="50%" innerRadius="70%" outerRadius="95%" paddingAngle={8} dataKey="value" stroke="none">
                                    {reportData.pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                 </Pie>
                                 <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1.25rem', color: '#fff' }} />
                              </PieChart>
                           </ResponsiveContainer>
                        </div>
                     ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-700 border-2 border-dashed border-white/5 rounded-full">
                           <History className="w-12 h-12 opacity-20 mb-6" />
                           <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-40">No activity found</p>
                        </div>
                     )}
                  </div>

                  <div className="flex flex-col gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                     {reportData.pieData.map((item, i) => (
                        <div key={item.name} className="flex justify-between items-center group bg-white/[0.02] p-6 rounded-3xl border border-white/5 hover:bg-white/[0.04] transition-all">
                           <div className="flex items-center gap-5">
                              <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                              <div>
                                 <span className="text-base font-black text-slate-200 group-hover:text-white uppercase tracking-tight block">{item.name}</span>
                                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{Math.round((item.value / reportData.total) * 100)}% contribution</span>
                              </div>
                           </div>
                           <p className="text-xl font-black text-white">${item.value.toLocaleString()}</p>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="mt-16 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="flex items-center gap-3">
                     <ShieldCheck className="w-5 h-5 text-indigo-500 opacity-40" />
                     <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Audit Trail Active • Net Liquidity: ${reportData.total.toLocaleString()}</p>
                  </div>
                  <button onClick={() => navigate('/collection')} className="flex items-center gap-6 group px-8 py-4 bg-white/5 hover:bg-white/10 rounded-[1.5rem] border border-white/5 transition-all w-full md:w-auto">
                     <p className="text-xl font-black text-white">Full Ledger <ArrowRight className="w-5 h-5 inline-block ml-3 group-hover:translate-x-2 transition-transform" /></p>
                  </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
