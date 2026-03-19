import { apiClient } from '@/api/client';
import { API_ENDPOINTS } from '@/api/endpoints';
import type {
  Purchase,
  Sale,
  Alert,
  GSTSummary,
  ReconciliationItem,
  KPIResponse,
  MonthlyTrend,
  CategorySpend,
  AgingBuckets,
  Vendor,
  Customer,
  SearchResults,
} from '@/types/api';

// Purchase APIs
export async function fetchPurchases(filters?: {
  status?: string;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
}): Promise<Purchase[]> {
  const params: Record<string, string> = {};
  if (filters?.status && filters.status !== 'all') params.status = filters.status;
  if (filters?.vendor) params.party_id = filters.vendor;
  if (filters?.dateFrom) params.date_from = filters.dateFrom;
  if (filters?.dateTo) params.date_to = filters.dateTo;
  if (filters?.category && filters.category !== 'all') params.category = filters.category;

  // Backend returns paginated response: {purchases: [], total: number, ...}
  const response = await apiClient.get<{purchases: any[], total: number}>(API_ENDPOINTS.purchases.list, params);
  
  // Map backend response to frontend Purchase type
  const purchases = (response.purchases || []).map((p: any) => ({
    id: p.id,
    invoiceNo: p.voucher_number,
    vendorId: p.party_id || '',
    vendor: p.vendor_name || '',
    gstin: p.vendor_gstin || '',
    vendorAddress: p.vendor_address || '',
    placeOfSupply: p.place_of_supply || '',
    invoiceDate: p.voucher_date,
    dueDate: p.ref_date || p.voucher_date,
    paymentTerms: '',
    category: '',
    costCenter: '',
    taxableAmount: p.taxable_amount || 0,
    cgst: p.cgst_amount || 0,
    sgst: p.sgst_amount || 0,
    igst: p.igst_amount || 0,
    totalTax: (p.cgst_amount || 0) + (p.sgst_amount || 0) + (p.igst_amount || 0),
    totalAmount: p.total_amount || 0,
    paidAmount: p.paid_amount || 0,
    status: (p.status || 'draft') as Purchase['status'],
    gstStatus: 'pending' as const,
    lineItems: [],
    recordedBy: p.created_by || '',
    recordedAt: p.created_at || '',
    entryMethod: 'manual' as const,
    notes: p.notes || '',
    flags: []
  }));
  
  return purchases;
}

export async function createPurchase(data: Partial<Purchase>): Promise<Purchase> {
  return apiClient.post<Purchase>(API_ENDPOINTS.purchases.create, data);
}

export async function updatePurchase(id: string, updates: Partial<Purchase>): Promise<Purchase> {
  return apiClient.put<Purchase>(API_ENDPOINTS.purchases.update(id), updates);
}

export async function uploadPurchaseBill(file: File, metadata?: Record<string, unknown>): Promise<Purchase> {
  return apiClient.uploadFile<Purchase>(API_ENDPOINTS.purchases.upload, file, metadata);
}

// Master Data APIs
export async function fetchVendors(): Promise<Vendor[]> {
  // Use partyService to handle the paginated response structure correctly
  const { getParties } = await import('./partyService');
  const parties = await getParties({ partyType: 'supplier' });
  
  // Map Party type to Vendor type
  return parties.map(party => ({
    id: party.id,
    tradeName: party.displayName || party.partyName,
    legalName: party.partyName,
    gstin: party.gstin || '',
    category: party.partyCategory || 'business',
    address: party.address,
    city: undefined, // Party type doesn't have city field
    state: party.state,
    contactEmail: party.email,
    contactPhone: party.phone,
  }));
}

// GST APIs
export async function fetchGSTSummaries(): Promise<GSTSummary[]> {
  return apiClient.get<GSTSummary[]>(API_ENDPOINTS.gst.summaries);
}

export async function fetchReconciliation(): Promise<ReconciliationItem[]> {
  return apiClient.get<ReconciliationItem[]>(API_ENDPOINTS.gst.reconciliation);
}

export async function updateReconciliationItem(
  id: string,
  updates: Partial<ReconciliationItem>
): Promise<ReconciliationItem> {
  return apiClient.put<ReconciliationItem>(API_ENDPOINTS.gst.reconciliationItem(id), updates);
}

// Analytics APIs
export async function fetchMonthlyTrend(): Promise<MonthlyTrend[]> {
  const response = await apiClient.get<{ trends: MonthlyTrend[] }>(API_ENDPOINTS.analytics.trends);
  return response.trends || [];
}

export async function fetchSpendByCategory(): Promise<CategorySpend[]> {
  const response = await apiClient.get<{ categories: CategorySpend[] }>(API_ENDPOINTS.analytics.categorySpend);
  return response.categories || [];
}

export async function fetchAgingBuckets(): Promise<AgingBuckets> {
  return apiClient.get<AgingBuckets>(API_ENDPOINTS.receivables.aging);
}

// Alerts API
export async function fetchAlerts(): Promise<Alert[]> {
  return apiClient.get<Alert[]>(API_ENDPOINTS.alerts.list);
}

export async function markAlertAsRead(id: string): Promise<void> {
  return apiClient.post<void>(API_ENDPOINTS.alerts.markRead(id));
}

// KPI APIs
export async function fetchHomeKPIs(): Promise<KPIResponse> {
  return apiClient.get<KPIResponse>(API_ENDPOINTS.kpis.home);
}

export async function fetchPurchaseKPIs(): Promise<KPIResponse> {
  return apiClient.get<KPIResponse>(API_ENDPOINTS.kpis.purchases);
}

export async function fetchGSTKPIs(): Promise<KPIResponse> {
  return apiClient.get<KPIResponse>(API_ENDPOINTS.kpis.gst);
}

// Search API
export async function globalSearch(query: string): Promise<SearchResults> {
  if (!query.trim()) {
    return { purchases: [], sales: [], vendors: [], customers: [] };
  }
  return apiClient.get<SearchResults>(API_ENDPOINTS.search.global, { q: query });
}
