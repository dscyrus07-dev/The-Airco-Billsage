import { apiClient } from '@/api/client';
import type { Party, PartyTransactionSummary, PartyAnalytics, PartyInvoice, PartyType } from '@/types/party';
import type { PartyCreateInput, PartyUpdateInput, PartyFilters } from '@/schemas/partySchemas';

// Party CRUD operations
export async function getParties(filters?: PartyFilters): Promise<Party[]> {
  const params: Record<string, string> = {};
  
  if (filters?.search) params.search = filters.search;
  if (filters?.status && filters.status !== 'all') params.status = filters.status;
  if (filters?.partyType && filters.partyType !== 'all') params.party_type = filters.partyType;
  if (filters?.state && filters.state !== 'all') params.state = filters.state;
  
  const url = `/api/v1/parties`;
  const response = await apiClient.get<{ parties: any[], total: number }>(url, params);
  
  // Map backend response to frontend Party type
  return response.parties.map(p => ({
    id: p.id,
    partyName: p.party_name,
    displayName: p.display_name,
    partyCode: p.party_code,
    partyType: p.party_type,
    partyCategory: p.party_category,
    gstin: p.gstin,
    pan: p.pan,
    cin: p.cin,
    tan: p.tan,
    email: p.email,
    phone: p.phone,
    alternatePhone: p.alternate_phone,
    website: p.website,
    address: p.address,
    state: p.state,
    pinCode: p.pin_code,
    creditLimit: p.credit_limit,
    paymentTermsDays: p.payment_terms_days,
    openingBalance: p.opening_balance,
    openingBalanceType: p.opening_balance_type,
    status: p.status,
    createdBy: p.created_by,
    updatedBy: p.updated_by,
    deletedAt: p.deleted_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    notes: p.notes,
  }));
}

export async function getPartyById(id: string): Promise<Party | null> {
  try {
    const response = await apiClient.get<any>(`/api/v1/parties/${id}`);
    
    // Map backend response to frontend Party type
    return {
      id: response.id,
      partyName: response.party_name,
      displayName: response.display_name,
      partyCode: response.party_code,
      partyType: response.party_type,
      partyCategory: response.party_category,
      gstin: response.gstin,
      pan: response.pan,
      cin: response.cin,
      tan: response.tan,
      email: response.email,
      phone: response.phone,
      alternatePhone: response.alternate_phone,
      website: response.website,
      address: response.address,
      state: response.state,
      pinCode: response.pin_code,
      creditLimit: response.credit_limit,
      paymentTermsDays: response.payment_terms_days,
      openingBalance: response.opening_balance,
      openingBalanceType: response.opening_balance_type,
      status: response.status,
      createdBy: response.created_by,
      updatedBy: response.updated_by,
      deletedAt: response.deleted_at,
      createdAt: response.created_at,
      updatedAt: response.updated_at,
      notes: response.notes,
    };
  } catch (error) {
    console.error('Error fetching party:', error);
    return null;
  }
}

