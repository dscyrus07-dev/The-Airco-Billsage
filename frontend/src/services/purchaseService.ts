import { apiClient } from '@/api/client';
import { getParties } from './partyService';

export interface PurchaseInvoiceItemCreate {
  line_no: number;
  product_id?: string;
  description: string;
  hsn_sac: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_percent: number;
  gst_percent: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export interface PurchaseInvoiceCreate {
  vendor_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  place_of_supply: string;
  category?: string;
  cost_center?: string;
  reverse_charge?: boolean;
  entry_method?: string;
  currency?: string;
  fx_rate_to_base?: number;
  status?: string;
  gst_status?: string;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  total_amount: number;
  paid_amount?: number;
  tds_percent?: number;
  tds_amount?: number;
  narration?: string;
  notes?: string;
  flags?: Record<string, any>;
  items: PurchaseInvoiceItemCreate[];
  source_file_id?: string;
}

export interface PurchaseInvoiceUpdate {
  vendor_id?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  place_of_supply?: string;
  category?: string;
  cost_center?: string;
  reverse_charge?: boolean;
  status?: string;
  gst_status?: string;
  taxable_amount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total_tax?: number;
  total_amount?: number;
  paid_amount?: number;
  tds_percent?: number;
  tds_amount?: number;
  narration?: string;
  notes?: string;
  flags?: Record<string, any>;
  items?: PurchaseInvoiceItemCreate[];
}

export interface ExtractionUploadResponse {
  status: string; // 'completed' | 'failed' | 'processing'
  review_id?: string;
  file_id?: string;
  extraction_confidence?: number;
  review_status?: string;
  extracted_data?: any;
  party_resolution?: any;
  requires_party_creation?: boolean;
  error?: string;
  message?: string;
}

export interface ExtractionReviewAction {
  action: string;
  rejection_reason?: string;
  edited_data?: any;
}

export interface PurchaseListFilters {
  status?: string;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class PurchaseService {
  private baseUrl = '/api/v1/purchases';

  /**
   * Upload and extract data from PDF
   */
  async uploadAndExtract(file: File): Promise<ExtractionUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.postFormData<ExtractionUploadResponse>(
      `${this.baseUrl}/upload`,
      formData
    );

    return response;
  }

  /**
   * Confirm extraction review and create purchase invoice
   */
  async confirmReview(reviewId: string, invoiceData: PurchaseInvoiceCreate): Promise<any> {
    const response = await apiClient.post(
      `${this.baseUrl}/extraction-reviews/${reviewId}/confirm`,
      invoiceData
    );

    return response;
  }

  /**
   * Action on extraction review (approve/reject)
   */
  async actionReview(reviewId: string, action: ExtractionReviewAction): Promise<any> {
    const response = await apiClient.post(
      `${this.baseUrl}/extraction-reviews/${reviewId}/action`,
      action
    );

    return response;
  }

  /**
   * Get extraction reviews
   */
  async getExtractionReviews(limit: number = 50): Promise<any[]> {
    const response = await apiClient.get(
      `${this.baseUrl}/extraction-reviews?limit=${limit}`
    );

    return Array.isArray(response) ? response : [];
  }

  /**
   * Get extraction review details
   */
  async getExtractionReview(reviewId: string): Promise<any> {
    const response = await apiClient.get(
      `${this.baseUrl}/extraction-reviews/${reviewId}`
    );

    return response;
  }

  /**
   * Create purchase invoice manually
   */
  async createPurchaseInvoice(data: PurchaseInvoiceCreate): Promise<any> {
    const response = await apiClient.post(
      `${this.baseUrl}`,
      data
    );

    return response;
  }

  /**
   * Update purchase invoice
   */
  async updatePurchaseInvoice(id: string, data: PurchaseInvoiceUpdate): Promise<any> {
    const response = await apiClient.put(
      `${this.baseUrl}/${id}`,
      data
    );

    return response;
  }

  async downloadPurchaseBill(id: string, fallbackFilename?: string): Promise<void> {
    await apiClient.download(
      `${this.baseUrl}/${id}/download`,
      fallbackFilename || `purchase-${id}.json`
    );
  }

  async downloadOriginalBill(id: string, fallbackFilename?: string): Promise<void> {
    await apiClient.download(
      `${this.baseUrl}/${id}/download-original`,
      fallbackFilename || `purchase-${id}.pdf`
    );
  }

