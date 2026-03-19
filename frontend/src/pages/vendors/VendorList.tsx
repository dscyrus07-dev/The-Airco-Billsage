import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Search, Eye, Edit, MoreVertical, Users, Building2, AlertCircle } from 'lucide-react';
import { getVendors, updateVendorStatus } from '@/services/vendorService';
import { useVendorStore } from '@/hooks/useVendorStore';
import type { Vendor } from '@/types/vendor';

const INDIAN_STATES = [
  'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Delhi', 'Uttar Pradesh',
  'West Bengal', 'Rajasthan', 'Madhya Pradesh', 'Andhra Pradesh', 'Telangana',
  'Punjab', 'Haryana', 'Bihar', 'Odisha', 'Kerala', 'Assam', 'Jharkhand', 'Chhattisgarh',
];

export default function VendorList() {
  const navigate = useNavigate();
  const {
    selectedVendors,
    filters,
    setSelectedVendors,
    toggleVendorSelection,
    clearSelection,
    setFilters,
    getFilteredVendors,
  } = useVendorStore();

  const { data: vendors = [], isLoading, refetch } = useQuery({
    queryKey: ['vendors', filters],
    queryFn: () => getVendors(filters),
  });

  const handleViewVendor = (vendorId: string) => {
    navigate(`/app/vendors/${vendorId}`);
  };

  const handleEditVendor = (vendorId: string) => {
    navigate(`/app/vendors/${vendorId}/edit`);
  };

  const handleAddVendor = () => {
    navigate('/app/vendors/new');
  };

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive' | 'blocked') => {
    try {
      await Promise.all(
        selectedVendors.map(vendorId => updateVendorStatus(vendorId, status))
      );
      toast.success(`Updated ${selectedVendors.length} vendors to ${status}`);
      clearSelection();
      refetch();
    } catch (error) {
      toast.error('Failed to update vendor status');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVendors(vendors.map(v => v.id));
    } else {
      clearSelection();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      blocked: 'destructive',
    } as const;
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Vendors" description="Manage your vendor relationships" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="Vendors" 
        description="Manage your vendor relationships and track performance"
        actions={
          <Button onClick={handleAddVendor} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Vendor
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={filters.search || ''}
                onChange={(e) => setFilters({ search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select
            value={filters.status || 'all'}
            onValueChange={(value) => setFilters({ status: value as any })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.vendorType || 'all'}
            onValueChange={(value) => setFilters({ vendorType: value as any })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="supplier">Supplier</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.gstCategory || 'all'}
            onValueChange={(value) => setFilters({ gstCategory: value as any })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="GST Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All GST</SelectItem>
              <SelectItem value="registered">Registered</SelectItem>
              <SelectItem value="unregistered">Unregistered</SelectItem>
              <SelectItem value="composition">Composition</SelectItem>
              <SelectItem value="import">Import</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.state || 'all'}
            onValueChange={(value) => setFilters({ state: value as any })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {INDIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedVendors.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedVendors.length} vendors selected
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear selection
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusUpdate('active')}
              >
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusUpdate('inactive')}
              >
                Deactivate
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleBulkStatusUpdate('blocked')}
              >
                Block
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Vendor Table */}
      <Card className="p-6">
        {vendors.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No vendors found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first vendor.
            </p>
            <Button onClick={handleAddVendor} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Vendor
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedVendors.length === vendors.length && vendors.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Vendor Name</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Total Spend</TableHead>
                <TableHead>Overdue Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow 
                  key={vendor.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewVendor(vendor.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedVendors.includes(vendor.id)}
                      onCheckedChange={() => toggleVendorSelection(vendor.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{vendor.vendorName}</div>
                      {vendor.tradeName && (
                        <div className="text-sm text-muted-foreground">{vendor.tradeName}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {vendor.gstin || (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{vendor.state}</TableCell>
                  <TableCell>{vendor.paymentTerms}</TableCell>
                  <TableCell>{formatCurrency(0)}</TableCell> {/* TODO: Add real spend data */}
                  <TableCell className="text-destructive">
                    {formatCurrency(0)}
                  </TableCell> {/* TODO: Add real overdue data */}
                  <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewVendor(vendor.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditVendor(vendor.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/app/purchases/manual?vendor=${vendor.id}`)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Purchase
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
