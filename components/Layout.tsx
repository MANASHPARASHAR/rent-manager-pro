
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
  CloudOff,
  RefreshCw,
  Database,
  ExternalLink,
  Lock,
  Globe,
  Copy,
  Check,
  ChevronLeft,
  PieChart,
  ShieldAlert,
  Key,
  LogOut,
  AlertTriangle,
  Info,
  ChevronUp,
  ChevronDown,
  Users,
  Loader2,
  FileText,
  AlertCircle
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

  // Close sidebar on navigation on mobile
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

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

  const steps = [
    { id: 1, title: "Enable API Access", icon: Database, desc: "Enable 'Google Sheets API', 'Google Drive API' in your Cloud Library.", link: "https://console.cloud.google.com/apis/library" },
    { id: 2, title: "Grant Permissions", icon: ShieldAlert, desc: "Add your email to 'Test Users' on the Consent Screen. Required for testing phase.", link: "https://console.cloud.google.com/apis/oauthconsent" },
    { id: 3, title: "Link Client ID", icon: Key, desc: "Create 'OAuth Web Application' credentials. Paste the resulting Client ID below.", link: "https://console.cloud.google.com/apis/credentials" }
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

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans antialiased text-slate-900 overflow-x-hidden">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[45] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Cloud Setup Modal */}
      {isSetupOpen && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
              <div className="p-10 bg-slate-900 text-white relative">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="bg-indigo-600 p-3.5 rounded-2xl shadow-xl shadow-indigo-600/20"><Cloud className="w-7 h-7" /></div>
                       <div>
                          <h3 className="text-2xl font-black uppercase tracking-tight">Cloud Integration</h3>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Global Sync Logic</p>
                       </div>
                    </div>
                    <button onClick={() => setIsSetupOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors text-slate-500"><X className="w-6 h-6" /></button>
                 </div>
              </div>
              
              <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
                 <div className="p-6 bg-indigo-50 rounded-3xl flex items-start gap-4">
                    <Info className="w-6 h-6 text-indigo-600 shrink-0" />
                    <p className="text-xs font-bold text-indigo-900 leading-relaxed uppercase tracking-tight">
                       Cloud settings are shared. Once configured, all team members will sync to this database automatically.
                    </p>
                 </div>

                 <div className="space-y-4">
                    {steps.map((step) => (
                       <div key={step.id} className={`border rounded-[2rem] transition-all ${activeStep === step.id ? 'border-indigo-200 bg-indigo-50/20' : 'border-slate-100 bg-slate-50/50'}`}>
                          <button onClick={() => setActiveStep(activeStep === step.id ? null : step.id)} className="w-full flex items-center justify-between p-6">
                             <div className="flex items-center gap-5">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${activeStep === step.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{step.id}</div>
                                <span className={`text-xs font-black uppercase tracking-widest ${activeStep === step.id ? 'text-indigo-950' : 'text-slate-500'}`}>{step.title}</span>
                             </div>
                             {activeStep === step.id ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                          </button>
                          {activeStep === step.id && (
                             <div className="px-20 pb-8 space-y-4 animate-in slide-in-from-top-2">
                                <p className="text-[11px] font-medium text-slate-500">{step.desc}</p>
                                <a href={step.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase hover:underline">
                                   Open Google Console <ExternalLink className="w-4 h-4" />
                                </a>
                             </div>
                          )}
                       </div>
                    ))}
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Client Authorization ID</label>
                    <div className="relative">
                       <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                       <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] pl-16 pr-8 py-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          placeholder="Paste OAuth Client ID"
                          value={tempClientId}
                          onChange={e => setTempClientId(e.target.value)}
                       />
                    </div>
                    <button onClick={handleSaveSetup} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Initialize Connection</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Sidebar UI */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-white transition-all duration-500 border-r border-white/5 shadow-2xl flex flex-col ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-24 -translate-x-full lg:translate-x-0'} lg:sticky lg:h-screen`}>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`absolute -right-4 top-12 bg-indigo-600 text-white p-2.5 rounded-full shadow-2xl hover:bg-indigo-500 transition-all hidden lg:flex items-center justify-center border-4 border-slate-50 ${!isSidebarOpen && 'rotate-180'}`}>
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Sidebar Header */}
        <div className={`p-10 flex items-center justify-between shrink-0 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-600/20"><Building className="w-7 h-7" /></div>
              <div>
                <span className="text-2xl font-black tracking-tighter uppercase leading-none block">Master</span>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] block mt-1">Rental Pro</span>
              </div>
            </div>
            {/* Mobile Close Button */}
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-white/10 rounded-full transition-colors text-slate-500">
              <X className="w-6 h-6" />
            </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-8 pb-10">
          <div className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
             <div className={`p-5 rounded-[2rem] border ${store.googleUser && !store.cloudError ? 'bg-emerald-500/5 border-emerald-500/20' : store.cloudError ? 'bg-rose-500/5 border-rose-500/20' : 'bg-slate-800/50 border-white/5'} transition-all`}>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2">
                      {store.googleUser && !store.cloudError ? (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      ) : store.cloudError ? (
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                      )}
                      <span className={`text-[9px] font-black uppercase tracking-widest ${store.cloudError ? 'text-rose-400' : 'text-slate-400'}`}>
                        {store.googleUser && !store.cloudError ? "Cloud Active" : store.cloudError ? "Sync Error" : "Local Cache"}
                      </span>
                   </div>
                   {store.isCloudSyncing && <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />}
                </div>

                {store.spreadsheetName && (
                  <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
                    <FileText className="w-3 h-3 text-indigo-400" />
                    <span className="text-[9px] font-bold text-slate-300 truncate max-w-[150px]">{store.spreadsheetName}</span>
                  </div>
                )}

                {store.cloudError && (
                  <div className="mb-4 flex items-start gap-2 px-3 py-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                    <AlertCircle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                    <span className="text-[8px] font-bold text-rose-300 leading-tight">{store.cloudError}</span>
                  </div>
                )}

                {isAdmin && (
                  <button 
                    onClick={handleConnect}
                    className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      store.googleUser && !store.cloudError
                        ? 'bg-emerald-600/10 text-emerald-500 border border-emerald-500/20' 
                        : store.cloudError
                        ? 'bg-rose-600 text-white shadow-lg active:scale-95'
                        : 'bg-indigo-600 text-white shadow-lg active:scale-95'
                    }`}
                  >
                    {store.googleUser && !store.cloudError ? 'Session Verified' : store.cloudError ? 'Retry Sync' : 'Authorize Cloud'}
                  </button>
                )}
                {!isAdmin && !store.googleUser && (
                  <div className="text-[8px] font-black text-slate-500 uppercase tracking-tight text-center">
                    Offline mode • Syncing paused
                  </div>
                )}
             </div>
          </div>

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
        </div>

        {/* Sidebar Footer */}
        <div className="p-8 shrink-0">
          <button 
            onClick={() => store.logout()} 
            disabled={store.isCloudSyncing}
            className={`bg-white/5 rounded-[2.5rem] border border-white/5 flex items-center gap-4 w-full hover:bg-rose-500/10 transition-all group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isSidebarOpen ? 'p-6' : 'p-4 justify-center'}`}
          >
            {store.isCloudSyncing ? (
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            ) : (
              <LogOut className={`w-5 h-5 text-slate-500 group-hover:text-rose-400`} />
            )}
            {isSidebarOpen && (
              <span className="text-[10px] font-black text-white uppercase tracking-widest group-hover:text-rose-400">
                {store.isCloudSyncing ? "Syncing..." : "Sign Out"}
              </span>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden min-h-screen flex flex-col relative">
        <div className="lg:hidden p-6 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><Building className="w-5 h-5" /></div>
              <span className="font-black uppercase tracking-tighter text-lg text-slate-900 leading-none">RentMaster</span>
            </div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-slate-950 text-white rounded-xl shadow-xl active:scale-90 transition-all"><Menu className="w-6 h-6" /></button>
        </div>
        
        <div className="p-6 md:p-10 lg:p-14 max-w-[1500px] mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
