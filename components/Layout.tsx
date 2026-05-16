
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Settings, 
  Menu,
  X,
  Building,
  CreditCard,
  ChevronLeft,
  PieChart,
  LogOut,
  Users,
  BarChart3,
  Loader2,
  Receipt
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';
import AdminUserFilter from './AdminUserFilter';
import NotificationCenter from './NotificationCenter';

import { useLanguageStore } from '../lib/i18n';

interface LayoutProps { children: React.ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const store = useRentalStore();
  const { language, setLanguage, t } = useLanguageStore();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const isAdmin = store.user?.role === UserRole.ADMIN || 
                  store.user?.username?.toLowerCase().trim() === 'manashparashar9926@gmail.com';
  const isManager = store.user?.role === UserRole.MANAGER;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { path: '/', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/properties', label: t('properties'), icon: Building2 },
    { path: '/collection', label: t('rent_collection'), icon: CreditCard },
    { path: '/expenses', label: t('expenses'), icon: Receipt },
    { path: '/reports', label: t('reports'), icon: PieChart },
    ...(isAdmin ? [
      { path: '/insights', label: t('insights'), icon: BarChart3 },
      { path: '/team', label: t('user_management'), icon: Users },
      { path: '/types', label: t('settings'), icon: Settings }
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans antialiased text-slate-900 overflow-x-hidden">
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[45] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-white transition-all duration-500 border-r border-white/5 shadow-2xl flex flex-col ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-24 -translate-x-full lg:translate-x-0'} lg:sticky lg:h-screen`}>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`absolute -right-4 top-12 bg-indigo-600 text-white p-2.5 rounded-full shadow-2xl hover:bg-indigo-500 transition-all hidden lg:flex items-center justify-center border-4 border-slate-50 ${!isSidebarOpen && 'rotate-180'}`}>
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className={`p-10 flex items-center justify-between shrink-0 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-600/20"><Building className="w-7 h-7" /></div>
              <div>
                <span className="text-2xl font-black tracking-tighter uppercase leading-none block">Master</span>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] block mt-1">Rental Pro</span>
              </div>
            </div>
        </div>

        <div className="flex-1 px-6 space-y-8 pb-10 overflow-y-auto custom-scrollbar">
          <nav className={`space-y-2 ${!isSidebarOpen && 'flex flex-col items-center px-0'}`}>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-6 py-4 rounded-2xl transition-all group ${isActive ? 'bg-white/10 text-white shadow-xl' : 'text-slate-400 hover:bg-white/5 hover:text-white'} ${!isSidebarOpen ? 'w-14 h-14 justify-center px-0' : 'justify-between'}`}
                >
                  <div className="flex items-center gap-4">
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                    {isSidebarOpen && <span className="font-bold text-xs uppercase tracking-widest">{item.label}</span>}
                  </div>
                </Link>
              );
            })}
          </nav>

          {isSidebarOpen && (
             <div className="mx-2 mt-10 p-5 bg-slate-950/60 rounded-3xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse absolute inset-0"></div>
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full relative"></div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                         {t('cloud_linked')}
                      </span>
                   </div>
                </div>
                
                <div className="flex flex-col gap-1 border-t border-white/5 pt-3">
                   <p className="text-[8px] font-bold text-slate-500 uppercase leading-relaxed mt-1">
                      {t('sync_desc')}
                   </p>
                </div>
             </div>
          )}
        </div>

        <div className="p-8 shrink-0">
          <div className="mb-4 px-4 bg-white/5 p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-black">
                {store.user?.name?.charAt(0)}
              </div>
              {isSidebarOpen && (
                <div className="overflow-hidden">
                  <p className="text-[10px] font-black uppercase tracking-tighter truncate">{store.user?.name}</p>
                  <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">{store.user?.role}</p>
                </div>
              )}
            </div>
          </div>
          <button onClick={() => store.logout()} className={`bg-white/5 rounded-[2.5rem] border border-white/5 flex items-center gap-4 w-full hover:bg-rose-500/10 transition-all group active:scale-95 ${isSidebarOpen ? 'p-6' : 'p-4 justify-center'}`}>
            <LogOut className="w-5 h-5 text-slate-500 group-hover:text-rose-400" />
            {isSidebarOpen && <span className="text-[10px] font-black text-white uppercase tracking-widest group-hover:text-rose-400">{t('logout')}</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 overflow-x-hidden min-h-screen flex flex-col relative`}>
        <div className="lg:hidden p-6 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><Building className="w-5 h-5" /></div>
              <span className="font-black uppercase tracking-tighter text-lg text-slate-900 leading-none">RentMaster</span>
            </div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-slate-950 text-white rounded-xl shadow-xl"><Menu className="w-6 h-6" /></button>
        </div>
        
        <div className="p-6 md:p-10 lg:p-14 max-w-[1500px] mx-auto w-full flex-1">
          <div className="mb-10 flex justify-end items-center gap-6">
            <button 
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="group relative flex items-center gap-3 bg-white border border-slate-200 rounded-full px-5 py-2.5 shadow-sm hover:shadow-md transition-all active:scale-95"
            >
               <span className={`text-[10px] font-black uppercase tracking-widest ${language === 'en' ? 'text-indigo-600' : 'text-slate-400'}`}>EN</span>
               <div className="w-10 h-5 bg-slate-100 rounded-full relative p-1 border border-slate-200">
                  <div className={`absolute top-1 bottom-1 w-3 h-3 bg-indigo-600 rounded-full transition-all duration-300 ${language === 'en' ? 'left-1' : 'left-6'}`}></div>
               </div>
               <span className={`text-[10px] font-black uppercase tracking-widest ${language === 'hi' ? 'text-indigo-600' : 'text-slate-400'}`}>HI</span>
            </button>
            <NotificationCenter />
            {isAdmin && !['/properties', '/insights', '/team', '/types'].some(path => location.pathname.startsWith(path)) && (
              <AdminUserFilter />
            )}
          </div>
          {children}
        </div>

        {store.isSyncing && (
          <div className="fixed bottom-10 right-10 z-[200] bg-slate-900 border border-white/10 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('syncing_cloud')}</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;
