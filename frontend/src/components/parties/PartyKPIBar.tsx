import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp, TrendingDown, Calendar, AlertTriangle, CheckCircle, FileText,
  Clock, Shield, ShoppingCart, DollarSign, CreditCard, Users,
} from 'lucide-react';
import type { Party, PartyInvoice, PartyTransactionSummary } from '@/types/party';

interface PartyKPIBarProps {
  party: Party;
  invoices: PartyInvoice[];
  summary?: PartyTransactionSummary | null;
  isLoading?: boolean;
}

export default function PartyKPIBar({
  party,
  invoices,
  summary,
  isLoading = false,
}: PartyKPIBarProps) {
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const calculateKPIs = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const currentMonthInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.invoiceDate);
      return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
    });

    const lastMonthInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.invoiceDate);
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear;
    });

    const currentMonthPurchases = currentMonthInvoices
      .filter(inv => inv.invoiceType === 'purchase')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    
    const lastMonthPurchases = lastMonthInvoices
      .filter(inv => inv.invoiceType === 'purchase')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    
    const purchaseChange = lastMonthPurchases > 0 ? ((currentMonthPurchases - lastMonthPurchases) / lastMonthPurchases) * 100 : 0;

    const currentMonthSales = currentMonthInvoices
      .filter(inv => inv.invoiceType === 'sale')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    
    const lastMonthSales = lastMonthInvoices
      .filter(inv => inv.invoiceType === 'sale')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    
    const salesChange = lastMonthSales > 0 ? ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100 : 0;

    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');
    const unpaidInvoices = invoices.filter(inv => inv.status === 'unpaid');
    
    const openPayables = unpaidInvoices
      .filter(inv => inv.invoiceType === 'purchase')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    
    const openReceivables = unpaidInvoices
      .filter(inv => inv.invoiceType === 'sale')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    const overduePayables = overdueInvoices
      .filter(inv => inv.invoiceType === 'purchase')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    
    const overdueReceivables = overdueInvoices
      .filter(inv => inv.invoiceType === 'sale')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const onTimePaymentRate = invoices.length > 0 ? (paidInvoices.length / invoices.length) * 100 : 100;

    // Calculate compliance flags from party data
    const complianceFlags = {
      high: party.gstin ? 0 : 1,
      medium: 0, // PAN field not available in current Party interface
      low: 0, // No low priority flags for now
    };

    return {
      currentMonthPurchases,
      purchaseChange,
      currentMonthSales,
      salesChange,
      openPayables,
      openReceivables,
      overduePayables,
      overdueReceivables,
      invoiceCount: currentMonthInvoices.length,
      onTimePaymentRate,
      complianceFlags,
      creditUtilization: summary?.creditUtilization || 0,
    };
  };

  const kpis = calculateKPIs();
  const isSupplier = party.partyType === 'supplier' || party.partyType === 'both';
  const isCustomer = party.partyType === 'customer' || party.partyType === 'both';

  // Dynamic KPI cards based on party type
  const getKPICards = () => {
    const cards = [];

    if (isSupplier) {
      cards.push(
        {
          title: 'Total Purchases (This Month)',
          value: formatCurrency(kpis.currentMonthPurchases),
          change: kpis.purchaseChange,
          icon: ShoppingCart,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          clickable: true,
          tab: 'purchases',
        },
        {
          title: 'Open Payables',
          value: formatCurrency(kpis.openPayables),
          subtitle: `₹${kpis.overduePayables.toLocaleString('en-IN')} overdue`,
          change: null,
          icon: Clock,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          clickable: true,
          tab: 'payables-receivables',
        },
        {
          title: 'Overdue Amount',
          value: formatCurrency(kpis.overduePayables),
          change: null,
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          clickable: true,
          tab: 'payables-receivables',
        }
      );
    }

    if (isCustomer) {
      cards.push(
        {
          title: 'Total Sales (This Month)',
          value: formatCurrency(kpis.currentMonthSales),
          change: kpis.salesChange,
          icon: DollarSign,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          clickable: true,
          tab: 'sales',
        },
        {
          title: 'Open Receivables',
          value: formatCurrency(kpis.openReceivables),
          subtitle: `₹${kpis.overdueReceivables.toLocaleString('en-IN')} overdue`,
          change: null,
          icon: CreditCard,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          clickable: true,
          tab: 'payables-receivables',
        },
        {
          title: 'Credit Utilization',
          value: formatPercent(kpis.creditUtilization),
          subtitle: 'of credit limit',
          change: null,
          icon: Users,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
          clickable: true,
          tab: 'overview',
        }
      );
    }

    // Common cards for all party types
    cards.push(
      {
        title: 'Invoice Count (This Month)',
        value: kpis.invoiceCount.toString(),
        change: null,
        icon: FileText,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        clickable: true,
        tab: isSupplier ? 'purchases' : 'sales',
      },
      {
        title: 'On-Time Payment Rate',
        value: formatPercent(kpis.onTimePaymentRate),
        change: null,
        icon: CheckCircle,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        clickable: true,
        tab: 'insights',
      },
      {
        title: 'Compliance Flags',
        value: (kpis.complianceFlags.high + kpis.complianceFlags.medium + kpis.complianceFlags.low).toString(),
        subtitle: `${kpis.complianceFlags.high} high, ${kpis.complianceFlags.medium} medium`,
        change: null,
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        clickable: true,
        tab: 'compliance',
      }
    );

    return cards;
  };

  const kpiCards = getKPICards();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-8 w-1/2 mb-2" />
            <Skeleton className="h-3 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
      {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon;
        const isPositive = kpi.change && kpi.change > 0;
        const isNegative = kpi.change && kpi.change < 0;

        return (
          <Card 
            key={index} 
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${kpi.clickable ? 'hover:scale-105' : ''}`}
            onClick={() => {
              if (kpi.clickable && kpi.tab) {
                console.log(`Navigate to ${kpi.tab} tab`);
              }
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              {kpi.change !== null && (
                <div className={`flex items-center text-xs ${
                  isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : null}
                  {isNegative ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                  {Math.abs(kpi.change).toFixed(1)}%
                </div>
              )}
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{kpi.title}</p>
              <p className="text-lg font-semibold">{kpi.value}</p>
              {kpi.subtitle && (
                <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
