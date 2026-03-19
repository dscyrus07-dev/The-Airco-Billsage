import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { getPartyById, getPartyInvoices, getPartySummary } from '@/services/partyService';
import { usePartyStore } from '@/hooks/usePartyStore';
import PartyHeader from '@/components/parties/PartyHeader';
import PartyKPIBar from '@/components/parties/PartyKPIBar';
import PartyOverviewTab from '@/components/parties/PartyOverviewTab';
import PartyPurchasesTab from '@/components/parties/PartyPurchasesTab';
import PartySalesTab from '@/components/parties/PartySalesTab';
import PartyPayablesReceivablesTab from '@/components/parties/PartyPayablesReceivablesTab';
import PartyComplianceTab from '@/components/parties/PartyComplianceTab';
import PartyInsightsTab from '@/components/parties/PartyInsightsTab';
import PartyNotesTab from '@/components/parties/PartyNotesTab';
import type { Party, PartyInvoice, PartyTransactionSummary } from '@/types/party';

export default function PartyProfile() {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();
  const { getPartyById: getPartyFromStore } = usePartyStore();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: party, isLoading: partyLoading, error: partyError } = useQuery({
    queryKey: ['party', partyId],
    queryFn: () => getPartyById(partyId!),
    enabled: !!partyId,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['party-invoices', partyId],
    queryFn: () => getPartyInvoices(partyId!),
    enabled: !!partyId,
    select: (data) => {
      // Ensure we always have an array, even if the API returns unexpected data
      console.log('PartyProfile - Raw invoices data:', data);
      const safeArray = Array.isArray(data) ? data : [];
      console.log('PartyProfile - Safe invoices array:', safeArray);
      return safeArray;
    },
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['party-summary', partyId],
    queryFn: () => getPartySummary(partyId!),
    enabled: !!partyId,
  });

  const handleBack = () => {
    navigate('/app/parties');
  };

  const handleEditParty = () => {
    navigate(`/app/parties/${partyId}/edit`);
  };

  const handleAddPurchase = () => {
    navigate(`/app/purchases/manual?party=${partyId}`);
  };

  const handleAddSale = () => {
    navigate(`/app/sales/invoice?party=${partyId}`);
  };

  if (partyLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Parties
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

  if (partyError || !party) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Parties
          </Button>
        </div>
        <Card className="p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Party not found</h3>
          <p className="text-muted-foreground mb-4">
            The party you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/app/parties')}>
            Back to Party List
          </Button>
        </Card>
      </div>
    );
  }

  // Determine available tabs based on party type
  const isSupplier = party.partyType === 'supplier' || party.partyType === 'both';
  const isCustomer = party.partyType === 'customer' || party.partyType === 'both';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Parties
        </Button>
      </div>

      {/* Party Header */}
      <PartyHeader 
        party={party} 
        onEdit={handleEditParty}
        onAddPurchase={isSupplier ? handleAddPurchase : undefined}
        onAddSale={isCustomer ? handleAddSale : undefined}
        lastUpdated={party.updatedAt}
      />

      {/* KPI Bar */}
      <PartyKPIBar 
        party={party}
        invoices={invoices}
        summary={summary}
        isLoading={invoicesLoading || summaryLoading}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isSupplier && <TabsTrigger value="purchases">Purchases</TabsTrigger>}
          {isCustomer && <TabsTrigger value="sales">Sales</TabsTrigger>}
          <TabsTrigger value="payables-receivables">
            {isSupplier && isCustomer ? 'Payables & Receivables' : isSupplier ? 'Payables' : 'Receivables'}
          </TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <PartyOverviewTab party={party} summary={summary} />
        </TabsContent>

        {isSupplier && (
          <TabsContent value="purchases" className="space-y-4">
            <PartyPurchasesTab 
              partyId={party.id}
              invoices={Array.isArray(invoices) ? invoices.filter(inv => inv.invoiceType === 'purchase') : []}
              isLoading={invoicesLoading}
            />
          </TabsContent>
        )}

        {isCustomer && (
          <TabsContent value="sales" className="space-y-4">
            <PartySalesTab 
              partyId={party.id}
              invoices={Array.isArray(invoices) ? invoices.filter(inv => inv.invoiceType === 'sale') : []}
              isLoading={invoicesLoading}
            />
          </TabsContent>
        )}

        <TabsContent value="payables-receivables" className="space-y-4">
          <PartyPayablesReceivablesTab 
            party={party}
            partyId={party.id}
            invoices={Array.isArray(invoices) ? invoices : []}
            isLoading={invoicesLoading}
          />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <PartyComplianceTab 
            party={party}
            invoices={Array.isArray(invoices) ? invoices : []}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <PartyInsightsTab 
            partyId={party.id}
            invoices={Array.isArray(invoices) ? invoices : []}
            isLoading={invoicesLoading}
          />
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <PartyNotesTab 
            partyId={party.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
