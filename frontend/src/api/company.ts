/**
 * Company API service
 */

import { apiClient } from './client';

export interface Company {
  id: string;
  legal_name: string;
  trade_name?: string;
  gstin?: string;
  pan?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface CompanyUpdateRequest {
  legal_name?: string;
  trade_name?: string;
  gstin?: string;
  pan?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export const companyApi = {
  /**
   * Get current user's company (canonical endpoint)
   */
  async getMyCompany(): Promise<Company> {
    return apiClient.get<Company>('/api/v1/company/me');
  },

  /**
   * Update current user's company (canonical endpoint)
   */
  async updateMyCompany(data: CompanyUpdateRequest): Promise<Company> {
    return apiClient.patch<Company>('/api/v1/company/me', data);
  },

  /**
   * Get company by ID (deprecated - use getMyCompany instead)
   * @deprecated Use getMyCompany() instead for current user's company
   */
  async getCompanyById(companyId: string): Promise<Company> {
    return apiClient.get<Company>(`/api/v1/company/${companyId}`);
  },

  /**
   * Update company by ID (deprecated - use updateMyCompany instead)
   * @deprecated Use updateMyCompany() instead for current user's company
   */
  async updateCompany(companyId: string, data: CompanyUpdateRequest): Promise<Company> {
    return apiClient.patch<Company>(`/api/v1/company/${companyId}`, data);
  },
};
