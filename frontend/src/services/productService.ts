import { apiClient } from '@/api/client';
import { API_ENDPOINTS } from '@/api/endpoints';
import type {
  Product,
  ProductCategory,
  ProductCreateInput,
  ProductUpdateInput,
  CategoryCreateInput,
  CategoryUpdateInput,
  ProductFilters,
  CategoryFilters,
  ProductListResponse,
  CategoryListResponse,
  ProductSearchItem,
  ProductSearchResponse,
} from '@/types/product';

// ==================== PRODUCT CATEGORY OPERATIONS ====================

// Helper function to get all categories for dropdown/select usage
export async function getAllCategoriesForSelect(): Promise<ProductCategory[]> {
  try {
    const response = await getCategories({ pageSize: 1000 });
    return response.categories;
  } catch (error) {
    console.error('Error fetching all categories for select:', error);
    return [];
  }
}

export async function getCategories(filters?: CategoryFilters): Promise<CategoryListResponse> {
  const params: Record<string, string> = {};
  
  if (filters?.search) params.search = filters.search;
  if (filters?.status && filters.status !== 'all') params.status = filters.status;
  if (filters?.parentId !== undefined) params.parent_id = filters.parentId;
  if (filters?.page) params.page = filters.page.toString();
  if (filters?.pageSize) params.page_size = filters.pageSize.toString();
  if (filters?.sortBy) params.sort_by = filters.sortBy;
  if (filters?.sortOrder) params.sort_order = filters.sortOrder;
  
  const response = await apiClient.get<any>(API_ENDPOINTS.products.categories.list, params);
  
  // Safely handle response - ensure categories is always an array
  const categoriesArray = Array.isArray(response.categories) ? response.categories : [];
  
  return {
    categories: categoriesArray.map(mapCategoryFromBackend),
    total: response.total || 0,
    page: response.page || 1,
    pageSize: response.page_size || filters?.pageSize || 50,
    totalPages: response.total_pages || 0,
  };
}

export async function getCategoryById(id: string): Promise<ProductCategory | null> {
  try {
    const response = await apiClient.get<any>(API_ENDPOINTS.products.categories.byId(id));
    return mapCategoryFromBackend(response);
  } catch (error) {
    console.error('Error fetching category:', error);
    return null;
  }
}

export async function createCategory(data: CategoryCreateInput): Promise<ProductCategory> {
  const backendData = {
    name: data.name,
    description: data.description,
    parent_id: data.parentId || null,
    status: data.status,
  };
  
  const response = await apiClient.post<any>(API_ENDPOINTS.products.categories.create, backendData);
  return mapCategoryFromBackend(response);
}

export async function updateCategory(id: string, data: CategoryUpdateInput): Promise<ProductCategory> {
  const backendData: Record<string, any> = {};
  
  if (data.name !== undefined) backendData.name = data.name;
  if (data.description !== undefined) backendData.description = data.description;
  if (data.parentId !== undefined) backendData.parent_id = data.parentId || null;
  if (data.status !== undefined) backendData.status = data.status;
  
  const response = await apiClient.patch<any>(API_ENDPOINTS.products.categories.update(id), backendData);
  return mapCategoryFromBackend(response);
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.products.categories.delete(id));
}

// ==================== PRODUCT OPERATIONS ====================

