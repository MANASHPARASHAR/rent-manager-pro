
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
  ColumnType
} from '../types';

const RentalContext = createContext<any>(null);

const DATABASE_FILENAME = "RentMaster_Pro_Database";
const SHEET_TABS = ["Users", "PropertyTypes", "Properties", "Records", "RecordValues", "Payments", "Config"];
const CLOUD_TOKEN_KEY = 'rentmaster_cloud_token_persistent_v1';
const TOMBSTONES_KEY = 'rentmaster_global_deletion_tombstones';
const LOCAL_CACHE_KEY = 'rentmaster_local_cache';

export const RentalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [spreadsheetName, setSpreadsheetName] = useState<string | null>(() => localStorage.getItem('rentmaster_active_sheet_name'));
  
  const [authSession, setAuthSession] = useState<any>(() => {
    const saved = localStorage.getItem(CLOUD_TOKEN_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => localStorage.getItem('rentmaster_active_sheet_id'));
  const [authClientId, setAuthClientId] = useState<string>(() => localStorage.getItem('rentmaster_google_client_id') || '');
  const [storageMode, setStorageMode] = useState<'cloud' | 'local'>(() => 
    (localStorage.getItem('rentmaster_storage_mode') as 'cloud' | 'local') || 'cloud'
  );

  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<PropertyRecord[]>([]);
  const [recordValues, setRecordValues] = useState<RecordValue[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  const [config, setConfig] = useState<AppConfig>({
    paidToOptions: ['Company Account', 'Bank Account', 'Petty Cash', 'Owner Direct'],
    paymentModeOptions: ['Bank Transfer', 'Cash', 'Check', 'UPI/QR', 'Credit Card']
  });

  const [tombstones, setTombstones] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(TOMBSTONES_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Track latest state to avoid stale closures in cache writing
  const latestStateRef = useRef({ users, propertyTypes, properties, records, recordValues, payments, config, tombstones });
  useEffect(() => {
    latestStateRef.current = { users, propertyTypes, properties, records, recordValues, payments, config, tombstones };
  }, [users, propertyTypes, properties, records, recordValues, payments, config, tombstones]);

  const lastSyncHash = useRef('');
  const isInitializingFirstUser = useRef(false);
  const tokenClientRef = useRef<any>(null);

  // Synchronous Local Storage Persistence
  const writeLocalCache = useCallback((overrides: any = {}) => {
    const s = latestStateRef.current;
    const cache = {
      users: overrides.users || s.users,
      propertyTypes: overrides.propertyTypes || s.propertyTypes,
      properties: overrides.properties || s.properties,
      records: overrides.records || s.records,
      recordValues: overrides.recordValues || s.recordValues,
      payments: overrides.payments || s.payments,
      config: overrides.config || s.config
    };
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
  }, []);

  // Load from cache utility
  const reloadFromCache = useCallback(() => {
    const saved = localStorage.getItem(LOCAL_CACHE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const currentTombstones = new Set(JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]'));
        if (parsed.users) setUsers(parsed.users.filter((u: any) => !currentTombstones.has(u.id)));
        if (parsed.propertyTypes) setPropertyTypes(parsed.propertyTypes.filter((t: any) => !currentTombstones.has(t.id)));
        if (parsed.properties) setProperties(parsed.properties.filter((p: any) => !currentTombstones.has(p.id)));
        if (parsed.records) setRecords(parsed.records.filter((r: any) => !currentTombstones.has(r.id)));
        if (parsed.recordValues) setRecordValues(parsed.recordValues.filter((v: any) => !currentTombstones.has(v.recordId)));
        if (parsed.payments) setPayments(parsed.payments.filter((p: any) => !currentTombstones.has(p.recordId)));
        if (parsed.config) setConfig(parsed.config);
      } catch (e) {}
    }
  }, []);

  // Sync Tombstones to disk
  useEffect(() => {
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(Array.from(tombstones)));
  }, [tombstones]);

  // Session guard
  useEffect(() => {
    if (user && users.length > 0 && !isInitializingFirstUser.current) {
      const stillExists = users.some(u => u.id === user.id);
      if (!stillExists || tombstones.has(user.id)) {
        setUser(null);
      }
    }
  }, [users, user, tombstones]);

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
                scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
                callback: (response: any) => {
                  if (response.access_token) {
                    setAuthSession(response);
                    localStorage.setItem(CLOUD_TOKEN_KEY, JSON.stringify(response));
                    gapi.client.setToken({ access_token: response.access_token });
                    setCloudError(null);
                    if (spreadsheetId) loadAllData(spreadsheetId);
                  }
                },
              });

              if (authSession?.access_token) {
                gapi.client.setToken({ access_token: authSession.access_token });
              }
              resolve(true);
            } catch (e) { resolve(false); }
          });
        } else { setTimeout(checkGapi, 100); }
      };
      checkGapi();
    });
  }, [authSession, authClientId, spreadsheetId]);

  const loadAllData = useCallback(async (id: string) => {
    const gapi = (window as any).gapi;
    if (!gapi?.client?.sheets || !authSession) return;

    try {
      const fileMeta = await gapi.client.drive.files.get({
        fileId: id,
        fields: 'name, trashed'
      });

      if (fileMeta.result.trashed) {
        setCloudError("Spreadsheet in trash.");
        return;
      }
      
      const name = fileMeta.result.name;
      setSpreadsheetName(name);
      localStorage.setItem('rentmaster_active_sheet_name', name);

      const response = await gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: id,
        ranges: SHEET_TABS.map(tab => `${tab}!A1:Z5000`),
      });

      const data = response.result.valueRanges;
      if (!data) return;

      const parse = (index: number) => data[index]?.values?.slice(1) || [];
      const currentTombstones = new Set(JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]'));

      const parsedUsers = parse(0)
        .map((r: any) => ({ id: r[0], username: r[1], name: r[2], role: r[3] as UserRole, passwordHash: r[4], createdAt: r[5] }))
        .filter(u => u.id && u.username && !currentTombstones.has(u.id));
      
      const parsedTypes = parse(1)
        .map((r: any) => ({ id: r[0], name: r[1], columns: JSON.parse(r[2] || '[]'), defaultDueDateDay: parseInt(r[3] || '5') }))
        .filter(t => t.id && t.name && !currentTombstones.has(t.id));
      
      const parsedProps = parse(2)
        .map((r: any) => ({ id: r[0], name: r[1], propertyTypeId: r[2], address: r[3], createdAt: r[4], isVisibleToManager: r[5] === 'true' }))
        .filter(p => p.id && p.name && !currentTombstones.has(p.id));
      
      const pRecords = parse(3)
        .map(r => ({ id: r[0], propertyId: r[1], createdAt: r[2], updatedAt: r[3] }))
        .filter(r => r.id && !currentTombstones.has(r.id));

      const pVals = parse(4)
        .map(r => ({ id: r[0], recordId: r[1], columnId: r[2], value: r[3] }))
        .filter(v => v.id && !currentTombstones.has(v.recordId));

      const pPays = parse(5)
        .map(r => ({ 
          id: r[0], recordId: r[1], month: r[2], amount: parseFloat(r[3] || '0'), status: r[4], 
          type: r[5], dueDate: r[6], paidAt: r[7], paidTo: r[8], paymentMode: r[9], isRefunded: r[10] === 'true' 
        }))
        .filter(p => p.id && !currentTombstones.has(p.recordId));

      setUsers(parsedUsers);
      setPropertyTypes(parsedTypes);
      setProperties(parsedProps);
      setRecords(pRecords);
      setRecordValues(pVals);
      setPayments(pPays);
      
      writeLocalCache({ 
        users: parsedUsers, 
        propertyTypes: parsedTypes, 
        properties: parsedProps, 
        records: pRecords, 
        recordValues: pVals, 
        payments: pPays 
      });

      setCloudError(null);
    } catch (e: any) {
      if (e.status === 401) {
        if (tokenClientRef.current) {
          tokenClientRef.current.requestAccessToken({ prompt: '' });
        }
      }
    }
  }, [authSession, writeLocalCache]);

  const bootstrapDatabase = useCallback(async () => {
    if (!authSession) return;
    setIsCloudSyncing(true);
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
      } else {
        const createResponse = await gapi.client.sheets.spreadsheets.create({
          resource: {
            properties: { title: DATABASE_FILENAME },
            sheets: SHEET_TABS.map(title => ({ properties: { title } }))
          }
        });
        dbId = createResponse.result.spreadsheetId;
      }

      setSpreadsheetId(dbId);
      localStorage.setItem('rentmaster_active_sheet_id', dbId);
      await loadAllData(dbId);
    } catch (error: any) {
      setCloudError("Cloud verify failed.");
    } finally {
      setIsCloudSyncing(false);
    }
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
              setAuthSession(response);
              localStorage.setItem(CLOUD_TOKEN_KEY, JSON.stringify(response));
              setCloudError(null);
              await bootstrapDatabase();
              resolve(true);
            } else {
              if (!silent) setCloudError("Auth required.");
              resolve(false);
            }
          },
        });
        tokenClientRef.current = client;
        client.requestAccessToken({ prompt: silent ? '' : 'consent' });
      } else { resolve(false); }
    });
  }, [authClientId, bootstrapDatabase]);

  const syncAll = useCallback(async (force: boolean = false, overrideState?: any) => {
    if (!spreadsheetId || !authSession) return; 
    
    const s = { ...latestStateRef.current, ...overrideState };
    const currentHash = JSON.stringify({ users: s.users, propertyTypes: s.propertyTypes, properties: s.properties, records: s.records, recordValues: s.recordValues, payments: s.payments, config: s.config });
    if (!force && currentHash === lastSyncHash.current) return;
    
    setIsCloudSyncing(true);
    try {
      const gapi = (window as any).gapi;
      const batchData = [
        { tab: "Users", rows: [["ID", "Username", "Name", "Role", "PassHash", "Created"], ...s.users.map((u: any) => [u.id, u.username, u.name, u.role, u.passwordHash, u.createdAt])] },
        { tab: "PropertyTypes", rows: [["ID", "Name", "ColumnsJSON", "DueDay"], ...s.propertyTypes.map((t: any) => [t.id, t.name, JSON.stringify(t.columns), t.defaultDueDateDay])] },
        { tab: "Properties", rows: [["ID", "Name", "TypeID", "Address", "Created", "Visible"], ...s.properties.map((p: any) => [p.id, p.name, p.propertyTypeId, p.address, p.createdAt, p.isVisibleToManager])] },
        { tab: "Records", rows: [["ID", "PropID", "Created", "Updated"], ...s.records.map((r: any) => [r.id, r.propertyId, r.createdAt, r.updatedAt])] },
        { tab: "RecordValues", rows: [["ID", "RecordID", "ColID", "Value"], ...s.recordValues.map((v: any) => [v.id, v.recordId, v.columnId, v.value])] },
        { tab: "Payments", rows: [["ID", "RecID", "Month", "Amount", "Status", "Type", "Due", "PaidAt", "PaidTo", "Mode", "Refunded"], ...s.payments.map((p: any) => [p.id, p.recordId, p.month, p.amount, p.status, p.type, p.dueDate, p.paidAt, p.paidTo, p.paymentMode, p.isRefunded])] },
        { tab: "Config", rows: [["PaidToJSON", "ModesJSON"], [JSON.stringify(s.config.paidToOptions), JSON.stringify(s.config.paymentModeOptions)]] }
      ];

      for (const item of batchData) {
        await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId, range: `${item.tab}!A1:Z5000` });
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${item.tab}!A1`,
          valueInputOption: 'RAW',
          resource: { values: item.rows }
        });
      }
      lastSyncHash.current = currentHash;
    } catch (e: any) {
      if (e.status === 401 && tokenClientRef.current) {
        tokenClientRef.current.requestAccessToken({ prompt: '' });
      }
    } finally {
      setIsCloudSyncing(false);
    }
  }, [spreadsheetId, authSession]);

  useEffect(() => { 
    initGoogleClient().then(() => {
      if (authSession && spreadsheetId) bootstrapDatabase();
    });
  }, [initGoogleClient, authSession, spreadsheetId, bootstrapDatabase]);

  useEffect(() => {
    if (spreadsheetId && authSession && storageMode === 'cloud' && !isInitializingFirstUser.current) {
      const timer = setTimeout(() => syncAll(), 2500);
      return () => clearTimeout(timer);
    }
  }, [users, propertyTypes, properties, records, recordValues, payments, config, spreadsheetId, authSession, storageMode, syncAll]);

  useEffect(() => {
    reloadFromCache();
    const timer = setTimeout(() => {
      setIsReady(true);
      setIsBooting(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [reloadFromCache]);

  const login = async (username: string, password: string) => {
    const lowerUser = username.toLowerCase();
    const currentTombstones = new Set(JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]'));
    const foundUser = users.find(u => u.username.toLowerCase() === lowerUser && u.passwordHash === password && !currentTombstones.has(u.id));
    
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    // Explicitly do not clear users list so they can log back in
  };

  // Fix: Missing updateClientId function
  const updateClientId = (id: string) => {
    setAuthClientId(id);
    localStorage.setItem('rentmaster_google_client_id', id);
  };

  const addUser = async (newUser: User, autoLogin: boolean = false) => {
    if (users.length === 0) isInitializingFirstUser.current = true;
    setUsers(prev => {
      const next = [...prev, newUser];
      writeLocalCache({ users: next });
      syncAll(true, { users: next });
      return next;
    });
    if (autoLogin) { setUser(newUser); isInitializingFirstUser.current = false; }
  };

  const deleteUser = async (id: string) => {
    setTombstones(prev => { const n = new Set(prev); n.add(id); return n; });
    setUsers(prev => {
      const next = prev.filter(u => u.id !== id);
      writeLocalCache({ users: next });
      syncAll(true, { users: next });
      return next;
    });
  };

  const addPropertyType = async (type: PropertyType) => {
    setPropertyTypes(prev => {
      const next = [...prev, type];
      writeLocalCache({ propertyTypes: next });
      syncAll(true, { propertyTypes: next });
      return next;
    });
  };

  // Fix: Missing updatePropertyType function
  const updatePropertyType = async (type: PropertyType) => {
    setPropertyTypes(prev => {
      const next = prev.map(t => t.id === type.id ? type : t);
      writeLocalCache({ propertyTypes: next });
      syncAll(true, { propertyTypes: next });
      return next;
    });
  };

  const deletePropertyType = async (id: string) => {
    setTombstones(prev => { const n = new Set(prev); n.add(id); return n; });
    setPropertyTypes(prev => {
      const next = prev.filter(t => t.id !== id);
      writeLocalCache({ propertyTypes: next });
      syncAll(true, { propertyTypes: next });
      return next;
    });
  };

  const addProperty = async (prop: Property) => {
    setProperties(prev => {
      const next = [...prev, { ...prop, isVisibleToManager: true }];
      writeLocalCache({ properties: next });
      syncAll(true, { properties: next });
      return next;
    });
  };

  // Fix: Missing togglePropertyVisibility function
  const togglePropertyVisibility = async (id: string) => {
    setProperties(prev => {
      const next = prev.map(p => p.id === id ? { ...p, isVisibleToManager: !p.isVisibleToManager } : p);
      writeLocalCache({ properties: next });
      syncAll(true, { properties: next });
      return next;
    });
  };

  const deleteProperty = async (id: string) => {
    setTombstones(prev => {
      const next = new Set(prev);
      next.add(id);
      records.filter(r => r.propertyId === id).forEach(r => next.add(r.id));
      return next;
    });
    
    const nextProps = properties.filter(p => p.id !== id);
    const nextRecords = records.filter(r => r.propertyId !== id);
    const deletedRecordIds = records.filter(r => r.propertyId === id).map(r => r.id);
    const nextValues = recordValues.filter(v => !deletedRecordIds.includes(v.recordId));
    const nextPayments = payments.filter(p => !deletedRecordIds.includes(p.recordId));

    setProperties(nextProps);
    setRecords(nextRecords);
    setRecordValues(nextValues);
    setPayments(nextPayments);

    writeLocalCache({ properties: nextProps, records: nextRecords, recordValues: nextValues, payments: nextPayments });
    syncAll(true, { properties: nextProps, records: nextRecords, recordValues: nextValues, payments: nextPayments });
  };

  const addRecord = async (record: PropertyRecord, values: RecordValue[]) => {
    const nextValues = [...recordValues, ...values];
    setRecordValues(nextValues);
    setRecords(prev => {
      const next = [...prev, record];
      writeLocalCache({ records: next, recordValues: nextValues });
      syncAll(true, { records: next, recordValues: nextValues });
      return next;
    });
  };

  // Fix: Missing updateRecord function
  const updateRecord = async (recordId: string, values: RecordValue[]) => {
    const nextValues = recordValues.filter(v => v.recordId !== recordId).concat(values);
    setRecordValues(nextValues);
    setRecords(prev => {
      const next = prev.map(r => r.id === recordId ? { ...r, updatedAt: new Date().toISOString() } : r);
      writeLocalCache({ records: next, recordValues: nextValues });
      syncAll(true, { records: next, recordValues: nextValues });
      return next;
    });
  };

  const deleteRecord = async (id: string) => {
    setTombstones(prev => { const n = new Set(prev); n.add(id); return n; });
    const nextPayments = payments.filter(p => p.recordId !== id);
    const nextValues = recordValues.filter(v => v.recordId !== id);
    const nextRecords = records.filter(r => r.id !== id);
    
    setPayments(nextPayments);
    setRecordValues(nextValues);
    setRecords(nextRecords);

    writeLocalCache({ records: nextRecords, recordValues: nextValues, payments: nextPayments });
    syncAll(true, { records: nextRecords, recordValues: nextValues, payments: nextPayments });
  };

  const togglePayment = async (recordId: string, month: string, amount: number, dueDate: string, extra: Partial<Payment> = {}, paymentType: PaymentType = 'RENT') => {
    setPayments(prev => {
      const existing = prev.find(p => p.recordId === recordId && p.month === month && p.type === paymentType);
      const next = existing ? prev.filter(p => p.id !== existing.id) : [...prev, {
        id: 'pay' + Date.now(), recordId, month, amount, status: PaymentStatus.PAID, type: paymentType,
        dueDate, paidAt: new Date().toISOString(), ...extra
      }];
      writeLocalCache({ payments: next });
      syncAll(true, { payments: next });
      return next;
    });
  };

  // Fix: Missing refundDeposit function
  const refundDeposit = async (recordId: string) => {
    setPayments(prev => {
      const next = prev.map(p => p.recordId === recordId && p.type === 'DEPOSIT' ? { ...p, isRefunded: true } : p);
      writeLocalCache({ payments: next });
      syncAll(true, { payments: next });
      return next;
    });
  };

  // Fix: Missing updateConfig function
  const updateConfig = async (updates: Partial<AppConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      writeLocalCache({ config: next });
      syncAll(true, { config: next });
      return next;
    });
  };

  const value = {
    isReady, isBooting, user, users, propertyTypes, properties, records, recordValues, payments, config,
    isCloudSyncing, cloudError, spreadsheetName, googleUser: authSession, spreadsheetId, googleClientId: authClientId, updateClientId, authenticate,
    login, logout, addUser, deleteUser, addPropertyType, updatePropertyType, deletePropertyType, addProperty,
    togglePropertyVisibility, deleteProperty, addRecord, updateRecord, deleteRecord, togglePayment,
    refundDeposit, updateConfig
  };

  return React.createElement(RentalContext.Provider, { value }, children);
};

export const useRentalStore = () => {
  const context = useContext(RentalContext);
  if (!context) throw new Error('useRentalStore must be used within a RentalProvider');
  return context;
};
