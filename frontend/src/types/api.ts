export interface LineItem {
  id: string;
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface Purchase {
  id: string;
  invoiceNo: string;
  vendorId: string;
  vendor: string;
  gstin: string;
  vendorAddress?: string;
  placeOfSupply?: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms?: string;
  category: string;
  costCenter: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  paidAmount: number;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "correction_required" | "paid" | "partial";
  gstStatus: "matched" | "mismatch" | "pending";
  approvalStatus?: {
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    correctionRequest?: string;
  };
  lineItems: LineItem[];
  recordedBy: string;
  recordedAt: string;
  entryMethod: "manual" | "upload" | "ocr";
  notes: string;
  flags?: string[];
}

export interface Sale {
  id: string;
  invoiceNo: string;
  customerId: string;
  customer: string;
  gstin: string;
  customerAddress?: string;
  placeOfSupply?: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  paidAmount: number;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "correction_required" | "paid" | "partial" | "issued" | "overdue";
  gstStatus: "matched" | "mismatch" | "pending";
  approvalStatus?: {
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    correctionRequest?: string;
  };
  lineItems: LineItem[];
  recordedBy?: string;
  recordedAt?: string;
  entryMethod?: "manual" | "system";
  notes: string;
  flags?: string[];
}

export interface Vendor {
  id: string;
  tradeName: string;
  legalName: string;
  gstin: string;
  category: string;
  address?: string;
  city?: string;
  state?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface Customer {
  id: string;
  tradeName: string;
  legalName: string;
  gstin: string;
  segment?: string;
  address?: string;
  city?: string;
  state?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface GSTSummary {
  period: string;
  inputCGST: number;
  inputSGST: number;
  inputIGST: number;
  totalInput: number;
  outputCGST: number;
  outputSGST: number;
  outputIGST: number;
  totalOutput: number;
  netPayable: number;
  itcAvailable: number;
  reconciliationPct: number;
}

export interface Alert {
  id: string;
  type: "duplicate" | "gst_mismatch" | "overdue_payable" | "overdue_receivable" | "concentration" | "compliance";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  module: string;
  link: string;
  createdAt: string;
}

export interface ReconciliationItem {
  id: string;
  invoiceRef: string;
  party: string;
  partyGstin: string;
  taxable: number;
  tax: number;
  status: "matched" | "mismatch" | "missing";
  reason?: string;
  resolved: boolean;
  notes?: string;
}

export interface MonthlyTrend {
  month: string;
  revenue: number;
  purchases: number;
  grossMargin: number;
  margin?: number;
  inputGST?: number;
  outputGST?: number;
}

export interface CategorySpend {
  category: string;
  amount: number;
  percentage?: number;
  trend?: number;
}

export interface Payment {
  id: string;
  paymentDate: string;
  paymentMode: "bank" | "cash" | "upi" | "cheque";
  referenceNumber?: string;
  amount: number;
  notes?: string;
  invoiceIds: string[];
  proofFiles?: PaymentProofFile[];
  recordedBy: string;
  recordedAt: string;
  status: "recorded" | "verified" | "disputed";
  invoiceId?: string;
  invoiceNo?: string;
  invoiceType?: "purchase" | "sale";
  partyName?: string;
  totalAmount?: number;
  partASplit?: number;
  partBSplit?: number;
  partCSplit?: number;
  partDSplit?: number;
  partAAmount?: number;
  partBAmount?: number;
  partCAmount?: number;
  partDAmount?: number;
}

export interface PaymentProofFile {
  id: string;
  fileName: string;
  fileType: "pdf" | "jpg" | "png";
  fileSize: number;
  uploadedAt: string;
  downloadUrl: string;
}

export interface AgingBucket {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90_plus: number;
}

export interface AgingBucketItem {
  bucket: string;
  amount: number;
}

export interface AgingBuckets {
  receivables: AgingBucketItem[];
  payables: AgingBucketItem[];
}

export interface KPIMetric {
  value: number;
  change: number;
  changeLabel: string;
  sparkData: number[];
}

export interface KPIResponse {
  [key: string]: KPIMetric;
}

export interface SearchResults {
  purchases: Purchase[];
  sales: Sale[];
  vendors: Vendor[];
  customers: Customer[];
}
