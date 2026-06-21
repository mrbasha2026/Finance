// Core P&L types for the Arabic financial dashboard

export type Currency = "SAR" | "USD" | "EUR" | "AED" | "KWD" | "BHD" | "OMR" | "QAR";

export type PeriodType = "monthly" | "quarterly" | "semi-annual" | "annual";

export type LineItemCategory = "revenue" | "expense" | "profit";

export interface PnLLineItemDef {
  key: string;
  name: string;       // English
  nameAr: string;     // Arabic
  category: LineItemCategory;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent: 0 | 1 | 2;
  description?: string;
  expandable?: boolean;
  parentKey?: string;
}

export interface LineItemValue {
  key: string;
  amount: number;
}

export interface CompanyPnL {
  id: string;
  companyId: string;
  companyName: string;
  period: string;      // "YYYY-MM"
  currency: Currency;
  data: Record<string, number>;
}

export interface JournalEntry {
  id: string;
  companyName: string;
  period: string;
  date: string;
  entryNumber: string;
  accountKey: string;
  accountNameAr: string;
  description?: string;
  debit: number;
  credit: number;
  reference?: string;
  currency: Currency;
}

export interface Company {
  id: string;
  name: string;
  color: string;
  currency: Currency;
  createdAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  twoFactorEnabled: boolean;
  twoFactorForced: boolean;
}

export interface PrepaidExpense {
  id: string;
  companyId: string;
  companyName?: string;
  vendorName: string;
  amount: number;
  currency: Currency;
  startDate: string;
  endDate: string;
  monthlyAmount: number;
  description?: string;
  status: "active" | "completed";
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  module: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface PnLKPIs {
  revenue: number;
  grossProfit: number;
  grossMargin: number;
  ebitda: number;
  ebitdaMargin: number;
  operatingIncome: number;
  operatingMargin: number;
  netIncome: number;
  netMargin: number;
}

export type PeriodGroup = {
  key: string;       // display key e.g. "2026-Q1"
  labelAr: string;   // "الربع الأول 2026"
  months: string[];  // source months ["2026-01","2026-02","2026-03"]
};

export type ComparisonType = "previous_period" | "yoy" | "both";

export type ReportTab =
  | "pnl"
  | "executive"
  | "comparison"
  | "trend"
  | "revenue"
  | "expenses"
  | "margin"
  | "variance";

export type ChartType =
  | "waterfall"
  | "line"
  | "column"
  | "bar"
  | "pie"
  | "area"
  | "margin"
  | "variance";
