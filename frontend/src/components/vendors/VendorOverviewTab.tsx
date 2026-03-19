import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Building2, MapPin, Phone, Mail, Calendar, AlertTriangle, CheckCircle,
  TrendingUp, FileText, Clock, Shield, CreditCard,
} from 'lucide-react';
import type { Vendor, VendorTransactionSummary } from '@/types/vendor';

interface VendorOverviewTabProps {
  vendor: Vendor;
  summary?: VendorTransactionSummary | null;
}

export default function VendorOverviewTab({ vendor, summary }: VendorOverviewTabProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getGSTCategoryBadge = (category: string) => {
    const variants = {
      registered: 'default',
      unregistered: 'secondary',
      composition: 'outline',
      import: 'destructive',
    } as const;
    return (
      <Badge variant={variants[category as keyof typeof variants] || 'secondary'}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  const getVendorTypeBadge = (type: string) => {
    const colors = {
      supplier: 'bg-blue-100 text-blue-800',
      service: 'bg-green-100 text-green-800',
      both: 'bg-purple-100 text-purple-800',
    } as const;
    
    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const validateGSTIN = (gstin: string) => {
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9]{1}$/;
    return GSTIN_REGEX.test(gstin);
  };

  const validatePAN = (pan: string) => {
    const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return PAN_REGEX.test(pan);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Vendor Identity Panel */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Vendor Identity</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Legal Name</label>
            <p className="font-medium">{vendor.vendorName}</p>
          </div>

          {vendor.tradeName && (
            <div>
              <label className="text-sm text-muted-foreground">Trade Name</label>
              <p className="font-medium">{vendor.tradeName}</p>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground">Vendor Type</label>
            <div className="mt-1">
              {getVendorTypeBadge(vendor.vendorType)}
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">GST Category</label>
            <div className="mt-1">
              {getGSTCategoryBadge(vendor.defaultGSTCategory)}
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">GSTIN</label>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-mono text-sm">{vendor.gstin || 'Not provided'}</p>
              {vendor.gstin && (
                validateGSTIN(vendor.gstin) ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )
              )}
            </div>
          </div>

          {vendor.pan && (
            <div>
              <label className="text-sm text-muted-foreground">PAN</label>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-mono text-sm">{vendor.pan}</p>
                {validatePAN(vendor.pan) ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground">MSME Status</label>
            <div className="mt-1">
              <Badge variant={vendor.msme ? 'default' : 'secondary'}>
                {vendor.msme ? 'MSME Registered' : 'Not MSME'}
              </Badge>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Payment Terms</label>
            <p className="font-medium">{vendor.paymentTerms}</p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Place of Supply</label>
            <p className="font-medium">{vendor.state}</p>
          </div>
        </div>
      </Card>

      {/* Contact & Address Panel */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Contact & Address</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Contact Person</label>
            <p className="font-medium">{vendor.contactPersonName || 'Not specified'}</p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Phone</label>
            <div className="flex items-center gap-2 mt-1">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{vendor.phone}</p>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <div className="flex items-center gap-2 mt-1">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{vendor.email}</p>
            </div>
          </div>

          <Separator />

          <div>
            <label className="text-sm text-muted-foreground">Address</label>
            <div className="mt-1 space-y-1">
              <p className="font-medium">{vendor.addressLine1}</p>
              {vendor.addressLine2 && (
                <p className="font-medium">{vendor.addressLine2}</p>
              )}
              <p className="font-medium">
                {vendor.city}, {vendor.state} - {vendor.pincode}
              </p>
              <p className="font-medium">{vendor.country}</p>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Communication Preference</label>
            <p className="font-medium">Email</p>
          </div>
        </div>
      </Card>

      {/* Risk / Health Summary Panel */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Risk / Health Summary</h3>
        </div>
        
        <div className="space-y-4">
          {/* Overdue Invoices */}
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Overdue Invoices</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-red-600">3</p>
              <p className="text-xs text-red-500">₹45,000</p>
            </div>
          </div>

          {/* Top Category Spend */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Top Category</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-blue-600">Raw Materials</p>
              <p className="text-xs text-blue-500">₹2.5L this month</p>
            </div>
          </div>

          {/* Duplicate Invoice Alerts */}
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Duplicate Alerts</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-orange-600">1</p>
              <p className="text-xs text-orange-500">This month</p>
            </div>
          </div>

          {/* GST Mismatch Alerts */}
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">GST Mismatch</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-purple-600">2</p>
              <p className="text-xs text-purple-500">Needs review</p>
            </div>
          </div>

          {/* Concentration Risk */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Concentration Risk</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-green-600">Low</p>
              <p className="text-xs text-green-500">#12 in spend</p>
            </div>
          </div>

          <Separator />

          {/* Important Dates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Invoice</span>
              <span className="text-sm font-medium">2 days ago</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Payment</span>
              <span className="text-sm font-medium">5 days ago</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
