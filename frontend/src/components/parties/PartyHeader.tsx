import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Edit, Plus, FileText, MoreVertical, Download, AlertTriangle, Trash2,
  UserCheck, UserX, MessageSquare, ShoppingCart, DollarSign,
} from 'lucide-react';
import type { Party } from '@/types/party';

interface PartyHeaderProps {
  party: Party;
  onEdit: () => void;
  onAddPurchase?: () => void;
  onAddSale?: () => void;
  onAddNote?: () => void;
  lastUpdated: string;
}

export default function PartyHeader({
  party,
  onEdit,
  onAddPurchase,
  onAddSale,
  onAddNote,
  lastUpdated,
}: PartyHeaderProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      blocked: 'destructive',
    } as const;
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
        {partyType === 'both' ? 'Supplier & Customer' : partyType.charAt(0).toUpperCase() + partyType.slice(1)}
      </Badge>
    );
  };

  const getTagBadge = (tag: string) => {
    const tagColors = {
      'MSME': 'bg-blue-100 text-blue-800',
      'Critical Supplier': 'bg-red-100 text-red-800',
      'High Risk': 'bg-orange-100 text-orange-800',
      'Preferred': 'bg-green-100 text-green-800',
      'New': 'bg-purple-100 text-purple-800',
      'Key Customer': 'bg-emerald-100 text-emerald-800',
      'Large Volume': 'bg-indigo-100 text-indigo-800',
      'Regular Supplier': 'bg-gray-100 text-gray-800',
      'Fast Moving': 'bg-yellow-100 text-yellow-800',
      'Retail Chain': 'bg-pink-100 text-pink-800',
      'Automotive': 'bg-cyan-100 text-cyan-800',
      'Technology': 'bg-violet-100 text-violet-800',
      'Export Customer': 'bg-teal-100 text-teal-800',
      'International': 'bg-orange-100 text-orange-800',
      'Credit Customer': 'bg-red-100 text-red-800',
      'Large Corporate': 'bg-blue-100 text-blue-800',
      'Small Parts': 'bg-gray-100 text-gray-800',
      'Engineering Supplier': 'bg-indigo-100 text-indigo-800',
      'Large Projects': 'bg-purple-100 text-purple-800',
      'Just-in-Time': 'bg-green-100 text-green-800',
      'Regular Orders': 'bg-blue-100 text-blue-800',
      'Supermarket Chain': 'bg-orange-100 text-orange-800',
    } as const;

    const colorClass = tagColors[tag as keyof typeof tagColors] || 'bg-gray-100 text-gray-800';
    
    return (
      <Badge className={colorClass} variant="secondary">
        {tag}
      </Badge>
    );
  };

  const handleExport = () => {
    toast.success('Party data exported successfully');
  };

  const handleDelete = () => {
    setDeleteDialogOpen(false);
    toast.success('Party deleted successfully');
    // In real app, this would call delete service
  };

  const handleToggleStatus = () => {
    setStatusDialogOpen(false);
    const newStatus = party.status === 'active' ? 'inactive' : 'active';
    toast.success(`Party status changed to ${newStatus}`);
    // In real app, this would call update service
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isSupplier = party.partyType === 'supplier' || party.partyType === 'both';
  const isCustomer = party.partyType === 'customer' || party.partyType === 'both';

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start justify-between">
          {/* Left Side - Party Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{party.partyName}</h1>
              {getPartyTypeBadge(party.partyType)}
              {getStatusBadge(party.status)}
            </div>
            
            {party.displayName && (
              <p className="text-muted-foreground mb-3">{party.displayName}</p>
            )}

            {/* Party Code */}
            {party.partyCode && (
              <p className="text-muted-foreground mb-3">
                <span className="font-semibold">Party Code:</span> {party.partyCode}
              </p>
            )}

            {/* Key Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">GSTIN:</span>
                <span className="ml-2 font-mono">{party.gstin || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Contact:</span>
                <span className="ml-2">{party.phone || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <span className="ml-2">{party.email || 'Not provided'}</span>
              </div>
            </div>

            {/* Address Information */}
            {(party.address || party.state || party.pinCode) && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <div className="text-sm font-medium mb-2">Address</div>
                <div className="text-sm text-muted-foreground">
                  {party.address && <div>{party.address}</div>}
                  {(party.state || party.pinCode) && (
                    <div>
                      {party.state && party.state}
                      {party.state && party.pinCode && ', '}
                      {party.pinCode && party.pinCode}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4">
              <div>
                <span className="text-muted-foreground">Payment Terms:</span>
                <span className="ml-2">{party.paymentTermsDays || 0} days</span>
              </div>
              {isCustomer && party.creditLimit && (
                <div>
                  <span className="text-muted-foreground">Credit Limit:</span>
                  <span className="ml-2">₹{party.creditLimit.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            {/* Last Updated */}
            <div className="mt-4 text-xs text-muted-foreground">
              Last updated: {formatDate(lastUpdated)}
            </div>
          </div>

          {/* Right Side - Quick Actions */}
          <div className="flex items-center gap-2">
            <Button onClick={onEdit} variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            
            {onAddPurchase && (
              <Button onClick={onAddPurchase} variant="outline" size="sm">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add Purchase
              </Button>
            )}
            
            {onAddSale && (
              <Button onClick={onAddSale} variant="outline" size="sm">
                <DollarSign className="h-4 w-4 mr-2" />
                Add Sale
              </Button>
            )}

            {onAddNote && (
              <Button onClick={onAddNote} variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusDialogOpen(true)}>
                  {party.status === 'active' ? (
                    <>
                      <UserX className="h-4 w-4 mr-2" />
                      Disable
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Enable
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Party</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{party.partyName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Party
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {party.status === 'active' ? 'Disable Party' : 'Enable Party'}
            </DialogTitle>
            <DialogDescription>
              {party.status === 'active' 
                ? `Are you sure you want to disable "${party.partyName}"? They will no longer be available for new transactions.`
                : `Are you sure you want to enable "${party.partyName}"? They will be available for new transactions.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleToggleStatus}>
              {party.status === 'active' ? 'Disable' : 'Enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
