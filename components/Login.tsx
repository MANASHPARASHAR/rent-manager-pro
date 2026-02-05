
import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Lock, 
  Fingerprint, 
  Loader2, 
  ArrowRightCircle,
  AlertCircle,
  ShieldCheck,
  Zap,
  Shield,
  Database,
  ArrowRight,
  Key
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

type LoginView = 'LOGIN' | 'CHOICE' | 'SETUP_CONFIG' | 'SETUP_CONNECT' | 'SETUP_PASSWORD' | 'FINALIZING';

const Login: React.FC = () => {
  const store = useRentalStore();
  const [view, setView] = useState<LoginView>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const hasUsers = store.users && store.users.length > 0;
  const isCloudConfigured = !!store.spreadsheetId;
  const isSystemInitialized = hasUsers || isCloudConfigured;

  // SECURITY LOCK: If system has users, force LOGIN view and never allow SETUP
  useEffect(() => {
    if (!store.isBooting) {
      if (isSystemInitialized) {
        setView('LOGIN');
      } else {
        setView('CHOICE');
      }
    }
  }, [isSystemInitialized, store.isBooting]);

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
                 Syncing Security Core...
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
      const success = await store.login(username.trim(), password);
      if (!success) {
        setError('Invalid credentials. Access Denied.');
      }
    } catch (err) {
      setError('An authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloudConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const clientId = store.googleClientId;
      const result: any = await store.authenticate(clientId, true);
      if (result && !result.error) {
        setView('SETUP_PASSWORD');
      } else if (result?.error === 'UNAUTHORIZED_EMAIL') {
        setError("Unauthorized Gmail detected. System Locked.");
      } else {
        setError("Cloud handshake failed.");
      }
    } catch (err) {
      setError("Sync connection error.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderLogin = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
           <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
           <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
              Live Connection
           </span>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
           <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Master Key Valid</span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Authentication</h2>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Enter credentials to access the ledger</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {error && <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-center gap-4 text-red-400 text-xs font-black uppercase tracking-widest animate-in shake"><AlertCircle className="w-6 h-6 shrink-0" />{error}</div>}
        
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Team ID (Email)</label>
          <div className="relative group">
            <Fingerprint className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
            <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-4 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold" placeholder="your@email.com" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Token</label>
          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
            <input type="password" required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-4 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 group">
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Access Dashboard <ArrowRightCircle className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
        </button>
      </form>

      <div className="p-6 bg-white/5 border border-white/10 rounded-3xl flex items-center gap-4">
         <Database className="w-5 h-5 text-indigo-400" />
         <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed tracking-wider">
            Enterprise database is linked to your Master Client ID. Setup mode is permanently disabled.
         </p>
      </div>
    </div>
  );

  const renderChoice = () => (
    <div className="space-y-12 animate-in fade-in zoom-in-95 duration-700">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest mb-2">
           <Zap className="w-3.5 h-3.5" /> Genesis Protocol
        </div>
        <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none">System <br/> Deployment</h2>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Connect your Client ID to initialize the secure ledger</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <button 
          onClick={() => setView('SETUP_CONFIG')}
          className="group relative bg-white/5 border border-white/10 p-12 rounded-[3rem] text-center hover:bg-indigo-600/10 hover:border-indigo-500/50 transition-all duration-500"
        >
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
             <Key className="w-8 h-8" />
          </div>
          <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Initialize Core</h3>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Enter the System Client ID to link your Google infrastructure.</p>
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
            Deploy Now <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );

  const renderSetupConfig = () => (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
       <button onClick={() => setView('CHOICE')} className="text-[10px] font-black text-slate-500 uppercase hover:text-white flex items-center gap-2">
         <ArrowRight className="w-3 h-3 rotate-180" /> Cancel
       </button>
       <div className="space-y-2">
          <h3 className="text-3xl font-black text-white uppercase tracking-tight">System Key</h3>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Paste your Master Google OAuth Client ID</p>
       </div>
       <div className="space-y-4">
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="0000000-xxxx.apps.googleusercontent.com"
            value={username} 
            onChange={e => setUsername(e.target.value)}
          />
          <button 
            onClick={() => { store.updateClientId(username.trim()); setView('SETUP_CONNECT'); }}
            className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl active:scale-95 transition-all"
          >
            Authorize System Key
          </button>
       </div>
    </div>
  );

  const renderSetupConnect = () => (
    <div className="text-center space-y-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-emerald-500/10 p-10 rounded-[4rem] border border-emerald-500/20 inline-block">
        <ShieldCheck className="w-16 h-16 text-emerald-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-3xl font-black text-white uppercase tracking-tight">Ownership</h3>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Connect the Master Super-Admin Account</p>
      </div>
      <button onClick={handleCloudConnect} disabled={isLoading} className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95">
        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><ShieldCheck className="w-6 h-6" /> Authenticate Master Owner</>}
      </button>
      {error && <p className="text-red-500 text-xs font-black uppercase">{error}</p>}
    </div>
  );

  const renderSetupPassword = () => (
    <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
      <div className="p-8 bg-indigo-600 rounded-[3rem] text-white">
         <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Secure the Vault</h3>
         <p className="text-indigo-100 text-xs font-medium uppercase tracking-widest leading-relaxed">System Key linked. Now set your unique access password to lock the dashboard.</p>
      </div>
      <div className="space-y-6">
         <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Master Password</label>
            <input type="password" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold" placeholder="6+ characters" value={password} onChange={e => setPassword(e.target.value)} />
         </div>
         <button onClick={async () => {
            if (!password || password.length < 6) { setError("Min 6 chars."); return; }
            setIsLoading(true); setView('FINALIZING');
            try {
              const uInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${store.googleUser.access_token}` } }).then(res => res.json());
              const newUser = { id: 'u-admin-' + Date.now(), username: uInfo.email.toLowerCase(), name: uInfo.name || 'Super Admin', role: UserRole.ADMIN, passwordHash: password, createdAt: new Date().toISOString() };
              await store.addUser(newUser, true);
            } catch (err) { setView('SETUP_PASSWORD'); setError("Deployment failed."); } finally { setIsLoading(false); }
         }} disabled={isLoading} className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl">
           Lock & Initialize
         </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none animate-pulse"></div>
      
      <div className={`w-full ${view === 'LOGIN' ? 'max-w-5xl' : 'max-w-6xl'} grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[4rem] shadow-[0_0_120px_rgba(0,0,0,0.6)] overflow-hidden relative z-10 animate-in fade-in duration-1000`}>
        <div className={`hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-indigo-600 to-indigo-900 text-white relative lg:col-span-5`}>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-16">
              <div className="bg-white/20 p-3 rounded-2xl border border-white/10 shadow-lg"><Building className="w-8 h-8" /></div>
              <span className="text-2xl font-black tracking-tighter uppercase leading-none">RentMaster<br/><span className="text-indigo-400 text-sm">Enterprise</span></span>
            </div>
            <h1 className="text-6xl font-black leading-[0.9] mb-8 tracking-tighter uppercase">Security <br/> Master <br/> Vault</h1>
            <p className="text-indigo-100/60 text-lg font-medium max-w-xs leading-relaxed">Protected with encrypted system keys and owner-only access.</p>
          </div>
        </div>
        <div className="lg:col-span-7 p-10 lg:p-20 flex flex-col justify-center bg-slate-900/40 min-h-[650px]">
          {view === 'LOGIN' && renderLogin()}
          {view === 'CHOICE' && renderChoice()}
          {view === 'SETUP_CONFIG' && renderSetupConfig()}
          {view === 'SETUP_CONNECT' && renderSetupConnect()}
          {view === 'SETUP_PASSWORD' && renderSetupPassword()}
          {view === 'FINALIZING' && (
            <div className="text-center space-y-10 py-10">
               <Loader2 className="w-24 h-24 text-indigo-500 animate-spin mx-auto" />
               <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Initializing Assets...</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
