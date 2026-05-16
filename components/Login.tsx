
import React, { useState } from 'react';
import { 
  Building, 
  Loader2, 
  ShieldCheck, 
  ArrowRight,
  Shield,
  LifeBuoy,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { useLanguageStore } from '../lib/i18n';

const SUPERADMIN_EMAIL = 'manashparashar9926@gmail.com';

const Login: React.FC = () => {
  const store = useRentalStore();
  const { t } = useLanguageStore();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const isSuperAdmin = email.toLowerCase().trim() === SUPERADMIN_EMAIL;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await store.login(email, password);
    } catch (err: any) {
      console.error("Login attempt resulted in error:", err);
      let message = "Authentication failed. Please verify your credentials or contact your administrator.";
      
      // If our store threw a custom error (with or without code), we should prefer its message
      // especially if it's one of our semantic ledger-related messages.
      if (err.message && (err.message.includes('managed') || err.message.includes('sign in') || err.message.includes('password') || err.message.includes('Account not found'))) {
        message = err.message;
      }
      // Handle Firebase-specific error codes
      else if (err.code) {
        switch (err.code) {
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
          case 'auth/invalid-email':
            message = "Invalid email or password. Please verify your credentials or use Google 'Quick Sign In' if you previously used that method.";
            break;
          case 'auth/too-many-requests':
            message = "Security Lockdown: Too many failed attempts. Please wait 5-10 minutes or use Google Sign-In for instant access.";
            break;
          case 'auth/network-request-failed':
            message = "Network error: Please check your internet connection and try again.";
            break;
          default:
            message = err.message || message;
        }
      } else {
        message = err.message || message;
      }
      
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await store.loginWithGoogle();
    } catch (err: any) {
      console.error("Google login failed", err);
      setError("Google authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
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
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter text-indigo-400">RentMaster Pro</h2>
              <div className="flex items-center justify-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
                 <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> 
                 {t('booting_security_core')}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans text-white">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative z-10">
        
        {/* Left Side: Branding */}
        <div className="p-12 md:p-16 bg-gradient-to-br from-indigo-700 to-indigo-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="bg-white/20 p-2.5 rounded-xl border border-white/10"><Building className="w-6 h-6" /></div>
              <span className="font-black uppercase tracking-tighter text-xl">RentMaster <span className="text-indigo-300">Pro</span></span>
            </div>
            <h1 className="text-5xl font-black uppercase leading-tight tracking-tighter mb-6">
              {t('secure_rental_ledger').split(' ').map((word, i) => <React.Fragment key={i}>{word} <br/></React.Fragment>)}
            </h1>
            <p className="text-indigo-100/70 text-sm font-medium leading-relaxed max-w-[240px]">
              {t('advanced_management_engine')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 group">
               <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center font-black group-hover:bg-white/20 transition-colors">01</div>
               <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200">{t('portfolio_monitoring')}</div>
            </div>
            <div className="flex items-center gap-4 group">
               <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center font-black group-hover:bg-white/20 transition-colors">02</div>
               <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200">{t('automated_ledger')}</div>
            </div>
            <div className="flex items-center gap-4 group">
               <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center font-black group-hover:bg-white/20 transition-colors">03</div>
               <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200">{t('team_whitelist')}</div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex items-center gap-3 mt-10">
            <Shield className="w-5 h-5 text-indigo-300" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
              {t('firebase_verify')}
            </div>
          </div>
        </div>

        <div className="p-12 md:p-16 flex flex-col justify-center bg-slate-900/40">
          <div className="mb-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                {t('master_auth')}
              </span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tighter">
              {t('sign_in')}
            </h2>
            <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest leading-relaxed">
              {t('access_portfolio')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400 leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            {isSuperAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in text-left">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 leading-relaxed">
                    Super Admin Identity Detected
                  </p>
                  <p className="text-[9px] text-amber-500/80 leading-relaxed">
                    You can use Google Sign In for instant access, or your custom password if already configured.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('email_address')}</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-5 text-sm font-bold placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:bg-indigo-500/5 transition-all text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('security_key')}</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-5 text-sm font-bold placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:bg-indigo-500/5 transition-all text-white"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-slate-950 font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl flex items-center justify-center gap-4 hover:bg-indigo-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group mt-4 hover:shadow-indigo-500/20"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-950" />
              ) : (
                <>
                  {t('authenticate_console')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[8px] uppercase font-black text-slate-600">
                <span className="bg-[#0b0c10] px-3 tracking-[0.3em]">{t('or_use_cloud_auth')}</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t('quick_sign_in')}
            </button>
          </form>

          <p className="text-[9px] text-slate-600 text-center uppercase tracking-widest font-bold leading-relaxed px-4 mt-8">
            {t('access_restricted_personnel')} <br/>
            {t('unauthorized_attempts_logged')}
          </p>

          <div className="mt-12 flex flex-col items-center gap-4">
            <div className="h-px w-full bg-white/5"></div>
            <button type="button" className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-indigo-400 transition-colors">
              <LifeBuoy className="w-4 h-4" /> {t('technical_support')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