export async function getProducts(filters?: ProductFilters): Promise<ProductListResponse> {
  const params: Record<string, string> = {};
  
  if (filters?.search) params.search = filters.search;
  if (filters?.categoryId) params.category_id = filters.categoryId;
  if (filters?.type && filters.type !== 'all') params.type = filters.type;
  if (filters?.status && filters.status !== 'all') params.status = filters.status;
  if (filters?.page) params.page = filters.page.toString();
  if (filters?.pageSize) params.page_size = filters.pageSize.toString();
  if (filters?.sortBy) params.sort_by = filters.sortBy;
  if (filters?.sortOrder) params.sort_order = filters.sortOrder;
  
  const response = await apiClient.get<any>(API_ENDPOINTS.products.list, params);
  
  return {
    products: response.products.map(mapProductFromBackend),
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
    totalPages: response.total_pages,
  };
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const response = await apiClient.get<any>(API_ENDPOINTS.products.byId(id));
    return mapProductFromBackend(response);
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

export async function searchProducts(query: string, limit: number = 20): Promise<ProductSearchResponse> {
  const params = {
    q: query,
    limit: limit.toString(),
  };
  
  const response = await apiClient.get<any>(API_ENDPOINTS.products.search, params);
  
  return {
    results: response.results.map(mapSearchItemFromBackend),
    total: response.total,
  };
}

export async function createProduct(data: ProductCreateInput): Promise<Product> {
  const backendData = {
    category_id: data.categoryId || null,
    name: data.name,
    description: data.description,
    type: data.type,
    sku: data.sku || null,
    hsn_sac: data.hsnSac || null,
    unit: data.unit,
    sale_price: data.salePrice,
    purchase_price: data.purchasePrice || null,
    gst_percent: data.gstPercent,
    status: data.status,
  };
  
  const response = await apiClient.post<any>(API_ENDPOINTS.products.create, backendData);
  return mapProductFromBackend(response);
}

export async function updateProduct(id: string, data: ProductUpdateInput): Promise<Product> {
  const backendData: Record<string, any> = {};
  
  if (data.categoryId !== undefined) backendData.category_id = data.categoryId || null;
  if (data.name !== undefined) backendData.name = data.name;
  if (data.description !== undefined) backendData.description = data.description;
  if (data.type !== undefined) backendData.type = data.type;
  if (data.sku !== undefined) backendData.sku = data.sku || null;
  if (data.hsnSac !== undefined) backendData.hsn_sac = data.hsnSac || null;
  if (data.unit !== undefined) backendData.unit = data.unit;
  if (data.salePrice !== undefined) backendData.sale_price = data.salePrice;
  if (data.purchasePrice !== undefined) backendData.purchase_price = data.purchasePrice || null;
  if (data.gstPercent !== undefined) backendData.gst_percent = data.gstPercent;
  if (data.status !== undefined) backendData.status = data.status;
  
  const response = await apiClient.patch<any>(API_ENDPOINTS.products.update(id), backendData);
  return mapProductFromBackend(response);
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.products.delete(id));
}

// ==================== HELPER FUNCTIONS ====================

// Data normalization helper for safe category operations
export function normalizeCategory(category: ProductCategory): ProductCategory & {
  id: string;
  name: string;
} {
  return {
    ...category,
    id: category.id || '',
    name: category.name || 'Unnamed Category',
  };
}

// Helper function to normalize categories for Select components
export function normalizeCategoriesForSelect(categories: ProductCategory[] | undefined | null): Array<{
  value: string;
  label: string;
  category: ProductCategory;
}> {
  // Defensive check: ensure categories is always an array
  if (!Array.isArray(categories)) {
    console.warn('normalizeCategoriesForSelect received non-array input:', categories);
    return [];
  }
  
  return categories
    .filter(cat => cat && cat.id && cat.id.trim() !== '') // Filter out categories with empty/undefined IDs
    .map(normalizeCategory)
    .map(cat => ({
      value: cat.id,
      label: cat.name,
      category: cat,
    }));
}

// ==================== MAPPING FUNCTIONS ====================

function mapCategoryFromBackend(data: any): ProductCategory {
  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    description: data.description,
    parentId: data.parent_id,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapProductFromBackend(data: any): Product {
  return {
    id: data.id,
    companyId: data.company_id,
    categoryId: data.category_id,
    name: data.name,
    description: data.description,
    type: data.type,
    sku: data.sku,
    hsnSac: data.hsn_sac,
    unit: data.unit,
    salePrice: parseFloat(data.sale_price),
    purchasePrice: data.purchase_price ? parseFloat(data.purchase_price) : undefined,
    gstPercent: parseFloat(data.gst_percent),
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapSearchItemFromBackend(data: any): ProductSearchItem {
  return {
    id: data.id,
    name: data.name,
    sku: data.sku,
    hsnSac: data.hsn_sac,
    unit: data.unit,
    salePrice: parseFloat(data.sale_price),
    purchasePrice: data.purchase_price ? parseFloat(data.purchase_price) : undefined,
    gstPercent: parseFloat(data.gst_percent),
    type: data.type,
  };
}
