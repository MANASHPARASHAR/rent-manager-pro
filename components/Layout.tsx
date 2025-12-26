
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Settings, 
  Menu,
  X,
  Building,
  CreditCard,
  Shield,
  User,
  Eye,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

interface LayoutProps { children: React.ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const store = useRentalStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const isAdmin = store.user?.role === UserRole.ADMIN;

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Building2, label: 'Properties', path: '/properties' },
    { icon: CreditCard, label: 'Rent Collection', path: '/collection' },
    ...(isAdmin ? [{ icon: Settings, label: 'Property Types', path: '/types' }] : []),
  ];

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return <Shield className="w-4 h-4" />;
      case UserRole.MANAGER: return <User className="w-4 h-4" />;
      case UserRole.VIEWER: return <Eye className="w-4 h-4" />;
      default: return null;
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'text-indigo-400 bg-indigo-400/10';
      case UserRole.MANAGER: return 'text-emerald-400 bg-emerald-400/10';
      case UserRole.VIEWER: return 'text-slate-400 bg-slate-400/10';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans antialiased text-slate-900 overflow-x-hidden">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-slate-950 text-white transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] transform border-r border-white/5 shadow-2xl
        ${isSidebarOpen ? 'w-72 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'}
        lg:sticky lg:h-screen
      `}>
        {/* Toggle Button for Desktop */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`
            absolute -right-4 top-10 bg-indigo-600 text-white p-1.5 rounded-full shadow-2xl hover:bg-indigo-500 transition-all z-[60] group active:scale-90 hidden lg:flex items-center justify-center border-4 border-slate-50
            ${!isSidebarOpen && 'rotate-180'}
          `}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className={`p-8 flex items-center justify-between transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-600/30">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tighter uppercase leading-none block">Master</span>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] block">Rental Pro</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 lg:hidden text-slate-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mini Logo for collapsed state */}
        {!isSidebarOpen && (
          <div className="hidden lg:flex flex-col items-center pt-10 gap-8">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg">
              <Building className="w-5 h-5 text-white" />
            </div>
          </div>
        )}

        <nav className={`px-4 space-y-1.5 mt-6 ${isSidebarOpen ? '' : 'lg:px-2 flex flex-col items-center'}`}>
          {isSidebarOpen && <p className="px-6 text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Workspace</p>}
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                className={`
                  flex items-center px-6 py-3.5 rounded-2xl transition-all duration-300 group
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }
                  ${!isSidebarOpen ? 'px-0 w-12 h-12 justify-center' : 'justify-between'}
                `}
              >
                <div className="flex items-center gap-3.5">
                  <item.icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                  {isSidebarOpen && <span className="font-bold text-xs uppercase tracking-widest">{item.label}</span>}
                </div>
                {isActive && isSidebarOpen && <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.8)]"></div>}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 lg:p-6">
          <div className={`bg-white/5 rounded-3xl border border-white/5 overflow-hidden transition-all ${isSidebarOpen ? 'p-5' : 'p-2 flex flex-col items-center'}`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white shadow-lg flex-shrink-0 ${isSidebarOpen ? 'w-10 h-10 text-base' : 'w-10 h-10 text-xs'}`}>
                {store.user?.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              {isSidebarOpen && (
                <div className="overflow-hidden flex-1">
                  <p className="text-xs font-black truncate text-white uppercase">{store.user?.name}</p>
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase mt-1 ${getRoleColor(store.user?.role as UserRole)}`}>
                    {getRoleIcon(store.user?.role as UserRole)}
                    {store.user?.role}
                  </div>
                </div>
              )}
              {isSidebarOpen && (
                <button onClick={() => store.logout()} className="p-2 text-slate-500 hover:text-red-400 transition-all hover:scale-110" title="Sign Out">
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
            {!isSidebarOpen && (
              <button onClick={() => store.logout()} className="mt-4 p-2 text-slate-500 hover:text-red-400 transition-all" title="Sign Out">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden min-h-screen flex flex-col">
        {/* Mobile Header Toggle */}
        <div className="lg:hidden p-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-xl text-white">
                <Building className="w-5 h-5" />
              </div>
              <span className="font-black uppercase tracking-widest text-xs text-slate-900">RentMaster</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="p-2.5 bg-slate-950 text-white rounded-xl shadow-lg active:scale-95 transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
        </div>
        
        <div className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-700">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
