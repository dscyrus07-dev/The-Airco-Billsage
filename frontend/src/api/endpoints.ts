const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Health check
  health: `${API_BASE_URL}/health`,

  // Authentication
  auth: {
    login: `${API_BASE_URL}/api/auth/login`,
    signup: `${API_BASE_URL}/api/auth/signup`,
    logout: `${API_BASE_URL}/api/auth/logout`,
    me: `${API_BASE_URL}/api/auth/me`,
    refresh: `${API_BASE_URL}/api/auth/refresh`,
  },

  // Purchases
  purchases: {
    list: `${API_BASE_URL}/api/v1/purchases`,
    create: `${API_BASE_URL}/api/v1/purchases`,
    byId: (id: string) => `${API_BASE_URL}/api/v1/purchases/${id}`,
    update: (id: string) => `${API_BASE_URL}/api/v1/purchases/${id}`,
    delete: (id: string) => `${API_BASE_URL}/api/v1/purchases/${id}`,
    upload: `${API_BASE_URL}/api/v1/purchases/upload`,
    approve: (id: string) => `${API_BASE_URL}/api/v1/purchases/${id}/approve`,
    reject: (id: string) => `${API_BASE_URL}/api/v1/purchases/${id}/reject`,
    kpis: `${API_BASE_URL}/api/v1/purchases/kpis`,
    analytics: `${API_BASE_URL}/api/v1/purchases/analytics`,
  },

  // Sales
  sales: {
    list: `${API_BASE_URL}/api/v1/sales`,
    create: `${API_BASE_URL}/api/v1/sales`,
    byId: (id: string) => `${API_BASE_URL}/api/v1/sales/${id}`,
    update: (id: string) => `${API_BASE_URL}/api/v1/sales/${id}`,
    delete: (id: string) => `${API_BASE_URL}/api/v1/sales/${id}`,
    generate: `${API_BASE_URL}/api/v1/sales/generate`,
    kpis: `${API_BASE_URL}/api/v1/sales/kpis`,
    analytics: `${API_BASE_URL}/api/v1/sales/analytics`,
  },

  // Vendors (mapped to unified parties API)
  vendors: {
    list: `${API_BASE_URL}/api/v1/parties?party_type=supplier`,
    create: `${API_BASE_URL}/api/v1/parties`,
    byId: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}`,
    update: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}`,
    delete: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}`,
    summary: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}/summary`,
    invoices: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}/invoices`,
    analytics: `${API_BASE_URL}/api/v1/parties/analytics/summary`,
    search: `${API_BASE_URL}/api/v1/parties/search`,
    bulkStatus: `${API_BASE_URL}/api/v1/parties/bulk/status`,
  },

  // Parties (Unified Suppliers/Customers)
  parties: `${API_BASE_URL}/api/v1/parties`,
  partyById: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}`,
  partySummary: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}/summary`,
  partyInvoices: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}/invoices`,
  partyAnalytics: `${API_BASE_URL}/api/v1/parties/analytics/summary`,
  partyAnalyticsTrends: `${API_BASE_URL}/api/v1/parties/analytics/trends`,
  partyAnalyticsTopPerformers: `${API_BASE_URL}/api/v1/parties/analytics/top-performers`,
  partyAnalyticsRisk: `${API_BASE_URL}/api/v1/parties/analytics/risk-analysis`,
  partySearch: `${API_BASE_URL}/api/v1/parties/search`,
  partyBulkStatus: `${API_BASE_URL}/api/v1/parties/bulk/status`,

  // Customers (mapped to unified parties API)
  customers: {
    list: `${API_BASE_URL}/api/v1/parties?party_type=customer`,
    create: `${API_BASE_URL}/api/v1/parties`,
    byId: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}`,
    update: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}`,
    delete: (id: string) => `${API_BASE_URL}/api/v1/parties/${id}`,
    analytics: `${API_BASE_URL}/api/v1/parties/analytics/summary`,
  },

  // GST
  gst: {
    dashboard: `${API_BASE_URL}/api/v1/gst/dashboard`,
    summaries: `${API_BASE_URL}/api/v1/gst/summaries`,
    reconciliation: `${API_BASE_URL}/api/v1/gst/reconciliation`,
    reconciliationItem: (id: string) => `${API_BASE_URL}/api/v1/gst/reconciliation/${id}`,
    reports: `${API_BASE_URL}/api/v1/gst/reports`,
    kpis: `${API_BASE_URL}/api/v1/gst/kpis`,
    gstr1: `${API_BASE_URL}/api/v1/gst/gstr1`,
    gstr2: `${API_BASE_URL}/api/v1/gst/gstr2`,
    gstr3b: `${API_BASE_URL}/api/v1/gst/gstr3b`,
  },

  // Products
  products: {
    list: `${API_BASE_URL}/api/v1/products`,
    create: `${API_BASE_URL}/api/v1/products`,
    byId: (id: string) => `${API_BASE_URL}/api/v1/products/${id}`,
    update: (id: string) => `${API_BASE_URL}/api/v1/products/${id}`,
    delete: (id: string) => `${API_BASE_URL}/api/v1/products/${id}`,
    search: `${API_BASE_URL}/api/v1/products/search`,
    categories: {
      list: `${API_BASE_URL}/api/v1/products/categories`,
      create: `${API_BASE_URL}/api/v1/products/categories`,
      byId: (id: string) => `${API_BASE_URL}/api/v1/products/categories/${id}`,
      update: (id: string) => `${API_BASE_URL}/api/v1/products/categories/${id}`,
      delete: (id: string) => `${API_BASE_URL}/api/v1/products/categories/${id}`,
    },
  },

  // Payments
  payments: {
    list: `${API_BASE_URL}/api/v1/payments`,
    create: `${API_BASE_URL}/api/v1/payments`,
    byId: (id: string) => `${API_BASE_URL}/api/v1/payments/${id}`,
    update: (id: string) => `${API_BASE_URL}/api/v1/payments/${id}`,
    delete: (id: string) => `${API_BASE_URL}/api/v1/payments/${id}`,
    record: `${API_BASE_URL}/api/v1/payments/record`,
    uploadProof: `${API_BASE_URL}/api/v1/payments/upload-proof`,
  },

  // Receivables & Payables
  receivables: {
    list: `${API_BASE_URL}/api/v1/receivables`,
    aging: `${API_BASE_URL}/api/v1/receivables/aging`,
    summary: `${API_BASE_URL}/api/v1/receivables/summary`,
  },

  payables: {
    list: `${API_BASE_URL}/api/v1/receivables/payables`,
    aging: `${API_BASE_URL}/api/v1/receivables/payables/aging`,
    summary: `${API_BASE_URL}/api/v1/receivables/payables/summary`,
  },

  // Approvals
  approvals: {
    pending: `${API_BASE_URL}/api/v1/approvals/pending`,
    approve: (id: string, type: string) => `${API_BASE_URL}/api/v1/approvals/${type}/${id}/approve`,
    reject: (id: string, type: string) => `${API_BASE_URL}/api/v1/approvals/${type}/${id}/reject`,
    requestCorrection: (id: string, type: string) => `${API_BASE_URL}/api/v1/approvals/${type}/${id}/request-correction`,
  },

  // Analytics & Reports (mapped to kpis)
  analytics: {
    dashboard: `${API_BASE_URL}/api/v1/kpis/home`,
    trends: `${API_BASE_URL}/api/v1/kpis/trends`,
    categorySpend: `${API_BASE_URL}/api/v1/kpis/category-spend`,
    concentration: `${API_BASE_URL}/api/v1/kpis/concentration`,
    cashflow: `${API_BASE_URL}/api/v1/kpis/cashflow`,
  },

  // Reports - TODO: Backend endpoints not implemented yet
  // reports: {
  //   profitLoss: `${API_BASE_URL}/api/v1/reports/profit-loss`,
  //   balanceSheet: `${API_BASE_URL}/api/v1/reports/balance-sheet`,
  //   trialBalance: `${API_BASE_URL}/api/v1/reports/trial-balance`,
  //   ledger: `${API_BASE_URL}/api/v1/reports/ledger`,
  //   export: `${API_BASE_URL}/api/v1/reports/export`,
  // },

  // Alerts & Notifications - TODO: Backend endpoints not implemented yet  
  // alerts: {
  //   list: `${API_BASE_URL}/v1/alerts`,
  //   markRead: (id: string) => `${API_BASE_URL}/v1/alerts/${id}/read`,
  //   markAllRead: `${API_BASE_URL}/v1/alerts/mark-all-read`,
  //   dismiss: (id: string) => `${API_BASE_URL}/v1/alerts/${id}/dismiss`,
  // },

  // Dashboard KPIs
  kpis: {
    home: `${API_BASE_URL}/api/v1/kpis/home`,
    purchases: `${API_BASE_URL}/api/v1/kpis/purchases`,
    sales: `${API_BASE_URL}/api/v1/kpis/sales`,
    gst: `${API_BASE_URL}/api/v1/kpis/gst`,
  },

  // Search - TODO: Backend endpoint not implemented yet
  // search: {
  //   global: `${API_BASE_URL}/v1/search`,
  // },

  // Settings
  settings: {
    company: `${API_BASE_URL}/api/v1/settings/company`,
    profile: `${API_BASE_URL}/api/v1/settings/profile`,
    preferences: `${API_BASE_URL}/api/v1/settings/preferences`,
  },
};

export default API_ENDPOINTS;
