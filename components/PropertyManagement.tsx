
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
  CheckCircle2,
  Globe,
  ChevronUp,
  ChevronDown,
  Coins,
  IndianRupee
} from 'lucide-react';
import { useRentalStore } from '../store/useRentalStore';
import { useLanguageStore } from '../lib/i18n';
import { UserRole, Property, User, ColumnType } from '../types';

const PropertyManagement: React.FC = () => {
  const store = useRentalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'vacant' | 'occupied'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [showCityConfig, setShowCityConfig] = useState(false);
  const [newCityInput, setNewCityInput] = useState('');
  const [editingCity, setEditingCity] = useState<{ original: string, current: string } | null>(null);
  const [allManagersSelected, setAllManagersSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [expectedDeleteName, setExpectedDeleteName] = useState('');
  const { t, language } = useLanguageStore();
  
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
    actionLabel: t('confirm') || 'Confirm'
  });

  const SUPERADMIN_EMAIL = 'manashparashar9926@gmail.com';
  const isAdmin = store.user?.role === UserRole.ADMIN || 
                   store.user?.username?.toLowerCase().trim() === SUPERADMIN_EMAIL;
  const isManager = store.user?.role === UserRole.MANAGER;
  const effectiveUser = store.effectiveUser;
  const effectiveIsAdmin = effectiveUser?.role === UserRole.ADMIN || 
                           effectiveUser?.username?.toLowerCase().trim() === SUPERADMIN_EMAIL;
  const canModify = isAdmin || effectiveIsAdmin;
  
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
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{t('syncing_catalog')}</h3>
        <p className="text-slate-500 font-medium mt-2">{t('connecting_cloud')}</p>
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
    setAllManagersSelected(personnel.length > 0 && personnel.every(p => (prop.allowedUserIds || []).includes(p.id)));
    setIsAdding(true);
  };

  const handleToggleUser = (userId: string) => {
    const idToToggle = userId.trim();
    setFormProp(prev => {
      const isSelected = prev.allowedUserIds.includes(idToToggle);
      const newIds = isSelected
        ? prev.allowedUserIds.filter(id => id !== idToToggle)
        : [...prev.allowedUserIds, idToToggle];
      
      setAllManagersSelected(personnel.length > 0 && personnel.every(p => newIds.includes(p.id)));
      return { ...prev, allowedUserIds: newIds };
    });
  };

  const handleSelectAllManagers = () => {
    const allIds = personnel.map(p => p.id);
    const shouldSelectAll = !allManagersSelected;
    
    setFormProp(prev => ({
      ...prev,
      allowedUserIds: shouldSelectAll ? Array.from(new Set([...prev.allowedUserIds, ...allIds])) : []
    }));
    setAllManagersSelected(shouldSelectAll);
  };

  const handleSaveProperty = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formProp.name.trim() || !formProp.address.trim() || !formProp.city.trim() || !formProp.typeId.trim()) {
      setError(t('all_fields_required'));
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: editingProp ? t('edit_property') : t('add_property'),
      message: `${editingProp ? t('authorize_changes') : t('authorize_creation')} "${formProp.name}"?`,
      actionLabel: editingProp ? t('update') : t('create'),
      icon: <Building2 className="w-10 h-10" />,
      onConfirm: () => {
        // Clean and ensure uniqueness without forcing lowercase on UIDs
        const normalizedAllowedIds = Array.from(new Set(
          formProp.allowedUserIds.filter(Boolean).map(id => id.trim())
        ));

        if (editingProp) {
          store.updateProperty(editingProp.id, {
            name: formProp.name,
            address: formProp.address,
            city: formProp.city,
            propertyTypeId: formProp.typeId,
            allowedUserIds: normalizedAllowedIds
          });
        } else {
          // If manager is creating, automatically assign them to it
          const finalAllowedIds = [...normalizedAllowedIds];
          if (isManager && store.user) {
            const myId = store.user.id;
            const myUser = store.user.username.toLowerCase();
            if (!finalAllowedIds.includes(myId)) finalAllowedIds.push(myId);
            if (!finalAllowedIds.includes(myUser)) finalAllowedIds.push(myUser);
          }

          store.addProperty({
            id: 'p' + Date.now(),
            name: formProp.name,
            address: formProp.address,
            city: formProp.city,
            propertyTypeId: formProp.typeId,
            createdAt: new Date().toISOString(),
            isVisibleToManager: true,
            allowedUserIds: Array.from(new Set(finalAllowedIds))
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
      title: t('delete_property') || "Delete Property",
      message: `${t('critical_delete_warning')} "${name}"`,
      actionLabel: t('permanently_delete'),
      icon: <AlertTriangle className="w-10 h-10" />,
      onConfirm: () => {
        store.deleteProperty(id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddCity = () => {
    if (!newCityInput.trim()) return;
    if (store.config.cities.includes(newCityInput.trim())) {
      setError(t('city_exists'));
      return;
    }
    store.updateConfig({ cities: [...store.config.cities, newCityInput.trim()] });
    setNewCityInput('');
    setError(null);
  };

  const handleRemoveCity = (city: string) => {
    store.updateConfig({ cities: store.config.cities.filter((c: string) => c !== city) });
  };

  const handleMoveCity = (index: number, direction: 'up' | 'down') => {
    const newCities = [...store.config.cities];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCities.length) return;
    
    [newCities[index], newCities[targetIndex]] = [newCities[targetIndex], newCities[index]];
    store.updateConfig({ cities: newCities });
  };

  const handleEditCity = (city: string) => {
    setEditingCity({ original: city, current: city });
  };

  const handleSaveCityEdit = () => {
    if (!editingCity || !editingCity.current.trim()) return;
    if (editingCity.current.trim() === editingCity.original) {
      setEditingCity(null);
      return;
    }
    
    const newCities = store.config.cities.map((c: string) => 
      c === editingCity.original ? editingCity.current.trim() : c
    );
    store.updateConfig({ cities: newCities });
    setEditingCity(null);
  };

  const recordsByProperty = useMemo(() => {
    const map: Record<string, PropertyRecord[]> = {};
    (store.records || []).forEach(r => {
      if (!map[r.propertyId]) map[r.propertyId] = [];
      map[r.propertyId].push(r);
    });
    return map;
  }, [store.records]);

  const valuesByRecord = useMemo(() => {
    const map: Record<string, RecordValue[]> = {};
    (store.recordValues || []).forEach(v => {
      if (!map[v.recordId]) map[v.recordId] = [];
      map[v.recordId].push(v);
    });
    return map;
  }, [store.recordValues]);

  const filteredProperties = useMemo(() => {
    return (store.properties || []).filter((p: Property) => {
      const lowerUsername = effectiveUser?.username?.toLowerCase().trim() || '';
      const userId = effectiveUser?.id || '';
      const allowed = (p.allowedUserIds || []).map(id => id.toLowerCase());
      
      const isActuallyAdmin = effectiveUser?.role === UserRole.ADMIN || 
                              effectiveUser?.username?.toLowerCase().trim() === SUPERADMIN_EMAIL;

      const isAuthorized = isActuallyAdmin || 
                           (effectiveUser?.assignedPropertyIds || []).includes(p.id) ||
                           allowed.includes(userId.toLowerCase()) ||
                           allowed.includes(lowerUsername);
      
      if (!isAuthorized) return false;

      const nameMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const cityMatch = selectedCity === 'all' || p.city === selectedCity;
      if (!nameMatch || !cityMatch) return false;

      if (occupancyFilter !== 'all') {
        const type = (store.propertyTypes || []).find((t: any) => t.id === p.propertyTypeId);
        const propertyUnits = recordsByProperty[p.id] || [];
        const occupancyCol = type?.columns.find(
          (c: any) => c.type === ColumnType.OCCUPANCY_STATUS ||
                      (c.type === ColumnType.DROPDOWN && (c.name.toLowerCase().includes('status') || c.name.toLowerCase().includes('occupancy')))
        );

        let activeCount = 0;
        let vacantCount = 0;

        propertyUnits.forEach(unit => {
          const unitVals = valuesByRecord[unit.id] || [];
          const occVal = occupancyCol
            ? (unitVals.find((v: any) => v.columnId === occupancyCol.id)?.value || 'Active').toLowerCase()
            : 'active';
          
          if (occVal.includes('vacant')) {
            vacantCount++;
          } else {
            activeCount++;
          }
        });

        if (occupancyFilter === 'vacant' && vacantCount === 0) return false;
        if (occupancyFilter === 'occupied' && vacantCount > 0) return false;
      }

      return true;
    });
  }, [store.properties, store.propertyTypes, recordsByProperty, valuesByRecord, store.user, isAdmin, searchTerm, selectedCity, effectiveUser, occupancyFilter]);

  const personnel = useMemo(() => {
    return (store.users || []).filter((u: User) => u.role !== UserRole.ADMIN);
  }, [store.users]);

  const overallStats = useMemo(() => {
    let totalCollectable = 0;
    let totalUnits = 0;
    
    const authorizedProps = (store.properties || []).filter((p: Property) => {
      const lowerUsername = effectiveUser?.username?.toLowerCase().trim() || '';
      const userId = effectiveUser?.id || '';
      const allowed = (p.allowedUserIds || []).map(id => id.toLowerCase());
      
      const isActuallyAdmin = effectiveUser?.role === UserRole.ADMIN || 
                              effectiveUser?.username?.toLowerCase().trim() === SUPERADMIN_EMAIL;

      return isActuallyAdmin || 
             (effectiveUser?.assignedPropertyIds || []).includes(p.id) ||
             allowed.includes(userId.toLowerCase()) ||
             allowed.includes(lowerUsername);
    });

    authorizedProps.forEach((prop) => {
      const type = (store.propertyTypes || []).find((t: any) => t.id === prop.propertyTypeId);
      const propertyUnits = recordsByProperty[prop.id] || [];
      totalUnits += propertyUnits.length;

      const rentCols = type?.columns.filter((c: any) => c.isRentCalculatable) || [];
      const totalRentForProp = propertyUnits.reduce((acc: number, unit: any) => {
        const unitVals = valuesByRecord[unit.id] || [];
        
        const occupancyCol = type?.columns.find(
          (c: any) => c.type === ColumnType.OCCUPANCY_STATUS ||
                      (c.type === ColumnType.DROPDOWN && (c.name.toLowerCase().includes('status') || c.name.toLowerCase().includes('occupancy')))
        );
        const occVal = occupancyCol
          ? (unitVals.find((v: any) => v.columnId === occupancyCol.id)?.value || 'Active').toLowerCase()
          : 'active';
        if (occVal.includes('vacant')) {
          return acc;
        }

        const unitRent = rentCols.reduce((sum: number, col: any) => {
          const val = unitVals.find((v: any) => v.columnId === col.id)?.value;
          return sum + (parseFloat(val) || 0);
        }, 0);
        return acc + unitRent;
      }, 0);
      
      totalCollectable += totalRentForProp;
    });

    return {
      totalCollectable,
      totalUnits,
      count: authorizedProps.length
    };
  }, [store.properties, store.propertyTypes, recordsByProperty, valuesByRecord, effectiveUser]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className={`p-10 text-center ${confirmConfig.isDanger ? 'bg-red-50/50' : 'bg-indigo-50/50'}`}>
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmConfig.isDanger ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-indigo-600 text-white shadow-indigo-500/20'}`}>
                {confirmConfig.icon}
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">{confirmConfig.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-6">{confirmConfig.message}</p>
              
              {confirmConfig.isDanger && (
                <div className="mt-4 text-left space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('type_property_name')}</label>
                  <input autoFocus className="w-full bg-white border-2 border-red-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none focus:border-red-500" placeholder={expectedDeleteName} value={confirmDeleteInput} onChange={e => setConfirmDeleteInput(e.target.value)} />
                </div>
              )}
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
              <button disabled={confirmConfig.isDanger && confirmDeleteInput !== expectedDeleteName} onClick={confirmConfig.onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 ${confirmConfig.isDanger ? 'bg-red-500' : 'bg-indigo-600'}`}>{confirmConfig.actionLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* CITY CONFIG MODAL */}
      {showCityConfig && isAdmin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Globe className="w-6 h-6 text-indigo-400" />
                <h3 className="text-xl font-black uppercase tracking-tight">{t('city_registry')}</h3>
              </div>
              <button onClick={() => setShowCityConfig(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('add_new_location')}</label>
                <div className="flex gap-3">
                  <input 
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    placeholder={t('enter_city_name')}
                    value={newCityInput}
                    onChange={e => setNewCityInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCity()}
                  />
                  <button onClick={handleAddCity} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 active:scale-95 transition-all">
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
                {error && <p className="text-[10px] text-red-500 font-bold uppercase ml-1">{error}</p>}
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('active_cities')}</label>
                {(store.config?.cities || []).length > 0 ? store.config.cities.map((city: string, index: number) => (
                  <div key={city + index} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group gap-3">
                    {editingCity?.original === city ? (
                      <div className="flex-1 flex gap-2">
                        <input 
                          autoFocus
                          className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                          value={editingCity.current}
                          onChange={e => setEditingCity({ ...editingCity, current: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && handleSaveCityEdit()}
                        />
                        <button onClick={handleSaveCityEdit} className="p-2 bg-emerald-500 text-white rounded-lg"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => setEditingCity(null)} className="p-2 bg-slate-200 text-slate-500 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-black uppercase text-slate-700 flex-1 truncate">{city}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveCity(index, 'up')}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                          >
                             <ChevronUp className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            disabled={index === store.config.cities.length - 1}
                            onClick={() => handleMoveCity(index, 'down')}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                          >
                             <ChevronDown className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleEditCity(city)} className="p-2 text-slate-400 hover:text-indigo-600">
                            <Settings className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleRemoveCity(city)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )) : (
                  <div className="py-10 text-center opacity-40">
                    <Navigation className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                    <p className="text-[10px] font-black uppercase tracking-widest">{t('no_cities')}</p>
                  </div>
                )}
              </div>

              <button onClick={() => setShowCityConfig(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">{t('close_registry')}</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">{t('your_properties')}</h1>
          <p className="text-gray-500 mt-1 font-medium">{t('manage_personnel')}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => { setShowCityConfig(true); setError(null); }} 
              className="p-3 bg-white border border-gray-200 text-gray-400 rounded-xl hover:text-indigo-600 shadow-sm active:scale-95 transition-all hover:bg-indigo-50/50"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          {canModify && (
            <button 
              onClick={() => { setIsAdding(true); setEditingProp(null); setFormProp({ name: '', address: '', typeId: store.propertyTypes?.[0]?.id || '', city: store.config?.cities?.[0] || '', allowedUserIds: [] }); }} 
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-lg font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" /> {t('add_property')}
            </button>
          )}
        </div>
      </header>

      {isAdding && canModify && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-black text-gray-900 uppercase">{editingProp ? t('edit_property') : t('new_property') || 'New Property'}</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSaveProperty} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {error && <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-xs font-bold">{error}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('property_name')}</label><input required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Skyline Towers" value={formProp.name} onChange={e => setFormProp({...formProp, name: e.target.value})} /></div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('city')}</label>
                  <select required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none" value={formProp.city} onChange={e => setFormProp({...formProp, city: e.target.value})}>
                    <option value="">{t('select_city') || 'Select City...'}</option>
                    {(store.config?.cities || []).map((city: string) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('location_address')}</label><input required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Street, City, State" value={formProp.address} onChange={e => setFormProp({...formProp, address: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('schema_template')}</label><select required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none" value={formProp.typeId} onChange={e => setFormProp({...formProp, typeId: e.target.value})}><option value="">{t('select_schema') || 'Select Schema...'}</option>{(store.propertyTypes || []).map((pt: any) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}</select></div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Users className="w-4 h-4" /> {t('permitted_personnel')}
                  </label>
                  {personnel.length > 0 && (
                    <button 
                      type="button"
                      onClick={handleSelectAllManagers}
                      className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg"
                    >
                      {allManagersSelected ? t('deselect_all') : t('select_all_managers')}
                    </button>
                  )}
                </div>
                
                {formProp.allowedUserIds.length === 0 && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-700 animate-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p className="text-[10px] font-bold uppercase tracking-tight">{t('admin_only_access')}</p>
                  </div>
                )}

                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {personnel.length > 0 ? personnel.map((u: User) => (
                    <label key={u.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${formProp.allowedUserIds.includes(u.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${formProp.allowedUserIds.includes(u.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{u.name.charAt(0)}</div>
                        <div>
                          <p className="text-xs font-black uppercase text-slate-900">{u.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t(u.role?.toLowerCase()) || u.role} {t('access') || 'Access'}</p>
                        </div>
                      </div>
                      <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={formProp.allowedUserIds.includes(u.id)} onChange={() => handleToggleUser(u.id)} />
                    </label>
                  )) : (
                    <p className="text-center py-6 text-[10px] font-black uppercase text-slate-300 italic">No non-admin users found.</p>
                  )}
                </div>
              </div>
              
              <div className="pt-4 flex gap-4"><button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button><button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">{editingProp ? t('update_record') || 'Update Record' : t('create_entry') || 'Create Entry'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* USER-SPECIFIC STATS SUMMARY */}
      <div className="bg-slate-50/70 rounded-[2.5rem] border border-slate-100 p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300 text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                {language === 'hi' ? 'मेरा अलॉटेड पोर्टफोलियो विवरण' : 'My Assigned Portfolio Summary'}
              </h2>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 leading-normal">
              {language === 'hi' 
                ? `आपके असाइन किए गए प्रॉपर्टीज़ की कुल मासिक संग्रह सूची। यूज़र: ${effectiveUser?.name || effectiveUser?.username || 'Unknown'} (${t(effectiveUser?.role?.toLowerCase() || '') || effectiveUser?.role || 'User'})`
                : `Aggregated data for properties assigned to your profile: ${effectiveUser?.name || effectiveUser?.username || 'Unknown'} (${effectiveUser?.role || 'User'})`}
            </p>
          </div>
          <div className="self-start md:self-center">
            <span className="bg-indigo-50 text-indigo-600 font-black uppercase text-[10px] tracking-wider px-4 py-2 rounded-2xl border border-indigo-100/80">
              👤 {effectiveUser?.name || 'Assigned View'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Collectable Amount */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between group">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                {language === 'hi' ? 'कुल संग्रहणीय राशि (मासिक)' : 'Total Collectable (Monthly Rent)'}
              </p>
              <h3 className="text-2xl font-black text-indigo-600 tracking-tight group-hover:scale-105 transition-transform duration-300">
                ₹{overallStats.totalCollectable.toLocaleString('en-IN')}
              </h3>
              <p className="text-[9px] font-bold text-slate-400">
                {language === 'hi' ? 'सभी स्वीकृत प्रॉपर्टीज़ का योग' : 'Sum of active assigned assets'}
              </p>
            </div>
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shrink-0">
              <IndianRupee className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Assigned Properties */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between group">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                {language === 'hi' ? 'आवंटित प्रॉपर्टीज़' : 'Assigned Properties'}
              </p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {overallStats.count} {language === 'hi' ? 'प्रॉपर्टीज़' : 'Asset(s)'}
              </h3>
              <p className="text-[9px] font-bold text-slate-400">
                {language === 'hi' ? 'असाइन की हुई कुल बिल्डिंग्स' : 'Visible according to permissions'}
              </p>
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Total Managed Units */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between group">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                {language === 'hi' ? 'कुल संचालित इकाइयां' : 'Total Managed Units'}
              </p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {overallStats.totalUnits} {language === 'hi' ? 'इकाइयां' : 'Unit(s)'}
              </h3>
              <p className="text-[9px] font-bold text-slate-400">
                {language === 'hi' ? 'सभी असाइन प्रॉपर्टी यूनिट्स का कुल योग' : 'Registered units under portfolio'}
              </p>
            </div>
            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-indigo-100 transition-all font-semibold text-sm" placeholder={t('search_portfolio')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-100 text-indigo-600 px-4 py-2 rounded-2xl w-full md:w-auto shadow-sm">
              <Users className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider whitespace-nowrap">
                {language === 'hi' ? 'एडमिन परिप्रेक्ष्य:' : 'Admin Perspective:'}
              </span>
              <select
                className="bg-transparent border-none text-[11px] font-black uppercase text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors font-sans py-1"
                value={store.impersonatedUser?.id || 'me'}
                onChange={(e) => {
                  if (e.target.value === 'me') {
                    store.setImpersonatedUser(null);
                  } else {
                    const selected = store.users.find((u: any) => u.id === e.target.value);
                    store.setImpersonatedUser(selected || null);
                  }
                }}
              >
                <option value="me">{language === 'hi' ? 'पूर्ण पोर्टफोलियो (ADMIN)' : 'Complete Portfolio (ADMIN)'}</option>
                {store.users.filter((u: any) => u.id !== store.user?.id).map((u: any) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role})
                  </option>
                ))}
              </select>
              {store.impersonatedUser && (
                <button
                  type="button"
                  onClick={() => store.setImpersonatedUser(null)}
                  className="p-1 bg-indigo-500 hover:bg-slate-950 text-white rounded-lg transition-all shrink-0 ml-1 active:scale-95"
                  title={language === 'hi' ? 'हटाएं' : 'Clear perspective'}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            className="bg-gray-50 border border-transparent rounded-xl px-4 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-gray-100 flex-1 lg:flex-none" 
            value={selectedCity} 
            onChange={e => setSelectedCity(e.target.value)}
          >
            <option value="all">{t('all_cities')}</option>
            {(store.config?.cities || []).map((city: string) => <option key={city} value={city}>{city}</option>)}
          </select>

          <select 
            className="bg-gray-50 border border-transparent rounded-xl px-4 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-gray-100 flex-1 lg:flex-none" 
            value={occupancyFilter} 
            onChange={e => setOccupancyFilter(e.target.value as any)}
          >
            <option value="all">{language === 'hi' ? 'सभी इकाइयां (ALL)' : 'All Occupancies'}</option>
            <option value="vacant">{language === 'hi' ? 'खाली इकाइयां मौजूद (Vacant)' : 'Has Vacancies'}</option>
            <option value="occupied">{language === 'hi' ? 'पूरी तरह से सक्रिय (Occupied)' : 'Fully Occupied'}</option>
          </select>
        </div>
      </div>

      {filteredProperties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProperties.map((prop: Property) => {
            const type = (store.propertyTypes || []).find((t: any) => t.id === prop.propertyTypeId);
            const propertyUnits = recordsByProperty[prop.id] || [];
            const unitCount = propertyUnits.length;
            const allowedCount = (prop.allowedUserIds || []).length;

            const occupancyCol = type?.columns.find(
              (c: any) => c.type === ColumnType.OCCUPANCY_STATUS ||
                          (c.type === ColumnType.DROPDOWN && (c.name.toLowerCase().includes('status') || c.name.toLowerCase().includes('occupancy')))
            );

            let activeCount = 0;
            let vacantCount = 0;

            propertyUnits.forEach(unit => {
              const unitVals = valuesByRecord[unit.id] || [];
              const occVal = occupancyCol
                ? (unitVals.find((v: any) => v.columnId === occupancyCol.id)?.value || 'Active').toLowerCase()
                : 'active';
              
              if (occVal.includes('vacant')) {
                vacantCount++;
              } else {
                activeCount++;
              }
            });

            const rentCols = type?.columns.filter((c: any) => c.isRentCalculatable) || [];
            const totalRent = propertyUnits.reduce((acc, unit) => {
              const unitVals = valuesByRecord[unit.id] || [];
              const unitRent = rentCols.reduce((sum, col) => {
                const val = unitVals.find(v => v.columnId === col.id)?.value;
                return sum + (parseFloat(val) || 0);
              }, 0);
              return acc + unitRent;
            }, 0);
            
            return (
              <div key={prop.id} className="group bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-300 flex flex-col overflow-hidden">
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300"><Building2 className="w-8 h-8" /></div>
                    {canModify && (
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

                  {/* Occupancy Status Badge Row */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                      🟢 {activeCount} {language === 'hi' ? 'सक्रिय' : 'Active'}
                    </span>
                    {vacantCount > 0 ? (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100 shadow-sm animate-pulse">
                        🟡 {vacantCount} {language === 'hi' ? 'खाली' : 'Vacant'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-100">
                        {language === 'hi' ? 'पूर्ण भरा हुआ' : 'Fully Occupied'}
                      </span>
                    )}
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
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-black text-gray-300 tracking-[0.2em]">Monthly Yield</p>
                      <span className="text-lg font-black text-indigo-600 block">₹{totalRent.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-black text-gray-300 tracking-[0.2em]">{unitCount} Units</p>
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-tighter block mt-1">{type?.name || 'Standard'}</span>
                    </div>
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
