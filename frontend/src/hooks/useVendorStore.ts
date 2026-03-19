import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Vendor } from '@/types/vendor';
import type { VendorFilters } from '@/schemas/vendorSchemas';

interface VendorStore {
  vendors: Vendor[];
  selectedVendors: string[];
  filters: VendorFilters;
  isLoading: boolean;
}

type VendorAction =
  | { type: 'SET_VENDORS'; payload: Vendor[] }
  | { type: 'ADD_VENDOR'; payload: Vendor }
  | { type: 'UPDATE_VENDOR'; payload: { id: string; updates: Partial<Vendor> } }
  | { type: 'REMOVE_VENDOR'; payload: string }
  | { type: 'SET_SELECTED_VENDORS'; payload: string[] }
  | { type: 'TOGGLE_VENDOR_SELECTION'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_FILTERS'; payload: Partial<VendorFilters> }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_VENDOR_NOTE'; payload: { vendorId: string; note: string; type: string } }
  | { type: 'UPDATE_VENDOR_STATUS'; payload: { vendorId: string; status: 'active' | 'inactive' | 'blocked' } };

interface VendorMetrics {
  totalSpend: number;
  invoiceCount: number;
  overdueAmount: number;
  onTimePaymentRate: number;
  complianceFlags: number;
}

const defaultFilters: VendorFilters = {
  search: '',
  status: 'all',
  vendorType: 'all',
  gstCategory: 'all',
  state: 'all',
};

const initialState: VendorStore = {
  vendors: [],
  selectedVendors: [],
  filters: defaultFilters,
  isLoading: false,
};

function vendorReducer(state: VendorStore, action: VendorAction): VendorStore {
  switch (action.type) {
    case 'SET_VENDORS':
      return { ...state, vendors: action.payload };
    
    case 'ADD_VENDOR':
      return { ...state, vendors: [...state.vendors, action.payload] };
    
    case 'UPDATE_VENDOR':
      return {
        ...state,
        vendors: state.vendors.map((vendor) =>
          vendor.id === action.payload.id
            ? { ...vendor, ...action.payload.updates }
            : vendor
        ),
      };
    
    case 'REMOVE_VENDOR':
      return {
        ...state,
        vendors: state.vendors.filter((vendor) => vendor.id !== action.payload),
        selectedVendors: state.selectedVendors.filter((id) => id !== action.payload),
      };
    
    case 'SET_SELECTED_VENDORS':
      return { ...state, selectedVendors: action.payload };
    
    case 'TOGGLE_VENDOR_SELECTION':
      const isSelected = state.selectedVendors.includes(action.payload);
      return {
        ...state,
        selectedVendors: isSelected
          ? state.selectedVendors.filter((id) => id !== action.payload)
          : [...state.selectedVendors, action.payload],
      };
    
    case 'CLEAR_SELECTION':
      return { ...state, selectedVendors: [] };
    
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    
    case 'RESET_FILTERS':
      return { ...state, filters: defaultFilters };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'ADD_VENDOR_NOTE':
      return {
        ...state,
        vendors: state.vendors.map((vendor) =>
          vendor.id === action.payload.vendorId
            ? { ...vendor, notes: vendor.notes ? `${vendor.notes}\n\n${action.payload.note}` : action.payload.note }
            : vendor
        ),
      };
    
    case 'UPDATE_VENDOR_STATUS':
      return {
        ...state,
        vendors: state.vendors.map((vendor) =>
          vendor.id === action.payload.vendorId
            ? { ...vendor, status: action.payload.status }
            : vendor
        ),
      };
    
    default:
      return state;
  }
}

