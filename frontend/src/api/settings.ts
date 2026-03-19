/**
 * Settings API service
 */

import { apiClient } from './client';

export interface FinancialSettings {
  fy_start_month: number;
  invoice_prefix: string;
}

export interface TaxSettings {
  enabled_gst_rates: number[];
}

export interface NotificationSettings {
  duplicate_invoice: boolean;
  gst_mismatch: boolean;
  overdue_receivable: boolean;
  overdue_payable: boolean;
  concentration_risk: boolean;
  gstr_reminders: boolean;
}

export interface AuditSettings {
  lock_after_approval: boolean;
  dual_approval: boolean;
  dual_approval_threshold: number;
}

export const settingsApi = {
  /**
   * Get financial settings
   */
  async getFinancial(): Promise<FinancialSettings> {
    return apiClient.get<FinancialSettings>('/api/v1/settings/financial');
  },

  /**
   * Update financial settings
   */
  async updateFinancial(data: FinancialSettings): Promise<FinancialSettings> {
    return apiClient.put<FinancialSettings>('/api/v1/settings/financial', data);
  },

  /**
   * Get tax settings
   */
  async getTax(): Promise<TaxSettings> {
    return apiClient.get<TaxSettings>('/api/v1/settings/tax');
  },

  /**
   * Update tax settings
   */
  async updateTax(data: TaxSettings): Promise<TaxSettings> {
    return apiClient.put<TaxSettings>('/api/v1/settings/tax', data);
  },

  /**
   * Get notification settings
   */
  async getNotifications(): Promise<NotificationSettings> {
    return apiClient.get<NotificationSettings>('/api/v1/settings/notifications');
  },

  /**
   * Update notification settings
   */
  async updateNotifications(data: NotificationSettings): Promise<NotificationSettings> {
    return apiClient.put<NotificationSettings>('/api/v1/settings/notifications', data);
  },

  /**
   * Get audit settings
   */
  async getAudit(): Promise<AuditSettings> {
    return apiClient.get<AuditSettings>('/api/v1/settings/audit');
  },

  /**
   * Update audit settings
   */
  async updateAudit(data: AuditSettings): Promise<AuditSettings> {
    return apiClient.put<AuditSettings>('/api/v1/settings/audit', data);
  },
};
