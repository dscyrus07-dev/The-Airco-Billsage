/**
 * Authentication API service
 */

import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  company: {
    company_code?: string;
    legal_name: string;
    trade_name?: string;
    display_name?: string;
    primary_email: string;
    primary_phone?: string;
  };
  company_details?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    pan?: string;
    gstin?: string;
    cin?: string;
    tan?: string;
    billing_email?: string;
    support_email?: string;
    website?: string;
    financial_year_start_month?: number;
    invoice_prefix?: string;
  };
  user: {
    full_name: string;
    username: string;
    email: string;
    phone?: string;
    password: string;
    role?: string;
  };
}

export interface UserSession {
  user_id: string;
  company_id: string;
  email: string;
  name: string;
  role: string;
  company_name?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      company_id: string;
      full_name: string;
      username: string;
      email: string;
      phone?: string;
      role: string;
      status: string;
      last_login_at?: string;
    };
    company: {
      id: string;
      company_code: string;
      legal_name: string;
      trade_name?: string;
      display_name?: string;
      primary_email: string;
      primary_phone?: string;
    };
    access_token: string;
    token_type: string;
  };
}

export interface SignupResponse {
  success: boolean;
  message: string;
  data: {
    company: {
      id: string;
      company_code: string;
      legal_name: string;
      trade_name?: string;
      display_name?: string;
      primary_email: string;
      primary_phone?: string;
      status: string;
      created_at: string;
    };
    user: {
      id: string;
      company_id: string;
      full_name: string;
      username: string;
      email: string;
      phone?: string;
      role: string;
      status: string;
      is_email_verified: boolean;
      created_at: string;
    };
  };
}

export interface MeResponse {
  success: boolean;
  data: {
    user: UserSession;
    company: {
      id: string;
      company_code: string;
      legal_name: string;
      trade_name?: string;
      display_name?: string;
      primary_email: string;
      primary_phone?: string;
      status: string;
    };
  };
}

export interface LogoutResponse {
  ok: boolean;
}

export const authApi = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/api/auth/login', { email, password });
  },

  /**
   * Signup new company and first user
   */
  async signup(signupData: SignupRequest): Promise<SignupResponse> {
    return apiClient.post<SignupResponse>('/api/auth/signup', signupData);
  },

  /**
   * Logout and clear session
   */
  async logout(): Promise<LogoutResponse> {
    return apiClient.post<LogoutResponse>('/api/auth/logout');
  },

  /**
   * Get current user session
   */
  async me(): Promise<MeResponse> {
    return apiClient.get<MeResponse>('/api/auth/me');
  },
};
