
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Plus, 
  ChevronRight, 
  Search, 
  Filter,
  Trash2,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
  Navigation,
  Settings,
  PlusCircle,
  Map,
  AlertCircle,
  Layers,
  Loader2,
  Users,
  CheckCircle2
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole, Property, User } from '../types';

const PropertyManagement: React.FC = () => {
  const store = useRentalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [showCityConfig, setShowCityConfig] = useState(false);
  const [newCityInput, setNewCityInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [expectedDeleteName, setExpectedDeleteName] = useState('');
  
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

  const isAdmin = store.user?.role === UserRole.ADMIN;
  
  const [formProp, setFormProp] = useState({
    name: '',
    address: '',
    typeId: '',
    city: '',
    allowedUserIds: [] as string[]
  });

  if (store.isBooting) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-white rounded-[3rem] border border-gray-100 shadow-sm animate-in fade-in duration-500 text-center">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Syncing Property Catalog...</h3>
        <p className="text-slate-500 font-medium mt-2">Connecting to Google Cloud Database</p>
      </div>
    );
  }

  useEffect(() => {
    if (!formProp.typeId && store.propertyTypes?.length > 0 && isAdding) {
      setFormProp(prev => ({
        ...prev,
        typeId: store.propertyTypes[0].id,
        city: store.config?.cities?.[0] || ''
      }));
    }
  }, [store.propertyTypes, store.config, isAdding]);

  const handleStartEdit = (prop: Property) => {
    setEditingProp(prop);
    setFormProp({
      name: prop.name,
      address: prop.address,
      typeId: prop.propertyTypeId,
      city: prop.city || '',
      allowedUserIds: prop.allowedUserIds || []
    });
    setIsAdding(true);
  };

  const handleToggleUser = (userId: string) => {
    setFormProp(prev => ({
      ...prev,
      allowedUserIds: prev.allowedUserIds.includes(userId)
        ? prev.allowedUserIds.filter(id => id !== userId)
        : [...prev.allowedUserIds, userId]
    }));
  };

  const handleSaveProperty = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formProp.name.trim() || !formProp.address.trim() || !formProp.city.trim() || !formProp.typeId.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: editingProp ? "Update Property" : "Add Property",
      message: `Authorize ${editingProp ? 'changes' : 'creation'} for "${formProp.name}"?`,
      actionLabel: editingProp ? "Update" : "Create",
      icon: <Building2 className="w-10 h-10" />,
      onConfirm: () => {
        if (editingProp) {
          store.updateProperty(editingProp.id, {
            name: formProp.name,
            address: formProp.address,
            city: formProp.city,
            propertyTypeId: formProp.typeId,
            allowedUserIds: formProp.allowedUserIds
          });
        } else {
          store.addProperty({
            id: 'p' + Date.now(),
            name: formProp.name,
            address: formProp.address,
            city: formProp.city,
            propertyTypeId: formProp.typeId,
            createdAt: new Date().toISOString(),
            isVisibleToManager: true,
            allowedUserIds: formProp.allowedUserIds
          });
        }
        setIsAdding(false);
        setEditingProp(null);
        setFormProp({ name: '', address: '', typeId: '', city: '', allowedUserIds: [] });
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteProperty = (id: string, name: string) => {
    setExpectedDeleteName(name);
    setConfirmDeleteInput('');
    setConfirmConfig({
      isOpen: true,
      isDanger: true,
      title: "Delete Property",
      message: `CRITICAL: Deleting "${name}" will remove all associated data permanently.`,
      actionLabel: "Permanently Delete",
      icon: <AlertTriangle className="w-10 h-10" />,
      onConfirm: () => {
        store.deleteProperty(id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const filteredProperties = useMemo(() => {
    return (store.properties || []).filter((p: Property) => {
      const isAuthorized = isAdmin || (p.allowedUserIds || []).includes(store.user?.id || '');
      if (!isAuthorized) return false;

      const nameMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const cityMatch = selectedCity === 'all' || p.city === selectedCity;
      return nameMatch && cityMatch;
    });
  }, [store.properties, store.user, isAdmin, searchTerm, selectedCity]);

  const personnel = useMemo(() => {
    return (store.users || []).filter((u: User) => u.role !== UserRole.ADMIN);
  }, [store.users]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95">
            <div className={`p-10 text-center ${confirmConfig.isDanger ? 'bg-red-50/50' : 'bg-indigo-50/50'}`}>
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmConfig.isDanger ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-indigo-600 text-white shadow-indigo-500/20'}`}>
                {confirmConfig.icon}
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">{confirmConfig.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-6">{confirmConfig.message}</p>
              
              {confirmConfig.isDanger && (
                <div className="mt-4 text-left space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type property name to confirm</label>
                  <input autoFocus className="w-full bg-white border-2 border-red-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none focus:border-red-500" placeholder={expectedDeleteName} value={confirmDeleteInput} onChange={e => setConfirmDeleteInput(e.target.value)} />
                </div>
              )}
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
              <button disabled={confirmConfig.isDanger && confirmDeleteInput !== expectedDeleteName} onClick={confirmConfig.onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 ${confirmConfig.isDanger ? 'bg-red-500' : 'bg-indigo-600'}`}>{confirmConfig.actionLabel}</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Your Properties</h1>
          <p className="text-gray-500 mt-1 font-medium">Manage all rental locations and assign personnel access.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && <button onClick={() => setShowCityConfig(true)} className="p-3 bg-white border border-gray-200 text-gray-400 rounded-xl hover:text-indigo-600 shadow-sm active:scale-95"><Settings className="w-5 h-5" /></button>}
          {isAdmin && <button onClick={() => { setIsAdding(true); setEditingProp(null); setFormProp({ name: '', address: '', typeId: store.propertyTypes?.[0]?.id || '', city: store.config?.cities?.[0] || '', allowedUserIds: [] }); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-lg font-black uppercase text-[10px] tracking-widest"><Plus className="w-5 h-5" /> Add Property</button>}
        </div>
      </header>

      {isAdding && isAdmin && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-black text-gray-900 uppercase">{editingProp ? 'Edit Property' : 'New Property'}</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSaveProperty} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {error && <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-xs font-bold">{error}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Property Name</label><input required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Skyline Towers" value={formProp.name} onChange={e => setFormProp({...formProp, name: e.target.value})} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">City</label><select required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none" value={formProp.city} onChange={e => setFormProp({...formProp, city: e.target.value})}><option value="">Select City...</option>{(store.config?.cities || []).map((city: string) => <option key={city} value={city}>{city}</option>)}</select></div>
              </div>

              <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Location Address</label><input required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Street, City, State" value={formProp.address} onChange={e => setFormProp({...formProp, address: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Schema Template</label><select required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none" value={formProp.typeId} onChange={e => setFormProp({...formProp, typeId: e.target.value})}><option value="">Select Schema...</option>{(store.propertyTypes || []).map((pt: any) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}</select></div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-2 mb-4"><Users className="w-4 h-4" /> Permitted Personnel</label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {personnel.length > 0 ? personnel.map((u: User) => (
                    <label key={u.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${formProp.allowedUserIds.includes(u.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${formProp.allowedUserIds.includes(u.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{u.name.charAt(0)}</div>
                        <div>
                          <p className="text-xs font-black uppercase text-slate-900">{u.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{u.role} Access</p>
                        </div>
                      </div>
                      <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={formProp.allowedUserIds.includes(u.id)} onChange={() => handleToggleUser(u.id)} />
                    </label>
                  )) : (
                    <p className="text-center py-6 text-[10px] font-black uppercase text-slate-300 italic">No non-admin users found.</p>
                  )}
                </div>
              </div>
              
              <div className="pt-4 flex gap-4"><button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancel</button><button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">{editingProp ? 'Update Record' : 'Create Entry'}</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-indigo-100 transition-all font-semibold text-sm" placeholder="Search portfolio..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select className="bg-gray-50 border border-transparent rounded-xl px-4 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-gray-100" value={selectedCity} onChange={e => setSelectedCity(e.target.value)}><option value="all">All Cities</option>{(store.config?.cities || []).map((city: string) => <option key={city} value={city}>{city}</option>)}</select>
        </div>
      </div>

      {filteredProperties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProperties.map((prop: Property) => {
            const type = (store.propertyTypes || []).find((t: any) => t.id === prop.propertyTypeId);
            const unitCount = (store.records || []).filter((r: any) => r.propertyId === prop.id).length;
            const allowedCount = (prop.allowedUserIds || []).length;
            
            return (
              <div key={prop.id} className="group bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-300 flex flex-col overflow-hidden">
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300"><Building2 className="w-8 h-8" /></div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button onClick={() => handleStartEdit(prop)} className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-all shadow-sm"><Settings className="w-5 h-5" /></button>
                        <button onClick={() => handleDeleteProperty(prop.id, prop.name)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{prop.name}</h3>
                  </div>
                  
                  <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-gray-400 font-bold text-[10px] uppercase tracking-widest"><MapPin className="w-3 h-3 text-indigo-400" /><span className="truncate">{prop.address || 'No Address'}</span></div>
                      {prop.city && <div className="flex items-center gap-2 text-indigo-400 font-black text-[9px] uppercase tracking-widest"><Navigation className="w-3 h-3" /><span>{prop.city}</span></div>}
                  </div>

                  <div className="mt-8 flex items-center gap-2">
                     <div className="flex -space-x-2">
                        {(prop.allowedUserIds || []).slice(0, 3).map((uid, idx) => {
                           const user = store.users.find((u: User) => u.id === uid);
                           return <div key={uid} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-500 uppercase">{user?.name.charAt(0) || 'U'}</div>;
                        })}
                     </div>
                     <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                        {allowedCount === 0 ? 'Admin Only Access' : `${allowedCount} Personnel Assigned`}
                     </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-gray-50 pt-6">
                    <div className="space-y-1"><p className="text-[10px] uppercase font-black text-gray-300 tracking-[0.2em]">Schema</p><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">{type?.name || 'Standard'}</span></div>
                    <div className="text-right"><p className="text-[10px] uppercase font-black text-gray-300 tracking-[0.2em]">Inventory</p><span className="text-2xl font-black text-gray-900">{unitCount} <span className="text-[10px] text-gray-400 font-bold">Units</span></span></div>
                  </div>
                </div>
                
                <Link to={`/properties/${prop.id}`} className="p-5 bg-gray-50 flex items-center justify-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Manage Units <ChevronRight className="w-4 h-4" /></Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[3rem] border border-gray-100 shadow-sm text-center">
           <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
              <Layers className="w-10 h-10 text-slate-200" />
           </div>
           <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Portfolio Locked</h2>
           <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
             No properties match your authorization level or filters. Contact Administrator to assign properties to your account.
           </p>
           {isAdmin && (
              <button onClick={() => setIsAdding(true)} className="mt-8 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all">
                 <PlusCircle className="w-5 h-5" /> Add New Asset
              </button>
           )}
        </div>
      )}
    </div>
  );
};

export default PropertyManagement;
