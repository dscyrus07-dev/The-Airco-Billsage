import * as z from 'zod';
import type { Vendor } from '@/types/vendor';

// PAN validation regex
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Phone validation (India)
const PHONE_REGEX = /^[6-9]\d{9}$/;

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const vendorCreateSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  tradeName: z.string().optional(),
  vendorType: z.enum(['supplier', 'service', 'both'], {
    required_error: 'Vendor type is required',
  }),
  gstin: z.string().optional(),
  pan: z.string().optional().refine((val) => {
    if (!val) return true; // Optional
    return PAN_REGEX.test(val);
  }, {
    message: 'Invalid PAN format',
  }),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode format'),
  country: z.string().default('India'),
  contactPersonName: z.string().min(1, 'Contact person is required'),
  email: z.string().regex(EMAIL_REGEX, 'Invalid email format'),
  phone: z.string().regex(PHONE_REGEX, 'Invalid phone format'),
  paymentTerms: z.enum(['NET 7', 'NET 15', 'NET 30', 'NET 45', 'custom'], {
    required_error: 'Payment terms are required',
  }),
  customPaymentTerms: z.string().optional(),
  defaultGSTCategory: z.enum(['registered', 'unregistered', 'composition', 'import'], {
    required_error: 'GST category is required',
  }),
  msme: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const vendorUpdateSchema = vendorCreateSchema.partial().extend({
  id: z.string().min(1, 'Vendor ID is required'),
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
});

export const vendorFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'blocked', 'all']).default('all'),
  vendorType: z.enum(['supplier', 'service', 'both', 'all']).default('all'),
  gstCategory: z.enum(['registered', 'unregistered', 'composition', 'import', 'all']).default('all'),
  state: z.string().default('all'),
});

export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;
export type VendorUpdateInput = z.infer<typeof vendorUpdateSchema>;
export type VendorFilters = z.infer<typeof vendorFiltersSchema>;
