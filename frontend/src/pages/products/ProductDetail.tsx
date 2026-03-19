import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getProductById, deleteProduct, getCategoryById } from '@/services/productService';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProductById(id!),
    enabled: !!id,
  });

  const { data: category } = useQuery({
    queryKey: ['category', product?.categoryId],
    queryFn: () => getCategoryById(product!.categoryId!),
    enabled: !!product?.categoryId,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      navigate('/app/products');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete product',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = () => {
    if (product && confirm(`Are you sure you want to delete "${product.name}"?`)) {
      deleteMutation.mutate(product.id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!product) {
    return (
      <div className="text-center py-8">
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Product not found</h3>
        <Button onClick={() => navigate('/app/products')} className="mt-4">
          Back to Products
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/products')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">Product details and information</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/app/products/${product.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Product Name</div>
              <div className="text-lg font-semibold">{product.name}</div>
            </div>
            {product.description && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Description</div>
                <div className="text-sm">{product.description}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Type</div>
                <Badge variant={product.type === 'product' ? 'default' : 'secondary'} className="mt-1">
                  {product.type}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Status</div>
                <Badge variant={product.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                  {product.status}
                </Badge>
              </div>
            </div>
            {category && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Category</div>
                <div className="text-sm">{category.name}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {product.sku && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">SKU</div>
                  <div className="text-sm font-mono">{product.sku}</div>
                </div>
              )}
              {product.hsnSac && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">HSN/SAC</div>
                  <div className="text-sm font-mono">{product.hsnSac}</div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-muted-foreground">Unit</div>
                <div className="text-sm">{product.unit}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">GST Rate</div>
                <div className="text-sm">{product.gstPercent}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Sale Price</div>
              <div className="text-2xl font-bold">₹{product.salePrice.toFixed(2)}</div>
            </div>
            {product.purchasePrice !== undefined && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Purchase Price</div>
                <div className="text-xl font-semibold">₹{product.purchasePrice.toFixed(2)}</div>
              </div>
            )}
            {product.purchasePrice !== undefined && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Margin</div>
                <div className="text-sm">
                  ₹{(product.salePrice - product.purchasePrice).toFixed(2)} (
                  {((product.salePrice - product.purchasePrice) / product.purchasePrice * 100).toFixed(1)}%)
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Product ID</div>
              <div className="text-sm font-mono">{product.id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Created At</div>
              <div className="text-sm">{new Date(product.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
              <div className="text-sm">{new Date(product.updatedAt).toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
