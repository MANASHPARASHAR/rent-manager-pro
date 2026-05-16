
import React, { useMemo, useState } from 'react';
import { 
  Bell, 
  ShieldAlert, 
  Zap, 
  Clock, 
  Check, 
  Trash2,
  Filter,
  Search,
  ChevronRight,
  X,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { AppNotification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useLanguageStore } from '../lib/i18n';

const NotificationHistory: React.FC = () => {
  const store = useRentalStore();
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | 'all' | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  const notifications = useMemo(() => {
    return (store.notifications || [])
      .filter((n: AppNotification) => n.userId === store.user?.username)
      .filter((n: AppNotification) => 
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        n.message.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [store.notifications, store.user?.username, searchTerm]);

  const handleMarkAsRead = async (id: string) => {
    await store.markNotificationAsRead(id);
  };

  const handleDelete = async () => {
    try {
      setErrorStatus(null);
      if (confirmingId === 'all') {
        await store.deleteAllNotifications();
      } else if (confirmingId) {
        await store.deleteNotification(confirmingId);
      }
      setIsConfirmOpen(false);
      setConfirmingId(null);
    } catch (e: any) {
      console.error("Purge failed:", e);
      try {
        const err = JSON.parse(e.message);
        setErrorStatus(err.error || "Permission Denied: System restricted delete operation.");
      } catch {
        setErrorStatus("Delete failed. Please verify your connection.");
      }
    }
  };

  const deleteAndClose = async () => {
    try {
      setErrorStatus('');
      await store.deleteAllNotifications();
      navigate('/');
    } catch (e: any) {
      console.error("Purge failed:", e);
      try {
        const err = JSON.parse(e.message);
        setErrorStatus(err.error || "Permission Denied: System restricted delete operation.");
      } catch {
        setErrorStatus("Delete failed. Please verify your connection.");
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'RENT_OVERDUE': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'EXPENSE': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'RENT_OVERDUE': return <ShieldAlert className="w-5 h-5" />;
      case 'EXPENSE': return <Zap className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-100">
               <Bell className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">{t('alert_history')}</h1>
          </div>
          <p className="text-slate-500 font-medium ml-1">{t('comprehensive_alert_log')}</p>
        </motion.div>

        <div className="flex flex-col gap-4">
          <div className="flex bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center px-6 gap-3 border-r border-slate-100">
               <Search className="w-4 h-4 text-slate-400" />
               <input 
                 type="text" 
                 placeholder={t('search_alerts_placeholder')} 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="bg-transparent border-none text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:ring-0 w-48"
               />
            </div>
            <button 
              onClick={() => navigate('/')}
              className="p-3 text-slate-400 hover:text-rose-500 transition-all"
              title={t('close_history')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex justify-end gap-3">
             {notifications.length > 0 && (
               <button 
                 onClick={() => {
                   setConfirmingId('all');
                   setIsConfirmOpen(true);
                 }}
                 className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100"
               >
                 <Trash2 className="w-4 h-4" />
                 {t('delete_all')}
               </button>
             )}
             <button 
               onClick={() => navigate('/')}
               className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all shadow-xl"
             >
               {t('close_history')}
             </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-[3rem] border border-slate-100 p-24 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
               <Bell className="w-10 h-10 text-slate-200" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">{t('zero_notifications')}</h2>
            <p className="text-slate-400 font-medium text-sm">{t('alert_history_empty')}</p>
          </div>
        ) : (
          notifications.map((n, idx) => (
            <motion.div 
              key={n.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`group bg-white rounded-[2.5rem] border p-8 transition-all hover:shadow-xl hover:shadow-slate-100 flex flex-col lg:flex-row items-start lg:items-center gap-8 ${!n.isRead ? 'border-indigo-100 shadow-lg shadow-indigo-50/50' : 'border-slate-100'}`}
            >
              <div className={`shrink-0 w-16 h-16 rounded-[1.5rem] flex items-center justify-center border shadow-sm ${getStatusColor(n.type)}`}>
                {getIcon(n.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${getStatusColor(n.type)}`}>
                    {n.type.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold tracking-tight">{formatDate(n.createdAt)}</span>
                  </div>
                </div>
                <h3 className={`text-xl font-black tracking-tight mb-1 truncate ${!n.isRead ? 'text-slate-900' : 'text-slate-600'}`}>
                  {n.title}
                </h3>
                <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-2xl">
                  {n.message}
                </p>
              </div>

              <div className="flex items-center gap-4 lg:pl-8 lg:border-l lg:border-slate-50 self-stretch">
                {!n.isRead ? (
                  <button 
                    onClick={() => handleMarkAsRead(n.id)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all scale-105"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t('mark_read')}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-6 py-3 text-emerald-500 font-black uppercase text-[10px] tracking-widest">
                    <Check className="w-3.5 h-3.5" />
                    {t('archive')}
                  </div>
                )}
                
                <button 
                  className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all opacity-100 group-hover:scale-100 scale-95 border border-transparent hover:border-rose-100 shadow-sm"
                  title={t('delete_alert')}
                  onClick={() => {
                    setConfirmingId(n.id);
                    setIsConfirmOpen(true);
                  }}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {isConfirmOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 backdrop-blur-md bg-slate-950/60">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
             >
                <div className="p-8 text-center">
                   <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle className="w-10 h-10" />
                   </div>
                   <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
                     {confirmingId === 'all' ? t('purge_all_alerts') : t('delete_alert')}
                   </h2>
                   {errorStatus && (
                      <div className="mx-4 md:mx-8 p-3 md:p-4 bg-rose-50 border border-rose-100 rounded-xl md:rounded-2xl text-rose-600 text-[9px] md:text-[10px] font-black uppercase tracking-tight mb-4 flex items-center gap-2 md:gap-3">
                        <AlertCircle className="w-4 h-4" />
                        {errorStatus}
                      </div>
                    )}
                   <p className="text-slate-500 font-medium text-sm leading-relaxed px-4">
                     {confirmingId === 'all' 
                       ? t('purge_all_confirm')
                       : t('delete_alert_confirm')
                     }
                   </p>
                </div>
                <div className="p-8 bg-slate-50/50 flex gap-4">
                   <button 
                     onClick={() => {
                       setIsConfirmOpen(false);
                       setConfirmingId(null);
                     }}
                     className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all bg-white rounded-2xl border border-slate-100"
                   >
                     {t('cancel')}
                   </button>
                    {confirmingId === 'all' ? (
                      <button 
                        onClick={deleteAndClose}
                        className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-white bg-slate-900 rounded-2xl shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        {t('delete_and_close')}
                      </button>
                    ) : (
                      <button 
                        onClick={handleDelete}
                        className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-white bg-rose-600 rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all"
                      >
                        {t('confirm_delete')}
                      </button>
                    )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationHistory;

