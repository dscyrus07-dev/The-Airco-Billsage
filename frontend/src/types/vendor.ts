export interface Vendor {
  id: string;
  vendorName: string; // Legal name
  tradeName?: string; // Display name
  vendorType: 'supplier' | 'service' | 'both';
  gstin?: string;
  pan?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string; // Default India
  contactPersonName: string;
  email: string;
  phone: string;
  paymentTerms: 'NET 7' | 'NET 15' | 'NET 30' | 'NET 45' | 'custom';
  customPaymentTerms?: string;
  defaultGSTCategory: 'registered' | 'unregistered' | 'composition' | 'import';
  msme: boolean;
  tags: string[];
  status: 'active' | 'inactive' | 'blocked';
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface VendorTransactionSummary {
  vendorId: string;
  totalSpend: number;
  invoiceCount: number;
  avgInvoiceValue: number;
  onTimePaymentRate: number;
  overdueAmount: number;
  lastInvoiceDate: string;
  gstMismatchCount: number;
  duplicateInvoiceFlags: number;
}

export interface VendorInvoice {
  id: string;
  vendorId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  agingBucket: '0-30' | '31-60' | '61-90' | '90+';
}

export interface VendorAnalytics {
  totalVendors: number;
  activeVendors: number;
  totalSpend: number;
  overduePayables: number;
  topVendorConcentration: number;
  complianceRiskCount: number;
  topVendorsBySpend: Array<{
    vendorId: string;
    vendorName: string;
    totalSpend: number;
    invoiceCount: number;
  }>;
  spendByState: Array<{
    state: string;
    totalSpend: number;
    vendorCount: number;
  }>;
  agingDistribution: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  riskLeaderboard: Array<{
    vendorId: string;
    vendorName: string;
    flags: number;
    overdueAmount: number;
    missingGSTIN: boolean;
  }>;
}
