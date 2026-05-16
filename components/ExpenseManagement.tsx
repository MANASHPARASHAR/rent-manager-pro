
import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft,
  ChevronRight,
  Receipt, 
  Plus, 
  Trash2, 
  Calendar, 
  Filter, 
  Search, 
  IndianRupee, 
  Building2,
  Tag,
  FileText,
  AlertCircle,
  X,
  History,
  Users
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { useLanguageStore } from '../lib/i18n';
import { UserRole, Expense, Property } from '../types';

const CATEGORIES = [
  'Maintenance',
  'Electricity Bill',
  'Water Bill',
  'Property Tax',
  'Cleaning',
  'Repairs',
  'Plumbing',
  'Electrical',
  'Painting',
  'Marketing',
  'Legal/Admin',
  'Insurance',
  'Others'
];

const ExpenseManagement: React.FC = () => {
  const store = useRentalStore();
  const { t, language } = useLanguageStore();
  const { effectiveUser, properties, expenses, addExpense, deleteExpense } = store;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterProperty, setFilterProperty] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    propertyId: '',
    category: CATEGORIES[0],
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const isUserAdmin = effectiveUser?.role === UserRole.ADMIN || 
                      effectiveUser?.username?.toLowerCase().trim() === 'manashparashar9926@gmail.com';

  const availableProperties = useMemo(() => {
    if (isUserAdmin) return properties;
    
    const lowerUsername = effectiveUser?.username?.toLowerCase().trim() || '';
    const lowerUserId = effectiveUser?.id?.toLowerCase() || '';
    
    return properties.filter(p => {
      const allowed = (p.allowedUserIds || []).map(id => id.toLowerCase());
      return (effectiveUser?.assignedPropertyIds || []).includes(p.id) ||
             allowed.includes(lowerUserId) ||
             allowed.includes(lowerUsername);
    });
  }, [properties, effectiveUser, isUserAdmin]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesProperty = filterProperty === 'all' || exp.propertyId === filterProperty;
      const matchesUser = filterUser === 'all' || exp.createdBy === filterUser;
      const matchesMonth = !filterMonth || exp.month === filterMonth;
      const matchesSearch = !searchQuery || 
        (exp.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exp.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exp.createdByRole || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      // Visibility Logic: 
      // 1. Admins see EVERYTHING.
      // 2. Others see expenses for properties they manage.
      // 3. ADMIN-created expenses are visible to everyone (as requested).
      const property = properties.find(p => p.id === exp.propertyId);
      const userAllowedInProp = (property?.allowedUserIds || []).map(id => id.toLowerCase());
      const lowerUsername = effectiveUser?.username?.toLowerCase().trim() || '';
      const lowerUserId = effectiveUser?.id?.toLowerCase() || '';
      
      const hasPermission = isUserAdmin || 
                            userAllowedInProp.includes(lowerUserId) ||
                            userAllowedInProp.includes(lowerUsername) ||
                            exp.createdBy === effectiveUser?.id ||
                            exp.createdByRole === UserRole.ADMIN;

      return matchesProperty && matchesUser && matchesMonth && matchesSearch && hasPermission;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, properties, filterProperty, filterUser, filterMonth, searchQuery, effectiveUser, isUserAdmin]);

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    return { total };
  }, [filteredExpenses]);

  const handlePrevMonth = () => {
    const [year, month] = filterMonth.split('-').map(Number);
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setFilterMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = filterMonth.split('-').map(Number);
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setFilterMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const handleCreate = async () => {
    if (!formData.propertyId || !formData.amount || !formData.date) {
      console.warn("Validation failed: missing required fields", formData);
      return;
    }

    try {
      await addExpense({
        propertyId: formData.propertyId,
        category: formData.category,
        amount: parseFloat(formData.amount),
        date: formData.date,
        month: formData.date.substring(0, 7),
        description: formData.description
      });
      setIsModalOpen(false);
      setFormData({
        propertyId: '',
        category: CATEGORIES[0],
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
    } catch (error) {
      console.error("Failed to add expense:", error);
    }
  };

  const getPropertyName = (id: string) => {
    const prop = properties.find(p => String(p.id) === String(id));
    if (prop) return prop.name;
    return `Unknown Property [${id}]`;
  };

  const openModal = () => {
    setFormData({ 
      ...formData, 
      propertyId: availableProperties.length > 0 ? availableProperties[0].id : '' 
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 text-rose-500 font-bold mb-3">
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-rose-400">{t('expense_ledger')}</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{t('expense_management')}</h1>
          <p className="text-slate-500 mt-2 font-medium">{t('track_categorize')}</p>
        </div>

        <button 
          onClick={openModal}
          className="bg-slate-900 text-white px-8 py-4 rounded-[2rem] flex items-center gap-3 hover:bg-slate-800 transition-all font-black uppercase text-[11px] tracking-widest shadow-xl h-16"
        >
          <Plus className="w-5 h-5" /> {t('add_expense')}
        </button>
      </header>

      {/* STATS AREA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50/50 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-rose-100/50 transition-colors"></div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('total_expenses')}</p>
            <h3 className="text-4xl font-black text-slate-950 tracking-tighter flex items-center gap-2">
              <IndianRupee className="w-8 h-8 text-rose-500" />
              {stats.total.toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-400 font-bold mt-2">{t('filter_period_expenditure') || 'Filter period expenditure'}</p>
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4">{t('property_selection')}</label>
               <div className="relative group">
                  <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-black text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none"
                    value={filterProperty}
                    onChange={e => setFilterProperty(e.target.value)}
                  >
                    <option value="all">{t('view_all_properties')}</option>
                    {availableProperties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
               </div>
            </div>

            {isUserAdmin && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4">{t('creator_context')}</label>
                <div className="relative group">
                    <Users className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <select 
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-black text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none"
                      value={filterUser}
                      onChange={e => setFilterUser(e.target.value)}
                    >
                      <option value="all">{t('staff_member')}</option>
                      {store.users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                </div>
              </div>
            )}

            <div className="min-w-[210px]">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4">{t('accounting_month')}</label>
               <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePrevMonth}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="relative group flex-1">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="month"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2 text-xs font-black text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-center"
                      value={filterMonth}
                      onChange={e => setFilterMonth(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={handleNextMonth}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
            </div>

            <div className="flex-1 min-w-[200px]">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4">{t('search_context')}</label>
               <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="text"
                    placeholder={`${t('search')}...`}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-black text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
               </div>
            </div>
        </div>
      </div>

      {/* EXPENSE LIST */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{t('date')} & {t('info_details') || 'Info'}</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{t('property')}</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{t('category')}</th>
                {isUserAdmin && <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{t('logged_by')}</th>}
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">{t('amount')}</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <History className="w-8 h-8 text-slate-200" />
                      </div>
                      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{t('no_expenses')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="group hover:bg-slate-50/30 transition-all">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                          <Calendar className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{new Date(expense.date).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-GB')}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5 line-clamp-1">{expense.description || t('no_description')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-xs font-black text-slate-600 uppercase tracking-tight">{getPropertyName(expense.propertyId)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        <Tag className="w-3 h-3" />
                        {expense.category}
                      </span>
                    </td>
                    {isUserAdmin && (
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[8px] font-black text-slate-500">
                             {(store.users.find(u => u.id === expense.createdBy)?.name || '??').charAt(0)}
                           </div>
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
                             {store.users.find(u => u.id === expense.createdBy)?.name || 'System'}
                           </span>
                        </div>
                      </td>
                    )}
                    <td className="px-8 py-6 text-right">
                      <span className="text-lg font-black text-rose-600">₹{expense.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                       <button 
                         onClick={() => {
                           console.log("Delete request for expense ID:", expense.id);
                           setConfirmingId(expense.id);
                           setIsConfirmOpen(true);
                         }}
                         className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-md border border-rose-200 flex items-center justify-center mx-auto scale-110 active:scale-95"
                         title="Delete Expense"
                       >
                         <Trash2 className="w-5 h-5" />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 backdrop-blur-md bg-slate-950/60 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
              <div className="p-8 text-center">
                 <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trash2 className="w-10 h-10" />
                 </div>
                 <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">{t('confirm_purge')}</h2>
                 {deleteError && (
                   <div className="mx-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-left mb-4">
                     <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                     <p className="text-[11px] font-black text-red-600 uppercase tracking-tight">
                       {deleteError}
                     </p>
                   </div>
                 )}
                 <p className="text-slate-500 font-medium text-sm leading-relaxed px-4">
                    {t('purge_warning')}
                 </p>
              </div>
              <div className="p-8 bg-slate-50/50 flex gap-4">
                 <button 
                   onClick={() => {
                     setIsConfirmOpen(false);
                     setConfirmingId(null);
                     setDeleteError(null);
                   }}
                   className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all bg-white rounded-2xl border border-slate-100"
                 >
                   {t('keep_record')}
                 </button>
                 <button 
                   onClick={async () => {
                     if (confirmingId) {
                        try {
                          setDeleteError(null);
                          await deleteExpense(confirmingId);
                          setIsConfirmOpen(false);
                          setConfirmingId(null);
                        } catch (e: any) {
                          console.error("Delete failed in modal:", e);
                          try {
                            const errObj = JSON.parse(e.message);
                            setDeleteError(errObj.error || "Permission Denied: Insufficient privileges.");
                          } catch {
                            setDeleteError(e.message || "Permission Denied: Insufficient privileges to delete this record.");
                          }
                        }
                     }
                   }}
                   className="flex-1 bg-rose-600 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-rose-700 transition-all"
                 >
                   {t('delete_forever')}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* ADD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10 backdrop-blur-md bg-slate-950/40 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl"><Receipt className="w-6 h-6" /></div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('add_expense')}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('operational_ledger')}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-rose-500 transition-all font-bold"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('property')}</label>
                  <div className="relative group">
                    <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500" />
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                      value={formData.propertyId}
                      onChange={e => setFormData({...formData, propertyId: e.target.value})}
                    >
                      <option value="" disabled>{t('select_property')}</option>
                      {availableProperties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      {availableProperties.length === 0 && (
                        <option value="" disabled>No properties assigned</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('category')}</label>
                  <div className="relative group">
                    <Tag className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500" />
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('date')}</label>
                  <div className="relative group">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500" />
                    <input 
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('amount')}</label>
                  <div className="relative group">
                    <IndianRupee className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500" />
                    <input 
                      type="number"
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('description')}</label>
                <div className="relative group">
                  <FileText className="absolute left-6 top-6 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500" />
                  <textarea 
                    placeholder={t('provide_spend_details')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[2.5rem] pl-16 pr-6 py-6 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all min-h-[120px]"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-start gap-4">
                  <AlertCircle className="w-5 h-5 text-indigo-500 mt-0.5" />
                  <p className="text-[10px] font-black text-slate-500 uppercase leading-relaxed tracking-widest">
                    {t('net_liquidity_notice')}
                  </p>
              </div>
            </div>

            <div className="p-10 bg-slate-50/50 border-t border-slate-50 grid grid-cols-2 gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-full py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
              >
                {t('abort')}
              </button>
              <button 
                onClick={handleCreate}
                className="w-full bg-slate-900 text-white py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all"
              >
                {t('settle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseManagement;
