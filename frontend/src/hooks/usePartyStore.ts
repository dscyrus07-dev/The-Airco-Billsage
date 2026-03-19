import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Party } from '@/types/party';
import type { PartyFilters } from '@/schemas/partySchemas';

interface PartyStore {
  parties: Party[];
  selectedParties: string[];
  filters: PartyFilters;
  isLoading: boolean;
}

type PartyAction =
  | { type: 'SET_PARTIES'; payload: Party[] }
  | { type: 'ADD_PARTY'; payload: Party }
  | { type: 'UPDATE_PARTY'; payload: { id: string; updates: Partial<Party> } }
  | { type: 'REMOVE_PARTY'; payload: string }
  | { type: 'SET_SELECTED_PARTIES'; payload: string[] }
  | { type: 'TOGGLE_PARTY_SELECTION'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_FILTERS'; payload: Partial<PartyFilters> }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_PARTY_NOTE'; payload: { partyId: string; note: string; type: string } }
  | { type: 'UPDATE_PARTY_STATUS'; payload: { partyId: string; status: 'active' | 'inactive' | 'blocked' } };

const defaultFilters: PartyFilters = {
  search: '',
  status: 'all',
  partyType: 'all',
  state: 'all',
  msme: 'all',
};

const initialState: PartyStore = {
  parties: [],
  selectedParties: [],
  filters: defaultFilters,
  isLoading: false,
};

function partyReducer(state: PartyStore, action: PartyAction): PartyStore {
  switch (action.type) {
    case 'SET_PARTIES':
      return { ...state, parties: action.payload };
    
    case 'ADD_PARTY':
      return { ...state, parties: [...state.parties, action.payload] };
    
    case 'UPDATE_PARTY':
      return {
        ...state,
        parties: state.parties.map((party) =>
          party.id === action.payload.id
            ? { ...party, ...action.payload.updates }
            : party
        ),
      };
    
    case 'REMOVE_PARTY':
      return {
        ...state,
        parties: state.parties.filter((party) => party.id !== action.payload),
        selectedParties: state.selectedParties.filter((id) => id !== action.payload),
      };
    
    case 'SET_SELECTED_PARTIES':
      return { ...state, selectedParties: action.payload };
    
    case 'TOGGLE_PARTY_SELECTION':
      const isSelected = state.selectedParties.includes(action.payload);
      return {
        ...state,
        selectedParties: isSelected
          ? state.selectedParties.filter((id) => id !== action.payload)
          : [...state.selectedParties, action.payload],
      };
    
    case 'CLEAR_SELECTION':
      return { ...state, selectedParties: [] };
    
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    
    case 'RESET_FILTERS':
      return { ...state, filters: defaultFilters };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'ADD_PARTY_NOTE':
      return {
        ...state,
        parties: state.parties.map((party) =>
          party.id === action.payload.partyId
            ? { ...party, notes: party.notes ? `${party.notes}\n\n${action.payload.note}` : action.payload.note }
            : party
        ),
      };
    
    case 'UPDATE_PARTY_STATUS':
      return {
        ...state,
        parties: state.parties.map((party) =>
          party.id === action.payload.partyId
            ? { ...party, status: action.payload.status }
            : party
        ),
      };
    
    default:
      return state;
  }
}

interface PartyContextType extends PartyStore {
  // Actions
  setParties: (parties: Party[]) => void;
  addParty: (party: Party) => void;
  updateParty: (id: string, updates: Partial<Party>) => void;
  removeParty: (id: string) => void;
  setSelectedParties: (partyIds: string[]) => void;
  togglePartySelection: (partyId: string) => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<PartyFilters>) => void;
  resetFilters: () => void;
  setLoading: (loading: boolean) => void;
  
  // Profile-specific actions
  addPartyNote: (partyId: string, note: string, type: string) => void;
  updatePartyStatus: (partyId: string, status: 'active' | 'inactive' | 'blocked') => void;
  getPartyMetrics: (partyId: string) => PartyMetrics;
  
  // Getters
  getPartyById: (id: string) => Party | undefined;
  getSelectedParties: () => Party[];
  getFilteredParties: () => Party[];
  getPartyCount: () => number;
  getActivePartyCount: () => number;
  getSupplierCount: () => number;
  getCustomerCount: () => number;
  getBothCount: () => number;
}

interface PartyMetrics {
  totalSpend?: number;
  totalRevenue?: number;
  invoiceCount?: number;
  overdueAmount?: number;
  onTimePaymentRate?: number;
  complianceFlags?: number;
  creditUtilization?: number;
  openPayables?: number;
  openReceivables?: number;
}

const PartyContext = createContext<PartyContextType | undefined>(undefined);

