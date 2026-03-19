/**
 * Zod schemas for product and category validation
 */

import { z } from 'zod';

// Valid GST percentages
const gstPercentValues = [0, 5, 12, 18, 28] as const;

// Product Category Schemas
export const categoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(200, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  parentId: z.union([
    z.literal('none'),
    z.literal(''),
    z.string().uuid('Invalid parent category')
  ]).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(200, 'Name too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  parentId: z.union([
    z.literal('none'),
    z.literal(''),
    z.string().uuid('Invalid parent category')
  ]).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// Product Schemas
export const productCreateSchema = z.object({
  categoryId: z.union([
    z.literal(''),
    z.string().uuid('Invalid category')
  ]).optional(),
  name: z.string().min(1, 'Product name is required').max(200, 'Name too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  type: z.enum(['goods', 'service', 'combo']).default('goods'),
  sku: z.string().max(100, 'SKU too long').optional().or(z.literal('')),
  hsnSac: z.string().max(20, 'HSN/SAC too long').optional().or(z.literal('')),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit too long'),
  salePrice: z.coerce.number().min(0, 'Sale price must be >= 0'),
  purchasePrice: z.coerce.number().min(0, 'Purchase price must be >= 0').optional().or(z.literal('')),
  gstPercent: z.coerce.number().refine(
    (val) => gstPercentValues.includes(val as any),
    { message: 'GST percent must be 0, 5, 12, 18, or 28' }
  ).default(18),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const productUpdateSchema = z.object({
  categoryId: z.union([
    z.literal(''),
    z.string().uuid('Invalid category')
  ]).optional(),
  name: z.string().min(1, 'Product name is required').max(200, 'Name too long').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  type: z.enum(['goods', 'service', 'combo']).optional(),
  sku: z.string().max(100, 'SKU too long').optional().or(z.literal('')),
  hsnSac: z.string().max(20, 'HSN/SAC too long').optional().or(z.literal('')),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit too long').optional(),
  salePrice: z.coerce.number().min(0, 'Sale price must be >= 0').optional(),
  purchasePrice: z.coerce.number().min(0, 'Purchase price must be >= 0').optional().or(z.literal('')),
  gstPercent: z.coerce.number().refine(
    (val) => gstPercentValues.includes(val as any),
    { message: 'GST percent must be 0, 5, 12, 18, or 28' }
  ).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type CategoryCreateFormData = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateFormData = z.infer<typeof categoryUpdateSchema>;
export type ProductCreateFormData = z.infer<typeof productCreateSchema>;
export type ProductUpdateFormData = z.infer<typeof productUpdateSchema>;
