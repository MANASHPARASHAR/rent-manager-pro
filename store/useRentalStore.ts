
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

export const RentalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => localStorage.getItem('rentmaster_active_sheet_id'));
  const [googleClientId, setGoogleClientId] = useState<string>(() => localStorage.getItem('rentmaster_google_client_id') || '');
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

  const updateClientId = (id: string) => {
    const cleanId = id.trim();
    setGoogleClientId(cleanId);
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
              resolve(true);
            } catch (e) {
              resolve(false);
            }
          });
        } else {
          setTimeout(checkGapi, 100);
        }
      };
      checkGapi();
    });
  }, []);

  const authenticate = async (providedId?: string) => {
    const rawId = providedId || googleClientId;
    const clientId = rawId.trim();
    if (!clientId) return false;

    return new Promise((resolve) => {
      const tryAuth = () => {
        const google = (window as any).google;
        if (google?.accounts?.oauth2) {
          try {
            const client = google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
              callback: async (response: any) => {
                if (response.access_token) {
                  setGoogleUser(response);
                  setCloudError(null);
                  await bootstrapDatabase();
                  resolve(true);
                } else {
                  setCloudError("Access denied by Google.");
                  resolve(false);
                }
              },
            });
            client.requestAccessToken({ prompt: 'consent' });
          } catch (e) {
            setCloudError("Authorization initiation failed.");
            resolve(false);
          }
        } else {
          setTimeout(tryAuth, 100);
        }
      };
      tryAuth();
    });
  };

  const bootstrapDatabase = async () => {
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
      console.error("Cloud boot error", error);
      setCloudError(error?.result?.error?.message || "Failed to initialize Cloud Sheet.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const loadAllData = async (id: string) => {
    const gapi = (window as any).gapi;
    try {
      const response = await gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: id,
        ranges: SHEET_TABS.map(tab => `${tab}!A1:Z1000`),
      });

      const data = response.result.valueRanges;
      const parse = (index: number) => data[index]?.values?.slice(1) || [];

      const parsedUsers = parse(0).map((r: any) => ({
        id: r[0], username: r[1], name: r[2], role: r[3] as UserRole, passwordHash: r[4], createdAt: r[5]
      })).filter(u => u.username);
      setUsers(parsedUsers);

      const parsedTypes = parse(1).map((r: any) => ({ 
        id: r[0], name: r[1], columns: JSON.parse(r[2] || '[]'), defaultDueDateDay: parseInt(r[3] || '5') 
      })).filter(t => t.name);
      setPropertyTypes(parsedTypes);
      
      const parsedProps = parse(2).map((r: any) => ({ 
        id: r[0], name: r[1], propertyTypeId: r[2], address: r[3], createdAt: r[4], isVisibleToManager: r[5] === 'true' 
      })).filter(p => p.name);
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
        const cloudConfig: AppConfig = {
          paidToOptions: JSON.parse(pConfig[0][0] || '[]'),
          paymentModeOptions: JSON.parse(pConfig[0][1] || '[]')
        };
        if (cloudConfig.paidToOptions.length) setConfig(cloudConfig);
      }

      setCloudError(null);
    } catch (e: any) {
      console.error("Cloud load failed", e);
      setCloudError(e?.result?.error?.message || "Cloud data loading failed.");
    }
  };

  const syncAll = async () => {
    if (!spreadsheetId || !googleUser) return;
    setIsCloudSyncing(true);
    try {
      const gapi = (window as any).gapi;
      const batchData = [
        { tab: "Users", rows: [["ID", "Username", "Name", "Role", "PassHash", "Created"], ...users.map(u => [u.id, u.username, u.name, u.role, u.passwordHash, u.createdAt])] },
        { tab: "PropertyTypes", rows: [["ID", "Name", "ColumnsJSON", "DueDay"], ...propertyTypes.map(t => [t.id, t.name, JSON.stringify(t.columns), t.defaultDueDateDay])] },
        { tab: "Properties", rows: [["ID", "Name", "TypeID", "Address", "Created", "Visible"], ...properties.map(p => [p.id, p.name, p.propertyTypeId, p.address, p.createdAt, p.isVisibleToManager])] },
        { tab: "Records", rows: [["ID", "PropID", "Created", "Updated"], ...records.map(r => [r.id, r.propertyId, r.createdAt, r.updatedAt])] },
        { tab: "RecordValues", rows: [["ID", "RecordID", "ColID", "Value"], ...recordValues.map(v => [v.id, v.recordId, v.columnId, v.value])] },
        { tab: "Payments", rows: [["ID", "RecID", "Month", "Amount", "Status", "Type", "Due", "PaidAt", "PaidTo", "Mode", "Refunded"], ...payments.map(p => [p.id, p.recordId, p.month, p.amount, p.status, p.type, p.dueDate, p.paidAt, p.paidTo, p.paymentMode, p.isRefunded])] },
        { tab: "Config", rows: [["PaidToJSON", "ModesJSON"], [JSON.stringify(config.paidToOptions), JSON.stringify(config.paymentModeOptions)]] }
      ];

      for (const item of batchData) {
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${item.tab}!A1`,
          valueInputOption: 'RAW',
          resource: { values: item.rows }
        });
      }
      setCloudError(null);
    } catch (e: any) {
      console.error("Batch sync failed", e);
      setCloudError("Sync Error: " + (e?.result?.error?.message || "Unknown error"));
    } finally {
      setIsCloudSyncing(false);
    }
  };

  useEffect(() => { initGoogleClient(); }, [initGoogleClient]);

  useEffect(() => {
    if (spreadsheetId && googleUser && storageMode === 'cloud') {
      const timer = setTimeout(() => syncAll(), 2500);
      return () => clearTimeout(timer);
    }
  }, [propertyTypes, properties, records, recordValues, payments, users, config, spreadsheetId, googleUser, storageMode]);

  useEffect(() => {
    // Load local cache immediately to allow login even if offline/not authorized yet
    const saved = localStorage.getItem('rentmaster_local_cache');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.users) setUsers(parsed.users);
        if (parsed.propertyTypes) setPropertyTypes(parsed.propertyTypes);
        if (parsed.properties) setProperties(parsed.properties);
        if (parsed.records) setRecords(parsed.records);
        if (parsed.recordValues) setRecordValues(parsed.recordValues);
        if (parsed.payments) setPayments(parsed.payments);
        if (parsed.config) setConfig(parsed.config);
      } catch (e) {
        console.error("Cache load failed", e);
      }
    }
    
    const timer = setTimeout(() => {
      setIsReady(true);
      setIsBooting(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []); // Run once on mount

  useEffect(() => {
    // Always persist to local cache for emergency pre-auth access
    localStorage.setItem('rentmaster_local_cache', JSON.stringify({ users, propertyTypes, properties, records, recordValues, payments, config }));
  }, [users, propertyTypes, properties, records, recordValues, payments, config]);

  const login = async (username: string, password: string) => {
    const lowerUser = username.toLowerCase();
    const foundUser = users.find(u => u.username.toLowerCase() === lowerUser && u.passwordHash === password);
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    // Don't clear googleUser here if you want to stay "Authorized" but "Logged out"
    // However, usually we clear it for security.
    setGoogleUser(null);
  };

  const addUser = (newUser: User) => {
    setUsers(prev => [...prev, newUser]);
    localStorage.setItem('rentmaster_initialized', 'true');
  };

  const deleteUser = (id: string) => setUsers(prev => prev.filter(u => u.id !== id));
  const updateUser = (updated: User) => setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));

  const addPropertyType = (type: PropertyType) => setPropertyTypes(prev => [...prev, type]);
  const updatePropertyType = (type: PropertyType) => setPropertyTypes(prev => prev.map(t => t.id === type.id ? type : t));
  const deletePropertyType = (id: string) => setPropertyTypes(prev => prev.filter(t => t.id !== id));
  const addProperty = (prop: Property) => setProperties(prev => [...prev, { ...prop, isVisibleToManager: true }]);
  const togglePropertyVisibility = (id: string) => setProperties(prev => prev.map(p => p.id === id ? { ...p, isVisibleToManager: !p.isVisibleToManager } : p));
  const deleteProperty = (id: string) => {
    setProperties(prev => prev.filter(p => p.id !== id));
    const unitsToDelete = records.filter(r => r.propertyId === id).map(r => r.id);
    setRecords(prev => prev.filter(r => r.propertyId !== id));
    setRecordValues(prev => prev.filter(v => !unitsToDelete.includes(v.recordId)));
    setPayments(prev => prev.filter(p => !unitsToDelete.includes(p.recordId)));
  };

  const addRecord = (record: PropertyRecord, values: RecordValue[]) => {
    setRecords(prev => [...prev, record]);
    setRecordValues(prev => [...prev, ...values]);
  };

  const updateRecord = (recordId: string, values: RecordValue[]) => {
    setRecordValues(prev => [...prev.filter(v => v.recordId !== recordId), ...values]);
  };

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    setRecordValues(prev => prev.filter(v => v.recordId !== id));
    setPayments(prev => prev.filter(p => p.recordId !== id));
  };

  const togglePayment = (recordId: string, month: string, amount: number, dueDate: string, extra: Partial<Payment> = {}, paymentType: PaymentType = 'RENT') => {
    const existing = payments.find(p => p.recordId === recordId && p.month === month && p.type === paymentType);
    if (existing) {
      setPayments(prev => prev.filter(p => p.id !== existing.id));
    } else {
      setPayments(prev => [...prev, {
        id: 'pay' + Date.now(), recordId, month, amount, status: PaymentStatus.PAID, type: paymentType,
        dueDate, paidAt: new Date().toISOString(), ...extra
      }]);
    }
  };

  const refundDeposit = (recordId: string) => {
    setPayments(prev => prev.map(p => p.recordId === recordId && p.type === 'DEPOSIT' ? { ...p, isRefunded: true } : p));
  };

  const updateConfig = (newConfig: Partial<AppConfig>) => setConfig(prev => ({ ...prev, ...newConfig }));

  const value = {
    isReady, isBooting, user, users, propertyTypes, properties, records, recordValues, payments, config,
    isCloudSyncing, cloudError, googleUser, spreadsheetId, googleClientId, storageMode, updateClientId, authenticate,
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
