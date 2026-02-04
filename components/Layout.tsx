
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
  Cloud,
  Database,
  ExternalLink,
  Lock,
  ChevronLeft,
  PieChart,
  ShieldAlert,
  Key,
  LogOut,
  Info,
  ChevronUp,
  ChevronDown,
  Users,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Zap,
  CheckCircle
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

interface LayoutProps { children: React.ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const store = useRentalStore();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [tempClientId, setTempClientId] = useState(store.googleClientId || '');
  const [activeStep, setActiveStep] = useState<number | null>(1);

  const isAdmin = store.user?.role === UserRole.ADMIN;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/properties', label: 'Properties', icon: Building2 },
    { path: '/collection', label: 'Collection', icon: CreditCard },
    { path: '/reports', label: 'Analytics', icon: PieChart },
    ...(isAdmin ? [
      { path: '/team', label: 'Team', icon: Users },
      { path: '/types', label: 'Schemas', icon: Settings }
    ] : []),
  ];

  const handleConnect = async () => {
    if (!isAdmin) return;
    if (!store.googleClientId) setIsSetupOpen(true);
    else await store.authenticate();
  };

  const handleSaveSetup = async () => {
    if (!tempClientId.trim()) return;
    store.updateClientId(tempClientId.trim());
    const success = await store.authenticate(tempClientId.trim());
    if (success) setIsSetupOpen(false);
  };

  const isReauthNeeded = store.syncStatus === 'reauth';
  // ISSUE #1 FIX: Added strict check for Cloud Live status
  const isCloudActive = !!store.spreadsheetId && !!store.googleUser && store.syncStatus === 'synced';

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans antialiased text-slate-900 overflow-x-hidden">
      {/* SILENT REAUTH TRIGGER */}
      {isReauthNeeded && isAdmin && (
        <div className="fixed top-0 inset-x-0 z-[200] bg-indigo-600 text-white p-3 flex items-center justify-center gap-4 animate-in slide-in-from-top duration-500 shadow-2xl">
           <Zap className="w-5 h-5 text-amber-300 animate-pulse" />
           <p className="text-[10px] font-black uppercase tracking-widest">Cloud Session Expired. Data saving locally until re-authorized.</p>
           <button 
             onClick={handleConnect}
             className="bg-white text-indigo-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-50 transition-all active:scale-95 shadow-sm"
           >
             Quick Reconnect
           </button>
        </div>
      )}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[45] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {isSetupOpen && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-10 bg-slate-900 text-white relative">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <Cloud className="w-7 h-7 text-indigo-500" />
                       <h3 className="text-2xl font-black uppercase tracking-tight">One-Time Cloud Link</h3>
                    </div>
                    <button onClick={() => setIsSetupOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors text-slate-500"><X className="w-6 h-6" /></button>
                 </div>
              </div>
              
              <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
                 <div className="p-6 bg-indigo-50 rounded-3xl flex items-start gap-4">
                    <Info className="w-6 h-6 text-indigo-600 shrink-0" />
                    <p className="text-xs font-bold text-indigo-900 leading-relaxed uppercase tracking-tight">
                       Once linked, data syncs automatically in the background. No manual syncing required.
                    </p>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Google OAuth Client ID</label>
                    <div className="relative">
                       <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                       <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] pl-16 pr-8 py-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                          placeholder="Paste Client ID"
                          value={tempClientId}
                          onChange={e => setTempClientId(e.target.value)}
                       />
                    </div>
                    <button onClick={handleSaveSetup} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Initialize One-Time Sync</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-white transition-all duration-500 border-r border-white/5 shadow-2xl flex flex-col ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-24 -translate-x-full lg:translate-x-0'} lg:sticky lg:h-screen ${isReauthNeeded ? 'pt-16' : ''}`}>
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

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-8 pb-10">
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

          {/* ZERO-HEADACHE CLOUD STATUS */}
          {isSidebarOpen && (
             <div className="mx-2 mt-10 p-4 bg-slate-950/40 rounded-3xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   {store.isCloudSyncing ? (
                      <div className="relative">
                         <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping absolute inset-0"></div>
                         <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full relative"></div>
                      </div>
                   ) : (
                      <div className={`w-2.5 h-2.5 rounded-full ${isCloudActive ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                   )}
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {store.isCloudSyncing ? "Saving Live..." : isCloudActive ? "Cloud Live" : "Offline Cache"}
                   </span>
                </div>
                {isCloudActive && <CheckCircle className="w-3 h-3 text-emerald-500/50" />}
             </div>
          )}
        </div>

        <div className="p-8 shrink-0">
          <button onClick={() => store.logout()} className={`bg-white/5 rounded-[2.5rem] border border-white/5 flex items-center gap-4 w-full hover:bg-rose-500/10 transition-all group active:scale-95 ${isSidebarOpen ? 'p-6' : 'p-4 justify-center'}`}>
            <LogOut className="w-5 h-5 text-slate-500 group-hover:text-rose-400" />
            {isSidebarOpen && <span className="text-[10px] font-black text-white uppercase tracking-widest group-hover:text-rose-400">Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 overflow-x-hidden min-h-screen flex flex-col relative ${isReauthNeeded ? 'pt-16' : ''}`}>
        <div className="lg:hidden p-6 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><Building className="w-5 h-5" /></div>
              <span className="font-black uppercase tracking-tighter text-lg text-slate-900 leading-none">RentMaster</span>
            </div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-slate-950 text-white rounded-xl shadow-xl"><Menu className="w-6 h-6" /></button>
        </div>
        <div className="p-6 md:p-10 lg:p-14 max-w-[1500px] mx-auto w-full flex-1">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
