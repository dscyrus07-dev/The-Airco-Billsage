import { useState } from 'react';
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
import {
  Plus, Search, Eye, Edit, MoreVertical, Users, ShoppingCart, TrendingUp,
  Building2, CheckCircle, Clock, Download,
} from 'lucide-react';
import { getParties, updatePartyStatus } from '@/services/partyService';
import { usePartyStore } from '@/hooks/usePartyStore';
import type { Party } from '@/types/party';

// Data normalization helper for safe party operations
function normalizeParty(party: Party): Party & {
  tags: string[];
  legalName: string;
  email: string;
  phone: string;
  tradeName: string;
  gstin: string;
  state: string;
} {
  return {
    ...party,
    tags: party.tags || [],
    legalName: party.legalName || '',
    email: party.email || '',
    phone: party.phone || '',
    tradeName: party.tradeName || '',
    gstin: party.gstin || '',
    state: party.state || '',
  };
}

const INDIAN_STATES = [
  'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Delhi', 'Uttar Pradesh',
  'West Bengal', 'Rajasthan', 'Madhya Pradesh', 'Andhra Pradesh', 'Telangana',
  'Punjab', 'Haryana', 'Bihar', 'Odisha', 'Kerala', 'Assam', 'Jharkhand', 'Chhattisgarh',
  'Uttarakhand', 'Himachal Pradesh', 'Goa', 'Jammu & Kashmir', 'Sikkim',
  'Nagaland', 'Manipur', 'Mizoram', 'Arunachal Pradesh', 'Tripura',
];

export default function PartySuppliers() {
  const navigate = useNavigate();
  const {
    selectedParties,
    filters,
    setSelectedParties,
    togglePartySelection,
    clearSelection,
    setFilters,
    getSupplierCount,
  } = usePartyStore();

  const { data: parties = [], isLoading, refetch } = useQuery({
    queryKey: ['parties', { ...filters, partyType: 'supplier' }],
    queryFn: () => getParties({ ...filters, partyType: 'supplier' }),
  });

  // Filter only suppliers and both-type parties, then normalize data
  const suppliers = parties.filter(party => 
    party.partyType === 'supplier' || party.partyType === 'both'
  ).map(normalizeParty);

  const handleViewParty = (partyId: string) => {
    navigate(`/app/parties/${partyId}`);
  };

  const handleEditParty = (partyId: string) => {
    navigate(`/app/parties/${partyId}/edit`);
  };

  const handleAddSupplier = () => {
    navigate('/app/parties/new?partyType=supplier');
  };

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive') => {
    try {
      await Promise.all(
        selectedParties.map(partyId => updatePartyStatus(partyId, status))
      );
      toast.success(`Updated ${selectedParties.length} suppliers to ${status}`);
      clearSelection();
      refetch();
    } catch (error) {
      toast.error('Failed to update supplier status');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedParties(suppliers.map(p => p.id));
    } else {
      clearSelection();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
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

  const filteredSuppliers = suppliers.filter((party) => {
    const matchesSearch = !filters.search || 
      party.legalName.toLowerCase().includes(filters.search.toLowerCase()) ||
      party.tradeName.toLowerCase().includes(filters.search.toLowerCase()) ||
      party.gstin.toLowerCase().includes(filters.search.toLowerCase()) ||
      party.phone.includes(filters.search!) ||
      party.email.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesStatus = !filters.status || filters.status === 'all' || party.status === filters.status;
    const matchesState = !filters.state || filters.state === 'all' || party.state === filters.state;
    
    return matchesSearch && matchesStatus && matchesState;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Suppliers" description="Manage your supplier relationships and purchase transactions" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
        title="Suppliers" 
        description="Manage your supplier relationships and purchase transactions"
        actions={
          <Button onClick={handleAddSupplier} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Supplier
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Suppliers</p>
              <p className="text-2xl font-bold">{suppliers.length}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Suppliers</p>
              <p className="text-2xl font-bold text-green-600">
                {suppliers.filter(s => s.status === 'active').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Both Suppliers & Customers</p>
              <p className="text-2xl font-bold text-blue-600">
                {suppliers.filter(s => s.partyType === 'both').length}
              </p>
            </div>
            <Building2 className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">With GST Registration</p>
              <p className="text-2xl font-bold text-purple-600">
                {suppliers.filter(s => s.gstin).length}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters({ search: '', status: 'all', state: 'all' });
            }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedParties.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedParties.length} suppliers selected
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
            </div>
          </div>
        </Card>
      )}

      {/* Suppliers Table */}
      <Card className="p-6">
        {filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No suppliers found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first supplier.
            </p>
            <Button onClick={handleAddSupplier} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Supplier
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedParties.length === filteredSuppliers.length && filteredSuppliers.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Supplier Name</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Party Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow 
                  key={supplier.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewParty(supplier.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedParties.includes(supplier.id)}
                      onCheckedChange={() => togglePartySelection(supplier.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{supplier.legalName}</div>
                      {supplier.tradeName && (
                        <div className="text-sm text-muted-foreground">{supplier.tradeName}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {supplier.gstin || (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{supplier.state || 'Not set'}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {supplier.email || supplier.phone || (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={supplier.partyType === 'both' ? 'default' : 'secondary'}>
                      {supplier.partyType === 'both' ? 'Both' : 'Supplier'}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(supplier.status)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewParty(supplier.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditParty(supplier.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/app/purchases/manual?party=${supplier.id}`)}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
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