interface VendorContextType extends VendorStore {
  // Actions
  setVendors: (vendors: Vendor[]) => void;
  addVendor: (vendor: Vendor) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  removeVendor: (id: string) => void;
  setSelectedVendors: (vendorIds: string[]) => void;
  toggleVendorSelection: (vendorId: string) => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<VendorFilters>) => void;
  resetFilters: () => void;
  setLoading: (loading: boolean) => void;
  
  // Profile-specific actions
  addVendorNote: (vendorId: string, note: string, type: string) => void;
  updateVendorStatus: (vendorId: string, status: 'active' | 'inactive' | 'blocked') => void;
  getVendorMetrics: (vendorId: string) => VendorMetrics;
  
  // Getters
  getVendorById: (id: string) => Vendor | undefined;
  getSelectedVendors: () => Vendor[];
  getFilteredVendors: () => Vendor[];
  getVendorCount: () => number;
  getActiveVendorCount: () => number;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export function VendorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(vendorReducer, initialState);

  const setVendors = useCallback((vendors: Vendor[]) => {
    dispatch({ type: 'SET_VENDORS', payload: vendors });
  }, []);

  const addVendor = useCallback((vendor: Vendor) => {
    dispatch({ type: 'ADD_VENDOR', payload: vendor });
  }, []);

  const updateVendor = useCallback((id: string, updates: Partial<Vendor>) => {
    dispatch({ type: 'UPDATE_VENDOR', payload: { id, updates } });
  }, []);

  const removeVendor = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_VENDOR', payload: id });
  }, []);

  const setSelectedVendors = useCallback((vendorIds: string[]) => {
    dispatch({ type: 'SET_SELECTED_VENDORS', payload: vendorIds });
  }, []);

  const toggleVendorSelection = useCallback((vendorId: string) => {
    dispatch({ type: 'TOGGLE_VENDOR_SELECTION', payload: vendorId });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const setFilters = useCallback((filters: Partial<VendorFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET_FILTERS' });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  // Profile-specific actions
  const addVendorNote = useCallback((vendorId: string, note: string, type: string) => {
    dispatch({ type: 'ADD_VENDOR_NOTE', payload: { vendorId, note, type } });
  }, []);

  const updateVendorStatus = useCallback((vendorId: string, status: 'active' | 'inactive' | 'blocked') => {
    dispatch({ type: 'UPDATE_VENDOR_STATUS', payload: { vendorId, status } });
  }, []);

  const getVendorMetrics = useCallback((vendorId: string): VendorMetrics => {
    // Get vendor data for basic compliance metrics
    const vendor = state.vendors.find(v => v.id === vendorId);
    
    if (!vendor) {
      return {
        totalSpend: 0,
        invoiceCount: 0,
        overdueAmount: 0,
        onTimePaymentRate: 100,
        complianceFlags: 0,
      };
    }
    
    // Calculate compliance flags based on vendor data
    const complianceFlags = (vendor.gstin ? 0 : 1) + (vendor.pan ? 0 : 1);
    
    // Return basic metrics - invoice data will come from backend API calls
    return {
      totalSpend: 0, // Will be populated from backend API
      invoiceCount: 0, // Will be populated from backend API
      overdueAmount: 0, // Will be populated from backend API
      onTimePaymentRate: 100, // Will be calculated from backend API
      complianceFlags,
    };
  }, [state.vendors]);

  const getVendorById = useCallback((id: string) => {
    return state.vendors.find((vendor) => vendor.id === id);
  }, [state.vendors]);

  const getSelectedVendors = useCallback(() => {
    return state.vendors.filter((vendor) =>
      state.selectedVendors.includes(vendor.id)
    );
  }, [state.vendors, state.selectedVendors]);

  const getFilteredVendors = useCallback(() => {
    let filtered = [...state.vendors];

    if (state.filters.search) {
      const searchLower = state.filters.search.toLowerCase();
      filtered = filtered.filter((vendor) =>
        vendor.vendorName.toLowerCase().includes(searchLower) ||
        vendor.tradeName?.toLowerCase().includes(searchLower) ||
        vendor.gstin?.toLowerCase().includes(searchLower) ||
        vendor.phone.includes(state.filters.search!) ||
        vendor.email.toLowerCase().includes(searchLower)
      );
    }

    if (state.filters.status !== 'all') {
      filtered = filtered.filter((vendor) => vendor.status === state.filters.status);
    }

    if (state.filters.vendorType !== 'all') {
      filtered = filtered.filter((vendor) => vendor.vendorType === state.filters.vendorType);
    }

    if (state.filters.gstCategory !== 'all') {
      filtered = filtered.filter((vendor) => vendor.defaultGSTCategory === state.filters.gstCategory);
    }

    if (state.filters.state !== 'all') {
      filtered = filtered.filter((vendor) => vendor.state === state.filters.state);
    }

    return filtered;
  }, [state.vendors, state.filters]);

  const getVendorCount = useCallback(() => {
    return state.vendors.length;
  }, [state.vendors]);

  const getActiveVendorCount = useCallback(() => {
    return state.vendors.filter((vendor) => vendor.status === 'active').length;
  }, [state.vendors]);

  const contextValue: VendorContextType = {
    ...state,
    // Actions
    setVendors,
    addVendor,
    updateVendor,
    removeVendor,
    setSelectedVendors,
    toggleVendorSelection,
    clearSelection,
    setFilters,
    resetFilters,
    setLoading,
    // Profile-specific actions
    addVendorNote,
    updateVendorStatus,
    getVendorMetrics,
    // Getters
    getVendorById,
    getSelectedVendors,
    getFilteredVendors,
    getVendorCount,
    getActiveVendorCount,
  };

  return React.createElement(
    VendorContext.Provider,
    { value: contextValue },
    children
  );
}

export function useVendorStore() {
  const context = useContext(VendorContext);
  if (context === undefined) {
    throw new Error('useVendorStore must be used within a VendorProvider');
  }
  return context;
}
