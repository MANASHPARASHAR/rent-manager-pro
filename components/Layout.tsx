
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
  ListChecks,
  Globe,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Bug,
  ChevronUp,
  ChevronDown,
  PieChart,
  ShieldAlert,
  Key,
  LogOut
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

interface LayoutProps { children: React.ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const store = useRentalStore();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [tempClientId, setTempClientId] = useState(store.googleClientId || '');
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(1);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  const isAdmin = store.user?.role === UserRole.ADMIN;
  const currentOrigin = window.location.origin;

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/properties', label: 'Properties', icon: Building2 },
    { path: '/collection', label: 'Collection', icon: CreditCard },
    { path: '/reports', label: 'Analytics', icon: PieChart },
    ...(isAdmin ? [{ path: '/types', label: 'Schemas', icon: Settings }] : []),
  ];

  const steps = [
    { id: 1, title: "Enable API Access", icon: Database, desc: "Enable 'Google Sheets API' & 'Google Drive API' in your Cloud Library.", link: "https://console.cloud.google.com/apis/library" },
    { id: 2, title: "Grant Permissions", icon: ShieldAlert, desc: "Add your email to 'Test Users' on the Consent Screen. Required for testing phase.", link: "https://console.cloud.google.com/apis/oauthconsent" },
    { id: 3, title: "Link Client ID", icon: Key, desc: "Create 'OAuth Web Application' credentials. Paste the resulting Client ID below.", link: "https://console.cloud.google.com/apis/credentials" }
  ];

  const handleConnect = async () => {
    if (!store.googleClientId) setIsSetupOpen(true);
    else await store.authenticate();
  };

  const handleSaveSetup = async () => {
    if (!tempClientId.trim()) return;
    store.updateClientId(tempClientId.trim());
    const success = await store.authenticate(tempClientId.trim());
    if (success) setIsSetupOpen(false);
  };

  const copyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans antialiased text-slate-900 overflow-x-hidden">
      {/* Cloud Integration Modal */}
      {isSetupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 bg-slate-900 text-white relative shrink-0">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="bg-indigo-600 p-2 rounded-xl"><Cloud className="w-6 h-6" /></div>
                       <div>
                          <h3 className="text-xl font-black uppercase tracking-tighter">Google Sheets Engine</h3>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Connect your private cloud database</p>
                       </div>
                    </div>
                    <button onClick={() => setIsSetupOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                       <X className="w-6 h-6 text-slate-500" />
                    </button>
                 </div>
              </div>
              
              <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                 {isInIframe && (
                   <div className="p-6 bg-amber-50 border-2 border-amber-200 rounded-3xl space-y-3 animate-pulse">
                      <div className="flex items-center gap-3 text-amber-700">
                         <Monitor className="w-6 h-6 shrink-0" />
                         <h4 className="font-black uppercase text-xs text-amber-900">Security Restriction</h4>
                      </div>
                      <p className="text-[10px] font-bold text-amber-600 leading-relaxed uppercase">
                        Google Auth will fail in an iframe. Open this app in a <strong>New Tab</strong> to use Google Sync.
                      </p>
                   </div>
                 )}

                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                       <ListChecks className="w-4 h-4" /> Setup Instructions
                    </div>
                    <button onClick={() => setShowTroubleshoot(!showTroubleshoot)} className="text-[9px] font-black text-rose-500 uppercase flex items-center gap-1">
                       <Bug className="w-3 h-3" /> Fix "Error 400"
                    </button>
                 </div>

                 <div className="space-y-3">
                    {steps.map((step) => (
                       <div key={step.id} className={`group border rounded-2xl transition-all ${activeStep === step.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
                          <button onClick={() => setActiveStep(activeStep === step.id ? null : step.id)} className="w-full flex items-center justify-between p-4 text-left">
                             <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${activeStep === step.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{step.id}</div>
                                <span className={`text-xs font-black uppercase tracking-widest ${activeStep === step.id ? 'text-indigo-900' : 'text-slate-600'}`}>{step.title}</span>
                             </div>
                             {activeStep === step.id ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                          </button>
                          {activeStep === step.id && (
                             <div className="px-16 pb-5 space-y-3 animate-in fade-in">
                                <p className="text-[11px] font-medium text-slate-600">{step.desc}</p>
                                <a href={step.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[9px] font-black text-indigo-600 uppercase hover:underline">Open Console <ExternalLink className="w-3 h-3" /></a>
                             </div>
                          )}
                       </div>
                    ))}
                 </div>

                 <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl space-y-4">
                    <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Your JavaScript Origin</label>
                    <div className="relative">
                       <div className="bg-white border border-emerald-200 p-4 rounded-2xl text-[10px] font-mono text-emerald-800 break-all">{currentOrigin}</div>
                       <button onClick={copyOrigin} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl transition-all">
                         {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                       </button>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">OAuth Client ID</label>
                    <div className="relative">
                       <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          placeholder="PASTE_YOUR_CLIENT_ID_HERE"
                          value={tempClientId}
                          onChange={e => setTempClientId(e.target.value)}
                       />
                    </div>
                    <button onClick={handleSaveSetup} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 transition-all">Link & Sync Google Sheets</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Sidebar UI */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-slate-950 text-white transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] transform border-r border-white/5 shadow-2xl ${isSidebarOpen ? 'w-72 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'} lg:sticky lg:h-screen`}>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`absolute -right-4 top-10 bg-indigo-600 text-white p-1.5 rounded-full shadow-2xl hover:bg-indigo-500 transition-all z-[60] hidden lg:flex items-center justify-center border-4 border-slate-50 ${!isSidebarOpen && 'rotate-180'}`}>
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className={`p-8 flex items-center justify-between transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl"><Building className="w-6 h-6 text-white" /></div>
            <div>
              <span className="text-xl font-black tracking-tighter uppercase leading-none block">Master</span>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Rental Pro</span>
            </div>
          </div>
        </div>

        <div className={`px-6 py-4 mb-6 transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
           <div className={`p-4 rounded-2xl border ${store.spreadsheetId ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-800 border-white/5'} transition-all`}>
              <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                    {store.spreadsheetId ? <Cloud className="w-4 h-4 text-emerald-400" /> : <CloudOff className="w-4 h-4 text-slate-500" />}
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cloud Status</span>
                 </div>
                 {store.isCloudSyncing && <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />}
              </div>
              <button 
                 onClick={handleConnect}
                 className={`w-full py-2 ${store.googleClientId ? 'bg-indigo-600' : 'bg-slate-700'} text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:opacity-80 transition-all`}
              >
                 {store.googleClientId ? (store.googleUser ? 'Connected' : 'Authorize') : 'Link Sheets'}
              </button>
           </div>
        </div>

        <nav className={`px-4 space-y-1.5 mt-2 ${isSidebarOpen ? '' : 'lg:px-2 flex flex-col items-center'}`}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                className={`flex items-center px-6 py-3.5 rounded-2xl transition-all duration-300 group ${isActive ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'} ${!isSidebarOpen ? 'px-0 w-12 h-12 justify-center' : 'justify-between'}`}
              >
                <div className="flex items-center gap-3.5">
                  <item.icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                  {isSidebarOpen && <span className="font-bold text-xs uppercase tracking-widest">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 lg:p-6">
          <button onClick={() => store.logout()} className={`bg-white/5 rounded-3xl border border-white/5 overflow-hidden transition-all flex items-center gap-3 w-full hover:bg-red-500/10 group ${isSidebarOpen ? 'p-5' : 'p-2 justify-center'}`}>
            <LogOut className={`w-5 h-5 text-slate-500 group-hover:text-red-400 transition-colors`} />
            {isSidebarOpen && <span className="text-[10px] font-black text-white uppercase tracking-widest group-hover:text-red-400">Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden min-h-screen flex flex-col">
        <div className="lg:hidden p-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-xl text-white"><Building className="w-5 h-5" /></div>
              <span className="font-black uppercase tracking-widest text-xs text-slate-900">RentMaster</span>
            </div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-950 text-white rounded-xl shadow-lg active:scale-95 transition-all"><Menu className="w-5 h-5" /></button>
        </div>
        <div className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
