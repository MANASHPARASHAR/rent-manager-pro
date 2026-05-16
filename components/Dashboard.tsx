
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign,
  TrendingUp,
  Target,
  ArrowUpRight,
  User,
  Home,
  CheckCircle2,
  AlertCircle,
  Zap,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Fingerprint,
  Database,
  Plus,
  Filter,
  Users
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useRentalStore } from '../store/useRentalStore';
import { useLanguageStore } from '../lib/i18n';
import { PaymentStatus, UserRole, Payment, ColumnType, UnitHistory, User as UserType, Property } from '../types';

const Dashboard: React.FC = () => {
  const store = useRentalStore();
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const effectiveUser = store.effectiveUser;
  const isAdmin = store.user?.role === UserRole.ADMIN || 
                  store.user?.username?.toLowerCase().trim() === 'manashparashar9926@gmail.com';
  const effectiveIsAdmin = effectiveUser?.role === UserRole.ADMIN || 
                           effectiveUser?.username?.toLowerCase().trim() === 'manashparashar9926@gmail.com';
  
  const visibleProperties = useMemo(() => {
    return (store.properties || []).filter((p: Property) => {
      const lowerUsername = effectiveUser?.username?.toLowerCase().trim() || '';
      const userId = effectiveUser?.id || '';
      const allowed = (p.allowedUserIds || []).map(id => id.toLowerCase());
      
      const isActuallyAdmin = effectiveUser?.role === UserRole.ADMIN || 
                              effectiveUser?.username?.toLowerCase().trim() === 'manashparashar9926@gmail.com';

      return isActuallyAdmin || 
             (effectiveUser?.assignedPropertyIds || []).includes(p.id) ||
             allowed.includes(userId.toLowerCase()) ||
             allowed.includes(lowerUsername);
    });
  }, [store.properties, effectiveUser, effectiveIsAdmin]);

  const visiblePropertyIds = useMemo(() => visibleProperties.map((p: any) => p.id), [visibleProperties]);

  const managers = useMemo(() => {
    return (store.users || []).filter((u: UserType) => u.role === UserRole.MANAGER);
  }, [store.users]);

  const [currentMonthKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const stats = useMemo(() => {
    const records = store.records.filter((r: any) => visiblePropertyIds.includes(r.propertyId));
    const recordIds = records.map((r: any) => r.id);
    const types = store.propertyTypes;

    const [year, month] = currentMonthKey.split('-').map(Number);
    const contextDate = new Date(year, month, 0, 23, 59, 59);

    const rentColIds = types.flatMap(pt => pt.columns.filter(c => c.isRentCalculatable).map(c => c.id));
    const occupancyColIds = types.flatMap(pt => pt.columns.filter(c => c.type === ColumnType.OCCUPANCY_STATUS || (c.type === ColumnType.DROPDOWN && (c.name.toLowerCase().includes('status') || c.name.toLowerCase().includes('occupancy')))).map(c => c.id));

    let monthlyRentExpected = 0;
    let totalPotentialRent = 0;
    let heldDeposits = 0;
    let activeUnits = 0;
    let vacantUnits = 0;
    const overdueUnitsList: any[] = [];

    records.forEach(record => {
      const historicalState = store.unitHistory.find((h: UnitHistory) => {
        if (h.recordId !== record.id) return false;
        const from = new Date(h.effectiveFrom);
        const to = h.effectiveTo ? new Date(h.effectiveTo) : new Date(8640000000000000);
        return contextDate >= from && contextDate <= to;
      });

      const activeValues = historicalState?.values || store.recordValues.filter(v => v.recordId === record.id).reduce((acc: any, v) => ({...acc, [v.columnId]: v.value}), {});
      
      const pt = types.find(t => t.id === store.properties.find(p => p.id === record.propertyId)?.propertyTypeId);
      const depositColId = pt?.columns.find(c => c.type === ColumnType.SECURITY_DEPOSIT)?.id;
      
      const statusValue = Object.entries(activeValues).find(([cid]) => occupancyColIds.includes(cid))?.[1]?.toString().toLowerCase() || 'active';
      const isActive = statusValue === 'active' || statusValue === 'occupied';
      
      // Sum all rent-calculatable columns for this unit
      let unitRent = 0;
      Object.entries(activeValues).forEach(([cid, val]) => {
        if (rentColIds.includes(cid)) {
          unitRent += parseFloat(val?.toString() || '0') || 0;
        }
      });

      totalPotentialRent += unitRent;

      // Calculate Held Deposit for this unit (Sum includes negative refunds)
      const unitPayments = store.payments.filter(p => String(p.recordId) === String(record.id) && p.type === 'DEPOSIT');
      heldDeposits += unitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      if (isActive) {
        activeUnits++;
        monthlyRentExpected += unitRent;
        const isPaid = store.payments.some((p: Payment) => p.recordId === record.id && p.month === currentMonthKey && p.type === 'RENT' && p.status === PaymentStatus.PAID);
        if (!isPaid) {
          const property = store.properties.find((p: any) => p.id === record.propertyId);
          const tenantName = Object.entries(activeValues).find(([cid]) => {
            const col = types.find(t => t.id === property?.propertyTypeId)?.columns.find(c => c.id === cid);
            return col?.name.toLowerCase().includes('name');
          })?.[1]?.toString() || 'Unknown';
          
          overdueUnitsList.push({ id: record.id, amount: unitRent, propertyName: property?.name, tenant: tenantName });
        }
      } else if (statusValue && statusValue.includes('vacant')) {
        vacantUnits++;
      }
    });

    const collectedThisMonth = store.payments
      .filter((p: Payment) => recordIds.includes(p.recordId) && p.month === currentMonthKey && p.status === PaymentStatus.PAID && p.type === 'RENT')
      .reduce((sum: number, p: Payment) => sum + (Number(p.amount) || 0), 0);

    return {
      totalProperties: visiblePropertyIds.length,
      activeUnits, vacantUnits, monthlyRentExpected, totalPotentialRent,
      heldDeposits,
      monthlyTotalCollected: collectedThisMonth,
      overdueUnitsList: overdueUnitsList.sort((a,b) => b.amount - a.amount).slice(0, 5),
      collectionRate: monthlyRentExpected > 0 ? (collectedThisMonth / monthlyRentExpected) * 100 : 0,
      occupancyRate: (activeUnits + vacantUnits) > 0 ? (activeUnits / (activeUnits + vacantUnits)) * 100 : 0
    };
  }, [store, currentMonthKey, visiblePropertyIds]);

  const propertyChartData = useMemo(() => {
    return visibleProperties.slice(0, 6).map(p => {
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
        .reduce((sum: number, pay: any) => sum + (Number(pay.amount) || 0), 0);

      return {
        name: p.name.length > 10 ? p.name.substring(0, 8) + '..' : p.name,
        target, collected
      };
    });
  }, [store, currentMonthKey, visibleProperties]);

  const roleColors = {
    [UserRole.ADMIN]: 'bg-indigo-600 text-white',
    [UserRole.MANAGER]: 'bg-emerald-600 text-white',
    [UserRole.VIEWER]: 'bg-slate-700 text-white',
  };

  return (
    <div className="space-y-10 pb-20 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-3">
            <Zap className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-black">{t('settlement_pulse')}</span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
             <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
               {t('portfolio_intelligence').split(' ').map((word, i) => i === 1 ? <React.Fragment key={i}><br className="hidden md:block" /> {word}</React.Fragment> : <React.Fragment key={i}>{i > 0 ? ' ' : ''}{word}</React.Fragment>)}
             </h1>
          </div>
          
          <p className="text-slate-500 mt-6 font-medium text-base lg:text-lg max-w-xl">
             {t('real_time_oversight')} <span className="text-slate-900 font-black">{stats.totalProperties} {t('properties')}</span> {t('under_your_command')}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => navigate('/reports')}
            className="group bg-slate-950 text-white px-8 py-5 rounded-2xl flex items-center gap-3 hover:bg-slate-800 transition-all font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-slate-200"
          >
            {t('analytics_engine')} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </header>

      {visibleProperties.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center animate-in zoom-in-95 duration-500" id="empty-state">
           <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
              <Home className="w-10 h-10 text-slate-200" />
           </div>
           <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
             {store.impersonatedUser ? t('no_assigned_assets') : t('no_assets_detected')}
           </h2>
           <p className="text-slate-400 font-medium max-w-sm mx-auto mb-10 leading-relaxed">
             {store.impersonatedUser 
               ? t('no_assets_assigned_desc') 
               : t('empty_portfolio_desc')}
           </p>
           {isAdmin && !store.impersonatedUser && (
              <div className="flex flex-wrap justify-center gap-4">
                 <button onClick={() => navigate('/properties')} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all">
                    <Plus className="w-5 h-5" /> {t('initialize_first_property')}
                 </button>
              </div>
           )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: t('mtd_revenue'), val: `₹${stats.monthlyTotalCollected.toLocaleString()}`, sub: t('settled_this_month'), icon: DollarSign, color: 'bg-indigo-600' },
              { label: t('asset_load'), val: `${Math.round(stats.occupancyRate)}%`, sub: `${stats.activeUnits} ${t('units_occupied')}`, icon: Home, color: 'bg-emerald-600' },
              { label: t('portfolio_cap'), val: `₹${stats.totalPotentialRent.toLocaleString()}`, sub: t('total_capacity'), icon: Target, color: 'bg-slate-950' },
              { label: t('security_held'), val: `₹${stats.heldDeposits.toLocaleString()}`, sub: t('total_deposits'), icon: ShieldCheck, color: 'bg-indigo-100 !text-indigo-600' },
            ].map((item, i) => (
              <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:translate-y-[-2px] transition-all duration-300">
                <div className="flex justify-between items-start mb-6">
                  <div className={`${item.color} p-4 rounded-2xl text-white shadow-lg`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{item.val}</h3>
                <p className="text-[11px] text-slate-400 font-bold mt-2">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t('revenue_stream')}</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">{t('mtd_target_vs_collection')}</p>
                </div>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase"><div className="w-2.5 h-2.5 rounded-full bg-slate-100"></div> {t('target')}</div>
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div> {t('actual')}</div>
                </div>
              </div>
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propertyChartData} barGap={10}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} tickFormatter={v => `₹${v/1000}k`} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1rem', color: '#fff' }} />
                    <Bar dataKey="target" fill="#f1f5f9" radius={[8, 8, 0, 0]} barSize={25} />
                    <Bar dataKey="collected" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('overdue_units')}</h2>
                <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center"><AlertCircle className="w-6 h-6" /></div>
              </div>
              <div className="flex-1 space-y-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                {stats.overdueUnitsList.length > 0 ? stats.overdueUnitsList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] border border-transparent hover:bg-indigo-50 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-inner group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><User className="w-5 h-5" /></div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-black text-slate-900 uppercase truncate">{item.tenant}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">{item.propertyName}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-rose-600">₹{item.amount.toLocaleString()}</p>
                    </div>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-12">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-6" />
                    <p className="text-[10px] font-black uppercase tracking-widest">{t('everything_settled')}</p>
                  </div>
                )}
              </div>
              <button onClick={() => navigate('/collection')} className="w-full mt-8 py-5 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-2">
                {t('open_ledger')} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
