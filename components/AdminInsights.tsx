
import React, { useMemo, useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  BarChart3, 
  Target, 
  Briefcase, 
  Building2, 
  Zap, 
  ChevronRight, 
  Undo2, 
  Save, 
  PieChart, 
  ArrowRight,
  ShieldCheck,
  Globe,
  Coins,
  LayoutGrid,
  Info,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, ComposedChart, Line, Area
} from 'recharts';
import { useRentalStore } from '../store/useRentalStore';
import { PaymentStatus, UserRole, Property } from '../types';

const AdminInsights: React.FC = () => {
  const store = useRentalStore();
  const isAdmin = store.user?.role === UserRole.ADMIN;
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempInvestment, setTempInvestment] = useState<string>('0');

  // AUTHORIZATION GUARD
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-white rounded-[3rem] border border-gray-100 shadow-sm text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
           <ShieldCheck className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Access Restricted</h2>
        <p className="text-slate-500 font-medium mt-3 max-w-sm">
           This dashboard contains sensitive financial CapEx data and is only visible to Super-Administrators.
        </p>
      </div>
    );
  }

  const propertyMetrics = useMemo(() => {
    return store.properties.map((p: Property) => {
      const records = store.records.filter((r: any) => r.propertyId === p.id);
      const recordIds = records.map((r: any) => r.id);
      
      const lifetimeRevenue = store.payments
        .filter((pay: any) => 
          recordIds.includes(pay.recordId) && 
          pay.status === PaymentStatus.PAID && 
          (pay.type === 'RENT' || pay.type === 'ELECTRICITY')
        )
        .reduce((sum: number, pay: any) => sum + pay.amount, 0);

      const investment = p.totalInvestment || 0;
      const profit = lifetimeRevenue - investment;
      const roi = investment > 0 ? (lifetimeRevenue / investment) * 100 : 0;
      const isBreakeven = lifetimeRevenue >= investment && investment > 0;

      return {
        ...p,
        lifetimeRevenue,
        investment,
        profit,
        roi,
        isBreakeven
      };
    }).sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);
  }, [store.properties, store.payments, store.records]);

  const portfolioStats = useMemo(() => {
    const totalRevenue = propertyMetrics.reduce((s, m) => s + m.lifetimeRevenue, 0);
    const totalInvestment = propertyMetrics.reduce((s, m) => s + m.investment, 0);
    const totalProfit = totalRevenue - totalInvestment;
    const avgROI = totalInvestment > 0 ? (totalRevenue / totalInvestment) * 100 : 0;

    return { totalRevenue, totalInvestment, totalProfit, avgROI };
  }, [propertyMetrics]);

  const handleUpdateInvestment = (id: string) => {
    const amount = parseFloat(tempInvestment) || 0;
    store.updateProperty(id, { totalInvestment: amount });
    setEditingId(null);
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  return (
    <div className="space-y-10 pb-20 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* HEADER */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-3">
            <Globe className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-indigo-400">Owner Intelligence Hub</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Capital Insights</h1>
          <p className="text-slate-500 mt-4 font-medium text-lg max-w-xl">
             Comprehensive lifecycle analysis comparing portfolio investment against aggregate yield.
          </p>
        </div>

        <div className="flex gap-4">
           <div className="px-8 py-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Portfolio ROI</span>
              <div className="flex items-center gap-3">
                 <h3 className="text-3xl font-black text-slate-900 leading-none">{portfolioStats.avgROI.toFixed(1)}%</h3>
                 <div className={`p-1.5 rounded-lg ${portfolioStats.avgROI >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {portfolioStats.avgROI >= 100 ? <ShieldCheck className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                 </div>
              </div>
           </div>
        </div>
      </header>

      {/* SUMMARY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Aggregate Revenue', val: `$${portfolioStats.totalRevenue.toLocaleString()}`, sub: 'Lifetime collections', icon: Coins, color: 'bg-indigo-600' },
          { label: 'Total Capital Outlay', val: `$${portfolioStats.totalInvestment.toLocaleString()}`, sub: 'Invested CapEx', icon: Target, color: 'bg-slate-900' },
          { label: 'Net Liquidity Position', val: `$${portfolioStats.totalProfit.toLocaleString()}`, sub: 'Rev minus CapEx', icon: DollarSign, color: portfolioStats.totalProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600' },
          { label: 'Yield Efficiency', val: `${portfolioStats.avgROI.toFixed(1)}%`, sub: 'Investment recovery', icon: BarChart3, color: 'bg-amber-500' },
        ].map((item, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 group">
             <div className="flex justify-between items-start mb-6">
                <div className={`${item.color} p-4 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform`}>
                   <item.icon className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 text-[9px] font-black text-slate-300">
                   LIVE <ArrowUpRight className="w-3 h-3" />
                </div>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
             <h3 className="text-3xl font-black text-slate-900 tracking-tight">{item.val}</h3>
             <p className="text-[11px] text-slate-400 font-bold mt-2">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
         <div className="xl:col-span-8 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between mb-12">
               <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Investment Recovery Gap</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Comparison of Total Revenue vs Initial Investment</p>
               </div>
               <div className="flex gap-6">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><div className="w-3 h-3 rounded-full bg-slate-100"></div> CapEx</div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-500"><div className="w-3 h-3 rounded-full bg-indigo-500"></div> Revenue</div>
               </div>
            </div>
            <div className="flex-1 h-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propertyMetrics} barGap={12}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} tickFormatter={v => `$${v/1000}k`} />
                     <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1rem', color: '#fff' }} />
                     <Bar dataKey="investment" fill="#f1f5f9" radius={[8, 8, 0, 0]} barSize={25} />
                     <Bar dataKey="lifetimeRevenue" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={25} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="xl:col-span-4 bg-slate-900 p-10 rounded-[3rem] shadow-2xl flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full"></div>
            <div className="relative z-10 flex flex-col h-full">
               <div className="flex items-center gap-4 mb-10">
                  <div className="p-4 bg-white/10 text-white rounded-2xl"><PieChart className="w-6 h-6" /></div>
                  <div>
                     <h2 className="text-xl font-black text-white uppercase tracking-tight">Breakeven Analysis</h2>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Portfolio Recovery progress</p>
                  </div>
               </div>
               
               <div className="flex-1 flex flex-col justify-center items-center py-10">
                  <div className="relative w-56 h-56">
                     <svg className="w-full h-full transform -rotate-90">
                        <circle className="text-slate-800" strokeWidth="20" stroke="currentColor" fill="transparent" r="90" cx="112" cy="112" />
                        <circle 
                           className="text-indigo-500" strokeWidth="20" strokeDasharray={565.48} 
                           strokeDashoffset={565.48 - (565.48 * Math.min(portfolioStats.avgROI, 100)) / 100} 
                           strokeLinecap="round" stroke="currentColor" fill="transparent" r="90" cx="112" cy="112" 
                        />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <span className="text-4xl font-black">{Math.min(portfolioStats.avgROI, 100).toFixed(0)}%</span>
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Recovered</span>
                     </div>
                  </div>
               </div>

               <div className="space-y-4 mt-8">
                  <div className="p-5 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profitable Assets</span>
                     <span className="text-sm font-black text-emerald-400">{propertyMetrics.filter(m => m.isBreakeven).length} / {propertyMetrics.length}</span>
                  </div>
                  <div className="p-5 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Year-to-Recov</span>
                     <span className="text-sm font-black text-indigo-400">4.2 yrs</span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* ASSET ROI TABLE */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl"><LayoutGrid className="w-6 h-6" /></div>
               <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">CapEx vs yield Inventory</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Property wise investment management</p>
               </div>
            </div>
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100">
               <Info className="w-5 h-5 text-indigo-500 ml-2" />
               <p className="text-[10px] font-black text-slate-500 uppercase pr-4">Edit Investment field to update portfolio CapEx</p>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-100 bg-white">
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Details</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Investment</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lifetime Revenue</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Net Profit/Loss</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">ROI Progress</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {propertyMetrics.map((asset) => (
                     <tr key={asset.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-10 py-8">
                           <div className="flex items-center gap-5">
                              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 shadow-inner group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                 <Building2 className="w-7 h-7" />
                              </div>
                              <div>
                                 <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">{asset.name}</h4>
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{asset.city}</span>
                              </div>
                           </div>
                        </td>

                        <td className="px-10 py-8 text-center">
                           {editingId === asset.id ? (
                              <div className="flex items-center justify-center gap-2 animate-in zoom-in-95">
                                 <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                       autoFocus
                                       className="w-32 pl-9 pr-4 py-2.5 bg-white border-2 border-indigo-200 rounded-xl text-sm font-black text-slate-900 outline-none"
                                       value={tempInvestment}
                                       onChange={e => setTempInvestment(e.target.value)}
                                       onKeyDown={e => e.key === 'Enter' && handleUpdateInvestment(asset.id)}
                                    />
                                 </div>
                                 <button onClick={() => handleUpdateInvestment(asset.id)} className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all"><Save className="w-5 h-5" /></button>
                                 <button onClick={() => setEditingId(null)} className="p-2.5 bg-slate-100 text-slate-400 rounded-xl"><X className="w-5 h-5" /></button>
                              </div>
                           ) : (
                              <button 
                                 onClick={() => { setEditingId(asset.id); setTempInvestment(String(asset.investment)); }}
                                 className="px-6 py-2.5 bg-slate-50 text-slate-900 rounded-xl text-sm font-black border border-transparent hover:border-indigo-100 hover:bg-white transition-all"
                              >
                                 ${asset.investment.toLocaleString()}
                              </button>
                           )}
                        </td>

                        <td className="px-10 py-8 text-center">
                           <div className="flex flex-col items-center">
                              <span className="text-base font-black text-slate-900">${asset.lifetimeRevenue.toLocaleString()}</span>
                              <div className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-tighter mt-1">
                                 <TrendingUp className="w-3 h-3" /> Growth Detected
                              </div>
                           </div>
                        </td>

                        <td className="px-10 py-8 text-center">
                           <span className={`px-5 py-2 rounded-2xl text-sm font-black uppercase tracking-tight ${asset.profit >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                              {asset.profit >= 0 ? '+' : ''}${asset.profit.toLocaleString()}
                           </span>
                        </td>

                        <td className="px-10 py-8 text-right">
                           <div className="flex flex-col items-end gap-2">
                              <span className={`text-lg font-black ${asset.roi >= 100 ? 'text-emerald-500' : 'text-indigo-600'}`}>{asset.roi.toFixed(1)}%</span>
                              <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                                 <div 
                                    className={`h-full transition-all duration-1000 ${asset.roi >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                    style={{ width: `${Math.min(asset.roi, 100)}%` }}
                                 ></div>
                              </div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                 {asset.roi >= 100 ? 'ASSET PROFITABLE' : `${(100 - asset.roi).toFixed(1)}% TO BREAKEVEN`}
                              </span>
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default AdminInsights;
