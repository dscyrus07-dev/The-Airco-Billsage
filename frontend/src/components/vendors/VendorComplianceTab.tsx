import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle, CheckCircle, XCircle, AlertCircle, FileText, Shield,
  TrendingUp, Filter, Eye,
} from 'lucide-react';
import type { Vendor, VendorInvoice } from '@/types/vendor';

interface VendorComplianceTabProps {
  vendor: Vendor;
  invoices: VendorInvoice[];
}

interface ComplianceFlag {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  impactedInvoices?: string[];
}

export default function VendorComplianceTab({ vendor, invoices }: VendorComplianceTabProps) {
  const validateGSTIN = (gstin: string) => {
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9]{1}$/;
    return GSTIN_REGEX.test(gstin);
  };

  const validatePAN = (pan: string) => {
    const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return PAN_REGEX.test(pan);
  };

  const generateComplianceFlags = (): ComplianceFlag[] => {
    const flags: ComplianceFlag[] = [];

    // Identity & Tax flags
    if (!vendor.gstin) {
      flags.push({
        id: 'missing-gstin',
        category: 'Identity & Tax',
        title: 'Missing GSTIN',
        description: 'GST identification number not provided',
        severity: 'high',
        count: 1,
      });
    } else if (!validateGSTIN(vendor.gstin)) {
      flags.push({
        id: 'invalid-gstin',
        category: 'Identity & Tax',
        title: 'Invalid GSTIN Format',
        description: 'GSTIN format validation failed',
        severity: 'high',
        count: 1,
      });
    }

    if (!vendor.pan) {
      flags.push({
        id: 'missing-pan',
        category: 'Identity & Tax',
        title: 'Missing PAN',
        description: 'Permanent Account Number not provided',
        severity: 'medium',
        count: 1,
      });
    } else if (!validatePAN(vendor.pan)) {
      flags.push({
        id: 'invalid-pan',
        category: 'Identity & Tax',
        title: 'Invalid PAN Format',
        description: 'PAN format validation failed',
        severity: 'medium',
        count: 1,
      });
    }

    // Place of supply mismatch (placeholder)
    if (vendor.state && vendor.defaultGSTCategory === 'registered') {
      flags.push({
        id: 'place-of-supply',
        category: 'Identity & Tax',
        title: 'Place of Supply Mismatch',
        description: 'Vendor state may not match GST registration state',
        severity: 'medium',
        count: 1,
      });
    }

    // RCM Applicability (placeholder)
    if (vendor.vendorType === 'service') {
      flags.push({
        id: 'rcm-applicable',
        category: 'Identity & Tax',
        title: 'RCM Applicability Check',
        description: 'Reverse Charge Mechanism may apply for this service vendor',
        severity: 'low',
        count: 1,
      });
    }

    // Invoice Quality flags - Check for actual duplicate invoice numbers
    const invoiceNumbers = invoices.map(inv => inv.invoiceNo);
    const duplicateNumbers = invoiceNumbers.filter((num, index) => invoiceNumbers.indexOf(num) !== index);
    const uniqueDuplicates = [...new Set(duplicateNumbers)];
    
    if (uniqueDuplicates.length > 0) {
      flags.push({
        id: 'duplicate-invoices',
        category: 'Invoice Quality',
        title: 'Duplicate Invoice Numbers',
        description: `Duplicate invoice numbers detected: ${uniqueDuplicates.join(', ')}`,
        severity: 'high',
        count: uniqueDuplicates.length,
        impactedInvoices: uniqueDuplicates,
      });
    }

    // Missing HSN/SAC - Not available in current VendorInvoice structure
    // This check will be re-enabled when HSN/SAC data is available from backend

    // Unusual tax rates (placeholder)
    flags.push({
      id: 'unusual-tax-rates',
      category: 'Invoice Quality',
      title: 'Unusual Tax Rate Usage',
      description: 'Tax rates outside standard ranges detected',
      severity: 'medium',
      count: 1,
    });

    // GSTR-2B mismatch - Will be implemented when GSTR data is available from backend

    // ITC eligibility (placeholder)
    flags.push({
      id: 'itc-eligibility',
      category: 'Matching & Filing',
      title: 'ITC Eligibility Issues',
      description: 'Some invoices may not be eligible for Input Tax Credit',
      severity: 'medium',
      count: 2,
    });

    return flags;
  };

  const complianceFlags = generateComplianceFlags();

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      high: 'destructive',
      medium: 'secondary',
      low: 'outline',
    } as const;
    
    return (
      <Badge variant={variants[severity as keyof typeof variants]}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </Badge>
    );
  };

  const groupFlagsByCategory = () => {
    const grouped: Record<string, ComplianceFlag[]> = {};
    
    complianceFlags.forEach(flag => {
      if (!grouped[flag.category]) {
        grouped[flag.category] = [];
      }
      grouped[flag.category].push(flag);
    });
    
    return grouped;
  };

  const groupedFlags = groupFlagsByCategory();
  const severityCounts = {
    high: complianceFlags.filter(f => f.severity === 'high').length,
    medium: complianceFlags.filter(f => f.severity === 'medium').length,
    low: complianceFlags.filter(f => f.severity === 'low').length,
  };

  const handleViewImpactedInvoices = (flag: ComplianceFlag) => {
    if (flag.impactedInvoices) {
      console.log('Filtering invoices for:', flag.title, flag.impactedInvoices);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Flags</p>
              <p className="text-2xl font-bold">{complianceFlags.length}</p>
            </div>
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">High Priority</p>
              <p className="text-2xl font-bold text-red-600">{severityCounts.high}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Medium Priority</p>
              <p className="text-2xl font-bold text-yellow-600">{severityCounts.medium}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Low Priority</p>
              <p className="text-2xl font-bold text-blue-600">{severityCounts.low}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Compliance Flags by Category */}
      {Object.entries(groupedFlags).map(([category, flags]) => (
        <Card key={category} className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{category}</h3>
            <Badge variant="secondary">{flags.length} issues</Badge>
          </div>
          
          <div className="space-y-4">
            {flags.map((flag) => (
              <div key={flag.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getSeverityIcon(flag.severity)}
                      <h4 className="font-medium">{flag.title}</h4>
                      {getSeverityBadge(flag.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {flag.description}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="text-sm">
                        <span className="font-medium">{flag.count}</span> 
                        {flag.count === 1 ? ' item' : ' items'} affected
                      </span>
                      {flag.impactedInvoices && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewImpactedInvoices(flag)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Impacted Invoices
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* No Issues State */}
      {complianceFlags.length === 0 && (
        <Card className="p-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
          <p className="text-muted-foreground">
            No compliance issues detected for this vendor.
          </p>
        </Card>
      )}

      {/* Compliance Score */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Compliance Score</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Overall Score</span>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-green-600">
                {Math.max(0, 100 - (severityCounts.high * 20) - (severityCounts.medium * 10) - (severityCounts.low * 5))}
              </div>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="font-medium text-green-800">Identity & Tax</p>
              <p className="text-green-600">85%</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="font-medium text-yellow-800">Invoice Quality</p>
              <p className="text-yellow-600">72%</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-800">Matching & Filing</p>
              <p className="text-blue-600">90%</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
