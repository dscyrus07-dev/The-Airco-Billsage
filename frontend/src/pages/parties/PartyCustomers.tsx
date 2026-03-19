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
  Plus, Search, Eye, Edit, MoreVertical, Users, DollarSign, TrendingUp,
  Building2, AlertTriangle, CheckCircle, Clock, Download, CreditCard,
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

export default function PartyCustomers() {
  const navigate = useNavigate();
  const {
    selectedParties,
    filters,
    setSelectedParties,
    togglePartySelection,
    clearSelection,
    setFilters,
    getCustomerCount,
  } = usePartyStore();

  const { data: parties = [], isLoading, refetch } = useQuery({
    queryKey: ['parties', { ...filters, partyType: 'customer' }],
    queryFn: () => getParties({ ...filters, partyType: 'customer' }),
  });

  // Filter only customers and normalize data
  const customers = parties.filter(party => party.partyType === 'customer').map(normalizeParty);

  const handleViewParty = (partyId: string) => {
    navigate(`/app/parties/${partyId}`);
  };

  const handleEditParty = (partyId: string) => {
    navigate(`/app/parties/${partyId}/edit`);
  };

  const handleAddCustomer = () => {
    navigate('/app/parties/new?partyType=customer');
  };

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive' | 'blocked') => {
    try {
      await Promise.all(
        selectedParties.map(partyId => updatePartyStatus(partyId, status))
      );
      toast.success(`Updated ${selectedParties.length} customers to ${status}`);
      clearSelection();
      refetch();
    } catch (error) {
      toast.error('Failed to update customer status');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedParties(customers.map(p => p.id));
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

  const getTagBadge = (tag: string) => {
    const tagColors = {
      'MSME': 'bg-blue-100 text-blue-800',
      'High Risk': 'bg-orange-100 text-orange-800',
      'Preferred': 'bg-green-100 text-green-800',
      'New': 'bg-purple-100 text-purple-800',
      'Key Customer': 'bg-emerald-100 text-emerald-800',
      'Large Volume': 'bg-indigo-100 text-indigo-800',
      'Regular Orders': 'bg-gray-100 text-gray-800',
      'Supermarket Chain': 'bg-orange-100 text-orange-800',
      'Retail Chain': 'bg-pink-100 text-pink-800',
      'Export Customer': 'bg-teal-100 text-teal-800',
      'Large Corporate': 'bg-blue-100 text-blue-800',
      'Credit Customer': 'bg-red-100 text-red-800',
    } as const;

    const colorClass = tagColors[tag as keyof typeof tagColors] || 'bg-gray-100 text-gray-800';
    
    return (
      <Badge className={colorClass} variant="secondary">
        {tag}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const filteredCustomers = customers.filter((party) => {
    const matchesSearch = !filters.search || 
      party.legalName.toLowerCase().includes(filters.search.toLowerCase()) ||
      party.tradeName.toLowerCase().includes(filters.search.toLowerCase()) ||
      party.gstin.toLowerCase().includes(filters.search.toLowerCase()) ||
      party.phone.includes(filters.search!) ||
      party.email.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesStatus = !filters.status || filters.status === 'all' || party.status === filters.status;
    const matchesState = !filters.state || filters.state === 'all' || party.state === filters.state;
    const matchesMsme = !filters.msme || filters.msme === 'all' || 
      (filters.msme === 'true' ? party.msme : filters.msme === 'false' ? !party.msme : false);
    
    return matchesSearch && matchesStatus && matchesState && matchesMsme;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Customers" description="Manage your customer relationships and sales transactions" />
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
        title="Customers" 
        description="Manage your customer relationships and sales transactions"
        actions={
          <Button onClick={handleAddCustomer} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold">{customers.length}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Customers</p>
              <p className="text-2xl font-bold text-green-600">
                {customers.filter(c => c.status === 'active').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Key Customers</p>
              <p className="text-2xl font-bold text-emerald-600">
                {customers.filter(c => c.tags.includes('Key Customer')).length}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-emerald-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Credit Customers</p>
              <p className="text-2xl font-bold text-purple-600">
                {customers.filter(c => c.creditLimit && c.creditLimit > 0).length}
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-purple-500" />
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
                placeholder="Search customers..."
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

          <Select
            value={filters.msme === 'all' ? 'all' : filters.msme ? 'true' : 'false'}
            onValueChange={(value) => setFilters({ msme: value === 'all' ? 'all' : value === 'true' })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="MSME" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">MSME</SelectItem>
              <SelectItem value="false">Non-MSME</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters({ search: '', status: 'all', state: 'all', msme: 'all' });
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
                {selectedParties.length} customers selected
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

      {/* Customers Table */}
      <Card className="p-6">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No customers found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first customer.
            </p>
            <Button onClick={handleAddCustomer} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Customer
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedParties.length === filteredCustomers.length && filteredCustomers.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow 
                  key={customer.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewParty(customer.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedParties.includes(customer.id)}
                      onCheckedChange={() => togglePartySelection(customer.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{customer.legalName}</div>
                      {customer.tradeName && (
                        <div className="text-sm text-muted-foreground">{customer.tradeName}</div>
                      )}
                      {customer.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {customer.tags.slice(0, 2).map((tag) => (
                            <span key={tag}>{getTagBadge(tag)}</span>
                          ))}
                          {customer.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{customer.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {customer.gstin || (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{customer.state}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {customer.paymentTermsSales || 'Not set'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {customer.creditLimit ? formatCurrency(customer.creditLimit) : 'Not set'}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(customer.status)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewParty(customer.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditParty(customer.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/app/sales/invoice?party=${customer.id}`)}
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          Add Sale
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
