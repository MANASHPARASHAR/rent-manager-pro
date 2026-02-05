
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
  Key,
  CloudOff,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Info,
  Trash2,
  Eye,
  EyeOff,
  LifeBuoy
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
  const [showPassword, setShowPassword] = useState(false);
  
  const hasUsers = store.users && store.users.length > 0;
  const isCloudConfigured = !!store.spreadsheetId;
  const isCloudNotFound = store.syncStatus === 'not_found';
  const isSystemInitialized = hasUsers || (isCloudConfigured && !isCloudNotFound);

  useEffect(() => {
    if (!store.isBooting) {
      if (isSystemInitialized) setView('LOGIN');
      else setView('CHOICE');
    }
  }, [isSystemInitialized, store.isBooting]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const success = await store.login(username.trim(), password);
      if (!success) {
        setError('Invalid credentials. Check email casing & password.');
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
      if (!clientId) {
        setError("Missing Client ID. Go back to config.");
        return;
      }
      const result: any = await store.authenticate(clientId, true);
      if (result && !result.error) {
        setView('SETUP_PASSWORD');
      } else if (result?.error === 'UNAUTHORIZED_EMAIL') {
        setError("Unauthorized Gmail detected. This email is not in the system's Admin list.");
      } else {
        setError("Cloud handshake failed. Check your Console settings (Origins & Scopes).");
      }
    } catch (err) {
      setError("Sync connection error. Please check your internet.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSetup = () => {
    if (confirm("CRITICAL: This will clear ALL local setup data. Are you sure?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

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

  const renderLogin = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
           <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
           <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Live Connection</span>
        </div>
        <div className="flex items-center gap-2">
           <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isCloudNotFound ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
           <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
             {isCloudNotFound ? 'Cloud Disconnected' : 'Master Key Valid'}
           </span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Authentication</h2>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Enter credentials to access the ledger</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex flex-col gap-2 text-red-400 animate-in shake">
            <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
              <AlertCircle className="w-6 h-6 shrink-0" /> {error}
            </div>
            <p className="text-[10px] font-bold opacity-60 ml-10">Tip: Check if caps lock is on or if you used a different email during setup.</p>
          </div>
        )}
        
        {isCloudNotFound && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl flex flex-col gap-3">
             <div className="flex items-center gap-4">
                <CloudOff className="w-6 h-6 text-rose-500 shrink-0" />
                <p className="text-[9px] text-rose-400 font-black uppercase leading-relaxed tracking-wider">
                   Alert: The linked Google Sheet was not found. Logging in will allow you to restore from local backup.
                </p>
             </div>
             <button type="button" onClick={() => setView('CHOICE')} className="text-[8px] font-black text-rose-500 uppercase flex items-center gap-1.5 self-end hover:underline">
               <RefreshCw className="w-2.5 h-2.5" /> Emergency Setup Mode
             </button>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Team ID (Email)</label>
          <div className="relative group">
            <Fingerprint className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              required 
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-4 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold" 
              placeholder="your@email.com" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Token</label>
          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type={showPassword ? "text" : "password"} 
              required 
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-14 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold" 
              placeholder="••••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button type="submit" disabled={isLoading} className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 group">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Access Dashboard <ArrowRightCircle className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
          </button>
          
          <button 
            type="button" 
            onClick={handleResetSetup}
            className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] hover:text-rose-500 transition-colors flex items-center justify-center gap-2"
          >
            <LifeBuoy className="w-3.5 h-3.5" /> Locked out? Emergency Reset Setup
          </button>
        </div>
      </form>
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
          <h3 className="text-3xl font-black text-white uppercase tracking-tight">Step 1: System Key</h3>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Paste your Master Google OAuth Client ID</p>
       </div>
       
       <div className="bg-indigo-500/5 border border-indigo-500/20 p-6 rounded-3xl space-y-4">
          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2"><Info className="w-4 h-4" /> Requirement Checklist</h4>
          <ul className="space-y-2">
             {[
               "Google Cloud Console: OAuth 2.0 Client ID created.",
               "Authorized JS Origins: Add your Vercel domain.",
               "Authorized Redirect URIs: Add your Vercel domain.",
               "APIs Enabled: Google Sheets & Google Drive API."
             ].map((text, i) => (
               <li key={i} className="flex items-start gap-3 text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" /> {text}
               </li>
             ))}
          </ul>
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-[9px] font-black text-indigo-500 hover:underline flex items-center gap-1.5 mt-2 uppercase">Open Google Console <ExternalLink className="w-3 h-3" /></a>
       </div>

       <div className="space-y-4 pt-4">
          <div className="relative group">
             <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500" />
             <input 
               className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
               placeholder="0000000-xxxx.apps.googleusercontent.com"
               value={username} 
               onChange={e => setUsername(e.target.value)}
             />
          </div>
          <button 
            disabled={!username.includes('.apps.googleusercontent.com')}
            onClick={() => { store.updateClientId(username.trim()); setView('SETUP_CONNECT'); }}
            className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-30"
          >
            Confirm Client Key
          </button>
       </div>
    </div>
  );

  const renderSetupConnect = () => (
    <div className="text-center space-y-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-indigo-600/10 p-10 rounded-[4rem] border border-indigo-600/20 inline-block relative">
        <ShieldCheck className="w-16 h-16 text-indigo-500" />
        <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-full border-4 border-[#050505]"><CheckCircle2 className="w-5 h-5 text-white" /></div>
      </div>
      <div className="space-y-2">
        <h3 className="text-3xl font-black text-white uppercase tracking-tight">Step 2: Ownership</h3>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest max-w-xs mx-auto">Authorize the app to manage your Cloud Infrastructure via Google Login</p>
      </div>

      <div className="space-y-4">
        <button onClick={handleCloudConnect} disabled={isLoading} className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><ShieldCheck className="w-6 h-6" /> Authenticate Master Owner</>}
        </button>
        
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl space-y-3 text-left animate-in shake">
            <div className="flex items-center gap-3 text-rose-500">
               <AlertCircle className="w-5 h-5 shrink-0" />
               <p className="text-[10px] font-black uppercase tracking-widest">Handshake Failed</p>
            </div>
            <p className="text-[11px] font-bold text-rose-400/80 leading-relaxed uppercase">{error}</p>
            <div className="pt-2 flex gap-3">
               <button onClick={() => setView('SETUP_CONFIG')} className="text-[9px] font-black text-rose-500 uppercase border-b border-rose-500/30">Edit Client ID</button>
               <button onClick={handleResetSetup} className="text-[9px] font-black text-rose-500 uppercase border-b border-rose-500/30 flex items-center gap-1"><Trash2 className="w-2.5 h-2.5" /> Full Reset</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 p-6 rounded-3xl text-left flex gap-4 border border-white/5">
         <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
         <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Why connect?</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed tracking-wider">
               This creates an automated Spreadsheet in your Google Drive to act as the primary database. No external servers needed.
            </p>
         </div>
      </div>
    </div>
  );

  const renderSetupPassword = () => (
    <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
      <div className="p-8 bg-indigo-600 rounded-[3rem] text-white">
         <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Step 3: Secure Vault</h3>
         <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest leading-relaxed">Handshake successful! Set your master access token to lock the dashboard.</p>
      </div>
      <div className="space-y-6">
         <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Master Password</label>
            <div className="relative">
               <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
               <input type="password" required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold" placeholder="Minimum 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
         </div>
         <button onClick={async () => {
            if (!password || password.length < 6) { setError("Min 6 chars."); return; }
            setIsLoading(true); setView('FINALIZING');
            try {
              const uInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${store.googleUser.access_token}` } });
              const uInfo = await uInfoResponse.json();
              const newUser = { id: 'u-admin-' + Date.now(), username: String(uInfo.email).trim().toLowerCase(), name: uInfo.name || 'Super Admin', role: UserRole.ADMIN, passwordHash: String(password).trim(), createdAt: new Date().toISOString() };
              await store.addUser(newUser, true);
            } catch (err) { setView('SETUP_PASSWORD'); setError("Deployment failed."); } finally { setIsLoading(false); }
         }} disabled={isLoading} className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl active:scale-95">
           Initialize & Deploy
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
            <p className="text-indigo-100/60 text-lg font-medium max-w-xs leading-relaxed">Enterprise-grade rental engine with owner-exclusive access.</p>
          </div>
          <div className="relative z-10 pt-10 border-t border-white/10 flex items-center gap-4">
             <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/5"><Shield className="w-6 h-6 text-indigo-300" /></div>
             <div><p className="text-[10px] font-black uppercase tracking-widest">End-to-End Encrypted</p><p className="text-[9px] text-white/40 uppercase font-bold">Google Cloud Native Infra</p></div>
          </div>
        </div>
        <div className="lg:col-span-7 p-10 lg:p-20 flex flex-col justify-center bg-slate-900/40 min-h-[700px]">
          {view === 'LOGIN' && renderLogin()}
          {view === 'CHOICE' && renderChoice()}
          {view === 'SETUP_CONFIG' && renderSetupConfig()}
          {view === 'SETUP_CONNECT' && renderSetupConnect()}
          {view === 'SETUP_PASSWORD' && renderSetupPassword()}
          {view === 'FINALIZING' && (
            <div className="text-center space-y-10 py-10 animate-in fade-in duration-1000">
               <Loader2 className="w-24 h-24 text-indigo-500 animate-spin mx-auto" />
               <div className="space-y-2">
                 <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Genesis Initialization...</h3>
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Configuring global ledger and security modules</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
