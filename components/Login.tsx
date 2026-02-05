
import React, { useState, useEffect } from 'react';
import { 
  Building, 
  ArrowRight, 
  AlertCircle, 
  Lock, 
  ShieldCheck, 
  Zap, 
  Fingerprint, 
  Loader2, 
  Cloud, 
  Key, 
  CheckCircle, 
  Database, 
  ArrowRightCircle,
  LogIn,
  Link as LinkIcon,
  Shield,
  Search,
  X
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

type LoginView = 'CHOICE' | 'LOGIN' | 'SETUP_CONFIG' | 'SETUP_CONNECT' | 'SETUP_PASSWORD' | 'RECOVERY' | 'FINALIZING';

const Login: React.FC = () => {
  const store = useRentalStore();
  const [view, setView] = useState<LoginView>('CHOICE');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [clientId, setClientId] = useState(store.googleClientId || '');
  const [googleInfo, setGoogleInfo] = useState<{name: string, email: string} | null>(null);

  const hasUsers = store.users && store.users.length > 0;
  const isCloudConfigured = !!store.spreadsheetId;

  useEffect(() => {
    if (isCloudConfigured && hasUsers && view === 'CHOICE') {
      setView('LOGIN');
    }
  }, [isCloudConfigured, hasUsers]);

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
                 Syncing Database Core...
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
      if (!success) setError('Invalid credentials. Access denied.');
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
      const result: any = await store.authenticate(clientId.trim(), true);
      if (result?.error === 'UNAUTHORIZED_EMAIL') {
        setError("SECURITY ALERT: This email is not authorized for this workspace. Access Denied.");
      } else if (result && !result.error) {
        setGoogleInfo({ name: result.name, email: result.email });
        if (store.users.length > 0) setView('LOGIN');
        else setView('SETUP_PASSWORD');
      } else {
        setError("Cloud connection failed. Verify Client ID.");
      }
    } catch (err) {
      setError("Handshake error. Check Client ID and permissions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRecover = async () => {
    if (!recoveryId.trim()) return;
    setIsLoading(true);
    try {
      await store.manualLinkSpreadsheet(recoveryId.trim());
      setView('LOGIN');
    } catch (err) {
      setError("Invalid Spreadsheet ID. Please verify from URL.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderChoice = () => (
    <div className="space-y-12 animate-in fade-in zoom-in-95 duration-700">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest mb-2">
           <Shield className="w-3.5 h-3.5" /> Identity Protection
        </div>
        <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none">Authorization <br/> Required</h2>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Connect your cloud account to sync data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button 
          onClick={() => setView(clientId ? 'SETUP_CONNECT' : 'SETUP_CONFIG')}
          className="group relative bg-white/5 border border-white/10 p-10 rounded-[3rem] text-left hover:bg-indigo-600/10 hover:border-indigo-500/50 transition-all duration-500 overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Cloud className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10">
            <div className="w-14 h-14 bg-indigo-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/20 group-hover:scale-110 transition-transform">
              <Cloud className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Sync Assets</h3>
            <p className="text-slate-400 text-xs font-medium leading-relaxed uppercase tracking-wide">
              {isCloudConfigured ? 'Database verified and linked.' : 'Initialize connection with Google Drive ledger.'}
            </p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              {isCloudConfigured ? 'Change Link' : 'Start Handshake'} <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </button>

        <button 
          onClick={() => {
            if (!hasUsers && !isCloudConfigured) setError("Protocol Error: System not initialized. Connect Cloud first.");
            else setView('LOGIN');
          }}
          className="group relative bg-white/5 border border-white/10 p-10 rounded-[3rem] text-left hover:bg-emerald-600/10 hover:border-emerald-500/50 transition-all duration-500 overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <LogIn className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10">
            <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20 group-hover:scale-110 transition-transform">
              <LogIn className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Vault Entry</h3>
            <p className="text-slate-400 text-xs font-medium leading-relaxed uppercase tracking-wide">Enter your credentials to access the ledger.</p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              Secure Auth <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </button>
      </div>

      <div className="text-center">
         <button onClick={() => setView('RECOVERY')} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors">
            Lost users? Link Spreadsheet ID manually
         </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px] font-black uppercase text-center tracking-widest animate-in shake">
          {error}
        </div>
      )}
    </div>
  );

  const renderLogin = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
      <div className="flex items-center justify-between">
        <button onClick={() => setView('CHOICE')} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white flex items-center gap-2">
           <ArrowRight className="w-4 h-4 rotate-180" /> Change Sync Account
        </button>
        <span className="text-[9px] font-black text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-full uppercase">Vault Protocol Active</span>
      </div>

      <div className="space-y-2">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Login</h2>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Team authentication</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {error && <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-center gap-4 text-red-400 text-xs font-black uppercase tracking-widest animate-in shake"><AlertCircle className="w-6 h-6 shrink-0" />{error}</div>}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Team ID / Email</label>
          <div className="relative group">
            <Fingerprint className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
            <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-4 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
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
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Access Ledger <ArrowRightCircle className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
        </button>
      </form>
    </div>
  );

  const renderRecovery = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
      <button onClick={() => setView('CHOICE')} className="p-2 text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
      <div className="space-y-2">
        <h3 className="text-3xl font-black text-white uppercase tracking-tight">Data Recovery</h3>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest leading-relaxed">
           If your users disappeared after reconnecting, find your original "RentMaster_Pro_Database" file in Google Drive and paste its ID from the URL below.
        </p>
      </div>
      <div className="space-y-4">
         <div className="relative group">
            <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-4 py-5 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="Paste Spreadsheet ID from URL"
              value={recoveryId}
              onChange={e => setRecoveryId(e.target.value)}
            />
         </div>
         <button 
           onClick={handleManualRecover}
           disabled={isLoading}
           className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl active:scale-95"
         >
           {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Link & Recover Data"}
         </button>
      </div>
    </div>
  );

  const renderSetupConfig = () => (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <button onClick={() => setView('CHOICE')} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white flex items-center gap-2">
         <ArrowRight className="w-4 h-4 rotate-180" /> Back
      </button>
      <div className="space-y-2">
         <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-none">Cloud Config</h3>
         <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Client ID setup required</p>
      </div>
      <div className="space-y-1.5">
         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">OAuth Client ID</label>
         <div className="relative group">
            <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
            <input className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-4 py-5 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="000000000000-xxxx.apps.googleusercontent.com" value={clientId} onChange={e => setClientId(e.target.value)} />
         </div>
      </div>
      <button onClick={() => { if (!clientId.trim()) return; store.updateClientId(clientId.trim()); setView('SETUP_CONNECT'); }} className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl hover:bg-indigo-500 transition-all">Establish Connection</button>
    </div>
  );

  const renderSetupConnect = () => (
    <div className="text-center space-y-10 animate-in fade-in zoom-in-95 duration-500">
      <button onClick={() => setView(store.googleClientId ? 'CHOICE' : 'SETUP_CONFIG')} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white flex items-center gap-2 mx-auto">
         <ArrowRight className="w-4 h-4 rotate-180" /> Back
      </button>
      <div className="bg-emerald-500/10 p-8 rounded-[3.5rem] border border-emerald-500/20 inline-block">
        <ShieldCheck className="w-16 h-16 text-emerald-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-3xl font-black text-white uppercase tracking-tight">Identity Handshake</h3>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Connect authorized personnel account</p>
      </div>
      <button onClick={handleCloudConnect} disabled={isLoading} className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Cloud className="w-6 h-6" /> Authenticate via Google</>}
      </button>
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px] font-black uppercase tracking-widest">{error}</div>}
    </div>
  );

  const renderSetupPassword = () => (
    <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
      <div className="flex items-center gap-6 p-6 bg-white/5 border border-white/10 rounded-[2.5rem]">
         <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl text-white font-black text-2xl uppercase">{googleInfo?.name.charAt(0)}</div>
         <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-none mb-1">{googleInfo?.name}</h3>
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">Authorized Super Admin</p>
         </div>
      </div>
      <div className="space-y-6">
         <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Set Master Security Key</label>
            <div className="relative group">
               <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
               <input type="password" className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-4 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold" placeholder="6+ characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
         </div>
         <button onClick={async () => {
            if (!password || password.length < 6) { setError("Min 6 characters required."); return; }
            setIsLoading(true); setView('FINALIZING');
            try {
              const newUser = { id: 'u-admin-' + Date.now(), username: googleInfo?.email.toLowerCase() || 'admin', name: googleInfo?.name || 'Super Admin', role: UserRole.ADMIN, passwordHash: password, createdAt: new Date().toISOString() };
              await store.addUser(newUser, true);
            } catch (err) { setError("Setup failed."); setView('SETUP_PASSWORD'); } finally { setIsLoading(false); }
         }} disabled={isLoading} className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
           {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Deploy System Core"}
         </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[160px] pointer-events-none"></div>
      
      <div className={`w-full ${view === 'CHOICE' ? 'max-w-6xl' : 'max-w-5xl'} grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[4rem] shadow-[0_0_120px_rgba(0,0,0,0.6)] overflow-hidden relative z-10 animate-in fade-in duration-1000`}>
        <div className={`hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-indigo-600 to-indigo-900 text-white relative lg:col-span-5`}>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-16">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md shadow-lg border border-white/10"><Building className="w-8 h-8" /></div>
              <span className="text-2xl font-black tracking-tighter uppercase leading-none">RentMaster<br/><span className="text-indigo-300 text-sm">Enterprise</span></span>
            </div>
            <h1 className="text-6xl font-black leading-[0.9] mb-8 tracking-tighter uppercase">Secure <br/> Cloud <br/> Ledger</h1>
            <p className="text-indigo-100/60 text-lg font-medium max-w-xs leading-relaxed">Enterprise rental management with rigid Cloud-First identity security.</p>
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
             <div className="space-y-1"><div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-indigo-100"><Zap className="w-4 h-4 text-amber-300" /> Hardened</div><p className="text-[10px] text-indigo-300/60 uppercase font-black tracking-widest">Cloud-First Auth</p></div>
             <div className="space-y-1"><div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-indigo-100"><ShieldCheck className="w-4 h-4 text-emerald-300" /> Audited</div><p className="text-[10px] text-indigo-300/60 uppercase font-black tracking-widest">Whitelist Only</p></div>
          </div>
        </div>
        <div className="lg:col-span-7 p-10 lg:p-20 flex flex-col justify-center bg-slate-900/40 min-h-[700px]">
          {view === 'CHOICE' && renderChoice()}
          {view === 'LOGIN' && renderLogin()}
          {view === 'SETUP_CONFIG' && renderSetupConfig()}
          {view === 'SETUP_CONNECT' && renderSetupConnect()}
          {view === 'SETUP_PASSWORD' && renderSetupPassword()}
          {view === 'RECOVERY' && renderRecovery()}
          {view === 'FINALIZING' && (
            <div className="text-center space-y-10 py-10">
               <div className="relative inline-block"><div className="absolute inset-0 bg-indigo-600 blur-3xl animate-pulse opacity-20"></div><Database className="w-24 h-24 text-indigo-500 animate-bounce relative" /></div>
               <div className="space-y-3"><h3 className="text-3xl font-black text-white uppercase tracking-tighter">Securing Assets</h3><p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.3em] animate-pulse">Initializing Production Vault...</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
