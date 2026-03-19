import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp, Calendar, FileText, Clock, CheckCircle, ShoppingCart, DollarSign,
  AlertTriangle, BarChart3,
} from 'lucide-react';
import type { PartyInvoice } from '@/types/party';

interface PartyInsightsTabProps {
  partyId: string;
  invoices: PartyInvoice[];
  isLoading?: boolean;
}

export default function PartyInsightsTab({
  partyId,
  invoices,
  isLoading = false,
}: PartyInsightsTabProps) {
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Check if there's any real data to show insights for
  const hasInvoices = invoices && invoices.length > 0;
  const hasRealData = hasInvoices;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-64 w-full" />
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  // Show empty state when no real data is available
  if (!hasRealData) {
    return (
      <div className="space-y-6">
        {/* Empty State Header */}
        <Card className="p-8">
          <div className="text-center py-8">
            <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Insights Available Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Insights will appear once this party has transactions and invoice history. 
              Create invoices for this party to see detailed analytics and trends.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="text-center p-4 border rounded-lg">
                <FileText className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <h4 className="font-medium mb-1">Invoice History</h4>
                <p className="text-sm text-muted-foreground">Track transactions over time</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h4 className="font-medium mb-1">Spend Trends</h4>
                <p className="text-sm text-muted-foreground">Monitor spending patterns</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <Calendar className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <h4 className="font-medium mb-1">Payment Analytics</h4>
                <p className="text-sm text-muted-foreground">Analyze payment behavior</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Placeholder for Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 opacity-60">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Spend Trend</span>
            </div>
            <p className="text-lg font-bold text-muted-foreground">--</p>
            <p className="text-xs text-muted-foreground">No data available</p>
          </Card>

          <Card className="p-4 opacity-60">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Avg Payment Time</span>
            </div>
            <p className="text-lg font-bold text-muted-foreground">--</p>
            <p className="text-xs text-muted-foreground">No data available</p>
          </Card>

          <Card className="p-4 opacity-60">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Risk Assessment</span>
            </div>
            <p className="text-lg font-bold text-muted-foreground">--</p>
            <p className="text-xs text-muted-foreground">No data available</p>
          </Card>
        </div>
      </div>
    );
  }

  // When there is real data, show actual insights
  // For now, this is a placeholder - in a real implementation, 
  // you would calculate insights from the actual invoice data
  const totalSpend = invoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
  const avgInvoiceValue = totalSpend / invoices.length;
  const recentInvoices = invoices.slice(-5);

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Party Insights Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Invoices</p>
            <p className="text-2xl font-bold">{invoices.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Spend</p>
            <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Invoice Value</p>
            <p className="text-2xl font-bold">{formatCurrency(avgInvoiceValue)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Recent Activity</p>
            <p className="text-2xl font-bold">{recentInvoices.length}</p>
          </div>
        </div>
      </Card>

      {/* Recent Invoices */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Invoices</h3>
        <div className="space-y-2">
          {recentInvoices.map((invoice, index) => (
            <div key={invoice.id} className="flex justify-between items-center p-3 border rounded">
              <div>
                <p className="font-medium">{invoice.invoiceNo}</p>
                <p className="text-sm text-muted-foreground">{invoice.invoiceDate}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(invoice.totalAmount)}</p>
                <p className="text-sm text-muted-foreground">{invoice.status}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Note about advanced analytics */}
      <Card className="p-6">
        <div className="text-center py-4">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-semibold mb-2">Advanced Analytics Coming Soon</h4>
          <p className="text-muted-foreground">
            Detailed charts, trends, and category breakdowns will be available as more transaction data is collected.
          </p>
        </div>
      </Card>
    </div>
  );
}
