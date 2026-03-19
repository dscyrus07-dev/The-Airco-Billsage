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
  UserCheck, UserX, MessageSquare,
} from 'lucide-react';
import type { Vendor } from '@/types/vendor';

interface VendorHeaderProps {
  vendor: Vendor;
  onEdit: () => void;
  onAddPurchase: () => void;
  onAddNote?: () => void;
  lastUpdated: string;
}

export default function VendorHeader({
  vendor,
  onEdit,
  onAddPurchase,
  onAddNote,
  lastUpdated,
}: VendorHeaderProps) {
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

  const getTagBadge = (tag: string) => {
    const tagColors = {
      'MSME': 'bg-blue-100 text-blue-800',
      'Critical Supplier': 'bg-red-100 text-red-800',
      'High Risk': 'bg-orange-100 text-orange-800',
      'Preferred': 'bg-green-100 text-green-800',
      'New': 'bg-purple-100 text-purple-800',
    } as const;

    const colorClass = tagColors[tag as keyof typeof tagColors] || 'bg-gray-100 text-gray-800';
    
    return (
      <Badge className={colorClass} variant="secondary">
        {tag}
      </Badge>
    );
  };

  const handleExport = () => {
    toast.success('Vendor data exported successfully');
  };

  const handleDelete = () => {
    setDeleteDialogOpen(false);
    toast.success('Vendor deleted successfully');
    // In real app, this would call delete service
  };

  const handleToggleStatus = () => {
    setStatusDialogOpen(false);
    const newStatus = vendor.status === 'active' ? 'inactive' : 'active';
    toast.success(`Vendor status changed to ${newStatus}`);
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

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start justify-between">
          {/* Left Side - Vendor Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{vendor.vendorName}</h1>
              {getStatusBadge(vendor.status)}
            </div>
            
            {vendor.tradeName && (
              <p className="text-muted-foreground mb-3">{vendor.tradeName}</p>
            )}

            {/* Tags */}
            {vendor.tags && vendor.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {vendor.tags.map((tag) => (
                  <span key={tag}>{getTagBadge(tag)}</span>
                ))}
              </div>
            )}

            {/* Key Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">GSTIN:</span>
                <span className="ml-2 font-mono">{vendor.gstin || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Contact:</span>
                <span className="ml-2">{vendor.contactPersonName || vendor.phone}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>
                <span className="ml-2">{vendor.city}, {vendor.state}</span>
              </div>
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
            
            <Button onClick={onAddPurchase} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Purchase
            </Button>

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
                  {vendor.status === 'active' ? (
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
            <DialogTitle>Delete Vendor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{vendor.vendorName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {vendor.status === 'active' ? 'Disable Vendor' : 'Enable Vendor'}
            </DialogTitle>
            <DialogDescription>
              {vendor.status === 'active' 
                ? `Are you sure you want to disable "${vendor.vendorName}"? They will no longer be available for new purchases.`
                : `Are you sure you want to enable "${vendor.vendorName}"? They will be available for new purchases.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleToggleStatus}>
              {vendor.status === 'active' ? 'Disable' : 'Enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
