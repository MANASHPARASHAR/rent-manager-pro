
import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, 
  Calendar, Download, ArrowUpRight, Wallet, 
  ChevronLeft, ChevronRight, Zap, History, User,
  CalendarDays, ChevronDown, Landmark, CreditCard, ShieldCheck,
  Building2, Layers
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { PaymentStatus, Payment, UserRole } from '../types';

type FilterType = 'monthly' | 'annual' | 'custom';
type Modality = 'RENT' | 'DEPOSIT' | 'ELECTRICITY';

const Reports: React.FC = () => {
  const store = useRentalStore();
  const [activeModality, setActiveModality] = useState<Modality>('RENT');
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

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6', '#f43f5e'];

  const analyticsData = useMemo(() => {
    const isManager = store.user?.role === UserRole.MANAGER;
    const visibleProps = isManager ? store.properties.filter((p: any) => p.isVisibleToManager) : store.properties;
    const visibleIds = visibleProps.map((p: any) => p.id);
    const records = store.records.filter((r: any) => visibleIds.includes(r.propertyId));
    const recordIds = records.map((r: any) => r.id);
    
    let filteredPayments = store.payments.filter((p: any) => 
      recordIds.includes(p.recordId) && p.status === PaymentStatus.PAID
    );

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
    const attributionMatrix: Record<string, Record<string, number>> = {};

    let totalRent = 0;
    let totalDeposits = 0;
    let totalElectricity = 0;
    let totalRefunds = 0;

    filteredPayments.forEach((p: Payment) => {
      const date = p.paidAt ? p.paidAt.split('T')[0] : 'Unknown';
      const prop = visibleProps.find(pr => pr.id === store.records.find(r => r.id === p.recordId)?.propertyId)?.name || 'Unknown';
      const recipient = p.paidTo || 'Unassigned';
      const mode = p.paymentMode || 'Cash';
      
      if (!byDate[date]) byDate[date] = { date, rent: 0, deposit: 0, electricity: 0, refund: 0 };
      
      if (p.type === 'RENT') {
        totalRent += p.amount;
        byDate[date].rent += p.amount;
        if (activeModality === 'RENT') {
          byProperty[prop] = (byProperty[prop] || 0) + p.amount;
          byMode[mode] = (byMode[mode] || 0) + p.amount;
          byRecipient[recipient] = (byRecipient[recipient] || 0) + p.amount;
          
          if (!attributionMatrix[recipient]) attributionMatrix[recipient] = {};
          attributionMatrix[recipient][mode] = (attributionMatrix[recipient][mode] || 0) + p.amount;
        }
      } else if (p.type === 'ELECTRICITY') {
        totalElectricity += p.amount;
        byDate[date].electricity += p.amount;
        if (activeModality === 'ELECTRICITY') {
          byProperty[prop] = (byProperty[prop] || 0) + p.amount;
          byMode[mode] = (byMode[mode] || 0) + p.amount;
          byRecipient[recipient] = (byRecipient[recipient] || 0) + p.amount;
          
          if (!attributionMatrix[recipient]) attributionMatrix[recipient] = {};
          attributionMatrix[recipient][mode] = (attributionMatrix[recipient][mode] || 0) + p.amount;
        }
      } else if (p.type === 'DEPOSIT') {
        if (p.isRefunded) {
          totalRefunds += p.amount;
          byDate[date].refund += p.amount;
          if (activeModality === 'DEPOSIT') {
            byProperty[prop] = (byProperty[prop] || 0) - p.amount;
            byRecipient[recipient] = (byRecipient[recipient] || 0) - p.amount;
          }
        } else {
          totalDeposits += p.amount;
          byDate[date].deposit += p.amount;
          if (activeModality === 'DEPOSIT') {
            byProperty[prop] = (byProperty[prop] || 0) + p.amount;
            byMode[mode] = (byMode[mode] || 0) + p.amount;
            byRecipient[recipient] = (byRecipient[recipient] || 0) + p.amount;

            if (!attributionMatrix[recipient]) attributionMatrix[recipient] = {};
            attributionMatrix[recipient][mode] = (attributionMatrix[recipient][mode] || 0) + p.amount;
          }
        }
      }
    });

    const timeSeries = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    const propertyData = Object.entries(byProperty).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const modeData = Object.entries(byMode).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const recipientData = Object.entries(byRecipient).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return {
      totalRent, totalDeposits, totalElectricity, totalRefunds, netFlow: totalRent + totalDeposits + totalElectricity - totalRefunds,
      timeSeries, propertyData, modeData, recipientData, attributionMatrix
    };
  }, [store, filterType, selectedMonth, selectedYear, startDate, endDate, activeModality]);

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
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-1">
            <PieIcon className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest font-black text-indigo-400">Financial Audit Engine</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Capital Analysis</h1>
          <p className="text-slate-500 mt-1 font-medium">Insights into collection efficiency and revenue distribution.</p>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center shadow-inner">
             {(['RENT', 'ELECTRICITY', 'DEPOSIT'] as Modality[]).map((m) => (
               <button 
                key={m}
                onClick={() => setActiveModality(m)}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeModality === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {m}
               </button>
             ))}
          </div>

          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center shadow-inner">
             {(['monthly', 'annual', 'custom'] as FilterType[]).map((type) => (
               <button 
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {type}
               </button>
             ))}
          </div>

          <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl flex items-center gap-2 min-h-[50px]">
            {filterType === 'monthly' && (
              <div 
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded-xl transition-colors group/month"
                onClick={(e) => { try { (e.currentTarget.querySelector('input') as any)?.showPicker(); } catch(err) {} }}
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); navigateMonth(-1); }} 
                  className="p-1 hover:text-indigo-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 text-indigo-500 group-hover/month:scale-110 transition-transform" />
                  <input 
                    type="month"
                    className="bg-transparent border-none text-xs font-black uppercase text-slate-900 outline-none cursor-pointer"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); navigateMonth(1); }} 
                  className="p-1 hover:text-indigo-600 transition-colors"
                >
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
                    className="bg-transparent border-none text-xs font-black uppercase text-slate-900 outline-none cursor-pointer appearance-none pr-8"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year.toString()}>{year}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 -ml-7 pointer-events-none" />
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
                  <div 
                    className="cursor-pointer hover:bg-slate-100 px-2 py-1 rounded-xl transition-colors group/start"
                    onClick={(e) => { try { (e.currentTarget.querySelector('input') as any)?.showPicker(); } catch(err) {} }}
                  >
                     <input type="date" className="bg-transparent border-none text-[10px] font-black uppercase text-slate-900 outline-none cursor-pointer" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="text-slate-300">→</div>
                  <div 
                    className="cursor-pointer hover:bg-slate-100 px-2 py-1 rounded-xl transition-colors group/end"
                    onClick={(e) => { try { (e.currentTarget.querySelector('input') as any)?.showPicker(); } catch(err) {} }}
                  >
                     <input type="date" className="bg-transparent border-none text-[10px] font-black uppercase text-slate-900 outline-none cursor-pointer" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Settled', val: activeModality === 'RENT' ? analyticsData.totalRent : activeModality === 'ELECTRICITY' ? analyticsData.totalElectricity : (analyticsData.totalDeposits - analyticsData.totalRefunds), sub: 'Confirmed transactions', icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Electricity Revenue', val: analyticsData.totalElectricity, sub: 'Power bill collection', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Rent Contribution', val: analyticsData.totalRent, sub: 'Lease liquidity', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Security Escrow', val: analyticsData.totalDeposits, sub: 'Held assets', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
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
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">${item.val.toLocaleString()}</h3>
            <p className="text-[11px] text-slate-400 font-bold mt-2">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Settlement Velocity</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Daily liquidity flow for {activeModality}</p>
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
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} tickFormatter={v => `$${v}`} />
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
                 <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Channel Attribution</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Recipient x Payment Mode Distribution</p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(analyticsData.attributionMatrix).map(([recipient, modes], idx) => (
                 <div key={recipient} className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex flex-col hover:bg-white hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                       <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{recipient}</span>
                       <User className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="space-y-3 flex-1">
                       {Object.entries(modes).sort((a,b) => b[1] - a[1]).map(([mode, amount], i) => (
                          <div key={mode} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
                             <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-600">{mode}</span>
                                <span className="text-xs font-black text-slate-900">${amount.toLocaleString()}</span>
                             </div>
                             <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                                <div 
                                   className="h-full bg-indigo-500 rounded-full" 
                                   style={{ width: `${(amount / (Object.values(modes).reduce((a,b) => a+b, 0))) * 100}%` }}
                                ></div>
                             </div>
                          </div>
                       ))}
                    </div>
                    <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center">
                       <span className="text-[9px] font-black text-slate-400 uppercase">Subtotal</span>
                       <span className="text-lg font-black text-indigo-600">${Object.values(modes).reduce((a,b) => a+b, 0).toLocaleString()}</span>
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
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Collected By</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Recipients distribution</p>
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
                     <h2 className="text-xl font-black uppercase tracking-tight">Channel Audit</h2>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Payment mode efficiency</p>
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
                      <span className="text-xs font-black">${item.value.toLocaleString()}</span>
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
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Revenue Vectors</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Property Performance for {activeModality}</p>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>

        <div className="overflow-x-auto -mx-10 px-10 max-h-[500px] overflow-y-auto custom-scrollbar">
           <table className="w-full text-left">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                 <tr className="border-b border-slate-50">
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Name</th>
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Settled Amount</th>
                    <th className="pb-6 pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Contribution</th>
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
                             <span className="text-sm font-black text-slate-900">${item.value.toLocaleString()}</span>
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
    </div>
  );
};

export default Reports;
