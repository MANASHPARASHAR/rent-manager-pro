
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, 
  ArrowRight, 
  AlertCircle, 
  Lock, 
  User as UserIcon,
  ShieldCheck,
  Zap,
  Fingerprint,
  UserPlus,
  Loader2,
  Cloud,
  ShieldAlert,
  Key
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

const Login: React.FC = () => {
  const store = useRentalStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hasUsers = store.users && store.users.length > 0;
  const isCloudAuthorized = !!store.googleUser;
  const isCloudConfigured = !!store.googleClientId;

  // Genesis Mode: Only active if absolutely no users exist in the directory
  const isInitializing = useMemo(() => !hasUsers, [hasUsers]);

  const isCloudAuthRequired = useMemo(() => {
    return !hasUsers && isCloudConfigured && !isCloudAuthorized;
  }, [hasUsers, isCloudConfigured, isCloudAuthorized]);

  // Auto-trigger Cloud Auth attempt if configured but not authorized
  useEffect(() => {
    if (!hasUsers && isCloudConfigured && !isCloudAuthorized && !isLoading && store.spreadsheetId) {
      handleCloudAuthorize(true);
    }
  }, [hasUsers, isCloudConfigured, isCloudAuthorized, store.spreadsheetId]);

  if (store.isBooting) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[160px] pointer-events-none"></div>
        <div className="relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-700">
           <div className="bg-white/5 p-6 rounded-[2.5rem] backdrop-blur-3xl border border-white/10 inline-block">
              <Building className="w-16 h-16 text-indigo-500 animate-pulse" />
           </div>
           <div className="space-y-3">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">RentMaster Pro</h2>
              <div className="flex items-center justify-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
                 <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> 
                 Syncing Workspace...
              </div>
           </div>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isInitializing) {
        // Genesis Mode: Validation for first admin
        if (!/^[A-Za-z\s]+$/.test(name)) {
          setError("Name must contain only alphabets and spaces");
          setIsLoading(false);
          return;
        }

        const newUser = {
          id: 'u-' + Math.random().toString(36).substr(2, 9),
          username: username.trim().toLowerCase(),
          name: name.trim() || 'Admin User',
          role: UserRole.ADMIN,
          passwordHash: password,
          createdAt: new Date().toISOString()
        };
        await store.addUser(newUser, true);
      } else {
        const success = await store.login(username.trim(), password);
        if (!success) {
          setError('Invalid credentials. Access denied.');
        }
      }
    } catch (err) {
      setError('An authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloudAuthorize = async (silent: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
        await store.authenticate(undefined, silent);
    } catch (err) {
        if (!silent) setError("Could not connect to Cloud. Check Client ID.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[160px] pointer-events-none animate-pulse"></div>
      
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-700">
        
        <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                <Building className="w-8 h-8" />
              </div>
              <span className="text-2xl font-black tracking-tighter uppercase">RentMaster Pro</span>
            </div>
            
            <h1 className="text-5xl font-black leading-tight mb-6 tracking-tighter uppercase">
              {isInitializing ? "Genesis <br/> Setup" : "Secure <br/> Portal"}
            </h1>
            
            <p className="text-indigo-100/70 text-lg font-medium max-w-md leading-relaxed">
              {isInitializing 
                ? "Your local directory is empty. Create the primary administrator account to begin." 
                : "Enter your secure credentials to manage your rental portfolio assets."}
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-6">
             <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-indigo-100/80">
               <Zap className="w-4 h-4 text-amber-300" /> Auto-Cloud Sync
             </div>
             <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-indigo-100/80">
               <ShieldCheck className="w-4 h-4 text-emerald-300" /> AES-256 Vault
             </div>
          </div>
        </div>

        <div className="p-8 lg:p-16 flex flex-col justify-center bg-slate-900/40">
          <div className="mb-10">
            <h2 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">
              {isInitializing ? "Root Access" : "Verify Identity"}
            </h2>
            <p className="text-slate-400 font-medium">
              {isInitializing ? "Configure the first user for this instance." : "Enter your access keys to continue."}
            </p>
          </div>

          <div className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-bold animate-in shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {isCloudAuthRequired ? (
              <div className="space-y-8 animate-in slide-in-from-bottom-4">
                 <div className="p-6 bg-indigo-600/10 border border-indigo-600/20 rounded-3xl space-y-4 text-center">
                    <Cloud className="w-10 h-10 text-indigo-400 mx-auto" />
                    <p className="text-slate-400 text-xs font-medium leading-relaxed">
                       Cloud database detected. Authorize to recover your team and properties.
                    </p>
                 </div>
                 <button 
                    onClick={() => handleCloudAuthorize(false)}
                    disabled={isLoading}
                    className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                 >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Key className="w-5 h-5" /> Sync Cloud Data</>}
                 </button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                {isInitializing && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="text"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-semibold"
                        placeholder="John Doe"
                        value={name}
                        onChange={e => setName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                  <div className="relative group">
                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="text"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-semibold"
                      placeholder="admin"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="password"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-semibold"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className={`w-full ${isInitializing ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'} text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 group`}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {isInitializing ? "Initialize Workspace" : "Identify Session"} 
                      {isInitializing ? <UserPlus className="w-5 h-5" /> : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
          
          <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${store.syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Cloud: {store.syncStatus === 'synced' ? "Sync Ready" : "Local Cache"}
                </span>
             </div>
             {isInitializing && (
               <div className="flex items-center gap-1.5 text-indigo-400">
                  <ShieldAlert className="w-3 h-3" />
                  <span className="text-[8px] font-black uppercase">Admin First Setup</span>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
