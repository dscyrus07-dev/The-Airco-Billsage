import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Building2, MapPin, Phone, Mail, Calendar, AlertTriangle, CheckCircle,
  TrendingUp, FileText, Clock, Shield, CreditCard, ShoppingCart, DollarSign,
} from 'lucide-react';
import type { Party, PartyTransactionSummary } from '@/types/party';

interface PartyOverviewTabProps {
  party: Party;
  summary?: PartyTransactionSummary | null;
}

export default function PartyOverviewTab({ party, summary }: PartyOverviewTabProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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

  const validateGSTIN = (gstin: string) => {
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9]{1}$/;
    return GSTIN_REGEX.test(gstin);
  };

  const validatePAN = (pan: string) => {
    const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return PAN_REGEX.test(pan);
  };

  const isSupplier = party.partyType === 'supplier' || party.partyType === 'both';
  const isCustomer = party.partyType === 'customer' || party.partyType === 'both';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Party Identity Panel */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Party Identity</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Legal Name</label>
            <p className="font-medium">{party.legalName}</p>
          </div>

          {party.tradeName && (
            <div>
              <label className="text-sm text-muted-foreground">Trade Name</label>
              <p className="font-medium">{party.tradeName}</p>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground">Party Type</label>
            <div className="mt-1">
              {getPartyTypeBadge(party.partyType)}
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">GSTIN</label>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-mono text-sm">{party.gstin || 'Not provided'}</p>
              {party.gstin && (
                validateGSTIN(party.gstin) ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )
              )}
            </div>
          </div>

          {party.pan && (
            <div>
              <label className="text-sm text-muted-foreground">PAN</label>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-mono text-sm">{party.pan}</p>
                {validatePAN(party.pan) ? (
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
              <Badge variant={party.msme ? 'default' : 'secondary'}>
                {party.msme ? 'MSME Registered' : 'Not MSME'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isSupplier && party.paymentTermsPurchase && (
              <div>
                <label className="text-sm text-muted-foreground">Purchase Terms</label>
                <p className="font-medium">{party.paymentTermsPurchase}</p>
              </div>
            )}
            {isCustomer && party.paymentTermsSales && (
              <div>
                <label className="text-sm text-muted-foreground">Sales Terms</label>
                <p className="font-medium">{party.paymentTermsSales}</p>
              </div>
            )}
            {isCustomer && party.creditLimit && (
              <div>
                <label className="text-sm text-muted-foreground">Credit Limit</label>
                <p className="font-medium">₹{party.creditLimit.toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Place of Supply</label>
            <p className="font-medium">{party.state}</p>
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
            <p className="font-medium">{party.contactPerson}</p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Phone</label>
            <div className="flex items-center gap-2 mt-1">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{party.phone}</p>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <div className="flex items-center gap-2 mt-1">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{party.email}</p>
            </div>
          </div>

          <Separator />

          <div>
            <label className="text-sm text-muted-foreground">Address</label>
            <div className="mt-1 space-y-1">
              <p className="font-medium">{party.addressLine1}</p>
              {party.addressLine2 && (
                <p className="font-medium">{party.addressLine2}</p>
              )}
              <p className="font-medium">
                {party.city}, {party.state} - {party.pincode}
              </p>
              <p className="font-medium">{party.country}</p>
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
          {/* Purchase/Sales Summary */}
          {isSupplier && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Total Purchases</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-blue-600">
                  ₹{summary?.totalPurchases?.toLocaleString('en-IN') || '0'}
                </p>
                <p className="text-xs text-blue-500">
                  {summary?.purchaseInvoiceCount || 0} invoices
                </p>
              </div>
            </div>
          )}

          {isCustomer && (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Total Sales</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">
                  ₹{summary?.totalSales?.toLocaleString('en-IN') || '0'}
                </p>
                <p className="text-xs text-green-500">
                  {summary?.salesInvoiceCount || 0} invoices
                </p>
              </div>
            </div>
          )}

          {/* Payables/Receivables */}
          {isSupplier && (
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Open Payables</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-orange-600">
                  ₹{summary?.openPayables?.toLocaleString('en-IN') || '0'}
                </p>
                <p className="text-xs text-orange-500">
                  ₹{summary?.overduePayables?.toLocaleString('en-IN') || '0'} overdue
                </p>
              </div>
            </div>
          )}

          {isCustomer && (
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Open Receivables</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-purple-600">
                  ₹{summary?.openReceivables?.toLocaleString('en-IN') || '0'}
                </p>
                <p className="text-xs text-purple-500">
                  ₹{summary?.overdueReceivables?.toLocaleString('en-IN') || '0'} overdue
                </p>
              </div>
            </div>
          )}

          {/* Credit Utilization for Customers */}
          {isCustomer && party.creditLimit && (
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-medium">Credit Utilization</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-indigo-600">
                  {summary?.creditUtilization ? `${summary.creditUtilization.toFixed(1)}%` : '0%'}
                </p>
                <p className="text-xs text-indigo-500">
                  of ₹{party.creditLimit.toLocaleString('en-IN')} limit
                </p>
              </div>
            </div>
          )}

          {/* Compliance Flags */}
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Compliance Flags</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-red-600">
                {summary?.complianceFlags || 0}
              </p>
              <p className="text-xs text-red-500">needs attention</p>
            </div>
          </div>

          <Separator />

          {/* Important Dates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Purchase</span>
              <span className="text-sm font-medium">
                {summary?.lastPurchaseDate ? formatDate(summary.lastPurchaseDate) : 'No purchases'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Sale</span>
              <span className="text-sm font-medium">
                {summary?.lastSaleDate ? formatDate(summary.lastSaleDate) : 'No sales'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Payment</span>
              <span className="text-sm font-medium">
                {summary?.lastPaymentDate ? formatDate(summary.lastPaymentDate) : 'No payments'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">On-Time Payment Rate</span>
              <span className="text-sm font-medium">
                {summary?.onTimePaymentRate ? `${summary.onTimePaymentRate.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
