import { apiClient } from '@/api/client';

export interface JournalCategory {
  id: string;
  company_id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface JournalLineItem {
  id: string;
  journal_entry_id: string;
  account_code: string;
  account_name: string;
  description?: string;
  debit: number;
  credit: number;
  party_id?: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  entry_number: string;
  entry_date: string;
  reference?: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: 'draft' | 'posted' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at?: string;
  updated_by?: string;
  line_items: JournalLineItem[];
}

export interface TrialBalance {
  id: string;
  company_id: string;
  as_of_date: string;
  generated_at: string;
  generated_by: string;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  status: string;
  line_items: TrialBalanceLine[];
}

export interface TrialBalanceLine {
  id: string;
  trial_balance_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  opening_balance: number;
  debit_total: number;
  credit_total: number;
  closing_balance: number;
}

export interface BalanceSheet {
  id: string;
  company_id: string;
  as_of_date: string;
  generated_at: string;
  generated_by: string;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  is_balanced: boolean;
  status: string;
  line_items: BalanceSheetLine[];
}

export interface BalanceSheetLine {
  id: string;
  balance_sheet_id: string;
  line_type: 'asset' | 'liability' | 'equity';
  category: string;
  item_name: string;
  amount: number;
  order_index: number;
}

export interface CreateJournalEntry {
  entry_date: string;
  reference?: string;
  description: string;
  status?: 'draft' | 'posted' | 'cancelled';
  line_items: CreateJournalLineItem[];
}

export interface CreateJournalLineItem {
  account_code: string;
  account_name: string;
  description?: string;
  debit: number;
  credit: number;
  party_id?: string;
}

export interface CreateJournalCategory {
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateJournalEntry {
  entry_date?: string;
  reference?: string;
  description?: string;
  status?: 'draft' | 'posted' | 'cancelled';
  line_items?: CreateJournalLineItem[];
}

export interface GenerateTrialBalance {
  as_of_date: string;
}

export interface GenerateBalanceSheet {
  as_of_date: string;
}

class JournalService {
  // Journal Categories
  async getCategories(): Promise<JournalCategory[]> {
    const response = await apiClient.get<JournalCategory[]>('/api/v1/journal/categories');
    return response;
  }

  async createCategory(data: CreateJournalCategory): Promise<JournalCategory> {
    const response = await apiClient.post<JournalCategory>('/api/v1/journal/categories', data);
    return response;
  }

  async updateCategory(id: string, data: CreateJournalCategory): Promise<JournalCategory> {
    const response = await apiClient.put<JournalCategory>(`/api/v1/journal/categories/${id}`, data);
    return response;
  }

  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/journal/categories/${id}`);
  }

  // Journal Entries
  async getEntries(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<JournalEntry[]> {
    const queryParams: Record<string, string> = {};
    if (params?.skip !== undefined) queryParams.skip = params.skip.toString();
    if (params?.limit !== undefined) queryParams.limit = params.limit.toString();
    if (params?.status) queryParams.status = params.status;
    if (params?.date_from) queryParams.date_from = params.date_from;
    if (params?.date_to) queryParams.date_to = params.date_to;
    
    const response = await apiClient.get<JournalEntry[]>('/api/v1/journal/entries', queryParams);
    return response;
  }

  async getEntry(id: string): Promise<JournalEntry> {
    const response = await apiClient.get<JournalEntry>(`/api/v1/journal/entries/${id}`);
    return response;
  }

  async createEntry(data: CreateJournalEntry): Promise<JournalEntry> {
    const response = await apiClient.post<JournalEntry>('/api/v1/journal/entries', data);
    return response;
  }

  async updateEntry(id: string, data: UpdateJournalEntry): Promise<JournalEntry> {
    const response = await apiClient.put<JournalEntry>(`/api/v1/journal/entries/${id}`, data);
    return response;
  }

  async deleteEntry(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/journal/entries/${id}`);
  }

