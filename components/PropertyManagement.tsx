
import React, { useState, useEffect } from 'react';
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
  Layers
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { UserRole } from '../types';

const PropertyManagement: React.FC = () => {
  const store = useRentalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [showCityConfig, setShowCityConfig] = useState(false);
  const [newCityInput, setNewCityInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Deletion confirmation state
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
  const isManager = store.user?.role === UserRole.MANAGER;
  const isViewer = store.user?.role === UserRole.VIEWER;
  const isRestricted = isManager || isViewer;

  // INITIAL STATE FIX: Use optional chaining to prevent crash if store arrays are empty at first mount
  const [newProp, setNewProp] = useState({
    name: '',
    address: '',
    typeId: '',
    city: ''
  });

  // Sync form defaults once data loads
  useEffect(() => {
    if (!newProp.typeId && store.propertyTypes?.length > 0) {
      setNewProp(prev => ({
        ...prev,
        typeId: store.propertyTypes[0].id,
        city: store.config?.cities?.[0] || ''
      }));
    }
  }, [store.propertyTypes, store.config, newProp.typeId]);

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newProp.name.trim() || !newProp.address.trim() || !newProp.city.trim() || !newProp.typeId.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!/^[A-Za-z\s]+$/.test(newProp.name)) {
      setError("Property name must contain only alphabets and spaces");
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: "Add Property",
      message: `Are you sure you want to add "${newProp.name}"?`,
      actionLabel: "Add Property",
      icon: <Building2 className="w-10 h-10" />,
      onConfirm: () => {
        store.addProperty({
          id: 'p' + Date.now(),
          name: newProp.name,
          address: newProp.address,
          city: newProp.city,
          propertyTypeId: newProp.typeId,
          createdAt: new Date().toISOString(),
          isVisibleToManager: true
        });
        setNewProp({ 
          name: '', 
          address: '', 
          typeId: store.propertyTypes?.[0]?.id || '', 
          city: store.config?.cities?.[0] || '' 
        });
        setIsAdding(false);
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

  const handleToggleVisibility = (id: string, name: string, isCurrentlyHidden: boolean) => {
    const action = isCurrentlyHidden ? 'show' : 'hide';
    setConfirmConfig({
      isOpen: true,
      title: "Change Visibility",
      message: `Are you sure you want to ${action} "${name}" for managers?`,
      actionLabel: `Confirm ${action}`,
      icon: isCurrentlyHidden ? <Eye className="w-10 h-10" /> : <EyeOff className="w-10 h-10" />,
      onConfirm: () => {
        store.togglePropertyVisibility(id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addCity = () => {
    setError(null);
    if (!newCityInput.trim()) return;
    const currentCities = store.config?.cities || [];
    if (currentCities.includes(newCityInput.trim())) {
      setError("This city already exists");
      return;
    }
    store.updateConfig({ cities: [...currentCities, newCityInput.trim()] });
    setNewCityInput('');
  };

  const removeCity = (city: string) => {
    const currentCities = store.config?.cities || [];
    store.updateConfig({ cities: currentCities.filter((c: string) => c !== city) });
  };

  const filteredProperties = (store.properties || []).filter((p: any) => {
    if (!p) return false;
    const name = (p.name || '').toLowerCase();
    const address = (p.address || '').toLowerCase();
    const query = (searchTerm || '').toLowerCase();
    
    const matchesSearch = name.includes(query) || address.includes(query);
    const matchesCity = selectedCity === 'all' || p.city === selectedCity;
    const matchesRole = isAdmin || p.isVisibleToManager !== false;
    
    return matchesSearch && matchesCity && matchesRole;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in">
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
                  <input 
                    autoFocus
                    className="w-full bg-white border-2 border-red-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none focus:border-red-500"
                    placeholder={expectedDeleteName}
                    value={confirmDeleteInput}
                    onChange={e => setConfirmDeleteInput(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
              <button disabled={confirmConfig.isDanger && confirmDeleteInput !== expectedDeleteName} onClick={confirmConfig.onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 ${confirmConfig.isDanger ? 'bg-red-500' : 'bg-indigo-600'}`}>
                {confirmConfig.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCityConfig && isAdmin && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl"><Map className="w-5 h-5" /></div>
                    <h3 className="text-xl font-black text-gray-900 uppercase">Manage Cities</h3>
                 </div>
                 <button onClick={() => setShowCityConfig(false)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-6">
                 {error && <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-xs font-bold">{error}</div>}
                 <div className="space-y-4">
                    <div className="flex gap-2">
                       <input className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none" placeholder="New City Name" value={newCityInput} onChange={e => setNewCityInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCity()} />
                       <button onClick={addCity} className="bg-indigo-600 text-white p-3 rounded-xl"><PlusCircle className="w-5 h-5" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                       {(store.config?.cities || []).map((city: string) => (
                          <div key={city} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2 group hover:border-rose-200 transition-all shadow-sm">
                             <span className="text-[11px] font-black uppercase text-slate-700">{city}</span>
                             <button onClick={() => removeCity(city)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-gray-50 border-t border-gray-100"><button onClick={() => setShowCityConfig(false)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Close</button></div>
           </div>
        </div>
      )}

      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Your Properties</h1>
          <p className="text-gray-500 mt-1 font-medium">Manage all rental locations and their inventories.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && <button onClick={() => setShowCityConfig(true)} className="p-3 bg-white border border-gray-200 text-gray-400 rounded-xl hover:text-indigo-600 shadow-sm active:scale-95"><Settings className="w-5 h-5" /></button>}
          {isAdmin && <button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-lg font-black uppercase text-[10px] tracking-widest"><Plus className="w-5 h-5" /> Add Property</button>}
        </div>
      </header>

      {isAdding && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-black text-gray-900 uppercase">New Property</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddProperty} className="p-8 space-y-6">
              {error && <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-xs font-bold">{error}</div>}
              <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Property Name</label><input required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Skyline Towers" value={newProp.name} onChange={e => setNewProp({...newProp, name: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Location Address</label><input required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Street, City, State" value={newProp.address} onChange={e => setNewProp({...newProp, address: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">City</label><select required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none cursor-pointer" value={newProp.city} onChange={e => setNewProp({...newProp, city: e.target.value})}><option value="">Select City...</option>{(store.config?.cities || []).map((city: string) => <option key={city} value={city}>{city}</option>)}</select></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Schema Template</label><select required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none cursor-pointer" value={newProp.typeId} onChange={e => setNewProp({...newProp, typeId: e.target.value})}><option value="">Select Schema...</option>{(store.propertyTypes || []).map((pt: any) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}</select></div>
              <div className="pt-4 flex gap-4"><button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancel</button><button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">Create Entry</button></div>
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
          {filteredProperties.map((prop: any) => {
            const type = (store.propertyTypes || []).find((t: any) => t.id === prop.propertyTypeId);
            const unitCount = (store.records || []).filter((r: any) => r.propertyId === prop.id).length;
            const isHidden = prop.isVisibleToManager === false;
            
            return (
              <div key={prop.id} className="group bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-300 flex flex-col overflow-hidden">
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300"><Building2 className="w-8 h-8" /></div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button onClick={() => handleToggleVisibility(prop.id, prop.name, isHidden)} className={`p-2 rounded-xl border ${isHidden ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`} title={isHidden ? "Hidden from Manager" : "Visible to Manager"}>{isHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                        <button onClick={() => handleDeleteProperty(prop.id, prop.name)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{prop.name}</h3>
                    {isAdmin && isHidden && <span className="text-[8px] font-black uppercase tracking-widest bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Hidden</span>}
                  </div>
                  
                  <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-gray-400 font-bold text-[10px] uppercase tracking-widest"><MapPin className="w-3 h-3 text-indigo-400" /><span className="truncate">{prop.address || 'No Address'}</span></div>
                      {prop.city && <div className="flex items-center gap-2 text-indigo-400 font-black text-[9px] uppercase tracking-widest"><Navigation className="w-3 h-3" /><span>{prop.city}</span></div>}
                  </div>

                  <div className="mt-10 flex items-center justify-between border-t border-gray-50 pt-6">
                    <div className="space-y-1"><p className="text-[10px] uppercase font-black text-gray-300 tracking-[0.2em]">Schema</p><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">{type?.name || 'Standard'}</span></div>
                    <div className="text-right"><p className="text-[10px] uppercase font-black text-gray-300 tracking-[0.2em]">Inventory</p><span className="text-2xl font-black text-gray-900">{unitCount} <span className="text-[10px] text-gray-400 font-bold">Units</span></span></div>
                  </div>
                </div>
                
                <Link to={`/properties/${prop.id}`} className="p-5 bg-gray-50 flex items-center justify-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all">{isViewer ? 'View Units' : 'Manage Units'} <ChevronRight className="w-4 h-4" /></Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[3rem] border border-gray-100 shadow-sm text-center">
           <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
              <Layers className="w-10 h-10 text-slate-200" />
           </div>
           <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">No Properties Found</h2>
           <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
             There are no properties to display for your account level or matching your search criteria.
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
