import { z } from 'zod';
import type { PartyType, PartyStatus } from '@/types/party';

// PAN validation regex
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Phone validation regex (Indian mobile numbers)
const PHONE_REGEX = /^[6-9]\d{9}$/;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PIN code validation regex (Indian PIN codes)
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const partyTypeValues = ['supplier', 'customer', 'both'] as const;
const statusValues = ['active', 'inactive', 'blocked'] as const;

export const partyCreateSchema = z.object({
  partyName: z.string().min(1, 'Party name is required').max(255, 'Party name must be less than 255 characters'),
  displayName: z.string().max(255, 'Display name must be less than 255 characters').optional(),
  partyCode: z.string().max(30, 'Party code must be less than 30 characters').optional(),
  partyType: z.enum(partyTypeValues, {
    required_error: 'Party type is required',
  }),
  partyCategory: z.enum(['business', 'individual']).default('business'),
  gstin: z.string().max(20, 'GSTIN must be less than 20 characters').optional(),
  pan: z.string().max(20, 'PAN must be less than 20 characters').optional(),
  cin: z.string().max(30, 'CIN must be less than 30 characters').optional(),
  tan: z.string().max(20, 'TAN must be less than 20 characters').optional(),
  email: z.string()
    .regex(EMAIL_REGEX, 'Invalid email format')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .regex(PHONE_REGEX, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  alternatePhone: z.string()
    .regex(PHONE_REGEX, 'Invalid alternate phone number format')
    .optional()
    .or(z.literal('')),
  website: z.string()
    .url('Invalid website URL')
    .optional()
    .or(z.literal('')),
  address: z.string().max(500, 'Address must be less than 500 characters').optional(),
  state: z.string().max(50, 'State name must be less than 50 characters').optional(),
  pinCode: z.string()
    .regex(PINCODE_REGEX, 'Invalid PIN code format')
    .optional(),
  creditLimit: z.number().min(0, 'Credit limit must be non-negative').optional(),
  paymentTermsDays: z.number().min(0, 'Payment terms must be non-negative').optional(),
  openingBalance: z.number().optional(),
  openingBalanceType: z.enum(['dr', 'cr']).optional(),
  status: z.enum(statusValues).default('active'),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
});

export const partyUpdateSchema = z.object({
  partyName: z.string().min(1, 'Party name is required').max(255, 'Party name must be less than 255 characters').optional(),
  displayName: z.string().max(255, 'Display name must be less than 255 characters').optional(),
  partyCode: z.string().max(30, 'Party code must be less than 30 characters').optional(),
  partyType: z.enum(partyTypeValues).optional(),
  partyCategory: z.enum(['business', 'individual']).optional(),
  gstin: z.string().max(20, 'GSTIN must be less than 20 characters').optional(),
  pan: z.string().max(20, 'PAN must be less than 20 characters').optional(),
  cin: z.string().max(30, 'CIN must be less than 30 characters').optional(),
  tan: z.string().max(20, 'TAN must be less than 20 characters').optional(),
  email: z.string()
    .regex(EMAIL_REGEX, 'Invalid email format')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .regex(PHONE_REGEX, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  alternatePhone: z.string()
    .regex(PHONE_REGEX, 'Invalid alternate phone number format')
    .optional()
    .or(z.literal('')),
  website: z.string()
    .url('Invalid website URL')
    .optional()
    .or(z.literal('')),
  address: z.string().max(500, 'Address must be less than 500 characters').optional(),
  state: z.string().max(50, 'State name must be less than 50 characters').optional(),
  pinCode: z.string()
    .regex(PINCODE_REGEX, 'Invalid PIN code format')
    .optional(),
  creditLimit: z.number()
    .min(0, 'Credit limit must be positive')
    .max(999999999, 'Credit limit is too high')
    .optional()
    .or(z.literal('')),
  paymentTermsDays: z.number()
    .min(0, 'Payment terms must be positive')
    .max(365, 'Payment terms cannot exceed 365 days')
    .optional()
    .or(z.literal('')),
  openingBalance: z.number().optional().or(z.literal('')),
  openingBalanceType: z.enum(['dr', 'cr']).optional(),
  status: z.enum(statusValues).optional(),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
});

export const partyFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['all', ...statusValues]).default('all'),
  partyType: z.enum(['all', ...partyTypeValues]).default('all'),
  state: z.string().default('all'),
  msme: z.union([z.boolean(), z.string()]).optional(),
});

export type PartyCreateInput = z.infer<typeof partyCreateSchema>;
export type PartyUpdateInput = z.infer<typeof partyUpdateSchema>;

export interface PartyFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'blocked' | 'all';
  partyType?: 'supplier' | 'customer' | 'both' | 'all';
  state?: string;
}
