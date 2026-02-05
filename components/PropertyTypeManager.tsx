
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Settings2, 
  Layout, 
  Check, 
  X, 
  AlertCircle,
  List,
  ShieldAlert,
  Calendar,
  GripVertical,
  ShieldCheck,
  Lock,
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  ListOrdered,
  Activity,
  Phone,
  User,
  Table
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { ColumnType, ColumnDefinition, UserRole, PropertyType } from '../types';

const generateId = (prefix: string = ''): string => {
  return prefix + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

const PropertyTypeManager: React.FC = () => {
  const store = useRentalStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [defaultDueDateDay, setDefaultDueDateDay] = useState<number>(5);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    actionLabel: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    actionLabel: 'Confirm'
  });

  const isAdmin = store.user?.role === UserRole.ADMIN;
  const [tempColumns, setTempColumns] = useState<ColumnDefinition[]>([]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full"></div>
          <div className="relative bg-white p-8 rounded-[3rem] shadow-2xl border border-red-100">
             <ShieldAlert className="w-24 h-24 text-red-500" />
          </div>
          <div className="absolute -bottom-4 -right-4 bg-slate-950 p-4 rounded-3xl shadow-xl">
             <Lock className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4 uppercase">Access Denied</h2>
        <Link to="/" className="inline-flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl active:scale-95">
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setNewTypeName('');
    setDefaultDueDateDay(5);
    // Minimal production clean slate
    setTempColumns([
      { id: generateId('col_'), name: 'Tenant Name', type: ColumnType.TEXT, required: true, isRentCalculatable: false, isDefaultInLedger: true, order: 0 }
    ]);
  };

  const handleStartEdit = (type: PropertyType) => {
    setEditingId(type.id);
    setIsAdding(false);
    setDefaultDueDateDay(type.defaultDueDateDay || 5);
    setTempColumns([...type.columns].sort((a, b) => a.order - b.order));
  };

  const handleAddColumn = () => {
    setTempColumns([...tempColumns, {
      id: generateId('col_'),
      name: `New Field ${tempColumns.length + 1}`,
      type: ColumnType.TEXT,
      required: false,
      isRentCalculatable: false,
      isDefaultInLedger: false,
      order: tempColumns.length
    }]);
  };

  const handleUpdateColumn = (id: string, updates: Partial<ColumnDefinition>) => {
    setTempColumns(tempColumns.map(c => {
      if (c.id === id) {
        let updated = { ...c, ...updates };
        const systemTypes = [ColumnType.SECURITY_DEPOSIT, ColumnType.OCCUPANCY_STATUS, ColumnType.RENT_DUE_DAY];
        const nameLower = updated.name.toLowerCase();
        
        if (systemTypes.includes(updated.type) || nameLower === 'tenant name') {
          updated.required = true;
          updated.isRentCalculatable = false;
        }

        if (updated.type === ColumnType.OCCUPANCY_STATUS && (!updated.options || updated.options.length === 0)) {
           updated.options = ['Active', 'Vacant'];
        }
        
        if (updated.type === ColumnType.DROPDOWN && (!updated.options || updated.options.length === 0)) {
          updated.options = ['Option 1'];
        }
        
        return updated;
      }
      return c;
    }));
  };

  const getDropdownOptionsError = (col: ColumnDefinition) => {
    if (col.type !== ColumnType.DROPDOWN && col.type !== ColumnType.OCCUPANCY_STATUS) return null;
    if (!col.options || col.options.length === 0) return "At least one option is required.";
    const options = col.options;
    if (options.some(o => o.trim() === "")) return "Empty values are not allowed.";
    return null;
  };

  const validateSchema = (typeName: string, cols: ColumnDefinition[]) => {
    if (!typeName.trim()) { setError("Property Type name is required."); return false; }
    if (cols.length === 0) { setError("At least one field is required."); return false; }
    if (cols.some(c => !c.name.trim())) { setError("All fields must have names."); return false; }
    return true;
  };

  const saveNewType = () => {
    if (!validateSchema(newTypeName, tempColumns)) return;
    setConfirmConfig({
      isOpen: true,
      title: "Create Schema",
      message: `Initialize "${newTypeName}" schema?`,
      actionLabel: "Confirm",
      onConfirm: () => {
        store.addPropertyType({ id: generateId('pt_'), name: newTypeName.trim(), columns: tempColumns, defaultDueDateDay });
        setIsAdding(false);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const saveEditChanges = (id: string) => {
    const type = store.propertyTypes.find((t: any) => t.id === id);
    if (!type || !validateSchema(type.name, tempColumns)) return;
    setConfirmConfig({
      isOpen: true,
      title: "Update Schema",
      message: `Structural changes will be applied to all linked units. Continue?`,
      actionLabel: "Apply Changes",
      onConfirm: () => {
        store.updatePropertyType({ ...type, columns: tempColumns, defaultDueDateDay });
        setEditingId(null);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeletePropertyType = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      isDanger: true,
      title: "Delete Schema",
      message: `Warning: This will render existing data for units using "${name}" inaccessible.`,
      actionLabel: "Confirm Deletion",
      onConfirm: () => {
        store.deletePropertyType(id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newCols = [...tempColumns];
    const draggedItem = newCols[draggedIndex];
    newCols.splice(draggedIndex, 1);
    newCols.splice(index, 0, draggedItem);
    setTempColumns(newCols.map((col, idx) => ({ ...col, order: idx })));
    setDraggedIndex(index);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-10 text-center ${confirmConfig.isDanger ? 'bg-red-50/50' : 'bg-indigo-50/50'}`}>
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmConfig.isDanger ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}>
                {confirmConfig.isDanger ? <AlertTriangle className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">{confirmConfig.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed">{confirmConfig.message}</p>
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Cancel</button>
              <button onClick={confirmConfig.onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 ${confirmConfig.isDanger ? 'bg-red-500' : 'bg-indigo-600'}`}>{confirmConfig.actionLabel}</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Property Schema</h1>
          <p className="text-gray-500 mt-1 font-medium">Define data structures for different rental types.</p>
        </div>
        {!isAdding && !editingId && (
          <button onClick={handleStartAdd} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 active:scale-95">
            <Plus className="w-5 h-5" /> New Schema
          </button>
        )}
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0" /><p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {(isAdding || editingId) && (
        <div className="bg-white border-2 border-indigo-100 p-8 rounded-[2.5rem] shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between pb-6 border-b border-gray-100">
            <div><h2 className="text-2xl font-black text-gray-900 uppercase">{isAdding ? 'Initialize Schema' : 'Refine Schema'}</h2></div>
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Schema Title</label>
              <input 
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-lg font-black text-gray-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" 
                placeholder="e.g. Apartment Unit" 
                value={isAdding ? newTypeName : store.propertyTypes.find((t: any) => t.id === editingId)?.name || ''} 
                onChange={(e) => isAdding ? setNewTypeName(e.target.value) : store.updatePropertyType({ ...store.propertyTypes.find((t: any) => t.id === editingId)!, name: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500" /> Default Due Day</label>
              <input type="number" min="1" max="31" className="w-24 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-lg font-black text-gray-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={defaultDueDateDay} onChange={(e) => setDefaultDueDateDay(parseInt(e.target.value) || 1)} />
            </div>
          </div>

          <div className="space-y-4">
             {tempColumns.map((col, index) => {
               const nameLower = col.name.toLowerCase();
               const isTenantName = nameLower === 'tenant name';
               return (
                 <div key={col.id} draggable={!isTenantName} onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => handleDragOver(e, index)} className={`grid grid-cols-12 gap-x-4 items-center bg-white p-5 rounded-3xl border ${isTenantName ? 'border-amber-200 bg-amber-50/5' : 'border-gray-100 shadow-sm'} hover:border-indigo-200 transition-all group`}>
                   <div className="col-span-1 flex items-center justify-center cursor-grab active:cursor-grabbing">
                      {isTenantName ? <User className="w-6 h-6 text-amber-500" /> : <GripVertical className="w-6 h-6 text-gray-300" />}
                   </div>
                   <div className="col-span-4">
                      <input className={`w-full bg-gray-50 border border-gray-100 p-3 rounded-xl text-sm font-black outline-none group-hover:bg-white transition-colors`} value={col.name} onChange={e => handleUpdateColumn(col.id, {name: e.target.value})} />
                   </div>
                   <div className="col-span-2">
                     <select className="w-full border border-gray-100 p-3 rounded-xl text-sm font-black bg-gray-50 outline-none group-hover:bg-white transition-colors" value={col.type} onChange={e => handleUpdateColumn(col.id, {type: e.target.value as ColumnType})}>
                       {Object.values(ColumnType).map(t => (
                         <option key={t} value={t}>{t.split('_').map(w => w.toUpperCase()).join(' ')}</option>
                       ))}
                     </select>
                   </div>
                   <div className="col-span-4 flex justify-around">
                      <label className="flex flex-col items-center gap-1">
                        <span className="text-[8px] font-black text-gray-400 uppercase">Rent Calc</span>
                        <input type="checkbox" checked={col.isRentCalculatable} onChange={e => handleUpdateColumn(col.id, {isRentCalculatable: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      </label>
                      <label className="flex flex-col items-center gap-1">
                        <span className="text-[8px] font-black text-gray-400 uppercase">Required</span>
                        <input type="checkbox" checked={col.required} onChange={e => handleUpdateColumn(col.id, {required: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      </label>
                      <label className="flex flex-col items-center gap-1">
                        <span className="text-[8px] font-black text-gray-400 uppercase">Ledger</span>
                        <input type="checkbox" checked={col.isDefaultInLedger} onChange={e => handleUpdateColumn(col.id, {isDefaultInLedger: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      </label>
                   </div>
                   <div className="col-span-1 text-right">
                     {!isTenantName && <button onClick={() => setTempColumns(tempColumns.filter(c => c.id !== col.id))} className="p-3 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>}
                   </div>

                   {(col.type === ColumnType.DROPDOWN || col.type === ColumnType.OCCUPANCY_STATUS) && (
                      <div className="col-span-12 mt-4 ml-11 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in slide-in-from-top-2">
                         <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">Options (Comma Separated)</label>
                         <input className="w-full bg-white border border-indigo-200 p-4 rounded-xl text-xs font-bold outline-none shadow-sm" placeholder="e.g. Active, Vacant" value={col.options?.join(', ') || ''} onChange={e => handleUpdateColumn(col.id, { options: e.target.value.split(',').map(s => s.trim()).filter(s => s !== "") })} />
                      </div>
                   )}
                 </div>
               );
             })}
             <button onClick={handleAddColumn} className="w-full py-6 border-4 border-dashed border-indigo-50 rounded-3xl text-indigo-400 font-black text-xs uppercase hover:bg-indigo-50 transition-all flex items-center justify-center gap-3">
               <Plus className="w-6 h-6" /> Add Data Field
             </button>
          </div>
          
          <div className="flex justify-end gap-4 pt-8 border-t border-gray-100">
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-8 py-3.5 text-gray-500 font-black text-xs uppercase tracking-widest hover:text-slate-800">Cancel</button>
            <button onClick={() => isAdding ? saveNewType() : saveEditChanges(editingId!)} className="bg-indigo-600 text-white px-12 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700">
              {isAdding ? 'Initialize Schema' : 'Save Structure'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {store.propertyTypes.map((type: PropertyType) => (
          <div key={type.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 flex items-center justify-between group hover:border-indigo-100 hover:shadow-xl transition-all duration-300">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Layout className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">{type.name}</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{type.columns.length} Fields • Due Day: {type.defaultDueDateDay}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 ml-8">
              <button onClick={() => handleStartEdit(type)} className="bg-white text-indigo-600 font-black text-[10px] uppercase tracking-widest border border-indigo-100 px-6 py-3 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95">
                <Settings2 className="w-4 h-4 mr-2 inline" /> Configure
              </button>
              <button onClick={() => handleDeletePropertyType(type.id, type.name)} className="p-3 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PropertyTypeManager;
