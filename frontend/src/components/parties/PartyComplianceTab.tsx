import { Card } from '@/components/ui/card';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Party, PartyInvoice } from '@/types/party';

interface PartyComplianceTabProps {
  party: Party;
  invoices: PartyInvoice[];
}

export default function PartyComplianceTab({ party, invoices }: PartyComplianceTabProps) {
  // Check if party has GSTIN for basic validation
  const hasGSTIN = !!party.gstin;
  const hasInvoices = invoices && invoices.length > 0;

  return (
    <div className="space-y-6">
      {/* Empty State - No Compliance APIs Available */}
      <Card className="p-12 text-center">
        <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Compliance Checks Available Yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Compliance monitoring and automated checks will be available once the compliance module is implemented.
          This will include GST validation, invoice quality checks, and regulatory compliance monitoring.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="text-center p-4 border rounded-lg">
            <AlertTriangle className="h-8 w-8 text-orange-500 mx-auto mb-2" />
            <h4 className="font-medium mb-1">GST Validation</h4>
            <p className="text-sm text-muted-foreground">Automated GSTIN verification</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <h4 className="font-medium mb-1">Invoice Quality</h4>
            <p className="text-sm text-muted-foreground">Invoice data validation</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <Shield className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <h4 className="font-medium mb-1">Regulatory Compliance</h4>
            <p className="text-sm text-muted-foreground">Tax compliance monitoring</p>
          </div>
        </div>
      </Card>

      {/* Basic Party Information (Real Data) */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Basic Party Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">GST Registration</p>
            <p className="font-medium">{hasGSTIN ? party.gstin : 'Not Registered'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Party Type</p>
            <p className="font-medium capitalize">{party.partyType}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium capitalize">{party.status}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Invoice Count</p>
            <p className="font-medium">{hasInvoices ? invoices.length : 0}</p>
          </div>
        </div>
      </Card>

      {/* Placeholder for Future Compliance Features */}
      <Card className="p-6">
        <div className="text-center py-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-semibold mb-2">Advanced Compliance Features Coming Soon</h4>
          <p className="text-muted-foreground">
            Automated compliance checking, GST reconciliation, and regulatory monitoring will be available 
            in future updates as the compliance module is developed.
          </p>
        </div>
      </Card>
    </div>
  );
}
