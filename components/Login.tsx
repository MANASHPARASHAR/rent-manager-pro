
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
  Shield
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

  // INITIAL STATE MANAGEMENT
  useEffect(() => {
    if (!store.isBooting) {
      if (!hasUsers && !isCloudConfigured) {
        setView('CHOICE'); // Fresh install: Show setup
      } else {
        setView('LOGIN'); // Live system: Strict login
      }
    }
  }, [hasUsers, isCloudConfigured, store.isBooting]);

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
        setError("This Gmail is not authorized.");
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
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
           <Shield className="w-3.5 h-3.5 text-indigo-400" />
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Identity Vault
           </span>
        </div>
        <span className="text-[9px] font-black text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-full uppercase tracking-widest">Locked</span>
      </div>

      <div className="space-y-2">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Authorization</h2>
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
         <ShieldCheck className="w-5 h-5 text-emerald-500" />
         <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed tracking-wider">
            Public Cloud Sync options are disabled for security. Login to manage connectivity.
         </p>
      </div>
    </div>
  );

  const renderChoice = () => (
    <div className="space-y-12 animate-in fade-in zoom-in-95 duration-700">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest mb-2">
           <Zap className="w-3.5 h-3.5" /> Initial Bootstrap Required
        </div>
        <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none">System <br/> Deployment</h2>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Connect your cloud account to initialize the ledger</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <button 
          onClick={() => setView('SETUP_CONFIG')}
          className="group relative bg-white/5 border border-white/10 p-12 rounded-[3rem] text-center hover:bg-indigo-600/10 hover:border-indigo-500/50 transition-all duration-500"
        >
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
             <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Initialize Security</h3>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Enter Google Client ID and Authenticate Super Admin.</p>
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
            Start Setup <ArrowRightCircle className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );

  const renderSetupConfig = () => (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
       <div className="space-y-2">
          <h3 className="text-3xl font-black text-white uppercase tracking-tight">Cloud Link</h3>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Paste your Google Cloud OAuth Client ID</p>
       </div>
       <div className="space-y-4">
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/10"
            placeholder="0000000-xxxx.apps.googleusercontent.com"
            value={username} // Reusing username field for temporary ID storage in setup
            onChange={e => setUsername(e.target.value)}
          />
          <button 
            onClick={() => { store.updateClientId(username.trim()); setView('SETUP_CONNECT'); }}
            className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl active:scale-95 transition-all"
          >
            Verify Infrastructure
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
        <h3 className="text-3xl font-black text-white uppercase tracking-tight">Handshake</h3>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Authenticate your Master Google account</p>
      </div>
      <button onClick={handleCloudConnect} disabled={isLoading} className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95">
        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><ShieldCheck className="w-6 h-6" /> Authenticate Super Admin</>}
      </button>
      {error && <p className="text-red-500 text-xs font-black uppercase">{error}</p>}
    </div>
  );

  const renderSetupPassword = () => (
    <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
      <div className="p-8 bg-indigo-600 rounded-[3rem] text-white">
         <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Secure the Vault</h3>
         <p className="text-indigo-100 text-xs font-medium uppercase tracking-widest leading-relaxed">Identity verified. Now set a local password to lock the dashboard.</p>
      </div>
      <div className="space-y-6">
         <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Master Password</label>
            <input type="password" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold" placeholder="6+ characters" value={password} onChange={e => setPassword(e.target.value)} />
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
           Deploy Core Ledger
         </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none animate-pulse"></div>
      
      <div className={`w-full ${view === 'CHOICE' ? 'max-w-6xl' : 'max-w-5xl'} grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[4rem] shadow-[0_0_120px_rgba(0,0,0,0.6)] overflow-hidden relative z-10 animate-in fade-in duration-1000`}>
        <div className={`hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-indigo-600 to-indigo-900 text-white relative lg:col-span-5`}>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-16">
              <div className="bg-white/20 p-3 rounded-2xl border border-white/10 shadow-lg"><Building className="w-8 h-8" /></div>
              <span className="text-2xl font-black tracking-tighter uppercase leading-none">RentMaster<br/><span className="text-indigo-400 text-sm">Enterprise</span></span>
            </div>
            <h1 className="text-6xl font-black leading-[0.9] mb-8 tracking-tighter uppercase">Private <br/> Digital <br/> Vault</h1>
            <p className="text-indigo-100/60 text-lg font-medium max-w-xs leading-relaxed">Highly secure rental management with cloud-encrypted identity gates.</p>
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
               <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Initializing Vault...</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
