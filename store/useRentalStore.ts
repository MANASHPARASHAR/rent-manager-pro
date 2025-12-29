
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

const DATABASE_FILENAME = "RentMaster_Pro_Database";
const SHEET_TABS = ["Users", "PropertyTypes", "Properties", "Records", "RecordValues", "Payments", "Config", "UnitHistory"];
const CLOUD_TOKEN_KEY = 'rentmaster_cloud_token_v2';
const TOMBSTONES_KEY = 'rentmaster_global_deletion_tombstones_v2';
const LOCAL_CACHE_KEY = 'rentmaster_local_cache_v2';

/**
 * SECURITY: SHA-256 Password Hashing
 * Ensures raw passwords are never stored in state, disk, or the cloud.
 */
const hashPassword = async (password: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * SECURITY: Local Storage Obfuscation
 * Prevents casual data leakage from shared devices or basic browser inspection.
 */
const secureSetItem = (key: string, value: any) => {
  try {
    const str = JSON.stringify(value);
    const obfuscated = btoa(unescape(encodeURIComponent(str)));
    localStorage.setItem(key, obfuscated);
  } catch (e) {
    console.error("Storage write failed", e);
  }
};

const secureGetItem = (key: string) => {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const decoded = decodeURIComponent(escape(atob(saved)));
    return JSON.parse(decoded);
  } catch (e) {
    console.warn(`Storage key ${key} is either corrupted or using an older format. Skipping.`);
    return null;
  }
};

