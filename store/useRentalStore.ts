
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
const TOMBSTONES_KEY = 'rentmaster_deleted_user_tombstones';
const LOCAL_CACHE_KEY = 'rentmaster_local_cache';

export const RentalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  
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

  // Persistence Effect: Automatically save state to localStorage whenever it changes
  useEffect(() => {
    if (isReady && !isBooting) {
      const cache = {
        users,
        propertyTypes,
        properties,
        records,
        recordValues,
        payments,
        config
      };
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
    }
  }, [users, propertyTypes, properties, records, recordValues, payments, config, isReady, isBooting]);

  useEffect(() => {
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(Array.from(tombstones)));
  }, [tombstones]);

  const lastSyncHash = useRef('');
  const isInitializingFirstUser = useRef(false);

  // SESSION GUARD
  useEffect(() => {
    if (user && users.length > 0 && !isInitializingFirstUser.current) {
      const stillExists = users.some(u => u.id === user.id);
      if (!stillExists || tombstones.has(user.id)) {
        setUser(null);
      }
    }
  }, [users, user, tombstones]);

  const updateClientId = (id: string) => {
    const cleanId = id.trim();
    setAuthClientId(cleanId);
    localStorage.setItem('rentmaster_google_client_id', cleanId);
  };

  const initGoogleClient = useCallback(async () => {
    return new Promise((resolve) => {
      const checkGapi = () => {
        const gapi = (window as any).gapi;
        if (gapi) {
          gapi.load('client', async () => {
            try {
              await gapi.client.init({
                discoveryDocs: [
                  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
                  "https://sheets.googleapis.com/$discovery/rest?version=v4"
                ],
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
  }, [authSession]);

  const loadAllData = useCallback(async (id: string) => {
    const gapi = (window as any).gapi;
    if (!gapi?.client?.sheets || !authSession) return;

    try {
      const response = await gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: id,
        ranges: SHEET_TABS.map(tab => `${tab}!A1:Z5000`),
      });

      const data = response.result.valueRanges;
      if (!data) return;

      const parse = (index: number) => data[index]?.values?.slice(1) || [];

      const currentTombstones = new Set(JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]'));
      const parsedUsers = parse(0)
        .map((r: any) => ({
          id: r[0], username: r[1], name: r[2], role: r[3] as UserRole, passwordHash: r[4], createdAt: r[5]
        }))
        .filter(u => u.username && u.id && !currentTombstones.has(u.id));
      
      setUsers(parsedUsers);

      const parsedTypes = parse(1).map((r: any) => ({ 
        id: r[0], name: r[1], columns: JSON.parse(r[2] || '[]'), defaultDueDateDay: parseInt(r[3] || '5') 
      })).filter(t => t.id && t.name);
      setPropertyTypes(parsedTypes);
      
      const parsedProps = parse(2).map((r: any) => ({ 
        id: r[0], name: r[1], propertyTypeId: r[2], address: r[3], createdAt: r[4], isVisibleToManager: r[5] === 'true' 
      })).filter(p => p.id && p.name);
      setProperties(parsedProps);
      
      const pRecords = parse(3).map(r => ({ id: r[0], propertyId: r[1], createdAt: r[2], updatedAt: r[3] })).filter(r => r.id);
      setRecords(pRecords);

      const pVals = parse(4).map(r => ({ id: r[0], recordId: r[1], columnId: r[2], value: r[3] })).filter(r => r.id);
      setRecordValues(pVals);

      const pPays = parse(5).map(r => ({ 
        id: r[0], recordId: r[1], month: r[2], amount: parseFloat(r[3] || '0'), status: r[4], 
        type: r[5], dueDate: r[6], paidAt: r[7], paidTo: r[8], paymentMode: r[9], isRefunded: r[10] === 'true' 
      })).filter(r => r.id);
      setPayments(pPays);

      const pConfig = parse(6);
      if (pConfig.length > 0) {
        try {
          const cloudConfig: AppConfig = {
            paidToOptions: JSON.parse(pConfig[0][0] || '[]'),
            paymentModeOptions: JSON.parse(pConfig[0][1] || '[]')
          };
          if (cloudConfig.paidToOptions.length) setConfig(cloudConfig);
        } catch(e) {}
      }
      setCloudError(null);
    } catch (e: any) {
      if (e.status === 401) {
        setAuthSession(null);
        localStorage.removeItem(CLOUD_TOKEN_KEY);
      }
      setCloudError("Cloud fetch failed.");
    }
  }, [authSession]);

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
      if (error.status === 401) {
        setAuthSession(null);
        localStorage.removeItem(CLOUD_TOKEN_KEY);
      }
      setCloudError(error?.result?.error?.message || "Cloud boot error.");
    } finally {
      setIsCloudSyncing(false);
    }
  }, [authSession, initGoogleClient, loadAllData]);

  const authenticate = useCallback(async (providedId?: string, silent: boolean = false) => {
    const rawId = providedId || authClientId;
    const clientIdValue = rawId.trim();
    if (!clientIdValue) return false;

    return new Promise((resolve) => {
      const tryAuth = () => {
        const google = (window as any).google;
        if (google?.accounts?.oauth2) {
          try {
            const client = google.accounts.oauth2.initTokenClient({
              client_id: clientIdValue,
              scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
              callback: async (response: any) => {
                if (response.access_token) {
                  setAuthSession(response);
                  localStorage.setItem(CLOUD_TOKEN_KEY, JSON.stringify(response));
                  setCloudError(null);
                  await bootstrapDatabase();
                  resolve(true);
                } else {
                  if (!silent) setCloudError("Access denied.");
                  resolve(false);
                }
              },
            });
            client.requestAccessToken({ prompt: silent ? '' : 'consent' });
          } catch (e) { resolve(false); }
        } else { setTimeout(tryAuth, 100); }
      };
      tryAuth();
    });
  }, [authClientId, bootstrapDatabase]);

  const syncAll = useCallback(async (force: boolean = false, overrideState?: any) => {
    if (!spreadsheetId || !authSession) return; 
    
    const sUsers = overrideState?.users || users;
    const sTypes = overrideState?.propertyTypes || propertyTypes;
    const sProps = overrideState?.properties || properties;
    const sRecords = overrideState?.records || records;
    const sValues = overrideState?.recordValues || recordValues;
    const sPayments = overrideState?.payments || payments;
    const sConfig = overrideState?.config || config;

    const currentHash = JSON.stringify({ users: sUsers, propertyTypes: sTypes, properties: sProps, records: sRecords, recordValues: sValues, payments: sPayments, config: sConfig });
    if (!force && currentHash === lastSyncHash.current) return;
    
    setIsCloudSyncing(true);
    try {
      const gapi = (window as any).gapi;
      const batchData = [
        { tab: "Users", rows: [["ID", "Username", "Name", "Role", "PassHash", "Created"], ...sUsers.map((u: any) => [u.id, u.username, u.name, u.role, u.passwordHash, u.createdAt])] },
        { tab: "PropertyTypes", rows: [["ID", "Name", "ColumnsJSON", "DueDay"], ...sTypes.map((t: any) => [t.id, t.name, JSON.stringify(t.columns), t.defaultDueDateDay])] },
        { tab: "Properties", rows: [["ID", "Name", "TypeID", "Address", "Created", "Visible"], ...sProps.map((p: any) => [p.id, p.name, p.propertyTypeId, p.address, p.createdAt, p.isVisibleToManager])] },
        { tab: "Records", rows: [["ID", "PropID", "Created", "Updated"], ...sRecords.map((r: any) => [r.id, r.propertyId, r.createdAt, r.updatedAt])] },
        { tab: "RecordValues", rows: [["ID", "RecordID", "ColID", "Value"], ...sValues.map((v: any) => [v.id, v.recordId, v.columnId, v.value])] },
        { tab: "Payments", rows: [["ID", "RecID", "Month", "Amount", "Status", "Type", "Due", "PaidAt", "PaidTo", "Mode", "Refunded"], ...sPayments.map((p: any) => [p.id, p.recordId, p.month, p.amount, p.status, p.type, p.dueDate, p.paidAt, p.paidTo, p.paymentMode, p.isRefunded])] },
        { tab: "Config", rows: [["PaidToJSON", "ModesJSON"], [JSON.stringify(sConfig.paidToOptions), JSON.stringify(sConfig.paymentModeOptions)]] }
      ];

      for (const item of batchData) {
        // MUST clear the range before updating to ensure deleted rows are actually removed from the sheet
        await gapi.client.sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${item.tab}!A1:Z5000`
        });

        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${item.tab}!A1`,
          valueInputOption: 'RAW',
          resource: { values: item.rows }
        });
      }
      
      setTombstones(prev => {
        const next = new Set(prev);
        sUsers.forEach((u: any) => next.delete(u.id));
        return next;
      });

      lastSyncHash.current = currentHash;
      setCloudError(null);
    } catch (e: any) {
      if (e.status === 401) {
        setAuthSession(null);
        localStorage.removeItem(CLOUD_TOKEN_KEY);
      }
      setCloudError("Sync Failed.");
    } finally {
      setIsCloudSyncing(false);
    }
  }, [spreadsheetId, authSession, users, propertyTypes, properties, records, recordValues, payments, config]);

  useEffect(() => { 
    initGoogleClient().then(() => {
      if (authSession && spreadsheetId) {
        bootstrapDatabase();
      }
    });
  }, [initGoogleClient, authSession, spreadsheetId, bootstrapDatabase]);

  useEffect(() => {
    if (spreadsheetId && authSession && storageMode === 'cloud' && !isInitializingFirstUser.current) {
      const timer = setTimeout(() => syncAll(), 2500);
      return () => clearTimeout(timer);
    }
  }, [propertyTypes, properties, records, recordValues, payments, users, config, spreadsheetId, authSession, storageMode, syncAll]);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_CACHE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const currentTombstones = new Set(JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]'));
        
        if (parsed.users) setUsers(parsed.users.filter((u: any) => !currentTombstones.has(u.id)));
        if (parsed.propertyTypes) setPropertyTypes(parsed.propertyTypes);
        if (parsed.properties) setProperties(parsed.properties);
        if (parsed.records) setRecords(parsed.records);
        if (parsed.recordValues) setRecordValues(parsed.recordValues);
        if (parsed.payments) setPayments(parsed.payments);
        if (parsed.config) setConfig(parsed.config);
      } catch (e) {}
    }
    const timer = setTimeout(() => {
      setIsReady(true);
      setIsBooting(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const login = async (username: string, password: string, skipCloudRefresh = false) => {
    const lowerUser = username.toLowerCase();
    if (spreadsheetId && authSession && !skipCloudRefresh) {
      try { await loadAllData(spreadsheetId); } catch(e) {}
    }
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
    // Clearing transient session data while keeping directory cache for the next login
    setProperties([]);
    setRecords([]);
    setRecordValues([]);
    setPayments([]);
  };

  const addUser = async (newUser: User, autoLogin: boolean = false) => {
    if (users.length === 0) isInitializingFirstUser.current = true;
    const nextUsers = [...users, newUser];
    setTombstones(prev => { const n = new Set(prev); n.delete(newUser.id); return n; });
    setUsers(nextUsers);
    if (autoLogin) { setUser(newUser); isInitializingFirstUser.current = false; }
    await syncAll(true, { users: nextUsers });
  };

  const deleteUser = async (id: string) => {
    setTombstones(prev => new Set(prev).add(id));
    const nextUsers = users.filter(u => u.id !== id);
    setUsers(nextUsers);
    await syncAll(true, { users: nextUsers });
  };

  const updateUser = async (updated: User) => {
    const nextUsers = users.map(u => u.id === updated.id ? updated : u);
    setUsers(nextUsers);
    await syncAll(true, { users: nextUsers });
  };

  const addPropertyType = async (type: PropertyType) => {
    const next = [...propertyTypes, type];
    setPropertyTypes(next);
    await syncAll(true, { propertyTypes: next });
  };

  const updatePropertyType = async (type: PropertyType) => {
    const next = propertyTypes.map(t => t.id === type.id ? type : t);
    setPropertyTypes(next);
    await syncAll(true, { propertyTypes: next });
  };

  const deletePropertyType = async (id: string) => {
    const next = propertyTypes.filter(t => t.id !== id);
    setPropertyTypes(next);
    await syncAll(true, { propertyTypes: next });
  };

  const addProperty = async (prop: Property) => {
    const next = [...properties, { ...prop, isVisibleToManager: true }];
    setProperties(next);
    await syncAll(true, { properties: next });
  };

  const togglePropertyVisibility = async (id: string) => {
    const next = properties.map(p => p.id === id ? { ...p, isVisibleToManager: !p.isVisibleToManager } : p);
    setProperties(next);
    await syncAll(true, { properties: next });
  };

  const deleteProperty = async (id: string) => {
    const nextProps = properties.filter(p => p.id !== id);
    const unitsToDelete = records.filter(r => r.propertyId === id).map(r => r.id);
    const nextRecords = records.filter(r => r.propertyId !== id);
    const nextValues = recordValues.filter(v => !unitsToDelete.includes(v.recordId));
    const nextPayments = payments.filter(p => !unitsToDelete.includes(p.recordId));
    
    setProperties(nextProps);
    setRecords(nextRecords);
    setRecordValues(nextValues);
    setPayments(nextPayments);
    
    await syncAll(true, { properties: nextProps, records: nextRecords, recordValues: nextValues, payments: nextPayments });
  };

  const addRecord = async (record: PropertyRecord, values: RecordValue[]) => {
    const nextRecords = [...records, record];
    const nextValues = [...recordValues, ...values];
    setRecords(nextRecords);
    setRecordValues(nextValues);
    await syncAll(true, { records: nextRecords, recordValues: nextValues });
  };

  const updateRecord = async (recordId: string, values: RecordValue[]) => {
    const nextValues = [...recordValues.filter(v => v.recordId !== recordId), ...values];
    setRecordValues(nextValues);
    await syncAll(true, { recordValues: nextValues });
  };

  const deleteRecord = async (id: string) => {
    const nextRecords = records.filter(r => r.id !== id);
    const nextValues = recordValues.filter(v => v.recordId !== id);
    const nextPayments = payments.filter(p => p.recordId !== id);
    
    setRecords(nextRecords);
    setRecordValues(nextValues);
    setPayments(nextPayments);
    
    await syncAll(true, { records: nextRecords, recordValues: nextValues, payments: nextPayments });
  };

  const togglePayment = async (recordId: string, month: string, amount: number, dueDate: string, extra: Partial<Payment> = {}, paymentType: PaymentType = 'RENT') => {
    const existing = payments.find(p => p.recordId === recordId && p.month === month && p.type === paymentType);
    let nextPayments;
    if (existing) {
      nextPayments = payments.filter(p => p.id !== existing.id);
    } else {
      nextPayments = [...payments, {
        id: 'pay' + Date.now(), recordId, month, amount, status: PaymentStatus.PAID, type: paymentType,
        dueDate, paidAt: new Date().toISOString(), ...extra
      }];
    }
    setPayments(nextPayments);
    await syncAll(true, { payments: nextPayments });
  };

  const refundDeposit = async (recordId: string) => {
    const next = payments.map(p => p.recordId === recordId && p.type === 'DEPOSIT' ? { ...p, isRefunded: true } : p);
    setPayments(next);
    await syncAll(true, { payments: next });
  };

  const updateConfig = async (newConfig: Partial<AppConfig>) => {
    const next = { ...config, ...newConfig };
    setConfig(next);
    await syncAll(true, { config: next });
  };

  const value = {
    isReady, isBooting, user, users, propertyTypes, properties, records, recordValues, payments, config,
    isCloudSyncing, cloudError, googleUser: authSession, spreadsheetId, googleClientId: authClientId, updateClientId, authenticate,
    login, logout, addUser, deleteUser, updateUser, addPropertyType, updatePropertyType, deletePropertyType, addProperty,
    togglePropertyVisibility, deleteProperty, addRecord, updateRecord, deleteRecord,
    togglePayment, refundDeposit, updateConfig
  };

  return React.createElement(RentalContext.Provider, { value }, children);
};

export const useRentalStore = () => {
  const context = useContext(RentalContext);
  if (!context) throw new Error('useRentalStore must be used within a RentalProvider');
  return context;
};
