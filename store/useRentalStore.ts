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
  const [isReady, setIsReady] = useState(false);
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
  
  // REAL-TIME LOCAL PERSISTENCE OBSERVER
  useEffect(() => {
    const currentState = { users, propertyTypes, properties, records, recordValues, unitHistory, payments, config };
    stateRef.current = currentState;

    // Persist to local storage only after the initial boot check
    if (hasLoadedInitialData.current) {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(currentState));
        localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(Array.from(tombstones)));
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
      console.error("Sync error:", e);
      if (e.status === 401) {
        setSyncStatus('reauth');
        setCloudError("Session expired. Refreshing...");
        if (tokenClientRef.current) {
          tokenClientRef.current.requestAccessToken({ prompt: '' });
        }
      } else if (e.result?.error?.message?.includes("Requested entity was not found")) {
        setSyncStatus('error');
        setCloudError("Cloud database missing.");
        localStorage.removeItem('rentmaster_active_sheet_id');
        setSpreadsheetId(null);
      } else {
        setSyncStatus('error');
        setCloudError("Offline mode. Changes queued.");
        const backoff = Math.min(30000, Math.pow(2, retryCount.current) * 1000);
        retryCount.current++;
        setTimeout(() => syncAll(), backoff);
      }
    } finally {
      setIsCloudSyncing(false);
      isSyncInProgress.current = false;
    }
  }, [spreadsheetId, authSession]);

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
                    setSyncStatus('synced');
                    if (spreadsheetId) loadAllData(spreadsheetId);
                  } else {
                      setSyncStatus('reauth');
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
        setSyncStatus('error');
        setCloudError("Database in trash.");
        setIsBooting(false);
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
      if (!data) {
        setIsBooting(false);
        return;
      }

      const parse = (index: number) => data[index]?.values?.slice(1) || [];
      const currentTombstones = new Set(JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]'));

      const rawUsers = parse(0);
      const parsedUsers = rawUsers
        .map((r: any) => ({ id: r[0], username: r[1], name: r[2], role: r[3] as UserRole, passwordHash: r[4], createdAt: r[5] }))
        .filter(u => u.id && u.username && !currentTombstones.has(u.id));
      
      const parsedTypes = parse(1)
        .map((r: any) => ({ id: r[0], name: r[1], columns: JSON.parse(r[2] || '[]'), defaultDueDateDay: parseInt(r[3] || '5') }))
        .filter(t => t.id && t.name && !currentTombstones.has(t.id));
      
      const parsedProps = parse(2)
        .map((r: any) => ({ 
          id: r[0], 
          name: r[1], 
          propertyTypeId: r[2], 
          address: r[3], 
          createdAt: r[4], 
          isVisibleToManager: r[5] !== 'false',
          city: r[6] || ''
        }))
        .filter(p => p.id && p.name && !currentTombstones.has(p.id));
      
      const pRecords = parse(3)
        .map(r => ({ id: r[0], propertyId: r[1], createdAt: r[2], updatedAt: r[3] }))
        .filter(r => r.id && !currentTombstones.has(r.id));

      const pVals = parse(4)
        .map(r => ({ id: r[0], recordId: r[1], columnId: r[2], value: r[3] }))
        .filter(v => v.id && !currentTombstones.has(v.recordId));

      const pPays = parse(5)
        .map(r => ({ 
          id: r[0], recordId: r[1], month: r[2], amount: parseFloat(r[3] || '0'), status: r[4] as PaymentStatus, 
          type: r[5], dueDate: r[6], paidAt: r[7], paidTo: r[8], paymentMode: r[9], isRefunded: r[10] === 'true' 
        }))
        .filter(p => p.id && !currentTombstones.has(p.recordId));

      const pConf = parse(6)[0];
      const parsedConfig = pConf ? {
        paidToOptions: JSON.parse(pConf[0] || '[]'),
        paymentModeOptions: JSON.parse(pConf[1] || '[]'),
        cities: JSON.parse(pConf[2] || '[]')
      } : stateRef.current.config;

      const pHist = parse(7)
        .map(r => ({
          id: r[0], recordId: r[1], values: JSON.parse(r[2] || '{}'), effectiveFrom: r[3], effectiveTo: r[4] === 'null' ? null : r[4]
        }))
        .filter(h => h.id && !currentTombstones.has(h.recordId));

      if (rawUsers.length === 0 && (stateRef.current.users.length > 0 || stateRef.current.properties.length > 0)) {
        syncAll(true);
        setIsBooting(false);
        hasLoadedInitialData.current = true;
        return;
      }

      setUsers(parsedUsers);
      setPropertyTypes(parsedTypes);
      setProperties(parsedProps);
      setRecords(pRecords);
      setRecordValues(pVals);
      setUnitHistory(pHist);
      setPayments(pPays);
      setConfig(parsedConfig);
      
      setCloudError(null);
      setSyncStatus('synced');
    } catch (e: any) {
      if (e.status === 401) {
        setSyncStatus('reauth');
        if (tokenClientRef.current) tokenClientRef.current.requestAccessToken({ prompt: '' });
      } else {
        setSyncStatus('error');
        setCloudError("Using Local Cache.");
      }
    } finally {
      setIsBooting(false);
      hasLoadedInitialData.current = true;
    }
  }, [authSession, spreadsheetId, syncAll]);

  const bootstrapDatabase = useCallback(async () => {
    if (!authSession) {
      setIsBooting(false);
      hasLoadedInitialData.current = true;
      return;
    }
    setIsCloudSyncing(true);
    setSyncStatus('pending');
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
        setSpreadsheetName(searchResponse.result.files[0].name);
      } else {
        const createResponse = await gapi.client.sheets.spreadsheets.create({
          resource: {
            properties: { title: DATABASE_FILENAME },
            sheets: SHEET_TABS.map(title => ({ properties: { title } }))
          }
        });
        dbId = createResponse.result.spreadsheetId;
        setSpreadsheetName(DATABASE_FILENAME);
      }

      setSpreadsheetId(dbId);
      localStorage.setItem('rentmaster_active_sheet_id', dbId);
      await loadAllData(dbId);
    } catch (error: any) {
      setSyncStatus('error');
      setCloudError("Cloud verify failed.");
      setIsBooting(false);
      hasLoadedInitialData.current = true;
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
              setSyncStatus('synced');
              await bootstrapDatabase();
              resolve(true);
            } else {
              if (!silent) {
                  setSyncStatus('reauth');
                  setCloudError("Auth required.");
              }
              resolve(false);
            }
          },
        });
        tokenClientRef.current = client;
        (client as any).requestAccessToken({ prompt: silent ? '' : 'consent' });
      } else { resolve(false); }
    });
  }, [authClientId, bootstrapDatabase]);

  useEffect(() => { 
    initGoogleClient().then(() => {
      if (authSession && spreadsheetId) bootstrapDatabase();
      else if (!spreadsheetId) {
        setIsBooting(false);
        hasLoadedInitialData.current = true;
      }
    });
  }, [initGoogleClient, authSession, spreadsheetId, bootstrapDatabase]);

  useEffect(() => {
    if (spreadsheetId && authSession && !isInitializingFirstUser.current) {
      const timer = setTimeout(() => syncAll(), 2500);
      return () => clearTimeout(timer);
    }
  }, [users, propertyTypes, properties, records, recordValues, unitHistory, payments, config, spreadsheetId, authSession, syncAll]);

  const login = async (username: string, password: string) => {
    const lowerUser = username.toLowerCase();
    const foundUser = users.find(u => u.username.toLowerCase() === lowerUser && u.passwordHash === password && !tombstones.has(u.id));
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const seedDummyData = async () => {
    const ptId = 'pt_demo_standard';
    const prop1Id = 'p_demo_apex';
    const prop2Id = 'p_demo_evergreen';
    
    const colIds = {
      tenant: 'c_tenant_name',
      num: 'c_tenant_phone',
      rent: 'c_monthly_rent',
      deposit: 'c_security_deposit',
      date: 'c_onboard_date',
      status: 'c_occ_status'
    };

    const pt: PropertyType = {
      id: ptId,
      name: 'Residential Portfolio',
      columns: [
        { id: colIds.tenant, name: 'Tenant Name', type: ColumnType.TEXT, required: true, isRentCalculatable: false, isDefaultInLedger: true, order: 0 },
        { id: colIds.num, name: 'Tenant Number', type: ColumnType.NUMBER, required: true, isRentCalculatable: false, isDefaultInLedger: true, order: 1 },
        { id: colIds.rent, name: 'Monthly Rent', type: ColumnType.CURRENCY, required: true, isRentCalculatable: true, isDefaultInLedger: true, order: 2 },
        { id: colIds.deposit, name: 'Security Deposit', type: ColumnType.SECURITY_DEPOSIT, required: true, isRentCalculatable: false, order: 3 },
        { id: colIds.date, name: 'Rent Date', type: ColumnType.DATE, required: true, isRentCalculatable: false, order: 4 },
        { id: colIds.status, name: 'Occupancy Status', type: ColumnType.OCCUPANCY_STATUS, required: true, isRentCalculatable: false, isDefaultInLedger: true, options: ['Active', 'Vacant'], order: 5 },
      ],
      defaultDueDateDay: 5
    };

    const props: Property[] = [
      { id: prop1Id, name: 'Apex Plaza Suites', propertyTypeId: ptId, address: '100 Financial District, NY', city: 'New York', createdAt: new Date().toISOString(), isVisibleToManager: true },
      { id: prop2Id, name: 'Evergreen Heights', propertyTypeId: ptId, address: '742 Terrace, Springfield', city: 'Chicago', createdAt: new Date().toISOString(), isVisibleToManager: true }
    ];

    const recordsArr: PropertyRecord[] = [];
    const valuesArr: RecordValue[] = [];
    const historyArr: UnitHistory[] = [];
    const paymentsArr: Payment[] = [];

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = now.getMonth() === 0 ? `${now.getFullYear()-1}-12` : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    apexUnits.forEach((u) => {
        const rId = `r_demo_apex_${u.id}`;
        recordsArr.push({ id: rId, propertyId: prop1Id, createdAt: '2024-01-01T00:00:00Z', updatedAt: new Date().toISOString() });
        const unitValues = { [colIds.tenant]: u.status === 'Vacant' ? '' : u.tenant, [colIds.num]: u.status === 'Vacant' ? '' : u.num, [colIds.rent]: u.rent, [colIds.deposit]: u.dep, [colIds.date]: u.date, [colIds.status]: u.status };
        Object.entries(unitValues).forEach(([cid, val]) => valuesArr.push({ id: `v_demo_${rId}_${cid}`, recordId: rId, columnId: cid, value: val }));
        historyArr.push({ id: `h_demo_${rId}`, recordId: rId, effectiveFrom: '2024-01-01T00:00:00Z', effectiveTo: null, values: unitValues });

        if (u.status === 'Active') {
            paymentsArr.push({ id: `pay_demo_${rId}_prev`, recordId: rId, month: prevMonth, amount: parseFloat(u.rent), status: PaymentStatus.PAID, type: 'RENT', dueDate: `${prevMonth}-05`, paidAt: `${prevMonth}-02`, paidTo: 'Company Account', paymentMode: 'Bank Transfer' });
            paymentsArr.push({ id: `dep_demo_${rId}`, recordId: rId, month: 'ONE_TIME', amount: parseFloat(u.dep), status: PaymentStatus.PAID, type: 'DEPOSIT', dueDate: 'N/A', paidAt: u.date, paidTo: 'Company Account', paymentMode: 'Check' });
        }
    });

    const eId = `r_demo_e_201`;
    recordsArr.push({ id: eId, propertyId: prop2Id, createdAt: '2024-01-01T00:00:00Z', updatedAt: new Date().toISOString() });
    const vacantValues = { [colIds.tenant]: '', [colIds.num]: '', [colIds.rent]: '1600', [colIds.deposit]: '1600', [colIds.date]: '2024-01-01', [colIds.status]: 'Vacant' };
    historyArr.push({ id: `h_demo_e_phase1`, recordId: eId, effectiveFrom: '2024-01-01T00:00:00Z', effectiveTo: '2024-12-31T23:59:59Z', values: vacantValues });
    const activeValues = { [colIds.tenant]: 'Peter Parker', [colIds.num]: '5550201', [colIds.rent]: '1600', [colIds.deposit]: '1600', [colIds.date]: '2025-01-01', [colIds.status]: 'Active' };
    historyArr.push({ id: `h_demo_e_phase2`, recordId: eId, effectiveFrom: '2025-01-01T00:00:00Z', effectiveTo: null, values: activeValues });
    Object.entries(activeValues).forEach(([cid, val]) => valuesArr.push({ id: `v_demo_${eId}_${cid}`, recordId: eId, columnId: cid, value: val }));

    setPropertyTypes([pt]);
    setProperties(props);
    setRecords(recordsArr);
    setRecordValues(valuesArr);
    setUnitHistory(historyArr);
    setPayments(paymentsArr);

    const nextState = { ...stateRef.current, propertyTypes: [pt], properties: props, records: recordsArr, recordValues: valuesArr, unitHistory: historyArr, payments: paymentsArr };
    stateRef.current = nextState;
    if (spreadsheetId) syncAll(true, nextState);
  };

  const apexUnits = [
    { id: '101', tenant: 'Jonathan Wick', num: '5550101', rent: '2400', dep: '2400', status: 'Active', date: '2024-10-01' },
    { id: '102', tenant: 'Selina Kyle', num: '5550102', rent: '1850', dep: '1850', status: 'Active', date: '2024-11-15' },
    { id: '103', tenant: 'Vacant', num: '0', rent: '2100', dep: '2100', status: 'Vacant', date: '2024-01-01' }
  ];

  const updateClientId = (id: string) => {
    setAuthClientId(id);
    localStorage.setItem('rentmaster_google_client_id', id);
  };

  const addUser = async (newUser: User, autoLogin: boolean = false) => {
    const isFirstUser = users.length === 0;
    if (isFirstUser) isInitializingFirstUser.current = true;
    const nextUsers = [...users, newUser];
    setUsers(nextUsers);
    syncAll(true, { users: nextUsers });
    if (autoLogin) { setUser(newUser); isInitializingFirstUser.current = false; }
  };

  const deleteUser = async (id: string) => {
    setTombstones(prev => new Set(prev).add(id));
    setUsers(users.filter(u => u.id !== id));
    syncAll(true);
  };

  const addPropertyType = async (type: PropertyType) => {
    setPropertyTypes([...propertyTypes, type]);
    syncAll(true);
  };

  const updatePropertyType = async (type: PropertyType) => {
    setPropertyTypes(propertyTypes.map(t => t.id === type.id ? type : t));
    syncAll(true);
  };

  const deletePropertyType = async (id: string) => {
    setTombstones(prev => new Set(prev).add(id));
    setPropertyTypes(propertyTypes.filter(t => t.id !== id));
    syncAll(true);
  };

  const addProperty = async (prop: Property) => {
    setProperties([...properties, { ...prop, isVisibleToManager: true }]);
    syncAll(true);
  };

  const updateProperty = async (id: string, updates: Partial<Property>) => {
    setProperties(properties.map(p => p.id === id ? { ...p, ...updates } : p));
    syncAll(true);
  };

  const togglePropertyVisibility = async (id: string) => {
    setProperties(properties.map(p => p.id === id ? { ...p, isVisibleToManager: p.isVisibleToManager === false } : p));
    syncAll(true);
  };

  const deleteProperty = async (id: string) => {
    const deletedRecordIds = records.filter(r => r.propertyId === id).map(r => r.id);
    setTombstones(prev => {
        const n = new Set(prev);
        n.add(id);
        deletedRecordIds.forEach(rid => n.add(rid));
        return n;
    });
    setProperties(properties.filter(p => p.id !== id));
    setRecords(records.filter(r => r.propertyId !== id));
    setRecordValues(recordValues.filter(v => !deletedRecordIds.includes(v.recordId)));
    setPayments(payments.filter(p => !deletedRecordIds.includes(p.recordId)));
    setUnitHistory(unitHistory.filter(h => !deletedRecordIds.includes(h.recordId)));
    syncAll(true);
  };

  const addRecord = async (record: PropertyRecord, values: RecordValue[]) => {
    const now = new Date().toISOString();
    const mappedValues = values.reduce((acc, v) => ({...acc, [v.columnId]: v.value}), {});
    const newHistory: UnitHistory = { id: 'h' + Date.now(), recordId: record.id, values: mappedValues, effectiveFrom: now, effectiveTo: null };
    setRecordValues([...recordValues, ...values]);
    setRecords([...records, record]);
    setUnitHistory([...unitHistory, newHistory]);
    syncAll(true);
  };

  const updateRecord = async (recordId: string, values: RecordValue[], effectiveDate?: string) => {
    const effDate = effectiveDate ? new Date(effectiveDate).toISOString() : new Date().toISOString();
    const mappedNewValues = values.reduce((acc, v) => ({...acc, [v.columnId]: v.value}), {});
    const updatedHistory = unitHistory.map(h => {
      if (h.recordId === recordId && h.effectiveTo === null) {
        if (new Date(effDate) > new Date(h.effectiveFrom)) return { ...h, effectiveTo: new Date(new Date(effDate).getTime() - 1000).toISOString() };
      }
      return h;
    });
    const newHistoryEntry: UnitHistory = { id: 'h' + Date.now() + Math.random().toString(36).substr(2, 5), recordId: recordId, values: mappedNewValues, effectiveFrom: effDate, effectiveTo: null };
    setRecordValues(recordValues.filter(v => v.recordId !== recordId).concat(values));
    setRecords(records.map(r => r.id === recordId ? { ...r, updatedAt: new Date().toISOString() } : r));
    setUnitHistory([...updatedHistory, newHistoryEntry]);
    syncAll(true);
  };

  const deleteRecord = async (id: string) => {
    setTombstones(prev => new Set(prev).add(id));
    setPayments(payments.filter(p => p.recordId !== id));
    setRecordValues(recordValues.filter(v => v.recordId !== id));
    setRecords(records.filter(r => r.id !== id));
    setUnitHistory(unitHistory.filter(h => h.recordId !== id));
    syncAll(true);
  };

  const togglePayment = async (recordId: string, month: string, amount: number, dueDate: string, extra: Partial<Payment> = {}, paymentType: PaymentType = 'RENT') => {
    const existing = payments.find(p => p.recordId === recordId && p.month === month && p.type === paymentType);
    setPayments(existing 
      ? payments.filter(p => p.id !== existing.id) 
      : [...payments, {
          id: 'pay' + Date.now(), recordId, month, amount, status: extra.status || PaymentStatus.PAID, type: paymentType,
          dueDate, paidAt: new Date().toISOString(), ...extra
        } as Payment]);
    syncAll(true);
  };

  const refundDeposit = async (recordId: string) => {
    setPayments(payments.map(p => p.recordId === recordId && p.type === 'DEPOSIT' ? { ...p, isRefunded: true } : p));
    syncAll(true);
  };

  const updateConfig = async (updates: Partial<AppConfig>) => {
    setConfig({ ...config, ...updates });
    syncAll(true);
  };

  const value = {
    isReady, isBooting, user, users, propertyTypes, properties, records, recordValues, unitHistory, payments, config,
    isCloudSyncing, cloudError, syncStatus, spreadsheetName, googleUser: authSession, spreadsheetId, googleClientId: authClientId, updateClientId, authenticate,
    login, logout, addUser, deleteUser, addPropertyType, updatePropertyType, deletePropertyType, addProperty, updateProperty,
    togglePropertyVisibility, deleteProperty, addRecord, updateRecord, deleteRecord, togglePayment,
    refundDeposit, updateConfig, seedDummyData
  };

  return React.createElement(RentalContext.Provider, { value }, children);
};

export const useRentalStore = () => {
  const context = useContext(RentalContext);
  if (!context) throw new Error('useRentalStore must be used within a RentalProvider');
  return context;
};