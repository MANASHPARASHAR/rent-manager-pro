
import React, { useState } from 'react';
import { 
  Building, 
  ArrowRight, 
  AlertCircle, 
  Database, 
  Lock, 
  User as UserIcon,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';

const Login: React.FC = () => {
  const store = useRentalStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoCreds, setShowDemoCreds] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const success = await store.login(username.trim(), password);
      if (!success) {
        setError('Verification failed. Invalid credentials.');
      }
    } catch (err) {
      setError('An authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const onInputChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    if (error) setError(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Immersive Background Mesh */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[160px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[160px] pointer-events-none"></div>
      
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-700">
        
        {/* Left Side: Branding & Features */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white relative">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                <Building className="w-8 h-8" />
              </div>
              <span className="text-2xl font-black tracking-tighter uppercase">RentMaster Pro</span>
            </div>
            
            <h1 className="text-5xl font-black leading-tight mb-6 tracking-tighter uppercase">
              Manage your assets <br />
              <span className="text-indigo-200">with absolute precision.</span>
            </h1>
            
            <p className="text-indigo-100/70 text-lg font-medium max-w-md leading-relaxed">
              The world's most dynamic rental management engine. Customize schemas, automate collections, and scale effortlessly.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-6">
             <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-indigo-100/50">
               <Zap className="w-4 h-4 text-amber-300" /> Real-time Analytics
             </div>
             <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-indigo-100/50">
               <ShieldCheck className="w-4 h-4 text-emerald-300" /> Enterprise Security
             </div>
             <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-indigo-100/50">
               <Database className="w-4 h-4 text-indigo-300" /> Dynamic Schema
             </div>
             <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-indigo-100/50">
               <CheckCircle2 className="w-4 h-4 text-white" /> Automated Ledger
             </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="p-8 lg:p-16 flex flex-col justify-center bg-slate-900/40">
          <div className="mb-10">
            <h2 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">Welcome Back</h2>
            <p className="text-slate-400 font-medium">Please enter your workspace credentials.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-bold animate-in shake duration-300">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identity</label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-semibold"
                  placeholder="Username"
                  value={username}
                  onChange={e => onInputChange(setUsername, e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Key</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="password"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-semibold"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => onInputChange(setPassword, e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Authenticate Access <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Sandbox Credentials Collapsible */}
          <div className="mt-12 group/sandbox">
            <button 
              onClick={() => setShowDemoCreds(!showDemoCreds)}
              className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl transition-all hover:bg-white/10 group-active/sandbox:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sandbox Credentials</span>
              </div>
              {showDemoCreds ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            
            {showDemoCreds && (
              <div className="mt-2 p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <span className="text-[9px] font-bold text-indigo-300 uppercase">Administrator</span>
                    <code className="text-[10px] text-white font-mono bg-indigo-500/20 px-2 py-0.5 rounded">admin / admin123</code>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <span className="text-[9px] font-bold text-emerald-300 uppercase">Manager</span>
                    <code className="text-[10px] text-white font-mono bg-emerald-500/20 px-2 py-0.5 rounded">manager / manager123</code>
                  </div>
                </div>
                <p className="mt-4 text-[9px] text-center text-slate-600 font-bold uppercase tracking-tight">
                  Session data is stored in memory. Refreshing will reset the dashboard.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