export async function createParty(data: PartyCreateInput): Promise<Party> {
  // Debug logging - capture exact frontend payload
  console.log('=== FRONTEND CREATE PARTY START ===');
  console.log('Frontend input data:', data);
  console.log('Frontend data type:', typeof data);
  console.log('Frontend data keys:', Object.keys(data));
  
  // Map frontend field names to backend field names
  // Backend accepts party_type and converts it to is_supplier/is_customer
  const backendData: any = {
    // Required fields
    party_type: data.partyType,
    party_name: data.partyName,
    
    // Optional fields - include all values since backend handles defaults
    ...(data.displayName && data.displayName.trim() && { display_name: data.displayName }),
    ...(data.gstin && data.gstin.trim() && { gstin: data.gstin }),
    ...(data.pan && data.pan.trim() && { pan: data.pan }),
    ...(data.cin && data.cin.trim() && { cin: data.cin }),
    ...(data.tan && data.tan.trim() && { tan: data.tan }),
    ...(data.email && data.email.trim() && { email: data.email }),
    ...(data.phone && data.phone.trim() && { phone: data.phone }),
    ...(data.alternatePhone && data.alternatePhone.trim() && { alternate_phone: data.alternatePhone }),
    ...(data.website && data.website.trim() && { website: data.website }),
    ...(data.creditLimit !== undefined && { credit_limit: data.creditLimit }),
    ...(data.paymentTermsDays !== undefined && { payment_terms_days: data.paymentTermsDays }),
    ...(data.openingBalance !== undefined && { opening_balance: data.openingBalance }),
    ...(data.openingBalanceType && data.openingBalanceType.trim() && { opening_balance_type: data.openingBalanceType }),
    ...(data.notes && data.notes.trim() && { notes: data.notes }),
  };
  
  console.log('Mapped backend data:', backendData);
  console.log('Sending POST to /api/v1/parties');
  
  try {
    const response = await apiClient.post<any>('/api/v1/parties', backendData);
    console.log('✓ API call successful:', response);
    console.log('=== FRONTEND CREATE PARTY SUCCESS ===');
    
    // Map backend response to frontend Party type
    return {
      id: response.id,
      partyName: response.party_name,
      displayName: response.display_name,
      partyType: response.party_type,
      partyCategory: response.party_category,
      gstin: response.gstin,
      pan: response.pan,
      cin: response.cin,
      tan: response.tan,
      email: response.email,
      phone: response.phone,
      alternatePhone: response.alternate_phone,
      website: response.website,
      creditLimit: response.credit_limit,
      paymentTermsDays: response.payment_terms_days,
      openingBalance: response.opening_balance,
      openingBalanceType: response.opening_balance_type,
      status: response.status,
      createdAt: response.created_at,
      updatedAt: response.updated_at,
      notes: response.notes,
    };
  } catch (error) {
    console.error('✗ API call failed:', error);
    console.error('✗ Error details:', error);
    console.log('=== FRONTEND CREATE PARTY FAILED ===');
    throw error;
  }
}

export async function updateParty(id: string, data: PartyUpdateInput): Promise<Party> {
  // Map frontend field names to backend field names
  const backendData: any = {};
  if (data.partyType !== undefined) backendData.party_type = data.partyType;
  if (data.partyName !== undefined) backendData.party_name = data.partyName;
  if (data.displayName !== undefined) backendData.display_name = data.displayName;
  if (data.partyCategory !== undefined) backendData.party_category = data.partyCategory;
  if (data.gstin !== undefined) backendData.gstin = data.gstin;
  if (data.pan !== undefined) backendData.pan = data.pan;
  if (data.cin !== undefined) backendData.cin = data.cin;
  if (data.tan !== undefined) backendData.tan = data.tan;
  if (data.email !== undefined) backendData.email = data.email;
  if (data.phone !== undefined) backendData.phone = data.phone;
  if (data.alternatePhone !== undefined) backendData.alternate_phone = data.alternatePhone;
  if (data.website !== undefined) backendData.website = data.website;
  if (data.creditLimit !== undefined) backendData.credit_limit = data.creditLimit;
  if (data.paymentTermsDays !== undefined) backendData.payment_terms_days = data.paymentTermsDays;
  if (data.openingBalance !== undefined) backendData.opening_balance = data.openingBalance;
  if (data.openingBalanceType !== undefined) backendData.opening_balance_type = data.openingBalanceType;
  if (data.status !== undefined) backendData.status = data.status;
  if (data.notes !== undefined) backendData.notes = data.notes;
  
  const response = await apiClient.patch<any>(`/api/v1/parties/${id}`, backendData);
  
  // Map backend response to frontend Party type
  return {
    id: response.id,
    partyName: response.party_name,
    displayName: response.display_name,
    partyType: response.party_type,
    partyCategory: response.party_category,
    gstin: response.gstin,
    pan: response.pan,
    cin: response.cin,
    tan: response.tan,
    email: response.email,
    phone: response.phone,
    alternatePhone: response.alternate_phone,
    website: response.website,
    creditLimit: response.credit_limit,
    paymentTermsDays: response.payment_terms_days,
    openingBalance: response.opening_balance,
    openingBalanceType: response.opening_balance_type,
    status: response.status,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    notes: response.notes,
  };
}

