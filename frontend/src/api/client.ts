import { toast } from '@/hooks/use-toast';
import { getCurrentAccessToken } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Remove /api prefix if it exists to prevent double prefix
const BASE_URL = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL;

export interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getCurrentAccessToken();
    console.log('=== API CLIENT TOKEN ===');
    console.log('Token available:', !!token);
    console.log('Token preview:', token ? `${token.substring(0, 20)}...` : 'none');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    // Don't handle 401 redirects here - let React Router handle navigation
    // This prevents infinite loops and allows proper error handling

    console.log('=== HANDLE RESPONSE ===');
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));

      console.log('Error data:', errorData);

      let errorMessage = 'Request failed';
      
      // Handle FastAPI validation errors (422)
      if (response.status === 422 && Array.isArray(errorData.detail)) {
        console.log('=== 422 VALIDATION ERROR ===');
        console.log('Validation errors:', errorData.detail);
        
        const validationErrors = errorData.detail.map((err: any) => {
          // Extract field path from loc array (skip first element which is usually 'body')
          const field = err.loc?.slice(1).join('.') || 'unknown field';
          const message = err.msg || 'validation error';
          return `${field}: ${message}`;
        });
        
        errorMessage = validationErrors.join('; ');
        console.log('Formatted validation message:', errorMessage);
      } else if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.detail?.message) {
        errorMessage = errorData.detail.message;
      }

      const error: ApiError = {
        message: errorMessage,
        status: response.status,
        details: errorData,
      };

      console.log('Constructed error:', error);
      throw error;
    }

    if (response.status === 204) {
      return {} as T;
    }

    const result = await response.json();
    console.log('Success response:', result);
    return result;
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<T> {
    // If endpoint is already a full URL, use it directly
    const url = endpoint.startsWith('http') ? new URL(endpoint) : new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    console.log('CLIENT: before getAuthHeaders');
    const headers = await this.getAuthHeaders();
    console.log('CLIENT: after getAuthHeaders, before fetch');
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'omit', // We use Authorization header instead of cookies
    });
    console.log('CLIENT: after fetch');

    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    // If endpoint is already a full URL, use it directly
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    console.log('=== API CLIENT POST ===');
    console.log('Base URL:', this.baseUrl);
    console.log('Endpoint:', endpoint);
    console.log('Full URL:', fullUrl);
    console.log('Data:', data);
    
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        credentials: 'omit', // We use Authorization header instead of cookies
        body: data ? JSON.stringify(data) : undefined,
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      return this.handleResponse<T>(response);
    } catch (error) {
      console.error('Network/CORS Error:', error);
      
      // Enhanced error reporting for CORS/network issues
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const corsError: ApiError = {
          message: 'Network error - unable to connect to backend. Please check if the backend server is running and CORS is properly configured.',
          status: 0,
          details: {
            type: 'Network/CORS Error',
            url: fullUrl,
            originalError: error.message
          }
        };
        throw corsError;
      }
      
      throw error;
    }
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = await this.getAuthHeaders();
    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers,
      credentials: 'omit', // We use Authorization header instead of cookies
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = await this.getAuthHeaders();
    const response = await fetch(fullUrl, {
      method: 'PATCH',
      headers,
      credentials: 'omit', // We use Authorization header instead of cookies
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = await this.getAuthHeaders();
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers,
      credentials: 'omit', // We use Authorization header instead of cookies
    });

    return this.handleResponse<T>(response);
  }

  async uploadFile<T>(endpoint: string, file: File, additionalData?: Record<string, unknown>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, JSON.stringify(value));
      });
    }

    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const token = await getCurrentAccessToken();
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      credentials: 'omit', // We use Authorization header instead of cookies
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const token = await getCurrentAccessToken();
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      credentials: 'omit', // We use Authorization header instead of cookies
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }

  async download(endpoint: string, fallbackFilename: string): Promise<void> {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const token = await getCurrentAccessToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(fullUrl, {
      method: 'GET',
      credentials: 'omit',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));

      let errorMessage = 'Download failed';
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.detail?.message) {
        errorMessage = errorData.detail.message;
      }

      const error: ApiError = {
        message: errorMessage,
        status: response.status,
        details: errorData,
      };

      throw error;
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition');
    const filenameMatch = disposition?.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i);
    const filename = decodeURIComponent(filenameMatch?.[1] || filenameMatch?.[2] || fallbackFilename);

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }
}

export const apiClient = new ApiClient();

export function handleApiError(error: unknown, defaultMessage = 'An error occurred') {
  if (error && typeof error === 'object' && 'message' in error) {
    const apiError = error as ApiError;
    toast({
      title: 'Error',
      description: apiError.message || defaultMessage,
      variant: 'destructive',
    });
  } else {
    toast({
      title: 'Error',
      description: defaultMessage,
      variant: 'destructive',
    });
  }
}