  async postEntry(id: string): Promise<JournalEntry> {
    const response = await apiClient.post<JournalEntry>(`/api/v1/journal/entries/${id}/post`);
    return response;
  }

  // Trial Balance
  async getTrialBalances(params?: {
    skip?: number;
    limit?: number;
    date_from?: string;
    date_to?: string;
  }): Promise<TrialBalance[]> {
    const queryParams: Record<string, string> = {};
    if (params?.skip !== undefined) queryParams.skip = params.skip.toString();
    if (params?.limit !== undefined) queryParams.limit = params.limit.toString();
    if (params?.date_from) queryParams.date_from = params.date_from;
    if (params?.date_to) queryParams.date_to = params.date_to;
    
    const response = await apiClient.get<TrialBalance[]>('/api/v1/journal/trial-balance', queryParams);
    return response;
  }

  async getTrialBalance(id: string): Promise<TrialBalance> {
    const response = await apiClient.get<TrialBalance>(`/api/v1/journal/trial-balance/${id}`);
    return response;
  }

  async generateTrialBalance(data: GenerateTrialBalance): Promise<TrialBalance> {
    const response = await apiClient.post<TrialBalance>('/api/v1/journal/trial-balance/generate', data);
    return response;
  }

  async exportTrialBalance(id: string, format: 'csv' | 'pdf' = 'csv'): Promise<Blob> {
    const queryParams: Record<string, string> = { format };
    const response = await apiClient.get<Blob>(`/api/v1/journal/trial-balance/${id}/export`, queryParams);
    return response;
  }

  // Balance Sheet
  async getBalanceSheets(params?: {
    skip?: number;
    limit?: number;
    date_from?: string;
    date_to?: string;
  }): Promise<BalanceSheet[]> {
    const queryParams: Record<string, string> = {};
    if (params?.skip !== undefined) queryParams.skip = params.skip.toString();
    if (params?.limit !== undefined) queryParams.limit = params.limit.toString();
    if (params?.date_from) queryParams.date_from = params.date_from;
    if (params?.date_to) queryParams.date_to = params.date_to;
    
    const response = await apiClient.get<BalanceSheet[]>('/api/v1/journal/balance-sheet', queryParams);
    return response;
  }

  async getBalanceSheet(id: string): Promise<BalanceSheet> {
    const response = await apiClient.get<BalanceSheet>(`/api/v1/journal/balance-sheet/${id}`);
    return response;
  }

  async generateBalanceSheet(data: GenerateBalanceSheet): Promise<BalanceSheet> {
    const response = await apiClient.post<BalanceSheet>('/api/v1/journal/balance-sheet/generate', data);
    return response;
  }

  async exportBalanceSheet(id: string, format: 'csv' | 'pdf' = 'csv'): Promise<Blob> {
    const queryParams: Record<string, string> = { format };
    const response = await apiClient.get<Blob>(`/api/v1/journal/balance-sheet/${id}/export`, queryParams);
    return response;
  }

  // Utility methods
  validateJournalEntry(entry: CreateJournalEntry): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!entry.description || entry.description.trim() === '') {
      errors.push('Description is required');
    }

    if (!entry.line_items || entry.line_items.length === 0) {
      errors.push('At least one line item is required');
    }

    if (entry.line_items) {
      let totalDebit = 0;
      let totalCredit = 0;

      for (const item of entry.line_items) {
        if (!item.account_code || item.account_code.trim() === '') {
          errors.push(`Account code is required for line item`);
        }

        if (!item.account_name || item.account_name.trim() === '') {
          errors.push(`Account name is required for line item`);
        }

        if (item.debit < 0 || item.credit < 0) {
          errors.push(`Debit and credit must be non-negative`);
        }

        if (item.debit > 0 && item.credit > 0) {
          errors.push(`Cannot have both debit and credit on same line item`);
        }

        totalDebit += item.debit;
        totalCredit += item.credit;
      }

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        errors.push(`Total debit (${totalDebit}) must equal total credit (${totalCredit})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

export const journalService = new JournalService();
