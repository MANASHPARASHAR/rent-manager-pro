
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Plus, 
  ChevronRight, 
  Search, 
  Filter,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
  ShieldCheck,
  Layout
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

const PropertyManagement: React.FC = () => {
  const store = useRentalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
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

  const isAdmin = store.user.role === UserRole.ADMIN;
  const isManager = store.user.role === UserRole.MANAGER;
  const isViewer = store.user.role === UserRole.VIEWER;

  const [newProp, setNewProp] = useState({
    name: '',
    address: '',
    typeId: store.propertyTypes[0]?.id || ''
  });

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProp.name || !newProp.typeId) return;

    setConfirmConfig({
      isOpen: true,
      title: "Add Property",
      message: `Are you sure you want to add "${newProp.name}" to your current portfolio? This will initialize a new property entry.`,
      actionLabel: "Add Property",
      icon: <Building2 className="w-10 h-10" />,
      onConfirm: () => {
        store.addProperty({
          id: 'p' + Date.now(),
          name: newProp.name,
          address: newProp.address,
          propertyTypeId: newProp.typeId,
          createdAt: new Date().toISOString()
        });
        setNewProp({ name: '', address: '', typeId: store.propertyTypes[0]?.id || '' });
        setIsAdding(false);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteProperty = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      isDanger: true,
      title: "Delete Property",
      message: `CRITICAL: Permanent deletion of "${name}". This action will remove ALL associated unit data and historical ledgers across the entire system. Are you absolutely sure?`,
      actionLabel: "Permanently Delete",
      icon: <AlertTriangle className="w-10 h-10" />,
      onConfirm: () => {
        store.deleteProperty(id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleVisibility = (id: string, name: string, isCurrentlyHidden: boolean) => {
    const action = isCurrentlyHidden ? 'show' : 'hide';
    setConfirmConfig({
      isOpen: true,
      title: "Change Visibility",
      message: `Are you sure you want to ${action} "${name}" for managers? This affects what properties managers can access in their dashboard.`,
      actionLabel: `Confirm ${action}`,
      icon: isCurrentlyHidden ? <Eye className="w-10 h-10" /> : <EyeOff className="w-10 h-10" />,
      onConfirm: () => {
        store.togglePropertyVisibility(id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const filteredProperties = store.properties.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !isManager || p.isVisibleToManager !== false;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-10 text-center ${confirmConfig.isDanger ? 'bg-red-50/50' : 'bg-indigo-50/50'}`}>
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmConfig.isDanger ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}>
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
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Your Properties</h1>
          <p className="text-gray-500 mt-1 font-medium">Manage all rental locations and their inventories.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-black uppercase text-[10px] tracking-widest"
          >
            <Plus className="w-5 h-5" /> Add Property
          </button>
        )}
      </header>

      {isAdding && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-black text-gray-900 uppercase">New Property</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleAddProperty} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Property Name</label>
                <input 
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="e.g. Skyline Towers"
                  value={newProp.name}
                  onChange={e => setNewProp({...newProp, name: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Location Address</label>
                <input 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Street, City, State"
                  value={newProp.address}
                  onChange={e => setNewProp({...newProp, address: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Schema Template</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                  value={newProp.typeId}
                  onChange={e => setNewProp({...newProp, typeId: e.target.value})}
                >
                  {store.propertyTypes.map((pt: any) => (
                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">Create Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm font-semibold"
            placeholder="Search portfolio..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredProperties.map((prop: any) => {
          const type = store.propertyTypes.find((t: any) => t.id === prop.propertyTypeId);
          const unitCount = store.records.filter((r: any) => r.propertyId === prop.id).length;
          const isHidden = prop.isVisibleToManager === false;
          
          return (
            <div key={prop.id} className="group bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-300 flex flex-col overflow-hidden">
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-4 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                    <Building2 className="w-8 h-8" />
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleToggleVisibility(prop.id, prop.name, isHidden)}
                        className={`p-2 rounded-xl border ${isHidden ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}
                        title={isHidden ? "Hidden from Manager" : "Visible to Manager"}
                      >
                        {isHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteProperty(prop.id, prop.name)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                   <h3 className="text-2xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{prop.name}</h3>
                   {isAdmin && isHidden && <span className="text-[8px] font-black uppercase tracking-widest bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Hidden</span>}
                </div>
                
                <div className="mt-2 flex items-center gap-2 text-gray-400 font-bold text-xs uppercase tracking-widest">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  <span className="truncate">{prop.address || 'Address not listed'}</span>
                </div>

                <div className="mt-10 flex items-center justify-between border-t border-gray-50 pt-6">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-black text-gray-300 tracking-[0.2em]">Schema</p>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">{type?.name || 'Standard'}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black text-gray-300 tracking-[0.2em]">Inventory</p>
                    <span className="text-2xl font-black text-gray-900">{unitCount} <span className="text-[10px] text-gray-400 font-bold">Units</span></span>
                  </div>
                </div>
              </div>
              
              <Link 
                to={`/properties/${prop.id}`}
                className="p-5 bg-gray-50 flex items-center justify-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
              >
                {isViewer ? 'View Units' : 'Manage Units'} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PropertyManagement;
