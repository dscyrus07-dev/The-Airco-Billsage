import { apiClient } from "@/api/client";

export interface Company {
  id: string;
  legal_name: string;
  trade_name?: string;
  display_name?: string;
  company_code?: string;
  primary_email?: string;
  primary_phone?: string;
  logo_url?: string;
  base_currency?: string;
  timezone?: string;
  
  // Company Details
  gstin?: string;
  pan?: string;
  cin?: string;
  tan?: string;
  address_line_1?: string;
  address_line_2?: string;
  landmark?: string;
  city?: string;
  district?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  website?: string;
  billing_email?: string;
  support_email?: string;
  alternate_phone?: string;
  
  // Financial Settings
  financial_year_start_month?: number;
  invoice_prefix?: string;
  credit_note_prefix?: string;
  debit_note_prefix?: string;
  payment_prefix?: string;
  receipt_prefix?: string;
  po_prefix?: string;
  
  // Bank Details
  bank_account_name?: string;
  bank_name?: string;
  bank_branch?: string;
  bank_account_number_masked?: string;
  ifsc_code?: string;
  upi_id?: string;
  
  // Company Settings
  notification_duplicate_invoice?: boolean;
  notification_gst_mismatch?: boolean;
  notification_overdue_receivable?: boolean;
  notification_overdue_payable?: boolean;
  notification_concentration_risk?: boolean;
  notification_gstr_reminders?: boolean;
  lock_after_approval?: boolean;
  dual_approval?: boolean;
  dual_approval_threshold?: number;
  
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  email?: string;
  phone?: string;
}

class CompanyService {
  async getMyCompany(): Promise<Company> {
    try {
      const companyData = await apiClient.get("/api/v1/company/me") as Company;
      
      // Validate the response data structure
      if (!companyData.id || !companyData.legal_name) {
        throw new Error('Invalid company data structure');
      }
      
      return companyData;
    } catch (error) {
      console.error('Failed to fetch company data:', error);
      // Return a default company object to prevent undefined
      return {
        id: 'COMP00000000000',
        legal_name: 'Unknown Company',
        status: 'active',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  }

  async updateCompany(data: CompanyUpdateRequest): Promise<Company> {
    const response = await apiClient.put("/api/v1/company/me", data) as { data: Company };
    return response.data;
  }

  getCompanyAddress(company: Company): string {
    const parts = [
      company.address_line_1,
      company.address_line_2,
      company.landmark,
      company.city,
      company.district,
      company.state,
      company.postal_code,
      company.country
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(", ") : "";
  }

  getCompanyDisplayName(company: Company): string {
    return company.trade_name || company.legal_name;
  }
}

export const companyService = new CompanyService();
