
import React, { createContext, useContext, useState, useEffect } from 'react';
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

const DUMMY_USERS: User[] = [
  {
    id: 'u-admin',
    username: 'admin',
    name: 'Chief Administrator',
    role: UserRole.ADMIN,
    passwordHash: 'admin123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'u-manager',
    username: 'manager',
    name: 'Property Manager',
    role: UserRole.MANAGER,
    passwordHash: 'manager123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'u-viewer',
    username: 'viewer',
    name: 'Guest Auditor',
    role: UserRole.VIEWER,
    passwordHash: 'viewer123',
    createdAt: new Date().toISOString()
  }
];

export const RentalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [users] = useState<User[]>(DUMMY_USERS);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<PropertyRecord[]>([]);
  const [recordValues, setRecordValues] = useState<RecordValue[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    paidToOptions: ['Company Account', 'Bank Account', 'Petty Cash', 'Owner Direct'],
    paymentModeOptions: ['Bank Transfer', 'Cash', 'Check', 'UPI/QR', 'Credit Card']
  });

  useEffect(() => {
    const d = new Date();
    const residentialType: PropertyType = {
      id: 'pt_res',
      name: 'Residential Standard',
      defaultDueDateDay: 5,
      columns: [
        { id: 'c1', name: 'Unit Name', type: ColumnType.TEXT, required: true, isRentCalculatable: false, order: 0 },
        { id: 'c2', name: 'Tenant Name', type: ColumnType.TEXT, required: true, isRentCalculatable: false, order: 1 },
        { id: 'c3', name: 'Monthly Rent', type: ColumnType.CURRENCY, required: true, isRentCalculatable: true, order: 2 },
        { id: 'c4', name: 'Security Deposit', type: ColumnType.SECURITY_DEPOSIT, required: true, isRentCalculatable: false, isSecurityDeposit: true, order: 3 },
        { id: 'c5', name: 'Rent Date', type: ColumnType.DATE, required: true, isRentCalculatable: false, order: 4 },
        { id: 'c6', name: 'Status', type: ColumnType.DROPDOWN, required: true, isRentCalculatable: false, options: ['Active', 'Vacant'], order: 5 },
      ]
    };

    const prop1: Property = {
      id: 'p1',
      name: 'Skyline Heights',
      address: '123 Pine St, Downtown',
      propertyTypeId: 'pt_res',
      createdAt: new Date().toISOString(),
      isVisibleToManager: true
    };

    const unit1Id = 'r1';
    const mockRecords: PropertyRecord[] = [
      { id: unit1Id, propertyId: 'p1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];

    const mockValues: RecordValue[] = [
      { id: 'v1', recordId: unit1Id, columnId: 'c1', value: '101' },
      { id: 'v2', recordId: unit1Id, columnId: 'c2', value: 'John Doe' },
      { id: 'v3', recordId: unit1Id, columnId: 'c3', value: '1200' },
      { id: 'v4', recordId: unit1Id, columnId: 'c4', value: '2400' },
      { id: 'v5', recordId: unit1Id, columnId: 'c5', value: d.toISOString().split('T')[0] },
      { id: 'v6', recordId: unit1Id, columnId: 'c6', value: 'Active' },
    ];

    setPropertyTypes([residentialType]);
    setProperties([prop1]);
    setRecords(mockRecords);
    setRecordValues(mockValues);
  }, []);

  const login = async (username: string, password: string) => {
    const foundUser = DUMMY_USERS.find(u => u.username === username && u.passwordHash === password);
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

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
      const id = 'pay' + Date.now();
      setPayments(prev => [...prev, {
        id, recordId, month, amount, status: PaymentStatus.PAID, type: paymentType,
        dueDate, paidAt: new Date().toISOString(), ...extra
      }]);
    }
  };

  const refundDeposit = (recordId: string) => {
    const deposit = payments.find(p => p.recordId === recordId && p.type === 'DEPOSIT');
    if (deposit) {
      setPayments(prev => prev.map(p => p.id === deposit.id ? { ...p, isRefunded: true } : p));
    }
  };

  const updateConfig = (newConfig: Partial<AppConfig>) => setConfig(prev => ({ ...prev, ...newConfig }));

  const value = {
    isReady, user, users, propertyTypes, properties, records, recordValues, payments, config,
    login, logout, addPropertyType, updatePropertyType, deletePropertyType, addProperty,
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
