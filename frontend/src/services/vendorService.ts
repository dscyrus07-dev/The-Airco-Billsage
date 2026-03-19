import { API_ENDPOINTS } from '@/config/api';
import type { Vendor, VendorTransactionSummary, VendorAnalytics, VendorInvoice } from '@/types/vendor';
import type { VendorCreateInput, VendorUpdateInput, VendorFilters } from '@/schemas/vendorSchemas';

// API helper function
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Vendor CRUD operations (using unified parties API)
export async function getVendors(filters?: VendorFilters): Promise<Vendor[]> {
  const params = new URLSearchParams();
  
  if (filters?.search) params.append('search', filters.search);
  if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters?.vendorType && filters.vendorType !== 'all') params.append('vendorType', filters.vendorType);
  if (filters?.gstCategory && filters.gstCategory !== 'all') params.append('gstCategory', filters.gstCategory);
  if (filters?.state && filters.state !== 'all') params.append('state', filters.state);
  
  const url = `${API_ENDPOINTS.vendors}${params.toString() ? '?' + params.toString() : ''}`;
  return apiRequest<Vendor[]>(url);
}

export async function getVendorById(id: string): Promise<Vendor | null> {
  try {
    return await apiRequest<Vendor>(API_ENDPOINTS.partyById(id));
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return null;
  }
}

export async function createVendor(data: VendorCreateInput): Promise<Vendor> {
  return apiRequest<Vendor>(API_ENDPOINTS.vendors, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateVendor(id: string, data: VendorUpdateInput): Promise<Vendor> {
  return apiRequest<Vendor>(API_ENDPOINTS.vendorUpdate(id), {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteVendor(id: string): Promise<void> {
  return apiRequest<void>(API_ENDPOINTS.vendorDelete(id), {
    method: 'DELETE',
  });
}

export async function updateVendorStatus(id: string, status: 'active' | 'inactive' | 'blocked'): Promise<Vendor> {
  return updateVendor(id, { status });
}

// Vendor analytics and summaries
export async function getVendorSummary(vendorId: string): Promise<VendorTransactionSummary | null> {
  try {
    return await apiRequest<VendorTransactionSummary>(API_ENDPOINTS.vendorSummary(vendorId));
  } catch (error) {
    console.error('Error fetching vendor summary:', error);
    return null;
  }
}

export async function getVendorInvoices(vendorId: string, filters?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<VendorInvoice[]> {
  const params = new URLSearchParams();
  
  if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.append('dateTo', filters.dateTo);
  
  const url = `${API_ENDPOINTS.vendorInvoices(vendorId)}${params.toString() ? '?' + params.toString() : ''}`;
  return apiRequest<VendorInvoice[]>(url);
}

export async function getVendorAnalytics(): Promise<VendorAnalytics> {
  return apiRequest<VendorAnalytics>(API_ENDPOINTS.vendorAnalytics);
}

// Search and autocomplete
export async function searchVendors(query: string): Promise<Vendor[]> {
  if (!query.trim()) return [];
  
  const params = new URLSearchParams({ q: query });
  return apiRequest<Vendor[]>(`${API_ENDPOINTS.vendorSearch}?${params.toString()}`);
}

// Bulk operations
export async function bulkUpdateVendorStatus(vendorIds: string[], status: 'active' | 'inactive' | 'blocked'): Promise<void> {
  await apiRequest<void>(API_ENDPOINTS.vendorBulkStatus, {
    method: 'POST',
    body: JSON.stringify({ vendorIds, status }),
  });
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