export async function deleteParty(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/v1/parties/${id}`);
}

export async function updatePartyStatus(id: string, status: 'active' | 'inactive' | 'blocked'): Promise<Party> {
  return updateParty(id, { status });
}

// Party analytics and summaries
export async function getPartySummary(partyId: string): Promise<PartyTransactionSummary | null> {
  try {
    return await apiClient.get<PartyTransactionSummary>(`/api/v1/parties/${partyId}/summary`);
  } catch (error) {
    console.error('Error fetching party summary:', error);
    return null;
  }
}

export async function getPartyInvoices(partyId: string, filters?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  invoiceType?: 'purchase' | 'sale';
}): Promise<PartyInvoice[]> {
  const params: Record<string, string> = {};
  
  if (filters?.invoiceType) params.invoiceType = filters.invoiceType;
  if (filters?.status && filters.status !== 'all') params.status = filters.status;
  if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters?.dateTo) params.dateTo = filters.dateTo;
  
  const response = await apiClient.get<{ invoices: any[], total: number, page: number, page_size: number }>(`/api/v1/parties/${partyId}/invoices`, params);
  
  // Map backend response to frontend PartyInvoice type
  const mappedInvoices = (response.invoices || []).map(inv => ({
    id: inv.id,
    partyId: partyId,
    invoiceNo: inv.invoice_number || '',
    invoiceDate: inv.invoice_date || '',
    dueDate: inv.due_date || '',
    taxableAmount: 0, // Backend doesn't provide this
    gstAmount: 0, // Backend doesn't provide this
    totalAmount: inv.total_amount || 0,
    status: (inv.status || 'draft') as 'draft' | 'submitted' | 'approved' | 'paid' | 'overdue' | 'unpaid',
    agingBucket: '0-30' as const, // Backend doesn't provide this
    invoiceType: inv.invoice_type || 'purchase'
  }));
  
  console.log('PartyService - Mapped invoices:', mappedInvoices);
  return mappedInvoices;
}

export async function getPartyAnalytics(): Promise<PartyAnalytics> {
  const response = await apiClient.get<any>('/api/v1/parties/analytics/summary');
  
  // Map backend response to frontend PartyAnalytics type
  return {
    totalSuppliers: response.active_suppliers || 0,
    totalCustomers: response.active_customers || 0,
    totalBoth: 0, // Backend doesn't return this separately
    totalSpend: response.total_spend || 0,
    totalRevenue: response.total_revenue || 0,
    topSupplierConcentration: 0, // Calculate from top performers if needed
    topCustomerConcentration: 0, // Calculate from top performers if needed
    totalOverduePayables: 0, // Not in summary endpoint
    totalOverdueReceivables: 0, // Not in summary endpoint
    averagePaymentDays: 0, // Not in summary endpoint
    averageCollectionDays: 0, // Not in summary endpoint
    riskScore: 0, // Not in summary endpoint
  };
}

// Search and autocomplete
export async function searchParties(query: string, partyType?: PartyType): Promise<Party[]> {
  if (!query.trim()) return [];
  
  const params = new URLSearchParams({ q: query });
  if (partyType && partyType !== 'both') params.append('partyType', partyType);
  
  return apiClient.get<Party[]>(`/api/v1/parties/search?q=${query}`);
}

// Bulk operations
export async function bulkUpdatePartyStatus(partyIds: string[], status: 'active' | 'inactive'): Promise<void> {
  await apiClient.patch<void>('/api/v1/parties/bulk/status', { party_ids: partyIds, status });
}

// Validation helpers
export function validatePAN(pan: string): boolean {
  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return PAN_REGEX.test(pan);
}

export function validatePhone(phone: string): boolean {
  const PHONE_REGEX = /^[6-9]\d{9}$/;
  return PHONE_REGEX.test(phone);
}

export function validateEmail(email: string): boolean {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return EMAIL_REGEX.test(email);
}
