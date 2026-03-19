/**
 * Optimized dashboard service to reduce API calls
 * Combines multiple API calls into single dashboard endpoint
 */

import { apiClient } from '@/api/client';
import { salesService } from '@/services/salesService';

export interface DashboardData {
  total_invoices: number;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  outstanding_receivables: number;
  outstanding_payables: number;
  cash_position: number;
  gst_compliance_rate: number;
  recentTransactions: Array<{
    id: string;
    type: 'purchase' | 'sale';
    ref: string;
    party: string;
    date: string;
    amount: number;
    gst: number;
    status: string;
    gstStatus?: string;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    message: string;
    created_at: string;
    is_read: boolean;
  }>;
  lastUpdated: string;
}

/**
 * Fetch complete dashboard data in single API call
 * Reduces 6 parallel requests to 1 cached request
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  // Fix: Use correct KPIs endpoint
  return apiClient.get<DashboardData>('/api/v1/kpis/home');
}

/**
 * Fallback method for when dashboard endpoint is not available
 * Combines multiple API calls with proper error handling
 */
export async function fetchDashboardDataLegacy(): Promise<DashboardData> {
  const [
    homeKPIs,
    alerts,
    aging,
    purchases,
    salesData,
    gstSummaries
  ] = await Promise.allSettled([
    import('./api').then(m => m.fetchHomeKPIs()),
    import('./api').then(m => m.fetchAlerts()),
    import('./api').then(m => m.fetchAgingBuckets()),
    import('./api').then(m => m.fetchPurchases()),
    Promise.resolve(salesService.listInvoices()),
    import('./api').then(m => m.fetchGSTSummaries())
  ]);

  // Extract successful results
  const kpis = homeKPIs.status === 'fulfilled' ? homeKPIs.value : null;
  const alertsData = alerts.status === 'fulfilled' ? alerts.value : [];
  const agingData = aging.status === 'fulfilled' ? aging.value : null;
  const purchasesData = purchases.status === 'fulfilled' ? purchases.value : [];
  const salesDataResult = salesData.status === 'fulfilled' ? salesData.value : [];
  const gstData = gstSummaries.status === 'fulfilled' ? gstSummaries.value : [];

  // Combine recent transactions
  const recentTransactions = [
    ...(purchasesData || []).map(p => ({
      id: p.id,
      type: 'purchase' as const,
      ref: p.invoiceNo,
      party: p.vendor,
      date: p.invoiceDate,
      amount: p.totalAmount,
      gst: p.totalTax,
      status: p.status,
      gstStatus: p.gstStatus,
    })),
    ...(salesDataResult || []).map(s => ({
      id: s.id,
      type: 'sale' as const,
      ref: s.invoice_number,
      party: `Customer ${s.customer_id}`,
      date: s.invoice_date,
      amount: s.total_amount,
      gst: 0,
      status: s.status,
      gstStatus: s.gst_status,
    }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);

  // Calculate GST summary
  const latestGST = gstData?.[gstData.length - 1];
  const netGSTPayable = latestGST ? latestGST.totalOutput - latestGST.totalInput : 0;

  return {
    total_invoices: Number(kpis?.total_invoices || 0),
    total_revenue: Number(kpis?.total_revenue || 0),
    total_expenses: Number(kpis?.total_expenses || 0),
    net_profit: Number(kpis?.net_profit || 0),
    outstanding_receivables: Number(kpis?.outstanding_receivables || 0),
    outstanding_payables: Number(kpis?.outstanding_payables || 0),
    cash_position: Number(kpis?.cash_position || 0),
    gst_compliance_rate: Number(kpis?.gst_compliance_rate || 0),
    recentTransactions,
    alerts: (alertsData || []).map(alert => ({
      id: alert.id || '',
      severity: alert.severity || 'info',
      title: alert.title || '',
      message: alert.description || alert.title || '',
      created_at: alert.createdAt || new Date().toISOString(),
      is_read: false, // Default to false since Alert interface doesn't have read property
    })),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Determine which method to use based on availability
 */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    // Try the optimized single endpoint first
    return await fetchDashboardData();
  } catch (error) {
    console.warn('Dashboard endpoint not available, using legacy method:', error);
    // Fall back to legacy method
    return await fetchDashboardDataLegacy();
  }
}
