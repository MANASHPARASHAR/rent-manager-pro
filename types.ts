
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER'
}

export enum ColumnType {
  TEXT = 'text',
  NUMBER = 'number',
  PHONE = 'phone',
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

export type PaymentType = 'RENT' | 'DEPOSIT' | 'ELECTRICITY';

export interface Expense {
  id: string;
  propertyId: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  month: string; // for easier grouping
  createdBy: string;
  createdByRole: UserRole;
  createdAt: string;
  propertyManagerId?: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
  assignedPropertyIds?: string[];
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
  allowedUserIds?: string[];
  totalInvestment?: number;
}

export interface PropertyRecord {
  id: string;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface RecordValue {
  id: string;
  recordId: string;
  propertyId: string;
  columnId: string;
  value: string;
}

export interface UnitHistory {
  id: string;
  recordId: string;
  propertyId: string;
  values: Record<string, string>;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface Payment {
  id: string;
  recordId: string;
  propertyId: string;
  historyId?: string;
  month: string;
  amount: number;
  status: PaymentStatus;
  type: PaymentType;
  dueDate: string;
  paidAt?: string;
  paidTo?: string;
  paymentMode?: string;
  isRefunded?: boolean;
  notes?: string;
  startReading?: number;
  endReading?: number;
  perUnitCost?: number;
  createdBy?: string;
  createdByRole?: UserRole;
}

export interface AppConfig {
  paidToOptions: string[];
  paymentModeOptions: string[];
  cities: string[];
  googleClientId?: string;
  whatsappAccessToken?: string;
  whatsappPhoneID?: string;
  whatsappTemplateName?: string;
  whatsappReminderIntervalDays?: number;
}

export type NotificationType = 'RENT_OVERDUE' | 'SYSTEM' | 'EXPENSE';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  propertyId?: string;
  recordId?: string;
  month?: string;
  createdAt: string;
  isRead: boolean;
}

export interface PushSubscriptionData {
  id: string;
  userId: string;
  subscription: string;
  createdAt: string;
}
