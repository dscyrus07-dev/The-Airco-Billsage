import { apiClient } from '@/api/client';

// Types matching backend schemas
export interface SalesInvoiceItem {
  line_number: number;
  line_no?: number;
  product_id?: string | null;
  description: string;
  hsn_sac_code: string;
  hsn_sac?: string;
  quantity: number;
  rate: number;
  discount_pct: number;
  discount_amount: number;
  taxable_amount: number;
  taxable_value?: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  cess_rate: number;
  cess_amount: number;
  line_total: number;
  total_amount?: number;
}

export interface SalesInvoiceCreate {
  party_id: string;
  voucher_date: string;
  supply_type?: string;
  place_of_supply?: string;
  notes?: string;
  items: SalesInvoiceItem[];
}

export interface SalesInvoiceUpdate {
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  place_of_supply?: string;
  currency?: string;
  fx_rate_to_base?: number;
  taxable_amount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total_tax?: number;
  total_amount?: number;
  tds_percent?: number;
  tds_amount?: number;
  late_fee_amount?: number;
  interest_amount?: number;
  narration?: string;
  notes?: string;
  items?: SalesInvoiceItem[];
}

export interface SalesInvoiceResponse {
  id: string;
  company_id: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_gstin?: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  place_of_supply: string;
  entry_method: string;
  currency: string;
  fx_rate_to_base: number;
  status: string;
  gst_status: string;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  total_amount: number;
  paid_amount: number;
  tds_percent: number;
  tds_amount: number;
  late_fee_amount: number;
  interest_amount: number;
  narration?: string;
  notes?: string;
  flags?: Record<string, any>;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  generated_file_id?: string;
  current_version: number;
  recorded_by?: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  items: SalesInvoiceItem[];
}

export interface SalesInvoiceListItem {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  gst_status: string;
  entry_method: string;
  created_at: string;
  // Temporary compatibility fields for existing code
  invoiceNo: string;
  customer: string;
  gstin: string;
  totalTax: number;
  invoiceDate: string;
  dueDate?: string;
  totalAmount: number;
  paidAmount: number;
  gstStatus: string;
  recordedBy: string;
  paymentTerms: string;
}

export interface SalesKPIs {
  total_sales: number;
  total_invoices: number;
  pending_approval: number;
  approved_invoices: number;
  total_received: number;
  total_outstanding: number;
  average_invoice_value: number;
  overdue_count: number;
  overdue_amount: number;
}

export interface SalesAnalytics {
  period_start: string;
  period_end: string;
  total_sales: number;
  invoice_count: number;
  average_value: number;
  top_customers: Array<{
    customer_id: string;
    customer_name: string;
    total_amount: number;
    invoice_count: number;
  }>;
  payment_status: {
    paid: number;
    partially_paid: number;
    unpaid: number;
  };
}

export interface ReceivablesAging {
  summary: {
    total_outstanding: number;
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  };
  by_customer: Array<{
    customer_id: string;
    customer_name: string;
    total_outstanding: number;
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  }>;
  invoices: Array<{
    invoice_id: string;
    invoice_number: string;
    customer_name: string;
    invoice_date: string;
    due_date?: string;
    total_amount: number;
    paid_amount: number;
    outstanding: number;
    days_overdue: number;
    bucket: string;
  }>;
}

export interface SalesFilters {
  skip?: number;
  limit?: number;
  status?: string;
  customer_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

class SalesService {
  private baseUrl = '/api/v1/sales';

  async listInvoices(filters?: SalesFilters): Promise<SalesInvoiceListItem[]> {
    const params: Record<string, string | number> = {};
    
    if (filters?.skip !== undefined) params.skip = filters.skip;
    if (filters?.limit !== undefined) params.limit = filters.limit;
    if (filters?.status) params.status = filters.status;
    if (filters?.customer_id) params.customer_id = filters.customer_id;
    if (filters?.start_date) params.start_date = filters.start_date;
    if (filters?.end_date) params.end_date = filters.end_date;
    if (filters?.search) params.search = filters.search;

    // Backend returns paginated response: {sales: [], total: number, page: number, ...}
    const response = await apiClient.get<{sales: any[], total: number}>(this.baseUrl, params);
    
    // Extract sales array from paginated response
    const salesData = response.sales || [];
    
    // Map backend response to include compatibility fields
    return salesData.map(item => ({
      id: item.id,
      company_id: item.company_id,
      customer_id: item.party_id || '',
      invoice_number: item.voucher_number,
      invoice_date: item.voucher_date,
      due_date: item.ref_date,
      total_amount: item.total_amount,
      paid_amount: item.paid_amount,
      status: item.status,
      gst_status: item.supply_type || 'B2B',
      entry_method: 'manual',
      created_at: item.created_at,
      // Add camelCase compatibility fields
      invoiceNo: item.voucher_number,
      customer: `Customer ${item.party_id?.substring(0, 8) || 'N/A'}`,
      gstin: '',
      totalTax: (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0),
      invoiceDate: item.voucher_date,
      dueDate: item.ref_date,
      totalAmount: item.total_amount,
      paidAmount: item.paid_amount,
      gstStatus: item.supply_type || 'B2B',
      recordedBy: '',
      paymentTerms: 'net30',
      customerMetadata: {
        name: item.customer_name || '',
        email: item.customer_email || '',
        gstin: item.customer_gstin || '',
      },
    }));
  }

