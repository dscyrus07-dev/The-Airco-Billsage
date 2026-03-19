/**
 * Users API service
 */

import { apiClient } from './client';

export interface User {
  id: string;
  company_id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface UserCreateRequest {
  email: string;
  name: string;
  phone?: string;
  role: string;
  password: string;
}

export interface UserUpdateRequest {
  name?: string;
  phone?: string;
  role?: string;
  is_active?: boolean;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

export const usersApi = {
  /**
   * List all users for current company
   */
  async listUsers(): Promise<UserListResponse> {
    return apiClient.get<UserListResponse>('/api/v1/users');
  },

  /**
   * Create a new user
   */
  async createUser(data: UserCreateRequest): Promise<User> {
    return apiClient.post<User>('/api/v1/users', data);
  },

  /**
   * Update a user
   */
  async updateUser(userId: string, data: UserUpdateRequest): Promise<User> {
    return apiClient.patch<User>(`/api/v1/users/${userId}`, data);
  },

  /**
   * Delete (deactivate) a user
   */
  async deleteUser(userId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/users/${userId}`);
  },
};