  /**
   * Get purchase invoice by ID
   */
  async getPurchaseInvoice(id: string): Promise<any> {
    const response = await apiClient.get<any>(
      `${this.baseUrl}/${id}`
    );

    // Map backend response to frontend format
    return {
      id: response.id,
      invoiceNo: response.voucher_number,
      vendorId: response.party_id || '',
      vendor: response.vendor_name || '',
      gstin: response.vendor_gstin || '',
      vendorAddress: '',
      placeOfSupply: response.place_of_supply || '',
      invoiceDate: response.voucher_date,
      refNumber: response.ref_number || '',
      dueDate: response.ref_date || response.voucher_date,
      paymentTerms: '',
      category: '',
      costCenter: '',
      taxableAmount: response.taxable_amount || 0,
      cgst: response.cgst_amount || 0,
      sgst: response.sgst_amount || 0,
      igst: response.igst_amount || 0,
      totalTax: (response.cgst_amount || 0) + (response.sgst_amount || 0) + (response.igst_amount || 0),
      totalAmount: response.total_amount || 0,
      paidAmount: response.paid_amount || 0,
      status: response.status || 'draft',
      gstStatus: 'pending',
      lineItems: (response.items || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        hsn: item.hsn_sac_code,
        qty: item.quantity,
        rate: item.rate,
        taxableAmount: item.taxable_amount,
        cgst: item.cgst_amount,
        sgst: item.sgst_amount,
        igst: item.igst_amount,
        total: item.line_total
      })),
      recordedBy: response.created_by || '',
      recordedAt: response.created_at || '',
      entryMethod: 'manual',
      notes: response.notes || '',
      flags: [],
      sourceFileName: response.source_file_name || '',
      hasOriginalFile: !!response.source_file_name,
    };
  }

  /**
   * List purchase invoices
   */
  async listPurchaseInvoices(filters?: PurchaseListFilters): Promise<any[]> {
    const params: Record<string, string> = {};
    
    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status;
    }
    if (filters?.vendor) {
      params.vendor = filters.vendor;
    }
    if (filters?.dateFrom) {
      params.dateFrom = filters.dateFrom;
    }
    if (filters?.dateTo) {
      params.dateTo = filters.dateTo;
    }
    if (filters?.search) {
      params.search = filters.search;
    }
    if (filters?.limit) {
      params.limit = filters.limit.toString();
    }
    if (filters?.offset) {
      params.offset = filters.offset.toString();
    }

    const response = await apiClient.get<{purchases: any[], total: number}>(
      `${this.baseUrl}`,
      params
    );

    // Backend returns paginated response: {purchases: [], total: number, ...}
    return response.purchases || [];
  }

  /**
   * Delete purchase invoice
   */
  async deletePurchaseInvoice(id: string): Promise<void> {
    await apiClient.delete(
      `${this.baseUrl}/${id}`
    );
  }

  /**
   * Approve purchase invoice
   */
  async approvePurchaseInvoice(id: string): Promise<any> {
    const response = await apiClient.post(
      `${this.baseUrl}/${id}/approve`,
      {}
    );

    return response;
  }

  /**
   * Reject purchase invoice
   */
  async rejectPurchaseInvoice(id: string, reason: string): Promise<any> {
    const response = await apiClient.post(
      `${this.baseUrl}/${id}/reject`,
      { reason }
    );

    return response;
  }

  /**
   * Request correction for purchase invoice
   */
  async requestCorrection(id: string, reason: string): Promise<any> {
    const response = await apiClient.post(
      `${this.baseUrl}/${id}/request-correction`,
      { reason }
    );

    return response;
  }

  /**
   * Get purchase KPIs
   */
  async getPurchaseKPIs(): Promise<any> {
    const response = await apiClient.get(
      `${this.baseUrl}/kpis`
    );

    return response;
  }

  /**
   * Get purchase analytics
   */
  async getPurchaseAnalytics(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<any> {
    const queryParams: Record<string, string> = {};
    
    if (params?.start_date) {
      queryParams.start_date = params.start_date;
    }
    if (params?.end_date) {
      queryParams.end_date = params.end_date;
    }

    const response = await apiClient.get(
      `${this.baseUrl}/analytics`,
      queryParams
    );

    return response;
  }

  /**
   * Get vendors (suppliers) - using Parties service per standard
   */
  async getVendors(): Promise<any[]> {
    // Fix: Use partyService instead of direct API call per Parties standard
    const response = await getParties({ partyType: 'supplier' });
    return response || [];
  }

  /**
   * Get purchase invoice history for a vendor
   */
  async getVendorPurchaseHistory(vendorId: string): Promise<any[]> {
    const response = await apiClient.get(
      `/api/v1/parties/${vendorId}/invoices?invoice_type=purchase`
    );

    return (response as any).invoices || [];
  }
}

export const purchaseService = new PurchaseService();
