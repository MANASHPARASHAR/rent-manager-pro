
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  Clock, 
  AlertCircle, 
  X,
  ShieldAlert,
  Zap,
  CheckCircle2,
  BellRing,
  Trash2
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { AppNotification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguageStore } from '../lib/i18n';

const NotificationCenter: React.FC = () => {
  const store = useRentalStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguageStore();

  const notifications = useMemo(() => {
    const currentUsername = store.user?.username?.toLowerCase().trim();
    return (store.notifications || [])
      .filter((n: AppNotification) => n.userId?.toLowerCase().trim() === currentUsername)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [store.notifications, store.user?.username]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleMarkAsRead = async (id: string) => {
    await store.markNotificationAsRead(id);
  };

  const handleDeleteAll = async () => {
    // confirm() is ignored in sandboxed iframes
    await store.deleteAllNotifications();
  };

  const handleRequestPermission = async () => {
    const granted = await store.requestNotificationPermission();
    if (granted) {
      alert("Notifications enabled! You'll now receive browser alerts for overdue rent.");
    } else {
      alert("Notification permission denied.");
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 60) return `${mins}${t('min')} ${t('ago')}`;
    if (hours < 24) return `${hours}${t('hour')} ${t('ago')}`;
    return `${days}${t('day')} ${t('ago')}`;
  };

  return (
    <div className="relative z-[1001]">
      <div className="flex items-center gap-3">
        {Notification.permission === 'default' && (
          <button 
            onClick={handleRequestPermission}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            <BellRing className="w-3.5 h-3.5" />
            {t('enable_alerts')}
          </button>
        )}
        
        <button 
          onClick={toggleOpen}
          className={`relative p-3 rounded-2xl transition-all shadow-sm border ${isOpen ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce-slow">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-96 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 z-20 overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{t('alert_center')}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    {unreadCount} {t('unread_notifications')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button 
                      onClick={handleDeleteAll}
                      className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all"
                      title={t('delete_all_alerts')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10 text-slate-200" />
                    </div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('everything_up_to_date')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-6 flex gap-4 hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-indigo-50/30' : ''}`}
                      >
                        <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                          n.type === 'RENT_OVERDUE' ? 'bg-rose-50 text-rose-500' : 
                          n.type === 'EXPENSE' ? 'bg-amber-50 text-amber-500' : 
                          'bg-indigo-50 text-indigo-500'
                        }`}>
                          {n.type === 'RENT_OVERDUE' ? <ShieldAlert className="w-6 h-6" /> : 
                           n.type === 'EXPENSE' ? <Zap className="w-6 h-6" /> : 
                           <Bell className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                             <h4 className={`text-xs font-black uppercase tracking-tight truncate ${!n.isRead ? 'text-slate-900' : 'text-slate-600'}`}>
                               {n.title}
                             </h4>
                             <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap ml-2">
                               {formatTime(n.createdAt)}
                             </span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                            {n.message}
                          </p>
                          {!n.isRead && (
                            <button 
                              onClick={() => handleMarkAsRead(n.id)}
                              className="mt-3 flex items-center gap-1.5 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:text-indigo-700"
                            >
                              <Check className="w-3 h-3" /> {t('mark_read')}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-6 bg-slate-50 text-center">
                  <button 
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/notifications');
                    }}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
                  >
                    {t('view_alert_history')}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
