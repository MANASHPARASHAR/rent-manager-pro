
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
  Key, 
  CheckCircle, 
  Database, 
  ArrowRightCircle 
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

type SetupStep = 'WELCOME' | 'CONFIG_CLOUD' | 'CONNECT_CLOUD' | 'SET_PASSWORD' | 'FINALIZING';

const Login: React.FC = () => {
  const store = useRentalStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Onboarding State
  const [setupStep, setSetupStep] = useState<SetupStep>('WELCOME');
  const [clientId, setClientId] = useState(store.googleClientId || '');
  const [googleInfo, setGoogleInfo] = useState<{name: string, email: string} | null>(null);

  const hasUsers = store.users && store.users.length > 0;
  
  // If we already have users, we're in standard login mode
  const isInitializing = !hasUsers;

  // Fix: Define isCloudConfigured based on spreadsheetId and googleUser existence
  const isCloudConfigured = !!store.spreadsheetId && !!store.googleUser;

  useEffect(() => {
    if (!hasUsers) setSetupStep('WELCOME');
    else setSetupStep('WELCOME'); // Logic handled by isInitializing
  }, [hasUsers]);

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
                 Initializing Core...
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

  const handleStartSetup = () => {
    if (!clientId) setSetupStep('CONFIG_CLOUD');
    else setSetupStep('CONNECT_CLOUD');
  };

  const handleSaveConfig = () => {
    if (!clientId.trim()) {
      setError("Google Client ID is required for sync.");
      return;
    }
    store.updateClientId(clientId.trim());
    setSetupStep('CONNECT_CLOUD');
  };

  const handleCloudConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userInfo = await store.authenticate(clientId.trim());
      if (userInfo) {
        setGoogleInfo({ name: userInfo.name, email: userInfo.email });
        setSetupStep('SET_PASSWORD');
      } else {
        setError("Could not authorize account. Ensure your Gmail is added to Google Cloud Console.");
      }
    } catch (err) {
      setError("Cloud connection failed. Verify Client ID.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeAdmin = async () => {
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setIsLoading(true);
    setSetupStep('FINALIZING');
    
    try {
      const newUser = {
        id: 'u-admin-' + Date.now(),
        username: googleInfo?.email.toLowerCase() || 'admin',
        name: googleInfo?.name || 'Super Admin',
        role: UserRole.ADMIN,
        passwordHash: password,
        createdAt: new Date().toISOString()
      };
      
      // The store handles spreadsheet creation automatically once authenticated
      await store.addUser(newUser, true);
    } catch (err) {
      setError("Setup finalization failed.");
      setSetupStep('SET_PASSWORD');
    } finally {
      setIsLoading(false);
    }
  };

  // RENDER HELPERS
  const renderOnboarding = () => {
    switch(setupStep) {
      case 'WELCOME':
        return (
          <div className="text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-indigo-600/10 p-6 rounded-[3rem] border border-indigo-600/20 inline-block mb-4">
              <Cloud className="w-16 h-16 text-indigo-500" />
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Lifetime <br/> Cloud Sync</h2>
              <p className="text-slate-400 text-sm font-medium max-w-xs mx-auto">
                RentMaster Pro requires a Google Sheets connection to store your data securely forever.
              </p>
            </div>
            <button 
              onClick={handleStartSetup}
              className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              Start Cloud Setup <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        );
      case 'CONFIG_CLOUD':
        return (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
            <div className="space-y-2">
               <h3 className="text-2xl font-black text-white uppercase tracking-tight">Configure Engine</h3>
               <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Provide your Google OAuth Client ID</p>
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Client ID String</label>
               <div className="relative group">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-4 py-5 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    placeholder="paste_client_id_here"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                  />
               </div>
            </div>
            <button onClick={handleSaveConfig} className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl hover:bg-indigo-500 transition-all">Save & Continue</button>
            <p className="text-[10px] text-slate-600 font-bold text-center">Documentation: ai.google.dev/gemini-api/docs/billing</p>
          </div>
        );
      case 'CONNECT_CLOUD':
        return (
          <div className="text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-emerald-500/10 p-6 rounded-[3rem] border border-emerald-500/20 inline-block">
              <Fingerprint className="w-16 h-16 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Authorize Account</h3>
              <p className="text-slate-400 text-xs font-medium">Link your authorized Gmail from the cloud console.</p>
            </div>
            <button 
              onClick={handleCloudConnect}
              disabled={isLoading}
              className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Sign in with Google</>}
            </button>
            {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px] font-black uppercase leading-relaxed tracking-widest">{error}</div>}
          </div>
        );
      case 'SET_PASSWORD':
        return (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/20 text-white font-black text-2xl uppercase">
                  {googleInfo?.name.charAt(0)}
               </div>
               <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">{googleInfo?.name}</h3>
                  <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-1">Found Authorized Identity</p>
               </div>
            </div>
            <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Set Master Password</label>
                  <div className="relative group">
                     <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                     <input 
                       type="password"
                       className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-4 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                       placeholder="••••••••"
                       value={password}
                       onChange={e => setPassword(e.target.value)}
                     />
                  </div>
               </div>
               <button 
                 onClick={handleFinalizeAdmin}
                 disabled={isLoading}
                 className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
               >
                 {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Finalize Super Admin"}
               </button>
            </div>
          </div>
        );
      case 'FINALIZING':
        return (
          <div className="text-center space-y-8 py-10">
             <div className="relative inline-block">
                <div className="absolute inset-0 bg-indigo-600 blur-3xl animate-pulse opacity-20"></div>
                <Database className="w-20 h-20 text-indigo-500 animate-bounce relative" />
             </div>
             <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Initializing Database</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Provisioning Google Sheet...</p>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[160px] pointer-events-none"></div>
      
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[3.5rem] shadow-[0_0_120px_rgba(0,0,0,0.6)] overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-1000">
        
        {/* LEFT PANEL - Branding */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-indigo-600 to-indigo-900 text-white relative">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-14">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <Building className="w-8 h-8" />
              </div>
              <span className="text-2xl font-black tracking-tighter uppercase leading-none">RentMaster<br/><span className="text-indigo-300 text-sm">Pro Edition</span></span>
            </div>
            
            <h1 className="text-6xl font-black leading-[0.9] mb-8 tracking-tighter uppercase">
              {isInitializing ? "Engine <br/> Setup" : "Secure <br/> Access"}
            </h1>
            
            <p className="text-indigo-100/60 text-lg font-medium max-w-sm leading-relaxed">
              {isInitializing 
                ? "Experience absolute control over your rental empire with lifetime data persistence." 
                : "Enter your master credentials to unlock the rental portfolio analytics engine."}
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
             <div className="space-y-1">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-indigo-100">
                   <Zap className="w-4 h-4 text-amber-300" /> Real-time
                </div>
                <p className="text-[10px] text-indigo-300/60 uppercase font-black tracking-widest">Active Google Sync</p>
             </div>
             <div className="space-y-1">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-indigo-100">
                   <ShieldCheck className="w-4 h-4 text-emerald-300" /> Vault-Grade
                </div>
                <p className="text-[10px] text-indigo-300/60 uppercase font-black tracking-widest">Encrypted Local Cache</p>
             </div>
          </div>
        </div>

        {/* RIGHT PANEL - Forms */}
        <div className="p-10 lg:p-20 flex flex-col justify-center bg-slate-900/40 min-h-[600px]">
          {isInitializing ? renderOnboarding() : (
            <div className="space-y-10 animate-in fade-in duration-700">
               <div>
                  <h2 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase leading-none">Verification</h2>
                  <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Identify current session credentials</p>
               </div>

               <div className="space-y-6">
                 {error && (
                   <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-center gap-4 text-red-400 text-xs font-black uppercase tracking-widest animate-in shake">
                     <AlertCircle className="w-6 h-6 shrink-0" />
                     {error}
                   </div>
                 )}

                 <form onSubmit={handleLogin} className="space-y-8">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Identity</label>
                     <div className="relative group">
                       <Fingerprint className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                       <input 
                         type="text"
                         required
                         className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] pl-14 pr-4 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white/10 transition-all font-bold"
                         placeholder="email or username"
                         value={username}
                         onChange={e => setUsername(e.target.value)}
                       />
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vault Key</label>
                     <div className="relative group">
                       <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                       <input 
                         type="password"
                         required
                         className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] pl-14 pr-4 py-5 text-white outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white/10 transition-all font-bold"
                         placeholder="••••••••"
                         value={password}
                         onChange={e => setPassword(e.target.value)}
                       />
                     </div>
                   </div>

                   <button 
                     type="submit"
                     disabled={isLoading}
                     className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 group"
                   >
                     {isLoading ? (
                       <Loader2 className="w-6 h-6 animate-spin" />
                     ) : (
                       <>Unlock Dashboard <ArrowRightCircle className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                     )}
                   </button>
                 </form>
               </div>
               
               <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className={`w-2 h-2 rounded-full ${store.syncStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-700'}`}></div>
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
                       Sync Status: {store.syncStatus === 'synced' ? "Protected" : "Local only"}
                     </span>
                  </div>
                  {isCloudConfigured && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                       <Cloud className="w-3 h-3 text-indigo-400" />
                       <span className="text-[8px] font-black text-indigo-400 uppercase">Cloud Enabled</span>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