export const RentalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialData = useRef(secureGetItem(LOCAL_CACHE_KEY));

  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => localStorage.getItem('rentmaster_active_sheet_id'));
  const [spreadsheetName, setSpreadsheetName] = useState<string | null>(() => localStorage.getItem('rentmaster_active_sheet_name'));
  const [authClientId, setAuthClientId] = useState<string>(() => localStorage.getItem('rentmaster_google_client_id') || '');
  const [authSession, setAuthSession] = useState<any>(() => secureGetItem(CLOUD_TOKEN_KEY));

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
    const saved = secureGetItem(TOMBSTONES_KEY);
    return saved ? new Set(saved) : new Set();
  });

  const [user, setUser] = useState<User | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'error' | 'reauth'>('synced');

  const lastSyncHash = useRef('');
  const tokenClientRef = useRef<any>(null);
  const isInitializingFirstUser = useRef(false);
  const isSyncInProgress = useRef(false);
  const retryCount = useRef(0);
  const hasLoadedInitialData = useRef(false);

  const stateRef = useRef({ users, propertyTypes, properties, records, recordValues, unitHistory, payments, config });
  
  // REAL-TIME LOCAL PERSISTENCE OBSERVER
  useEffect(() => {
    const currentState = { users, propertyTypes, properties, records, recordValues, unitHistory, payments, config };
    stateRef.current = currentState;

    if (hasLoadedInitialData.current) {
        secureSetItem(LOCAL_CACHE_KEY, currentState);
        secureSetItem(TOMBSTONES_KEY, Array.from(tombstones));
    }
  }, [users, propertyTypes, properties, records, recordValues, unitHistory, payments, config, tombstones]);

  const syncAll = useCallback(async (force: boolean = false, overrideState?: any) => {
    if (!spreadsheetId || !authSession || isSyncInProgress.current) return; 
    
    const s = { ...stateRef.current, ...overrideState };
    const currentHash = JSON.stringify({ users: s.users, propertyTypes: s.propertyTypes, properties: s.properties, records: s.records, recordValues: s.recordValues, unitHistory: s.unitHistory, payments: s.payments, config: s.config });
    if (!force && currentHash === lastSyncHash.current) {
        setSyncStatus('synced');
        return;
    }
    
    isSyncInProgress.current = true;
    setIsCloudSyncing(true);
    setSyncStatus('pending');
    try {
      const gapi = (window as any).gapi;
      
      const batchData = [
        { tab: "Users", rows: [["ID", "Username", "Name", "Role", "PassHash", "Created"], ...s.users.map((u: any) => [u.id, u.username, u.name, u.role, u.passwordHash, u.createdAt])] },
        { tab: "PropertyTypes", rows: [["ID", "Name", "ColumnsJSON", "DueDay"], ...s.propertyTypes.map((t: any) => [t.id, t.name, JSON.stringify(t.columns), t.defaultDueDateDay])] },
        { tab: "Properties", rows: [["ID", "Name", "TypeID", "Address", "Created", "Visible", "City"], ...s.properties.map((p: any) => [p.id, p.name, p.propertyTypeId, p.address, p.createdAt, String(p.isVisibleToManager !== false), p.city || ''])] },
        { tab: "Records", rows: [["ID", "PropID", "Created", "Updated"], ...s.records.map((r: any) => [r.id, r.propertyId, r.createdAt, r.updatedAt])] },
        { tab: "RecordValues", rows: [["ID", "RecordID", "ColID", "Value"], ...s.recordValues.map((v: any) => [v.id, v.recordId, v.columnId, v.value])] },
        { tab: "Payments", rows: [["ID", "RecID", "Month", "Amount", "Status", "Type", "Due", "PaidAt", "PaidTo", "Mode", "Refunded"], ...s.payments.map((p: any) => [p.id, p.recordId, p.month, p.amount, p.status, p.type, p.dueDate, p.paidAt, p.paidTo, p.paymentMode, String(p.isRefunded === true)])] },
        { tab: "Config", rows: [["PaidToJSON", "ModesJSON", "CitiesJSON"], [JSON.stringify(s.config.paidToOptions), JSON.stringify(s.config.paymentModeOptions), JSON.stringify(s.config.cities)]] },
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
      setCloudError(null);
      setSyncStatus('synced');
      retryCount.current = 0;
    } catch (e: any) {
      if (e.status === 401) {
        setSyncStatus('reauth');
        setCloudError("Session expired. Refreshing...");
        if (tokenClientRef.current) tokenClientRef.current.requestAccessToken({ prompt: '' });
      } else if (e.result?.error?.message?.includes("Requested entity was not found")) {
        setSyncStatus('error');
        setCloudError("Cloud database missing.");
        localStorage.removeItem('rentmaster_active_sheet_id');
        setSpreadsheetId(null);
      } else {
        setSyncStatus('error');
        setCloudError("Sync delayed. Queue active.");
        const backoff = Math.min(30000, Math.pow(2, retryCount.current) * 1000);
        retryCount.current++;
        setTimeout(() => syncAll(), backoff);
      }
    } finally {
      setIsCloudSyncing(false);
      isSyncInProgress.current = false;
    }
  }, [spreadsheetId, authSession]);

  const loadAllData = useCallback(async (id: string) => {
    const gapi = (window as any).gapi;
    if (!gapi?.client?.sheets || !authSession) return;

    try {
      const fileMeta = await gapi.client.drive.files.get({ fileId: id, fields: 'name, trashed' });
      if (fileMeta.result.trashed) {
        setSyncStatus('error'); setCloudError("Database in trash."); setIsBooting(false); return;
      }
      
      const name = fileMeta.result.name;
      setSpreadsheetName(name);
      localStorage.setItem('rentmaster_active_sheet_name', name);

      const response = await gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: id,
        ranges: SHEET_TABS.map(tab => `${tab}!A1:Z5000`),
      });

      const data = response.result.valueRanges;
      if (!data) { setIsBooting(false); return; }

      const parse = (index: number) => data[index]?.values?.slice(1) || [];
      const currentTombstones = new Set(secureGetItem(TOMBSTONES_KEY) || []);

      const rawUsers = parse(0);
      const parsedUsers = rawUsers
        .map((r: any) => ({ id: r[0], username: r[1], name: r[2], role: r[3] as UserRole, passwordHash: r[4], createdAt: r[5] }))
        .filter(u => u.id && u.username && !currentTombstones.has(u.id));
      
      const parsedTypes = parse(1)
        .map((r: any) => ({ id: r[0], name: r[1], columns: JSON.parse(r[2] || '[]'), defaultDueDateDay: parseInt(r[3] || '5') }))
        .filter(t => t.id && t.name && !currentTombstones.has(t.id));
      
      const parsedProps = parse(2)
        .map((r: any) => ({ 
          id: r[0], name: r[1], propertyTypeId: r[2], address: r[3], createdAt: r[4], 
          isVisibleToManager: r[5] !== 'false', city: r[6] || ''
        }))
        .filter(p => p.id && p.name && !currentTombstones.has(p.id));
      
      const pRecords = parse(3).map(r => ({ id: r[0], propertyId: r[1], createdAt: r[2], updatedAt: r[3] })).filter(r => r.id && !currentTombstones.has(r.id));
      const pVals = parse(4).map(r => ({ id: r[0], recordId: r[1], columnId: r[2], value: r[3] })).filter(v => v.id && !currentTombstones.has(v.recordId));
      const pPays = parse(5).map(r => ({ 
          id: r[0], recordId: r[1], month: r[2], amount: parseFloat(r[3] || '0'), status: r[4] as PaymentStatus, 
          type: r[5], dueDate: r[6], paidAt: r[7], paidTo: r[8], paymentMode: r[9], isRefunded: r[10] === 'true' 
        })).filter(p => p.id && !currentTombstones.has(p.recordId));

      const pConf = parse(6)[0];
      const parsedConfig = pConf ? {
        paidToOptions: JSON.parse(pConf[0] || '[]'),
        paymentModeOptions: JSON.parse(pConf[1] || '[]'),
        cities: JSON.parse(pConf[2] || '[]')
      } : stateRef.current.config;

      const pHist = parse(7).map(r => ({ id: r[0], recordId: r[1], values: JSON.parse(r[2] || '{}'), effectiveFrom: r[3], effectiveTo: r[4] === 'null' ? null : r[4] })).filter(h => h.id && !currentTombstones.has(h.recordId));

      if (rawUsers.length === 0 && (stateRef.current.users.length > 0 || stateRef.current.properties.length > 0)) {
        syncAll(true); setIsBooting(false); hasLoadedInitialData.current = true; return;
      }

      setUsers(parsedUsers); setPropertyTypes(parsedTypes); setProperties(parsedProps); setRecords(pRecords); setRecordValues(pVals); setUnitHistory(pHist); setPayments(pPays); setConfig(parsedConfig);
      setCloudError(null); setSyncStatus('synced');
    } catch (e: any) {
      if (e.status === 401) {
        setSyncStatus('reauth'); if (tokenClientRef.current) tokenClientRef.current.requestAccessToken({ prompt: '' });
      } else {
        setSyncStatus('error'); setCloudError("Cloud connection pending.");
      }
    } finally {
      setIsBooting(false); hasLoadedInitialData.current = true;
    }
  }, [authSession, spreadsheetId, syncAll]);

  const initGoogleClient = useCallback(async () => {
    return new Promise((resolve) => {
      const checkGapi = () => {
        const gapi = (window as any).gapi;
        const google = (window as any).google;
        if (gapi && google?.accounts?.oauth2) {
          gapi.load('client', async () => {
            try {
              await gapi.client.init({
                discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest", "https://sheets.googleapis.com/$discovery/rest?version=v4"],
              });
              tokenClientRef.current = google.accounts.oauth2.initTokenClient({
                client_id: authClientId.trim(),
                scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
                callback: (response: any) => {
                  if (response.access_token) {
                    setAuthSession(response); secureSetItem(CLOUD_TOKEN_KEY, response);
                    gapi.client.setToken({ access_token: response.access_token });
                    setCloudError(null); setSyncStatus('synced');
                    if (spreadsheetId) loadAllData(spreadsheetId);
                  } else { setSyncStatus('reauth'); }
                },
              });
              if (authSession?.access_token) gapi.client.setToken({ access_token: authSession.access_token });
              resolve(true);
            } catch (e) { resolve(false); }
          });
        } else { setTimeout(checkGapi, 100); }
      };
      checkGapi();
    });
  }, [authSession, authClientId, spreadsheetId, loadAllData]);

  const bootstrapDatabase = useCallback(async () => {
    if (!authSession) { setIsBooting(false); hasLoadedInitialData.current = true; return; }
    setIsCloudSyncing(true); setSyncStatus('pending');
    try {
      const gapi = (window as any).gapi;
      if (!gapi?.client?.drive) await initGoogleClient();
      const searchResponse = await gapi.client.drive.files.list({
        q: `name = '${DATABASE_FILENAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: 'files(id, name)',
      });

      let dbId: string;
      if (searchResponse.result.files && searchResponse.result.files.length > 0) {
        dbId = searchResponse.result.files[0].id; setSpreadsheetName(searchResponse.result.files[0].name);
      } else {
        const createResponse = await gapi.client.sheets.spreadsheets.create({
          resource: { properties: { title: DATABASE_FILENAME }, sheets: SHEET_TABS.map(title => ({ properties: { title } })) }
        });
        dbId = createResponse.result.spreadsheetId; setSpreadsheetName(DATABASE_FILENAME);
      }
      setSpreadsheetId(dbId); localStorage.setItem('rentmaster_active_sheet_id', dbId);
      await loadAllData(dbId);
    } catch (error: any) {
      setSyncStatus('error'); setCloudError("Verification required."); setIsBooting(false); hasLoadedInitialData.current = true;
    } finally { setIsCloudSyncing(false); }
  }, [authSession, initGoogleClient, loadAllData]);

  const authenticate = useCallback(async (providedId?: string, silent: boolean = false) => {
    const rawId = providedId || authClientId;
    const clientIdValue = rawId.trim();
    if (!clientIdValue) return false;
    return new Promise((resolve) => {
      const google = (window as any).google;
      if (google?.accounts?.oauth2) {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientIdValue,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
          callback: async (response: any) => {
            if (response.access_token) {
              setAuthSession(response); secureSetItem(CLOUD_TOKEN_KEY, response);
              setCloudError(null); setSyncStatus('synced');
              await bootstrapDatabase(); resolve(true);
            } else { if (!silent) { setSyncStatus('reauth'); setCloudError("Auth required."); } resolve(false); }
          },
        });
        tokenClientRef.current = client;
        (client as any).requestAccessToken({ prompt: silent ? '' : 'consent' });
      } else { resolve(false); }
    });
  }, [authClientId, bootstrapDatabase]);

  // FIX: Added missing updateClientId to allow changing the Google OAuth Client ID.
  const updateClientId = useCallback((id: string) => {
    const trimmedId = id.trim();
    setAuthClientId(trimmedId);
    localStorage.setItem('rentmaster_google_client_id', trimmedId);
  }, []);

  useEffect(() => { 
    initGoogleClient().then(() => {
      if (authSession && spreadsheetId) bootstrapDatabase();
      else if (!spreadsheetId) { setIsBooting(false); hasLoadedInitialData.current = true; }
    });
  }, [initGoogleClient, authSession, spreadsheetId, bootstrapDatabase]);

  useEffect(() => {
    if (spreadsheetId && authSession && !isInitializingFirstUser.current) {
      const timer = setTimeout(() => syncAll(), 2500);
      return () => clearTimeout(timer);
    }
  }, [users, propertyTypes, properties, records, recordValues, unitHistory, payments, config, spreadsheetId, authSession, syncAll]);

  const login = async (username: string, password: string) => {
    const inputHash = await hashPassword(password);
    const foundUser = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === inputHash && !tombstones.has(u.id));
    if (foundUser) { setUser(foundUser); return true; }
    return false;
  };

  const addUser = async (newUser: User, autoLogin: boolean = false) => {
    if (users.length === 0) isInitializingFirstUser.current = true;
    const hashedPass = await hashPassword(newUser.passwordHash);
    const userToSave = { ...newUser, passwordHash: hashedPass };
    const nextUsers = [...users, userToSave];
    setUsers(nextUsers); syncAll(true, { users: nextUsers });
    if (autoLogin) { setUser(userToSave); isInitializingFirstUser.current = false; }
  };

  const deleteUser = async (id: string) => { setTombstones(prev => new Set(prev).add(id)); setUsers(users.filter(u => u.id !== id)); syncAll(true); };
  const addPropertyType = async (type: PropertyType) => { setPropertyTypes([...propertyTypes, type]); syncAll(true); };
  const updatePropertyType = async (type: PropertyType) => { setPropertyTypes(propertyTypes.map(t => t.id === type.id ? type : t)); syncAll(true); };
  const deletePropertyType = async (id: string) => { setTombstones(prev => new Set(prev).add(id)); setPropertyTypes(propertyTypes.filter(t => t.id !== id)); syncAll(true); };
  const addProperty = async (prop: Property) => { setProperties([...properties, { ...prop, isVisibleToManager: true }]); syncAll(true); };
  const updateProperty = async (id: string, updates: Partial<Property>) => { setProperties(properties.map(p => p.id === id ? { ...p, ...updates } : p)); syncAll(true); };
  const togglePropertyVisibility = async (id: string) => { setProperties(properties.map(p => p.id === id ? { ...p, isVisibleToManager: p.isVisibleToManager === false } : p)); syncAll(true); };
  const deleteProperty = async (id: string) => {
    const deletedRecordIds = records.filter(r => r.propertyId === id).map(r => r.id);
    setTombstones(prev => { const n = new Set(prev); n.add(id); deletedRecordIds.forEach(rid => n.add(rid)); return n; });
    setProperties(properties.filter(p => p.id !== id)); setRecords(records.filter(r => r.propertyId !== id)); setRecordValues(recordValues.filter(v => !deletedRecordIds.includes(v.recordId))); setPayments(payments.filter(p => !deletedRecordIds.includes(p.recordId))); setUnitHistory(unitHistory.filter(h => !deletedRecordIds.includes(h.recordId)));
    syncAll(true);
  };
  const addRecord = async (record: PropertyRecord, values: RecordValue[]) => {
    const now = new Date().toISOString(); const mappedValues = values.reduce((acc, v) => ({...acc, [v.columnId]: v.value}), {});
    const newHistory: UnitHistory = { id: 'h' + Date.now(), recordId: record.id, values: mappedValues, effectiveFrom: now, effectiveTo: null };
    setRecordValues([...recordValues, ...values]); setRecords([...records, record]); setUnitHistory([...unitHistory, newHistory]); syncAll(true);
  };
  const updateRecord = async (recordId: string, values: RecordValue[], effectiveDate?: string) => {
    const effDate = effectiveDate ? new Date(effectiveDate).toISOString() : new Date().toISOString(); const mappedNewValues = values.reduce((acc, v) => ({...acc, [v.columnId]: v.value}), {});
    const updatedHistory = unitHistory.map(h => (h.recordId === recordId && h.effectiveTo === null && new Date(effDate) > new Date(h.effectiveFrom)) ? { ...h, effectiveTo: new Date(new Date(effDate).getTime() - 1000).toISOString() } : h);
    const newHistoryEntry: UnitHistory = { id: 'h' + Date.now() + Math.random().toString(36).substr(2, 5), recordId: recordId, values: mappedNewValues, effectiveFrom: effDate, effectiveTo: null };
    setRecordValues(recordValues.filter(v => v.recordId !== recordId).concat(values)); setRecords(records.map(r => r.id === recordId ? { ...r, updatedAt: new Date().toISOString() } : r)); setUnitHistory([...updatedHistory, newHistoryEntry]); syncAll(true);
  };
  const deleteRecord = async (id: string) => { setTombstones(prev => new Set(prev).add(id)); setPayments(payments.filter(p => p.recordId !== id)); setRecordValues(recordValues.filter(v => v.recordId !== id)); setRecords(records.filter(r => r.id !== id)); setUnitHistory(unitHistory.filter(h => h.recordId !== id)); syncAll(true); };
  const togglePayment = async (recordId: string, month: string, amount: number, dueDate: string, extra: Partial<Payment> = {}, paymentType: PaymentType = 'RENT') => {
    const existing = payments.find(p => p.recordId === recordId && p.month === month && p.type === paymentType);
    setPayments(existing ? payments.filter(p => p.id !== existing.id) : [...payments, { id: 'pay' + Date.now(), recordId, month, amount, status: extra.status || PaymentStatus.PAID, type: paymentType, dueDate, paidAt: new Date().toISOString(), ...extra } as Payment]);
    syncAll(true);
  };
  const refundDeposit = async (recordId: string) => { setPayments(payments.map(p => p.recordId === recordId && p.type === 'DEPOSIT' ? { ...p, isRefunded: true } : p)); syncAll(true); };
  const updateConfig = async (updates: Partial<AppConfig>) => { setConfig({ ...config, ...updates }); syncAll(true); };
  const seedDummyData = async () => { /* ... dummy data logic ... */ };

  const value = { isBooting, user, users, propertyTypes, properties, records, recordValues, unitHistory, payments, config, isCloudSyncing, cloudError, syncStatus, spreadsheetName, googleUser: authSession, spreadsheetId, googleClientId: authClientId, updateClientId, authenticate, login, logout: () => setUser(null), addUser, deleteUser, addPropertyType, updatePropertyType, deletePropertyType, addProperty, updateProperty, togglePropertyVisibility, deleteProperty, addRecord, updateRecord, deleteRecord, togglePayment, refundDeposit, updateConfig, seedDummyData };
  return React.createElement(RentalContext.Provider, { value }, children);
};

export const useRentalStore = () => {
  const context = useContext(RentalContext);
  if (!context) throw new Error('useRentalStore must be used within a RentalProvider');
  return context;
};
