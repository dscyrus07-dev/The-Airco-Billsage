import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { authApi, SignupRequest } from '@/api/auth';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
  company_name?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (signupData: SignupRequest) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  selectCompany: (company: any) => void;
}

// Global singleton state for auth to prevent multiple instances
let globalAuthState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

let authSubscription: { unsubscribe: () => void } | null = null;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(globalAuthState);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize auth state from Supabase session
  useEffect(() => {
    let mounted = true;
    let authRequestInProgress = false;
    
    // If we already have a subscription, don't create another one
    if (authSubscription) {
      setState(globalAuthState);
      return;
    }
    
    const initializeAuth = async () => {
      // Don't try to initialize auth on public auth pages
      const publicAuthPaths = ['/auth/login', '/auth/signup', '/'];
      const isPublicAuthPath = publicAuthPaths.some(path => 
        location.pathname === path || location.pathname.startsWith(path)
      );
      
      if (isPublicAuthPath) {
        if (mounted) {
          const newState = { ...globalAuthState, isLoading: false };
          globalAuthState = newState;
          setState(newState);
        }
        return;
      }
      
      if (authRequestInProgress) {
        return; // Prevent multiple concurrent requests
      }
      
      authRequestInProgress = true;
      
      try {
        // Get current Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted && session?.user) {
          // Get user profile from our API
          const response = await authApi.me();
          
          if (response?.data?.user) {
            const user: User = {
              id: response.data.user.user_id,
              name: response.data.user.name,
              email: response.data.user.email,
              role: response.data.user.role,
              company_id: response.data.user.company_id,
              company_name: response.data.user.company_name || response.data.company?.trade_name,
            };
            
            const newState = {
              user,
              isAuthenticated: true,
              isLoading: false,
            };
            globalAuthState = newState;
            setState(newState);
          } else {
            const newState = { ...globalAuthState, isLoading: false };
            globalAuthState = newState;
            setState(newState);
          }
        } else if (mounted) {
          const newState = { ...globalAuthState, isLoading: false };
          globalAuthState = newState;
          setState(newState);
        }
      } catch (error: any) {
        // Check if this is an authentication-related error (401 = no session)
        const isAuthError = error?.status === 401;
        
        if (mounted) {
          if (isAuthError) {
            // Normal case - no active session, just set as not authenticated
            const newState = { ...globalAuthState, isLoading: false };
            globalAuthState = newState;
            setState(newState);
          } else {
            // Other error (network, server error, etc.)
            console.error('Auth initialization error:', error);
            const newState = { ...globalAuthState, isLoading: false };
            globalAuthState = newState;
            setState(newState);
          }
        }
      } finally {
        authRequestInProgress = false;
      }
    };
    
    initializeAuth();
    
    // Listen for auth changes (only create once)
    if (!authSubscription) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('=== AUTH STATE CHANGE ===');
          console.log('Event:', event);
          console.log('Session:', session);
          
          if (!mounted) return;
          
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('Processing SIGNED_IN event');
            
            // Skip navigation if already on app pages to prevent redirect loops
            const isAlreadyOnAppPage = location.pathname.startsWith('/app/');
            
            // Fire and forget to avoid blocking Supabase's internal auth flow
            (async () => {
              // Add a small delay to ensure component is ready
              await new Promise(resolve => setTimeout(resolve, 100));
              
              if (authRequestInProgress) {
                console.log('Auth request already in progress, skipping duplicate SIGNED_IN');
                return;
              }
              authRequestInProgress = true;
              
              try {
                console.log('Fetching user profile...');
                const response = await authApi.me();
                
                if (response && response.data?.user) {
                  const user: User = {
                    id: response.data.user.user_id,
                    name: response.data.user.name,
                    email: response.data.user.email,
                    role: response.data.user.role,
                    company_id: response.data.user.company_id,
                    company_name: response.data.user.company_name || response.data.company?.trade_name,
                  };
                  
                  console.log('Setting user state:', user);
                  const newState = {
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                  };
                  globalAuthState = newState;
                  setState(newState);
                  
                  // Only navigate to dashboard if not already on an app page
                  if (!isAlreadyOnAppPage) {
                    console.log('Navigating to dashboard...');
                    navigate('/app/home', { replace: true });
                  }
                } else {
                  console.log('No user in response, setting not authenticated');
                  const newState = { ...globalAuthState, isLoading: false };
                  globalAuthState = newState;
                  setState(newState);
                }
              } catch (error) {
                console.error('Error fetching user profile after auth change:', error);
                const newState = { ...globalAuthState, isLoading: false };
                globalAuthState = newState;
                setState(newState);
              } finally {
                authRequestInProgress = false;
              }
            })();
          } else if (event === 'SIGNED_OUT') {
            console.log('Processing SIGNED_OUT event');
            const newState = {
              user: null,
              isAuthenticated: false,
              isLoading: false,
            };
            globalAuthState = newState;
            setState(newState);
          }
        }
      );
      
      authSubscription = subscription;
    }
    
    return () => {
      mounted = false;
      // Don't unsubscribe here to maintain singleton behavior
    };
  }, []);
  
  const login = async (email: string, password: string) => {
    console.log('=== LOGIN START ===');
    console.log('Email:', email);
    
    try {
      console.log('LOGIN: before signInWithPassword');
      // Use Supabase Auth for login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('LOGIN: after signInWithPassword');
      
      console.log('Supabase auth response:', { data, error });
      
      if (error) {
        console.error('Supabase auth error:', error);
        throw new Error(error.message);
      }
      
      if (data.user && data.session) {
        console.log('Login successful, user:', data.user);
        console.log('Session:', data.session);
        
        toast.success('Login successful!');
        
        try {
          console.log('LOGIN: before authApi.me');
          // Fetch profile directly after explicit login
          const response = await authApi.me();
          console.log('LOGIN: after authApi.me');
          if (response && response.data?.user) {
            const user: User = {
              id: response.data.user.user_id,
              name: response.data.user.name,
              email: response.data.user.email,
              role: response.data.user.role,
              company_id: response.data.user.company_id,
              company_name: response.data.user.company_name || response.data.company?.trade_name,
            };
            
            const newState = {
              user,
              isAuthenticated: true,
              isLoading: false,
            };
            globalAuthState = newState;
            setState(newState);
          }
        } catch (profileError) {
          console.error("Failed to fetch profile during explicit login:", profileError);
        } finally {
          // Always navigate after successful login, even if profile fetch failed or timed out temporarily
          console.log('LOGIN: before navigate');
          console.log('Navigating to dashboard...');
          navigate('/app/home', { replace: true });
          console.log('LOGIN: after navigate');
        }
      } else {
        console.error('Login failed - no user or session');
        throw new Error('Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const message = error?.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const signup = async (signupData: SignupRequest) => {
    try {
      // Call backend signup API (which will create Supabase user and profile)
      const response = await authApi.signup(signupData);
      
      if (response.success) {
        toast.success('Account created successfully! Please login to continue.');
        // Redirect to login page after successful signup
        navigate('/auth/login', { replace: true });
      } else {
        throw new Error('Signup failed');
      }
    } catch (error: any) {
      const message = error?.message || 'Signup failed';
      toast.error(message);
      throw error;
    }
  };
  
  const logout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    const newState = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };
    globalAuthState = newState;
    setState(newState);
    
    toast.success('Logged out successfully');
    navigate('/auth/login', { replace: true });
  };
  
  const updateProfile = (data: Partial<User>) => {
    if (!state.user) return;
    
    const updatedUser = { ...state.user, ...data };
    const newState = { ...state, user: updatedUser };
    globalAuthState = newState;
    setState(newState);
    toast.success('Profile updated successfully');
  };
  
  const selectCompany = (company: any) => {
    // Update user with company information
    if (!state.user) return;
    
    const updatedUser = { 
      ...state.user, 
      company_id: company.id,
      company_name: company.trade_name || company.legal_name
    };
    const newState = { ...state, user: updatedUser };
    globalAuthState = newState;
    setState(newState);
    toast.success(`Company "${company.trade_name || company.legal_name}" selected successfully!`);
  };
  
  const value: AuthContextType = {
    ...state,
    login,
    signup,
    logout,
    updateProfile,
    selectCompany,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
