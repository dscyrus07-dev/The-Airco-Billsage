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
import {
  Plus, Search, Eye, Edit, MoreVertical, Users, ShoppingCart, DollarSign,
  Building2, AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
} from 'lucide-react';
import { getParties, updatePartyStatus, bulkUpdatePartyStatus } from '@/services/partyService';
import { usePartyStore } from '@/hooks/usePartyStore';
import type { Party } from '@/types/party';

const INDIAN_STATES = [
  'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Delhi', 'Uttar Pradesh',
  'West Bengal', 'Rajasthan', 'Madhya Pradesh', 'Andhra Pradesh', 'Telangana',
  'Punjab', 'Haryana', 'Bihar', 'Odisha', 'Kerala', 'Assam', 'Jharkhand', 'Chhattisgarh',
  'Uttarakhand', 'Himachal Pradesh', 'Goa', 'Jammu & Kashmir', 'Sikkim',
  'Nagaland', 'Manipur', 'Mizoram', 'Arunachal Pradesh', 'Tripura',
];

export default function PartyList() {
  const navigate = useNavigate();
  const {
    selectedParties,
    filters,
    setSelectedParties,
    togglePartySelection,
    clearSelection,
    setFilters,
  } = usePartyStore();

  const { data: parties = [], isLoading, refetch } = useQuery({
    queryKey: ['parties', filters],
    queryFn: () => getParties(filters),
  });
  
  // Calculate summary counts from real data
  const supplierCount = parties.filter(p => p.partyType === 'supplier').length;
  const customerCount = parties.filter(p => p.partyType === 'customer').length;
  const bothCount = parties.filter(p => p.partyType === 'both').length;
  
  // Apply filters for table display
  const filteredParties = parties.filter(party => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchableText = [
        party.partyName,
        party.displayName || '',
        party.gstin || '',
        party.phone || '',
        party.email || ''
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (party.status !== filters.status) {
        return false;
      }
    }

    // Party type filter
    if (filters.partyType && filters.partyType !== 'all') {
      if (party.partyType !== filters.partyType) {
        return false;
      }
    }

    return true;
  });

  const handleViewParty = (partyId: string) => {
    navigate(`/app/parties/${partyId}`);
  };

  const handleEditParty = (partyId: string) => {
    navigate(`/app/parties/${partyId}/edit`);
  };

  const handleAddParty = () => {
    navigate('/app/parties/new');
  };

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive') => {
    try {
      await bulkUpdatePartyStatus(selectedParties, status);
      toast.success(`Updated ${selectedParties.length} parties to ${status}`);
      clearSelection();
      refetch();
    } catch (error) {
      toast.error('Failed to update party status');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedParties(parties.map(p => p.id));
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

  const getPartyTypeBadge = (partyType: string) => {
    const variants = {
      supplier: 'bg-blue-100 text-blue-800',
      customer: 'bg-green-100 text-green-800',
      both: 'bg-purple-100 text-purple-800',
    } as const;
    
    return (
      <Badge className={variants[partyType as keyof typeof variants]}>
        {partyType === 'both' ? 'Both' : partyType.charAt(0).toUpperCase() + partyType.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Parties" description="Manage your supplier and customer relationships" />
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
        title="Parties" 
        description="Manage your supplier and customer relationships"
        actions={
          <Button onClick={handleAddParty} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Party
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Parties</p>
              <p className="text-2xl font-bold">{parties.length}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Suppliers</p>
              <p className="text-2xl font-bold text-blue-600">{supplierCount}</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Customers</p>
              <p className="text-2xl font-bold text-green-600">{customerCount}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Both</p>
              <p className="text-2xl font-bold text-purple-600">{bothCount}</p>
            </div>
            <Building2 className="h-8 w-8 text-purple-500" />
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
                placeholder="Search parties..."
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
            value={filters.partyType || 'all'}
            onValueChange={(value) => setFilters({ partyType: value as any })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="supplier">Supplier</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters({ search: '', status: 'all', partyType: 'all' });
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
                {selectedParties.length} parties selected
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

      {/* Party Table */}
      <Card className="p-6">
        {filteredParties.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No parties found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first party.
            </p>
            <Button onClick={handleAddParty} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Party
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedParties.length === filteredParties.length && filteredParties.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Party Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParties.map((party) => (
                <TableRow 
                  key={party.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewParty(party.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedParties.includes(party.id)}
                      onCheckedChange={() => togglePartySelection(party.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{party.partyName}</div>
                      {party.displayName && (
                        <div className="text-sm text-muted-foreground">{party.displayName}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">{party.partyCode || 'Auto-gen'}</div>
                  </TableCell>
                  <TableCell>{getPartyTypeBadge(party.partyType)}</TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {party.gstin || (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {party.partyType === 'supplier' || party.partyType === 'both' 
                        ? 'Not set'
                        : '-'
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {party.partyType === 'customer' || party.partyType === 'both' 
                        ? party.creditLimit ? formatCurrency(party.creditLimit) : 'Not set'
                        : '-'
                      }
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(party.status)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewParty(party.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditParty(party.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {party.partyType === 'supplier' || party.partyType === 'both' ? (
                          <DropdownMenuItem
                            onClick={() => navigate(`/app/purchases/manual?party=${party.id}`)}
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add Purchase
                          </DropdownMenuItem>
                        ) : null}
                        {party.partyType === 'customer' || party.partyType === 'both' ? (
                          <DropdownMenuItem
                            onClick={() => navigate(`/app/sales/invoice?party=${party.id}`)}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Add Sale
                          </DropdownMenuItem>
                        ) : null}
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
