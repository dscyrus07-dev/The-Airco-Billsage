import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { getVendorById, getVendorInvoices, getVendorSummary } from '@/services/vendorService';
import { useVendorStore } from '@/hooks/useVendorStore';
import VendorHeader from '@/components/vendors/VendorHeader';
import VendorKPIBar from '@/components/vendors/VendorKPIBar';
import VendorOverviewTab from '@/components/vendors/VendorOverviewTab';
import VendorPurchasesTab from '@/components/vendors/VendorPurchasesTab';
import VendorPayablesTab from '@/components/vendors/VendorPayablesTab';
import VendorComplianceTab from '@/components/vendors/VendorComplianceTab';
import VendorInsightsTab from '@/components/vendors/VendorInsightsTab';
import VendorNotesTab from '@/components/vendors/VendorNotesTab';
import type { Vendor, VendorInvoice, VendorTransactionSummary } from '@/types/vendor';

export default function VendorProfile() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { getVendorById: getVendorFromStore } = useVendorStore();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: vendor, isLoading: vendorLoading, error: vendorError } = useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: () => getVendorById(vendorId!),
    enabled: !!vendorId,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['vendor-invoices', vendorId],
    queryFn: () => getVendorInvoices(vendorId!),
    enabled: !!vendorId,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['vendor-summary', vendorId],
    queryFn: () => getVendorSummary(vendorId!),
    enabled: !!vendorId,
  });

  const handleBack = () => {
    navigate('/app/vendors');
  };

  const handleEditVendor = () => {
    navigate(`/app/vendors/${vendorId}/edit`);
  };

  const handleAddPurchase = () => {
    navigate(`/app/purchases/manual?vendor=${vendorId}`);
  };

  if (vendorLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vendors
          </Button>
        </div>
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (vendorError || !vendor) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vendors
          </Button>
        </div>
        <Card className="p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Vendor not found</h3>
          <p className="text-muted-foreground mb-4">
            The vendor you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/app/vendors')}>
            Back to Vendor List
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Vendors
        </Button>
      </div>

      {/* Vendor Header */}
      <VendorHeader 
        vendor={vendor} 
        onEdit={handleEditVendor}
        onAddPurchase={handleAddPurchase}
        lastUpdated={vendor.updatedAt}
      />

      {/* KPI Bar */}
      <VendorKPIBar 
        vendor={vendor}
        invoices={invoices}
        summary={summary}
        isLoading={invoicesLoading || summaryLoading}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="payables">Payables</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <VendorOverviewTab vendor={vendor} summary={summary} />
        </TabsContent>

        <TabsContent value="purchases" className="space-y-4">
          <VendorPurchasesTab 
            vendorId={vendor.id}
            invoices={invoices}
            isLoading={invoicesLoading}
          />
        </TabsContent>

        <TabsContent value="payables" className="space-y-4">
          <VendorPayablesTab 
            vendorId={vendor.id}
            invoices={invoices}
            isLoading={invoicesLoading}
          />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <VendorComplianceTab 
            vendor={vendor}
            invoices={invoices}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <VendorInsightsTab 
            vendorId={vendor.id}
            invoices={invoices}
            isLoading={invoicesLoading}
          />
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <VendorNotesTab 
            vendorId={vendor.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
