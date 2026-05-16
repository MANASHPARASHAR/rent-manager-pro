
import React, { useMemo, useState } from 'react';
import { 
  IndianRupee, 
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
  X,
  Users,
  Layers,
  Activity,
  Receipt
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, ComposedChart, Line, Area
} from 'recharts';
import { useRentalStore } from '../store/useRentalStore';
import { useLanguageStore } from '../lib/i18n';
import { PaymentStatus, UserRole, Property, User as UserType } from '../types';

const AdminInsights: React.FC = () => {
  const store = useRentalStore();
  const effectiveUser = store.effectiveUser;
  const SUPERADMIN_EMAIL = 'manashparashar9926@gmail.com';
  const isAdmin = store.user?.role === UserRole.ADMIN || 
                   store.user?.username?.toLowerCase().trim() === SUPERADMIN_EMAIL;
  const isManager = store.user?.role === UserRole.MANAGER;
  const effectiveIsAdmin = effectiveUser?.role === UserRole.ADMIN || 
                           effectiveUser?.username?.toLowerCase().trim() === SUPERADMIN_EMAIL;
  const effectiveIsManager = effectiveUser?.role === UserRole.MANAGER;
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempInvestment, setTempInvestment] = useState<string>('0');
  const { t } = useLanguageStore();
  
  // AUTHORIZATION GUARD: Real user must be admin/manager AND effective user must be admin/manager
  if (!isAdmin && !isManager) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-white rounded-[3rem] border border-gray-100 shadow-sm text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
           <ShieldCheck className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">{t('access_restricted')}</h2>
        <p className="text-slate-500 font-medium mt-3 max-w-sm">
           {t('restricted_dashboard_msg')}
        </p>
      </div>
    );
  }

  const visibleProperties = useMemo(() => {
    return store.properties.filter(p => {
      const lowerUsername = effectiveUser?.username?.toLowerCase().trim() || '';
      const lowerUserId = effectiveUser?.id?.toLowerCase() || '';
      return effectiveIsAdmin || 
             (effectiveUser?.assignedPropertyIds || []).includes(p.id) ||
             (p.allowedUserIds || []).some(id => id.toLowerCase() === lowerUserId) ||
             (p.allowedUserIds || []).some(id => id.toLowerCase() === lowerUsername);
    });
  }, [store.properties, effectiveUser, effectiveIsAdmin]);

  const propertyMetrics = useMemo(() => {
    return visibleProperties
      .map((p: Property) => {
        const records = store.records.filter((r: any) => r.propertyId === p.id);
        const recordIds = records.map((r: any) => r.id);
        
        const lifetimeRevenue = store.payments
          .filter((pay: any) => 
            recordIds.includes(pay.recordId) && 
            pay.status === PaymentStatus.PAID && 
            (pay.type === 'RENT' || pay.type === 'ELECTRICITY')
          )
          .reduce((sum: number, pay: any) => sum + (Number(pay.amount) || 0), 0);

        const totalExpenses = store.expenses
          .filter((exp: any) => exp.propertyId === p.id)
          .reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0);

        const investment = p.totalInvestment || 0;
        const netRevenue = lifetimeRevenue - totalExpenses;
        const profit = netRevenue - investment;
        const roi = investment > 0 ? (netRevenue / investment) * 100 : 0;
        const isBreakeven = netRevenue >= investment && investment > 0;

        return {
          ...p,
          lifetimeRevenue,
          totalExpenses,
          investment,
          netRevenue,
          profit,
          roi,
          isBreakeven
        };
      })
      .sort((a, b) => b.netRevenue - a.netRevenue);
  }, [store.properties, store.payments, store.records, store.expenses]);

  const portfolioStats = useMemo(() => {
    const totalRevenue = propertyMetrics.reduce((s, m) => s + m.lifetimeRevenue, 0);
    const totalExpenses = propertyMetrics.reduce((s, m) => s + m.totalExpenses, 0);
    const totalInvestment = propertyMetrics.reduce((s, m) => s + m.investment, 0);
    const netRevenue = totalRevenue - totalExpenses;
    const totalProfit = netRevenue - totalInvestment;
    const avgROI = totalInvestment > 0 ? (netRevenue / totalInvestment) * 100 : 0;

    return { totalRevenue, totalExpenses, totalInvestment, netRevenue, totalProfit, avgROI };
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
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-indigo-400">{t('owner_intelligence_hub')}</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">{t('capital_insights')}</h1>
          <p className="text-slate-500 mt-4 font-medium text-lg max-w-xl">
             {t('lifecycle_analysis')}
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
           <div className="px-8 py-4 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col justify-center h-16">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('focus_roi')}</span>
              <div className="flex items-center gap-3 leading-none">
                 <h3 className="text-2xl font-black text-slate-900 leading-none">{portfolioStats.avgROI.toFixed(1)}%</h3>
                 <div className={`p-1 rounded-lg ${portfolioStats.avgROI >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {portfolioStats.avgROI >= 100 ? <ShieldCheck className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                 </div>
              </div>
           </div>
           <button 
             onClick={() => window.print()}
             className="bg-slate-950 text-white px-8 h-16 rounded-[2rem] flex items-center gap-3 hover:bg-slate-800 transition-all font-black uppercase text-[10px] tracking-widest shadow-xl"
           >
             <TrendingUp className="w-4 h-4" /> {t('export_global_analysis')}
           </button>
        </div>
      </header>

      {/* SUMMARY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: t('aggregate_revenue'), val: `₹${portfolioStats.totalRevenue.toLocaleString()}`, sub: t('lifetime_collections'), icon: Coins, color: 'bg-indigo-600' },
          { label: t('operational_expenses'), val: `₹${portfolioStats.totalExpenses.toLocaleString()}`, sub: t('building_maintenance'), icon: Receipt, color: 'bg-rose-500' },
          { label: t('capital_outlay'), val: `₹${portfolioStats.totalInvestment.toLocaleString()}`, sub: t('invested_capex'), icon: Target, color: 'bg-slate-900' },
          { label: t('liquidity_position'), val: `₹${portfolioStats.totalProfit.toLocaleString()}`, sub: t('liquidity_formula'), icon: IndianRupee, color: portfolioStats.totalProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600' },
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
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('investment_recovery_gap')}</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">{t('comparison_revenue_capex')}</p>
               </div>
               <div className="flex gap-6">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><div className="w-3 h-3 rounded-full bg-slate-100"></div> {t('capital_outlay')}</div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-400"><div className="w-3 h-3 rounded-full bg-rose-400"></div> {t('expenses')}</div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-500"><div className="w-3 h-3 rounded-full bg-indigo-500"></div> {t('revenue')}</div>
               </div>
            </div>
            <div className="flex-1 h-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propertyMetrics} barGap={8}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} tickFormatter={v => `₹${v/1000}k`} />
                     <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1rem', color: '#fff' }} />
                     <Bar dataKey="investment" fill="#f1f5f9" radius={[6, 6, 0, 0]} barSize={20} />
                     <Bar dataKey="totalExpenses" fill="#fb7185" radius={[6, 6, 0, 0]} barSize={20} />
                     <Bar dataKey="lifetimeRevenue" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={20} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* BREAKEVEN ANALYSIS CARD */}
         <div className="xl:col-span-4 bg-slate-900 p-10 rounded-[3rem] shadow-2xl flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full"></div>
            <div className="relative z-10 flex flex-col h-full">
               <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-white/10 text-white rounded-2xl"><Activity className="w-6 h-6" /></div>
                  <div>
                     <h2 className="text-xl font-black text-white uppercase tracking-tight">{t('breakeven_engine')}</h2>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{t('asset_lifecycle_tracking')}</p>
                  </div>
               </div>
               
               {/* TOTAL PORTFOLIO BREAKEVEN */}
               <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 mb-8">
                  <div className="flex justify-between items-end mb-6">
                     <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('portfolio_aggregate')}</p>
                        <h3 className="text-2xl font-black text-white leading-none">{t('total_recovery')}</h3>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t('portfolio_roi')}</p>
                        <h4 className="text-2xl font-black text-indigo-400 leading-none">{portfolioStats.avgROI.toFixed(1)}%</h4>
                     </div>
                  </div>
                  
                  <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-1">
                     <div 
                        className={`h-full rounded-full transition-all duration-1000 ${portfolioStats.avgROI >= 100 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-indigo-500'}`} 
                        style={{ width: `${Math.min(portfolioStats.avgROI, 100)}%` }}
                     ></div>
                  </div>
                  <div className="flex justify-between mt-4">
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('capital_outlay')}: ₹{portfolioStats.totalInvestment.toLocaleString()}</span>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${portfolioStats.avgROI >= 100 ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {portfolioStats.avgROI >= 100 ? t('fully_recovered') : `${(100 - portfolioStats.avgROI).toFixed(1)}% ${t('remaining')}`}
                     </span>
                  </div>
               </div>

               {/* PROPERTY WISE PROGRESS */}
               <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 max-h-[350px]">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Individual Asset Status</p>
                  {propertyMetrics.map((asset) => (
                     <div key={asset.id} className="p-5 rounded-3xl bg-white/5 border border-white/5 flex flex-col gap-3 group hover:bg-white/10 transition-colors">
                        <div className="flex justify-between items-start">
                           <div className="flex items-center gap-3">
                              <Building2 className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[120px]">{asset.name}</span>
                           </div>
                           <span className={`text-[10px] font-black uppercase tracking-tighter ${asset.roi >= 100 ? 'text-emerald-400' : 'text-indigo-400'}`}>
                              {asset.roi.toFixed(0)}%
                           </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                           <div 
                              className={`h-full rounded-full transition-all duration-1000 ${asset.roi >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                              style={{ width: `${Math.min(asset.roi, 100)}%` }}
                           ></div>
                        </div>
                        {asset.roi >= 100 && (
                           <div className="flex items-center gap-1.5 text-[8px] font-black text-emerald-500/80 uppercase tracking-widest mt-1">
                              <TrendingUp className="w-2.5 h-2.5" /> {t('surplus')}: ₹{asset.profit.toLocaleString()}
                           </div>
                        )}
                     </div>
                  ))}
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
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('capex_yield_inventory')}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('investment_management')}</p>
               </div>
            </div>
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100">
               <Info className="w-5 h-5 text-indigo-500 ml-2" />
               <p className="text-[10px] font-black text-slate-500 uppercase pr-4">{t('edit_investment_help')}</p>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-white">
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('asset_details')}</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('total_capex')}</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('revenue')}</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('expenses')}</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('net_position')}</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('roi_progress')}</th>
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
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                                 ₹{asset.investment.toLocaleString()}
                              </button>
                           )}
                        </td>

                        <td className="px-10 py-8 text-center text-sm font-black text-slate-900">
                           ₹{asset.lifetimeRevenue.toLocaleString()}
                        </td>

                        <td className="px-10 py-8 text-center">
                           <div className="flex flex-col items-center">
                              <span className="text-base font-black text-rose-600">₹{asset.totalExpenses.toLocaleString()}</span>
                           </div>
                        </td>

                        <td className="px-10 py-8 text-center">
                           <span className={`px-5 py-2 rounded-2xl text-sm font-black uppercase tracking-tight ${asset.profit >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                              {asset.profit >= 0 ? '+' : ''}₹{asset.profit.toLocaleString()}
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
                                 {asset.roi >= 100 ? t('asset_profitable') : `${(100 - asset.roi).toFixed(1)}% ${t('to_breakeven')}`}
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
