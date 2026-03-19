import { apiClient } from '@/api/client';

// Types for receivables (matching existing page expectations)
export interface ReceivableItem {
  invoice_id: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  days_overdue: number;
}

export interface PayableItem {
  invoice_id: string;
  vendor_id: string;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  days_overdue: number;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  amount: number;
}

export interface ReceivablesSummary {
  total_outstanding: number;
  total_overdue: number;
  invoice_count: number;
  overdue_count: number;
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
  }>;
}

export class ReceivablesService {
  private baseUrl = '/api/v1/receivables';

  // Receivables endpoints
  async getReceivables(params?: {
    skip?: number;
    limit?: number;
  }): Promise<ReceivableItem[]> {
    const queryParams: Record<string, string> = {};
    if (params?.skip !== undefined) queryParams.skip = params.skip.toString();
    if (params?.limit !== undefined) queryParams.limit = params.limit.toString();
    
    const response = await apiClient.get<ReceivableItem[]>(this.baseUrl, queryParams);
    return response;
  }

  async getReceivablesAging(): Promise<ReceivablesAging> {
    // For now, call the sales endpoint since that's what the page expects
    // TODO: Update backend to provide proper receivables aging structure
    return apiClient.get<ReceivablesAging>(`/api/v1/sales/receivables/aging`);
  }

  async getReceivablesSummary(): Promise<ReceivablesSummary> {
    const response = await apiClient.get<ReceivablesSummary>(`${this.baseUrl}/summary`);
    return response;
  }

  // Payables endpoints
  async getPayables(params?: {
    skip?: number;
    limit?: number;
  }): Promise<PayableItem[]> {
    const queryParams: Record<string, string> = {};
    if (params?.skip !== undefined) queryParams.skip = params.skip.toString();
    if (params?.limit !== undefined) queryParams.limit = params.limit.toString();
    
    const response = await apiClient.get<PayableItem[]>(`${this.baseUrl}/payables`, queryParams);
    return response;
  }

  async getPayablesAging(): Promise<AgingBucket[]> {
    const response = await apiClient.get<AgingBucket[]>(`${this.baseUrl}/payables/aging`);
    return response;
  }

  async getPayablesSummary(): Promise<ReceivablesSummary> {
    const response = await apiClient.get<ReceivablesSummary>(`${this.baseUrl}/payables/summary`);
    return response;
  }
}

export const receivablesService = new ReceivablesService();
