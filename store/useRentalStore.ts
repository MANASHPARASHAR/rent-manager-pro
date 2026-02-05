
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  PropertyType, 
  Property, 
  PropertyRecord, 
  RecordValue, 
  UserRole,
  Payment,
  PaymentStatus,
  PaymentType,
  User,
  AppConfig,
  ColumnType,
  UnitHistory
} from '../types';

const RentalContext = createContext<any>(null);

/**
 * 🔒 PRODUCTION SECURITY CONFIG
 * IMPORTANT: Enter your primary Gmail address here before deploying.
 * Only THIS email will be allowed to initialize the system for the first time.
 */
const OWNER_EMAIL = ""; 

const DATABASE_FILENAME = "RentMaster_Pro_Database";
const SHEET_TABS = ["Users", "PropertyTypes", "Properties", "Records", "RecordValues", "Payments", "Config", "UnitHistory"];
const CLOUD_TOKEN_KEY = 'rentmaster_cloud_token_persistent_v1';
const TOMBSTONES_KEY = 'rentmaster_global_deletion_tombstones';
const LOCAL_CACHE_KEY = 'rentmaster_local_cache';

const getDiskData = () => {
  const saved = localStorage.getItem(LOCAL_CACHE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch (e) {
    return null;
  }
};

export const RentalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialData = useRef(getDiskData());

  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => localStorage.getItem('rentmaster_active_sheet_id'));
  const [spreadsheetName, setSpreadsheetName] = useState<string | null>(() => localStorage.getItem('rentmaster_active_sheet_name'));
  const [authClientId, setAuthClientId] = useState<string>(() => localStorage.getItem('rentmaster_google_client_id') || '');
  const [authSession, setAuthSession] = useState<any>(() => {
    const saved = localStorage.getItem(CLOUD_TOKEN_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState<User[]>(() => initialData.current?.users || []);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>(() => initialData.current?.propertyTypes || []);
  const [properties, setProperties] = useState<Property[]>(() => initialData.current?.properties || []);
  const [records, setRecords] = useState<PropertyRecord[]>(() => initialData.current?.records || []);
  const [recordValues, setRecordValues] = useState<RecordValue[]>(() => initialData.current?.recordValues || []);
  const [unitHistory, setUnitHistory] = useState<UnitHistory[]>(() => initialData.current?.unitHistory || []);
  const [payments, setPayments] = useState<Payment[]>(() => initialData.current?.payments || []);
  const [config, setConfig] = useState<AppConfig>(() => initialData.current?.config || {
    paidToOptions: ['Company Account', 'Bank Account', 'Petty Cash', 'Owner Direct'],
    paymentModeOptions: ['Bank Transfer', 'Cash', 'Check', 'UPI/QR', 'Credit Card'],
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston']
  });

  const [tombstones, setTombstones] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(TOMBSTONES_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [user, setUser] = useState<User | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'error' | 'reauth'>('synced');

  const lastSyncHash = useRef('');
  const tokenClientRef = useRef<any>(null);
  const isSyncInProgress = useRef(false);
  const hasLoadedInitialData = useRef(false);
  const syncTimeoutRef = useRef<any>(null);
  const refreshTimerRef = useRef<any>(null);

  const stateRef = useRef({ 
    users: initialData.current?.users || [], 
    propertyTypes: initialData.current?.propertyTypes || [], 
    properties: initialData.current?.properties || [], 
    records: initialData.current?.records || [], 
    recordValues: initialData.current?.recordValues || [], 
    unitHistory: initialData.current?.unitHistory || [],
    payments: initialData.current?.payments || [], 
    config: initialData.current?.config || {
      paidToOptions: ['Company Account', 'Bank Account', 'Petty Cash', 'Owner Direct'],
      paymentModeOptions: ['Bank Transfer', 'Cash', 'Check', 'UPI/QR', 'Credit Card'],
      cities: ['New York', 'Los Angeles', 'Chicago', 'Houston']
    }
  });

  const startTokenRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(() => {
      if (tokenClientRef.current && authClientId) {
        tokenClientRef.current.requestAccessToken({ prompt: '' }); 
      }
    }, 50 * 60 * 1000);
  }, [authClientId]);

  const syncAll = useCallback(async () => {
    if (!spreadsheetId || !authSession || isSyncInProgress.current) return; 
    
    const s = stateRef.current;
    const currentHash = JSON.stringify(s);
    if (currentHash === lastSyncHash.current) return;
    
    isSyncInProgress.current = true;
    setIsCloudSyncing(true);
    setSyncStatus('pending');

    try {
      const gapi = (window as any).gapi;
      
      const batchData = [
        { tab: "Users", rows: [["ID", "Username", "Name", "Role", "PassHash", "Created"], ...s.users.map((u: any) => [u.id, u.username, u.name, u.role, u.passwordHash, u.createdAt])] },
        { tab: "PropertyTypes", rows: [["ID", "Name", "ColumnsJSON", "DueDay"], ...s.propertyTypes.map((t: any) => [t.id, t.name, JSON.stringify(t.columns), t.defaultDueDateDay])] },
        { tab: "Properties", rows: [["ID", "Name", "TypeID", "Address", "Created", "Visible", "City", "AllowedUsersJSON", "Investment"], ...s.properties.map((p: any) => [p.id, p.name, p.propertyTypeId, p.address, p.createdAt, String(p.isVisibleToManager !== false), p.city || '', JSON.stringify(p.allowedUserIds || []), p.totalInvestment || 0])] },
        { tab: "Records", rows: [["ID", "PropID", "Created", "Updated"], ...s.records.map((r: any) => [r.id, r.propertyId, r.createdAt, r.updatedAt])] },
        { tab: "RecordValues", rows: [["ID", "RecordID", "ColID", "Value"], ...s.recordValues.map((v: any) => [v.id, v.recordId, v.columnId, v.value])] },
        { tab: "Payments", rows: [["ID", "RecID", "Month", "Amount", "Status", "Type", "Due", "PaidAt", "PaidTo", "Mode", "Refunded"], ...s.payments.map((p: any) => [p.id, p.recordId, p.month, p.amount, p.status, p.type, p.dueDate, p.paidAt, p.paidTo, p.paymentMode, String(p.isRefunded === true)])] },
        { tab: "Config", rows: [["PaidToJSON", "ModesJSON", "CitiesJSON"], [JSON.stringify(s.config.paidToOptions), JSON.stringify(s.config.paymentModeOptions), JSON.stringify(s.config.cities)]] },
        { tab: "UnitHistory", rows: [["ID", "RecordID", "ValuesJSON", "From", "To"], ...s.unitHistory.map((h: any) => [h.id, h.recordId, JSON.stringify(h.values), h.effectiveFrom, h.effectiveTo || 'null'])] }
      ];

      for (const item of batchData) {
        await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId, range: `${item.tab}!A1:Z5000` });
      }

      const data = batchData.map(item => ({
        range: `${item.tab}!A1`,
        values: item.rows
      }));

      await gapi.client.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          data,
          valueInputOption: 'RAW'
        }
      });

      lastSyncHash.current = currentHash;
      setSyncStatus('synced');
    } catch (e: any) {
      if (e.status === 401) {
        setSyncStatus('reauth');
        if (tokenClientRef.current) tokenClientRef.current.requestAccessToken({ prompt: '' });
      } else {
        setSyncStatus('error');
      }
    } finally {
      setIsCloudSyncing(false);
      isSyncInProgress.current = false;
    }
  }, [spreadsheetId, authSession]);

  useEffect(() => {
    const currentState = { users, propertyTypes, properties, records, recordValues, unitHistory, payments, config };
    stateRef.current = currentState;

    if (hasLoadedInitialData.current) {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(currentState));
        localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(Array.from(tombstones)));
        
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          syncAll();
        }, 2000); 
    }
  }, [users, propertyTypes, properties, records, recordValues, unitHistory, payments, config, tombstones, syncAll]);

  const loadAllData = useCallback(async (id: string) => {
    const gapi = (window as any).gapi;
    if (!gapi?.client?.sheets || !authSession) {
      setIsBooting(false);
      hasLoadedInitialData.current = true;
      return;
    }

    try {
      const fileMeta = await gapi.client.drive.files.get({ fileId: id, fields: 'name, trashed' });
      if (fileMeta.result.trashed) {
        setIsBooting(false);
        hasLoadedInitialData.current = true;
        return;
      }
      
      setSpreadsheetName(fileMeta.result.name);
      localStorage.setItem('rentmaster_active_sheet_name', fileMeta.result.name);

      const response = await gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: id,
        ranges: SHEET_TABS.map(tab => `${tab}!A1:Z5000`),
      });

      const data = response.result.valueRanges;
      if (!data) {
        setIsBooting(false);
        hasLoadedInitialData.current = true;
        return;
      }

      const parse = (index: number) => data[index]?.values?.slice(1) || [];
      // Fix: Ensure currentTombstones is treated as Set<string> to avoid 'never' issues
      const currentTombstones = new Set<string>(JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]'));

      // Fix: Explicitly type parsed results to avoid 'never[]' inference
      const parsedUsers: User[] = parse(0).map((r: any) => ({ id: r[0], username: r[1], name: r[2], role: r[3] as UserRole, passwordHash: r[4], createdAt: r[5] })).filter(u => u.id && !currentTombstones.has(u.id));
      const parsedTypes: PropertyType[] = parse(1).map((r: any) => ({ id: r[0], name: r[1], columns: JSON.parse(r[2] || '[]'), defaultDueDateDay: parseInt(r[3] || '5') })).filter(t => t.id && !currentTombstones.has(t.id));
      const parsedProps: Property[] = parse(2).map((r: any) => ({ id: r[0], name: r[1], propertyTypeId: r[2], address: r[3], createdAt: r[4], isVisibleToManager: r[5] !== 'false', city: r[6] || '', allowedUserIds: JSON.parse(r[7] || '[]'), totalInvestment: parseFloat(r[8] || '0') })).filter(p => p.id && !currentTombstones.has(p.id));
      const pRecords: PropertyRecord[] = parse(3).map((r: any) => ({ id: r[0], propertyId: r[1], createdAt: r[2], updatedAt: r[3] })).filter(r => r.id && !currentTombstones.has(r.id));
      const pVals: RecordValue[] = parse(4).map((r: any) => ({ id: r[0], recordId: r[1], columnId: r[2], value: r[3] })).filter(v => v.id && !currentTombstones.has(v.recordId));
      const pPays: Payment[] = parse(5).map((r: any) => ({ id: r[0], recordId: r[1], month: r[2], amount: parseFloat(r[3] || '0'), status: r[4] as PaymentStatus, type: r[5], dueDate: r[6], paidAt: r[7], paidTo: r[8], paymentMode: r[9], isRefunded: r[10] === 'true' })).filter(p => p.id && !currentTombstones.has(p.recordId));
      
      const pConf = parse(6)[0];
      const parsedConfig: AppConfig = pConf ? { paidToOptions: JSON.parse(pConf[0] || '[]'), paymentModeOptions: JSON.parse(pConf[1] || '[]'), cities: JSON.parse(pConf[2] || '[]') } : stateRef.current.config;
      const pHist: UnitHistory[] = parse(7).map((r: any) => ({ id: r[0], recordId: r[1], values: JSON.parse(r[2] || '{}'), effectiveFrom: r[3], effectiveTo: r[4] === 'null' ? null : r[4] })).filter(h => h.id && !currentTombstones.has(h.recordId));

      setUsers(parsedUsers);
      setPropertyTypes(parsedTypes);
      setProperties(parsedProps);
      setRecords(pRecords);
      setRecordValues(pVals);
      setUnitHistory(pHist);
      setPayments(pPays);
      setConfig(parsedConfig);
      
      lastSyncHash.current = JSON.stringify({ users: parsedUsers, propertyTypes: parsedTypes, properties: parsedProps, records: pRecords, recordValues: pVals, unitHistory: pHist, payments: pPays, config: parsedConfig });
      setSyncStatus('synced');
      return { users: parsedUsers };
    } catch (e: any) {
      if (e.status === 401) setSyncStatus('reauth');
      return null;
    } finally {
      setIsBooting(false);
      hasLoadedInitialData.current = true;
    }
  }, [authSession]);

  const initGoogleClient = useCallback(async () => {
    return new Promise((resolve) => {
      const checkGapi = () => {
        const gapi = (window as any).gapi;
        const google = (window as any).google;
        if (gapi && google?.accounts?.oauth2) {
          gapi.load('client', async () => {
            try {
              await gapi.client.init({
                discoveryDocs: [
                  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
                  "https://sheets.googleapis.com/$discovery/rest?version=v4"
                ],
              });
              
              tokenClientRef.current = google.accounts.oauth2.initTokenClient({
                client_id: authClientId.trim(),
                scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                callback: (response: any) => {
                  if (response.access_token) {
                    setAuthSession(response);
                    localStorage.setItem(CLOUD_TOKEN_KEY, JSON.stringify(response));
                    gapi.client.setToken({ access_token: response.access_token });
                    setSyncStatus('synced');
                    startTokenRefreshTimer();
                    if (spreadsheetId) loadAllData(spreadsheetId);
                  } else {
                    setSyncStatus('reauth');
                  }
                },
              });

              if (authSession?.access_token) {
                gapi.client.setToken({ access_token: authSession.access_token });
                startTokenRefreshTimer();
              }
              resolve(true);
            } catch (e) { resolve(false); }
          });
        } else { setTimeout(checkGapi, 200); }
      };
      checkGapi();
    });
  }, [authSession, authClientId, spreadsheetId, startTokenRefreshTimer, loadAllData]);

  const bootstrapDatabase = useCallback(async () => {
    if (!authSession) {
      setIsBooting(false);
      hasLoadedInitialData.current = true;
      return null;
    }
    try {
      const gapi = (window as any).gapi;
      if (!gapi?.client?.drive) await initGoogleClient();
      
      const searchResponse = await gapi.client.drive.files.list({
        q: `name = '${DATABASE_FILENAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: 'files(id, name)',
      });

      let dbId: string;
      if (searchResponse.result.files && searchResponse.result.files.length > 0) {
        dbId = searchResponse.result.files[0].id;
        setSpreadsheetId(dbId);
        localStorage.setItem('rentmaster_active_sheet_id', dbId);
        const cloudData = await loadAllData(dbId);
        return { spreadsheetId: dbId, ...cloudData };
      } else {
        return { spreadsheetId: null, isNew: true };
      }
    } catch (error: any) {
      if (error.status === 401) {
        setSyncStatus('reauth');
        if (tokenClientRef.current) tokenClientRef.current.requestAccessToken({ prompt: '' });
      }
      setIsBooting(false);
      hasLoadedInitialData.current = true;
      return null;
    }
  }, [authSession, initGoogleClient, loadAllData]);

  const authenticate = useCallback(async (providedId?: string, silent: boolean = false) => {
    const rawId = providedId || authClientId;
    if (!rawId.trim()) return null;

    return new Promise((resolve) => {
      const google = (window as any).google;
      if (google?.accounts?.oauth2) {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: rawId.trim(),
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (response: any) => {
            if (response.access_token) {
              const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` }
              }).then(res => res.json());

              setAuthSession(response);
              const gapi = (window as any).gapi;
              gapi.client.setToken({ access_token: response.access_token });
              
              const bootstrapResult = await bootstrapDatabase();
              // Fix: Explicitly type cloudUsers as User[] to avoid potential 'never' inference
              const cloudUsers: User[] = (bootstrapResult as any)?.users || [];
              const isDatabaseExisting = !!bootstrapResult?.spreadsheetId;
              
              if (isDatabaseExisting) {
                // Fix: Added safety check for username property to prevent 'never' or 'undefined' access
                const isAuthorizedInCloud = cloudUsers.some((u: User) => (u.username || '').toLowerCase() === (userInfo.email || '').toLowerCase());
                if (!isAuthorizedInCloud) {
                  google.accounts.oauth2.revoke(response.access_token);
                  setAuthSession(null);
                  localStorage.removeItem(CLOUD_TOKEN_KEY);
                  resolve({ error: 'UNAUTHORIZED_EMAIL' });
                  return;
                }
              } else if (OWNER_EMAIL && userInfo.email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
                google.accounts.oauth2.revoke(response.access_token);
                setAuthSession(null);
                localStorage.removeItem(CLOUD_TOKEN_KEY);
                resolve({ error: 'UNAUTHORIZED_EMAIL' });
                return;
              }

              if (!isDatabaseExisting) {
                const createResponse = await gapi.client.sheets.spreadsheets.create({
                  resource: {
                    properties: { title: DATABASE_FILENAME },
                    sheets: SHEET_TABS.map(title => ({ properties: { title } }))
                  }
                });
                const newId = createResponse.result.spreadsheetId;
                setSpreadsheetId(newId);
                localStorage.setItem('rentmaster_active_sheet_id', newId);
              }

              localStorage.setItem(CLOUD_TOKEN_KEY, JSON.stringify(response));
              setSyncStatus('synced');
              startTokenRefreshTimer();
              resolve(userInfo);
            } else {
              resolve(null);
            }
          },
        });
        tokenClientRef.current = client;
        (client as any).requestAccessToken({ prompt: silent ? '' : 'consent' });
      } else { resolve(null); }
    });
  }, [authClientId, bootstrapDatabase, startTokenRefreshTimer]);

  const updateClientId = useCallback((id: string) => {
    setAuthClientId(id);
    localStorage.setItem('rentmaster_google_client_id', id);
  }, []);

  useEffect(() => { 
    initGoogleClient().then(() => {
      if (authSession) {
        bootstrapDatabase();
      } else {
        setIsBooting(false);
        hasLoadedInitialData.current = true;
      }
    });
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [initGoogleClient, authSession]);

  const updateRecord = async (recordId: string, values: RecordValue[], effectiveDate?: string) => {
    const effDate = effectiveDate ? new Date(effectiveDate).toISOString() : new Date().toISOString();
    const mappedNewValues = values.reduce((acc, v) => ({...acc, [v.columnId]: v.value}), {});
    const activeIdx = unitHistory.findIndex(h => h.recordId === recordId && h.effectiveTo === null);
    let updatedHistory = [...unitHistory];
    
    if (activeIdx !== -1) {
      const active = updatedHistory[activeIdx];
      const closeOutTime = new Date(new Date(effDate).getTime() - 1000).toISOString();
      updatedHistory[activeIdx] = { ...active, effectiveTo: closeOutTime };
    }
    
    const newEntry: UnitHistory = { 
      id: 'h' + Date.now() + Math.random().toString(36).substr(2, 5), 
      recordId, 
      values: mappedNewValues, 
      effectiveFrom: effDate, 
      effectiveTo: null 
    };
    
    setUnitHistory([...updatedHistory, newEntry]);
    setRecordValues(recordValues.filter(v => v.recordId !== recordId).concat(values));
    setRecords(records.map(r => r.id === recordId ? { ...r, updatedAt: new Date().toISOString() } : r));
  };

  const value = {
    isBooting, user, users, propertyTypes, properties, records, recordValues, unitHistory, payments, config,
    isCloudSyncing, syncStatus, spreadsheetName, googleUser: authSession, spreadsheetId, googleClientId: authClientId, 
    updateClientId, authenticate, syncAll,
    login: async (username: string, password: string) => {
      // Fix: Ensure users is treated as User[] and safely handle potential undefined/null usernames
      const found = (users as User[]).find((u: User) => (u.username || '').toLowerCase() === (username || '').toLowerCase() && u.passwordHash === password && !tombstones.has(u.id));
      if (found) { setUser(found); return true; }
      return false;
    },
    logout: () => setUser(null),
    addUser: (u: User, a: boolean) => { setUsers([...users, u]); if (a) setUser(u); },
    deleteUser: (id: string) => { setTombstones(prev => new Set(prev).add(id)); setUsers(users.filter(u => u.id !== id)); },
    addPropertyType: (t: PropertyType) => setPropertyTypes([...propertyTypes, t]),
    updatePropertyType: (t: PropertyType) => setPropertyTypes(propertyTypes.map(x => x.id === t.id ? t : x)),
    deletePropertyType: (id: string) => { setTombstones(prev => new Set(prev).add(id)); setPropertyTypes(propertyTypes.filter(t => t.id !== id)); },
    addProperty: (p: Property) => setProperties([...properties, { ...p, isVisibleToManager: true, allowedUserIds: p.allowedUserIds || [] }]),
    updateProperty: (id: string, u: Partial<Property>) => setProperties(properties.map(p => p.id === id ? { ...p, ...u } : p)),
    togglePropertyVisibility: (id: string) => setProperties(properties.map(p => p.id === id ? { ...p, isVisibleToManager: p.isVisibleToManager === false } : p)),
    deleteProperty: (id: string) => { const rIds = records.filter(r => r.propertyId === id).map(r => r.id); setTombstones(prev => { const n = new Set(prev); n.add(id); rIds.forEach(rid => n.add(rid)); return n; }); setProperties(properties.filter(p => p.id !== id)); setRecords(records.filter(r => r.propertyId !== id)); },
    addRecord: (r: PropertyRecord, v: RecordValue[]) => { const now = new Date().toISOString(); const mapped = v.reduce((acc, x) => ({...acc, [x.columnId]: x.value}), {}); setRecordValues([...recordValues, ...v]); setRecords([...records, r]); setUnitHistory([...unitHistory, { id: 'h' + Date.now(), recordId: r.id, values: mapped, effectiveFrom: now, effectiveTo: null }]); },
    updateRecord,
    deleteRecord: (id: string) => { setTombstones(prev => new Set(prev).add(id)); setRecords(records.filter(r => r.id !== id)); },
    togglePayment: (rId: string, m: string, a: number, d: string, x: Partial<Payment> = {}, t: PaymentType = 'RENT') => { const ex = payments.find(p => p.recordId === rId && p.month === m && p.type === t); setPayments(ex ? payments.filter(p => p.id !== ex.id) : [...payments, { id: 'pay' + Date.now(), recordId: rId, month: m, amount: a, status: x.status || PaymentStatus.PAID, t: t, dueDate: d, paidAt: new Date().toISOString(), ...x } as Payment]); },
    refundDeposit: (rId: string) => setPayments(payments.map(p => p.recordId === rId && p.type === 'DEPOSIT' ? { ...p, isRefunded: true } : p)),
    updateConfig: (u: Partial<AppConfig>) => setConfig({ ...config, ...u })
  };

  return React.createElement(RentalContext.Provider, { value }, children);
};

export const useRentalStore = () => {
  const context = useContext(RentalContext);
  if (!context) throw new Error('useRentalStore must be used within a RentalProvider');
  return context;
};
