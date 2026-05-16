
import React from 'react';
import { Users, User as UserIcon, X, ChevronDown, ShieldCheck } from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';
import { useLanguageStore } from '../lib/i18n';

const AdminUserFilter: React.FC = () => {
  const store = useRentalStore();
  const isAdmin = store.user?.role === UserRole.ADMIN || 
                  store.user?.username?.toLowerCase().trim() === 'manashparashar9926@gmail.com';

  const { t } = useLanguageStore();

  if (!isAdmin) return null;

  const handleUserSelect = (userId: string) => {
    if (userId === 'me') {
      store.setImpersonatedUser(null);
    } else {
      const selected = store.users.find((u: any) => u.id === userId);
      store.setImpersonatedUser(selected || null);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-slate-950/5 p-2 rounded-2xl border border-slate-200/50 shadow-sm transition-all hover:bg-slate-950/10">
      <div className="flex items-center gap-3 px-4 py-2 border-r border-slate-200">
         <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
            <ShieldCheck className="w-4 h-4" />
         </div>
         <div className="hidden sm:block">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{t('context_view')}</p>
            <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none">{t('admin_perspective')}</p>
         </div>
      </div>

      <div className="flex items-center gap-3 pl-2 pr-4">
        <select 
          className="bg-transparent text-sm font-black text-slate-700 uppercase tracking-tight py-2 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
          value={store.impersonatedUser?.id || 'me'}
          onChange={(e) => handleUserSelect(e.target.value)}
        >
          <option value="me">{t('viewing_as_self')}</option>
          <optgroup label={t('impersonate_team')}>
            {store.users.filter((u: any) => u.id !== store.user?.id).map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </optgroup>
        </select>
        {store.impersonatedUser && (
          <button 
            onClick={() => store.setImpersonatedUser(null)}
            className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"
            title={t('clear_impersonation')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminUserFilter;
