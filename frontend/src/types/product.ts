/**
 * Product and category types
 */

export type ProductType = 'goods' | 'service' | 'combo';
export type ProductStatus = 'active' | 'inactive';
export type CategoryStatus = 'active' | 'inactive';

export interface ProductCategory {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  parentId?: string;
  status: CategoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  companyId: string;
  categoryId?: string;
  name: string;
  description?: string;
  type: ProductType;
  sku?: string;
  hsnSac?: string;
  unit: string;
  salePrice: number;
  purchasePrice?: number;
  gstPercent: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCreateInput {
  categoryId?: string;
  name: string;
  description?: string;
  type: ProductType;
  sku?: string;
  hsnSac?: string;
  unit: string;
  salePrice: number;
  purchasePrice?: number | '';
  gstPercent: number;
  status: ProductStatus;
}

export interface ProductUpdateInput {
  categoryId?: string;
  name?: string;
  description?: string;
  type?: ProductType;
  sku?: string;
  hsnSac?: string;
  unit?: string;
  salePrice?: number;
  purchasePrice?: number | '';
  gstPercent?: number;
  status?: ProductStatus;
}

export interface CategoryCreateInput {
  name: string;
  description?: string;
  parentId?: string;
  status: CategoryStatus;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string;
  parentId?: string;
  status?: CategoryStatus;
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  type?: ProductType | 'all';
  status?: ProductStatus | 'all';
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CategoryFilters {
  search?: string;
  status?: CategoryStatus | 'all';
  parentId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CategoryListResponse {
  categories: ProductCategory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductSearchItem {
  id: string;
  name: string;
  sku?: string;
  hsnSac?: string;
  unit: string;
  salePrice: number;
  purchasePrice?: number;
  gstPercent: number;
  type: ProductType;
}

export interface ProductSearchResponse {
  results: ProductSearchItem[];
  total: number;
}