  async getInvoice(invoiceId: string): Promise<SalesInvoiceResponse> {
    const response = await apiClient.get<any>(`${this.baseUrl}/${invoiceId}`);
    
    // Map backend response to frontend expected format
    return {
      ...response,
      // Map party_id to customer_id for frontend compatibility
      customer_id: response.party_id || '',
      customer_name: response.customer_name || '',
      customer_email: response.customer_email || '',
      customer_gstin: response.customer_gstin || '',
      invoice_number: response.voucher_number,
      invoice_date: response.voucher_date,
      due_date: response.ref_date,
      total_amount: response.total_amount ?? 0,
      paid_amount: response.paid_amount ?? 0,
      status: response.status,
      gst_status: response.supply_type || 'B2B',
      entry_method: 'manual',
      created_at: response.created_at,
      taxable_amount: response.taxable_amount ?? 0,
      cgst: response.cgst_amount ?? 0,
      sgst: response.sgst_amount ?? 0,
      igst: response.igst_amount ?? 0,
      total_tax: (response.cgst_amount ?? 0) + (response.sgst_amount ?? 0) + (response.igst_amount ?? 0),
      tds_percent: response.tds_percent ?? 0,
      tds_amount: response.tds_amount ?? 0,
      late_fee_amount: response.late_fee_amount ?? 0,
      interest_amount: response.interest_amount ?? 0,
      flags: response.flags || {},
      items: (response.items || []).map((item: any) => ({
        ...item,
        line_no: item.line_number,
        hsn_sac: item.hsn_sac_code,
        taxable_value: item.taxable_amount ?? 0,
        total_amount: item.line_total ?? 0,
        quantity: item.quantity ?? 0,
        rate: item.rate ?? 0,
        cgst_amount: item.cgst_amount ?? 0,
        sgst_amount: item.sgst_amount ?? 0,
        igst_amount: item.igst_amount ?? 0,
      })),
    };
  }

  async downloadInvoice(invoiceId: string, fallbackFilename?: string): Promise<void> {
    await apiClient.download(
      `${this.baseUrl}/${invoiceId}/download`,
      fallbackFilename || `sale-${invoiceId}.json`
    );
  }

  async createInvoice(data: SalesInvoiceCreate): Promise<SalesInvoiceResponse> {
    return apiClient.post<SalesInvoiceResponse>(this.baseUrl, data);
  }

  async generateInvoice(data: SalesInvoiceCreate): Promise<SalesInvoiceResponse> {
    return apiClient.post<SalesInvoiceResponse>(`${this.baseUrl}/generate`, data);
  }

  async updateInvoice(invoiceId: string, data: SalesInvoiceUpdate): Promise<SalesInvoiceResponse> {
    return apiClient.put<SalesInvoiceResponse>(`${this.baseUrl}/${invoiceId}`, data);
  }

  async deleteInvoice(invoiceId: string): Promise<void> {
    return apiClient.delete<void>(`${this.baseUrl}/${invoiceId}`);
  }

  async approveInvoice(invoiceId: string): Promise<SalesInvoiceResponse> {
    return apiClient.post<SalesInvoiceResponse>(`/api/v1/approvals/sales/${invoiceId}/approve`);
  }

  async rejectInvoice(invoiceId: string, reason?: string): Promise<SalesInvoiceResponse> {
    const params: Record<string, string> = {};
    if (reason) params.reason = reason;
    return apiClient.post<SalesInvoiceResponse>(`/api/v1/approvals/sales/${invoiceId}/reject`, params);
  }

  async getKPIs(): Promise<SalesKPIs> {
    return apiClient.get<SalesKPIs>(`${this.baseUrl}/kpis`);
  }

  async getAnalytics(startDate?: string, endDate?: string): Promise<SalesAnalytics> {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return apiClient.get<SalesAnalytics>(`${this.baseUrl}/analytics`, params);
  }
}

export const salesService = new SalesService();
