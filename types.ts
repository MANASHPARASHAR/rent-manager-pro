export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER'
}

export enum ColumnType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  DROPDOWN = 'dropdown',
  CURRENCY = 'currency',
  RENT_DUE_DAY = 'rent_due_day',
  SECURITY_DEPOSIT = 'security_deposit',
  OCCUPANCY_STATUS = 'occupancy_status'
}

export enum PaymentStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  VACANT = 'VACANT'
}

export type PaymentType = 'RENT' | 'DEPOSIT';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
}

export interface ColumnDefinition {
  id: string;
  name: string;
  type: ColumnType;
  required: boolean;
  isRentCalculatable: boolean;
  isSecurityDeposit?: boolean;
  isDefaultInLedger?: boolean;
  options?: string[];
  order: number;
}

export interface PropertyType {
  id: string;
  name: string;
  columns: ColumnDefinition[];
  defaultDueDateDay?: number;
}

export interface Property {
  id: string;
  name: string;
  propertyTypeId: string;
  address: string;
  city?: string;
  createdAt: string;
  isVisibleToManager?: boolean;
}

export interface PropertyRecord {
  id: string;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordValue {
  id: string;
  recordId: string;
  columnId: string;
  value: string;
}

export interface UnitHistory {
  id: string;
  recordId: string;
  values: Record<string, string>;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface Payment {
  id: string;
  recordId: string;
  month: string;
  amount: number;
  status: PaymentStatus;
  type: PaymentType;
  dueDate: string;
  paidAt?: string;
  paidTo?: string;
  paymentMode?: string;
  isRefunded?: boolean;
}

export interface AppConfig {
  paidToOptions: string[];
  paymentModeOptions: string[];
  cities: string[];
}