export function PartyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(partyReducer, initialState);

  // Actions
  const setParties = useCallback((parties: Party[]) => {
    dispatch({ type: 'SET_PARTIES', payload: parties });
  }, []);

  const addParty = useCallback((party: Party) => {
    dispatch({ type: 'ADD_PARTY', payload: party });
  }, []);

  const updateParty = useCallback((id: string, updates: Partial<Party>) => {
    dispatch({ type: 'UPDATE_PARTY', payload: { id, updates } });
  }, []);

  const removeParty = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_PARTY', payload: id });
  }, []);

  const setSelectedParties = useCallback((partyIds: string[]) => {
    dispatch({ type: 'SET_SELECTED_PARTIES', payload: partyIds });
  }, []);

  const togglePartySelection = useCallback((partyId: string) => {
    dispatch({ type: 'TOGGLE_PARTY_SELECTION', payload: partyId });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const setFilters = useCallback((filters: Partial<PartyFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET_FILTERS' });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  // Profile-specific actions
  const addPartyNote = useCallback((partyId: string, note: string, type: string) => {
    dispatch({ type: 'ADD_PARTY_NOTE', payload: { partyId, note, type } });
  }, []);

  const updatePartyStatus = useCallback((partyId: string, status: 'active' | 'inactive' | 'blocked') => {
    dispatch({ type: 'UPDATE_PARTY_STATUS', payload: { partyId, status } });
  }, []);

  const getPartyMetrics = useCallback((partyId: string): PartyMetrics => {
    // Return empty metrics - real metrics should be calculated from actual invoice data
    // This function should be replaced with API calls to get real party metrics
    return {
      totalSpend: 0,
      totalRevenue: 0,
      invoiceCount: 0,
      overdueAmount: 0,
      onTimePaymentRate: 0,
      complianceFlags: 0,
      creditUtilization: 0,
      openPayables: 0,
      openReceivables: 0,
    };
  }, []);

  // Getters
  const getPartyById = useCallback((id: string) => {
    return state.parties.find((party) => party.id === id);
  }, [state.parties]);

  const getSelectedParties = useCallback(() => {
    return state.parties.filter((party) =>
      state.selectedParties.includes(party.id)
    );
  }, [state.parties, state.selectedParties]);

  const getFilteredParties = useCallback(() => {
    let filtered = [...state.parties];

    // Search filter
    if (state.filters.search) {
      const searchLower = state.filters.search.toLowerCase();
      filtered = filtered.filter((party) =>
        party.legalName.toLowerCase().includes(searchLower) ||
        party.tradeName?.toLowerCase().includes(searchLower) ||
        party.gstin?.toLowerCase().includes(searchLower) ||
        party.phone.includes(state.filters.search!) ||
        party.email.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (state.filters.status !== 'all') {
      filtered = filtered.filter((party) => party.status === state.filters.status);
    }

    // Party type filter
    if (state.filters.partyType !== 'all') {
      filtered = filtered.filter((party) => party.partyType === state.filters.partyType);
    }

    // State filter
    if (state.filters.state !== 'all') {
      filtered = filtered.filter((party) => party.state === state.filters.state);
    }

    // MSME filter
    if (state.filters.msme !== 'all' && state.filters.msme !== undefined) {
      if (state.filters.msme === 'true') {
        filtered = filtered.filter((party) => party.msme === true);
      } else if (state.filters.msme === 'false') {
        filtered = filtered.filter((party) => party.msme === false);
      }
    }

    return filtered;
  }, [state.parties, state.filters]);

  const getPartyCount = useCallback(() => {
    return state.parties.length;
  }, [state.parties]);

  const getActivePartyCount = useCallback(() => {
    return state.parties.filter((party) => party.status === 'active').length;
  }, [state.parties]);

  const getSupplierCount = useCallback(() => {
    return state.parties.filter((party) => party.partyType === 'supplier').length;
  }, [state.parties]);

  const getCustomerCount = useCallback(() => {
    return state.parties.filter((party) => party.partyType === 'customer').length;
  }, [state.parties]);

  const getBothCount = useCallback(() => {
    return state.parties.filter((party) => party.partyType === 'both').length;
  }, [state.parties]);

  const contextValue: PartyContextType = {
    ...state,
    // Actions
    setParties,
    addParty,
    updateParty,
    removeParty,
    setSelectedParties,
    togglePartySelection,
    clearSelection,
    setFilters,
    resetFilters,
    setLoading,
    // Profile-specific actions
    addPartyNote,
    updatePartyStatus,
    getPartyMetrics,
    // Getters
    getPartyById,
    getSelectedParties,
    getFilteredParties,
    getPartyCount,
    getActivePartyCount,
    getSupplierCount,
    getCustomerCount,
    getBothCount,
  };

  return React.createElement(
    PartyContext.Provider,
    { value: contextValue },
    children
  );
}

export function usePartyStore() {
  const context = useContext(PartyContext);
  if (context === undefined) {
    throw new Error('usePartyStore must be used within a PartyProvider');
  }
  return context;
}
