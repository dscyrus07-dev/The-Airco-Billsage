export type PartyType = 'supplier' | 'customer' | 'both';

export type PartyStatus = 'active' | 'inactive' | 'blocked';

export interface Party {
  id: string;
  partyName: string;
  displayName?: string;
  partyCode?: string;
  partyType: PartyType;
  partyCategory?: 'business' | 'individual';
  gstin?: string;
  pan?: string;
  cin?: string;
  tan?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  website?: string;
  address?: string;
  state?: string;
  pinCode?: string;
  creditLimit?: number;
  paymentTermsDays?: number;
  openingBalance?: number;
  openingBalanceType?: 'dr' | 'cr';
  status: PartyStatus;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface PartyInvoice {
  id: string;
  partyId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'overdue' | 'unpaid';
  agingBucket: '0-30' | '31-60' | '61-90' | '90+';
  invoiceType: 'purchase' | 'sale';
}

export interface PartyTransactionSummary {
  partyId: string;
  totalPurchases: number;
  totalSales: number;
  openPayables: number;
  openReceivables: number;
  overduePayables: number;
  overdueReceivables: number;
  purchaseInvoiceCount: number;
  salesInvoiceCount: number;
  onTimePaymentRate: number;
  creditUtilization?: number;
  complianceFlags: number;
  lastPurchaseDate?: string;
  lastSaleDate?: string;
  lastPaymentDate?: string;
}

export interface PartyAnalytics {
  totalSuppliers: number;
  totalCustomers: number;
  totalBoth: number;
  totalSpend: number;
  totalRevenue: number;
  topSupplierConcentration: number;
  topCustomerConcentration: number;
  totalOverduePayables: number;
  totalOverdueReceivables: number;
  averagePaymentDays: number;
  averageCollectionDays: number;
  riskScore: number;
}

export interface PartyMetrics {
  totalSpend?: number;
  totalRevenue?: number;
  invoiceCount?: number;
  overdueAmount?: number;
  onTimePaymentRate?: number;
  complianceFlags?: number;
  creditUtilization?: number;
  openPayables?: number;
  openReceivables?: number;
}

export interface PartyFilters {
  search?: string;
  status?: PartyStatus | 'all';
  partyType?: PartyType | 'all';
  state?: string | 'all';
  tags?: string[];
  msme?: boolean | string;
}

export interface PartyCreateInput {
  partyName: string;
  displayName?: string;
  partyCode?: string;
  partyType: PartyType;
  partyCategory?: 'business' | 'individual';
  gstin?: string;
  pan?: string;
  cin?: string;
  tan?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  website?: string;
  address?: string;
  state?: string;
  pinCode?: string;
  creditLimit?: number;
  paymentTermsDays?: number;
  openingBalance?: number;
  openingBalanceType?: 'dr' | 'cr';
  status?: PartyStatus;
  notes?: string;
}

export interface PartyUpdateInput {
  partyName?: string;
  displayName?: string;
  partyCode?: string;
  partyType?: PartyType;
  partyCategory?: 'business' | 'individual';
  gstin?: string;
  pan?: string;
  cin?: string;
  tan?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  website?: string;
  address?: string;
  state?: string;
  pinCode?: string;
  creditLimit?: number;
  paymentTermsDays?: number;
  openingBalance?: number;
  openingBalanceType?: 'dr' | 'cr';
  status?: PartyStatus;
  notes?: string;
}
