
import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  UserCheck, 
  User, 
  Trash2, 
  ShieldAlert,
  Edit2,
  X,
  Lock,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

const UserManagement: React.FC = () => {
  const store = useRentalStore();
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: UserRole.MANAGER });
  const [error, setError] = useState<string | null>(null);
  
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    actionLabel: string;
    isDanger?: boolean;
    icon?: React.ReactNode;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    actionLabel: 'Confirm'
  });

  if (store.user?.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
         <ShieldAlert className="w-20 h-20 text-rose-500 mb-6" />
         <h2 className="text-3xl font-black uppercase">Restricted Area</h2>
         <p className="text-slate-500 font-medium">Only Super-Admins can manage the team.</p>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // BUG-B FIX: Team member name validation
    if (!/^[A-Za-z\s]+$/.test(newUser.name)) {
      setError("Team member name must contain only alphabets and spaces");
      return;
    }

    if (!newUser.username || !newUser.password) return;

    await store.addUser({
      id: 'u-' + Math.random().toString(36).substr(2, 9),
      username: newUser.username.toLowerCase(),
      name: newUser.name,
      role: newUser.role,
      passwordHash: newUser.password,
      createdAt: new Date().toISOString()
    });
    setIsAdding(false);
    setNewUser({ name: '', username: '', password: '', role: UserRole.MANAGER });
  };

  const handleDeleteRequest = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      isDanger: true,
      title: "Remove Team Member",
      message: `Are you sure you want to revoke access for "${name}"? This will immediately terminate their session and prevent future logins.`,
      actionLabel: "Revoke Access",
      icon: <Trash2 className="w-10 h-10" />,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setDeletingId(id);
        try {
          await store.deleteUser(id);
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const roleLabels = {
    [UserRole.ADMIN]: { label: 'Admin', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    [UserRole.MANAGER]: { label: 'Manager', icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    [UserRole.VIEWER]: { label: 'Viewer', icon: User, color: 'text-slate-400', bg: 'bg-slate-50' },
  };

  return (
    <div className="space-y-10 pb-20 max-w-5xl mx-auto animate-in fade-in duration-700">
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-10 text-center ${confirmConfig.isDanger ? 'bg-red-50/50' : 'bg-indigo-50/50'}`}>
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmConfig.isDanger ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-indigo-600 text-white shadow-indigo-500/20'}`}>
                {confirmConfig.icon}
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">{confirmConfig.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed">{confirmConfig.message}</p>
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button 
                onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmConfig.onConfirm}
                className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 ${confirmConfig.isDanger ? 'bg-red-500 shadow-red-200 hover:bg-red-600' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'}`}
              >
                {confirmConfig.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-950 tracking-tighter uppercase leading-none">Team Control</h1>
          <p className="text-slate-500 mt-2 font-medium">Manage access privileges for your rental portfolio.</p>
        </div>
        <button 
          onClick={() => { setIsAdding(true); setError(null); }}
          disabled={!!deletingId}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl flex items-center gap-3 hover:bg-indigo-700 transition-all font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50"
        >
          <UserPlus className="w-5 h-5" /> Add Team Member
        </button>
      </header>

      {isAdding && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">New Member</h3>
                 <button onClick={() => setIsAdding(false)} className="p-3 hover:bg-white rounded-full transition-colors"><X className="w-7 h-7 text-slate-400" /></button>
              </div>
              <form onSubmit={handleCreate} className="p-10 space-y-6">
                 {error && (
                   <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 animate-in shake">
                     <AlertCircle className="w-5 h-5 shrink-0" /><p className="text-xs font-bold">{error}</p>
                   </div>
                 )}
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Display Name</label>
                    <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username (Login)</label>
                    <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Password</label>
                    <input required type="password" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Role Permission</label>
                    <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none cursor-pointer" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                       <option value={UserRole.ADMIN}>Super Administrator</option>
                       <option value={UserRole.MANAGER}>Portfolio Manager</option>
                       <option value={UserRole.VIEWER}>Read-Only Viewer</option>
                    </select>
                 </div>
                 <div className="pt-6 flex gap-4">
                    <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
                    <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100">Create Account</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {store.users.map((u: any) => {
          const config = roleLabels[u.role as UserRole];
          const isOwnAccount = u.id === store.user?.id;
          const isDeleting = deletingId === u.id;
          
          return (
            <div key={u.id} className={`bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col relative group transition-all duration-300 ${isDeleting ? 'opacity-50 scale-95 grayscale' : 'hover:shadow-2xl hover:border-indigo-100'}`}>
               {isDeleting && (
                 <div className="absolute inset-0 z-10 bg-white/60 rounded-[3.5rem] flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                    <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">Revoking...</span>
                 </div>
               )}

               <div className="flex justify-between items-start mb-10">
                  <div className={`${config.bg} ${config.color} p-5 rounded-[1.5rem] shadow-xl`}>
                     <config.icon className="w-8 h-8" />
                  </div>
                  {!isOwnAccount && !isDeleting && (
                    <button onClick={() => handleDeleteRequest(u.id, u.name)} className="p-3 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                       <Trash2 className="w-6 h-6" />
                    </button>
                  )}
               </div>
               
               <div className="flex-1">
                  <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tighter leading-none mb-2 truncate">{u.name}</h3>
                  <div className="flex items-center gap-3">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">@{u.username}</span>
                     {isOwnAccount && <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded uppercase">You</span>}
                  </div>
               </div>

               <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Access Level</span>
                     <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>{config.label}</span>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Created</span>
                     <span className="text-[10px] font-black text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</span>
                  </div>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserManagement;
