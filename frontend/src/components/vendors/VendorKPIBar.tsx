import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp, TrendingDown, Calendar, AlertTriangle, CheckCircle, FileText,
  IndianRupee, Clock, Shield,
} from 'lucide-react';
import type { Vendor, VendorInvoice, VendorTransactionSummary } from '@/types/vendor';

interface VendorKPIBarProps {
  vendor: Vendor;
  invoices: VendorInvoice[];
  summary?: VendorTransactionSummary | null;
  isLoading?: boolean;
}

export default function VendorKPIBar({
  vendor,
  invoices,
  summary,
  isLoading = false,
}: VendorKPIBarProps) {
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const calculateKPIs = () => {
    // KPI calculations from real invoice data
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

    const currentMonthSpend = currentMonthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const lastMonthSpend = lastMonthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const spendChange = lastMonthSpend > 0 ? ((currentMonthSpend - lastMonthSpend) / lastMonthSpend) * 100 : 0;

    const fySpend = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');
    const upcomingInvoices = invoices.filter(inv => inv.status === 'unpaid' && inv.dueDate > new Date().toISOString());
    const openPayables = overdueInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0) + 
                         upcomingInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const onTimePaymentRate = invoices.length > 0 ? (paidInvoices.length / invoices.length) * 100 : 100;

    // Calculate compliance flags from vendor data
    const complianceFlags = {
      high: vendor.gstin ? 0 : 1,
      medium: vendor.pan ? 0 : 1,
      low: 0, // No low priority flags for now
    };

    return {
      currentMonthSpend,
      spendChange,
      fySpend,
      openPayables,
      overdueAmount: overdueInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      invoiceCount: currentMonthInvoices.length,
      onTimePaymentRate,
      complianceFlags,
    };
  };

  const kpis = calculateKPIs();

  const kpiCards = [
    {
      title: 'Total Spend (This Month)',
      value: formatCurrency(kpis.currentMonthSpend),
      change: kpis.spendChange,
      icon: IndianRupee,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      clickable: true,
      tab: 'insights',
    },
    {
      title: 'Total Spend (FY)',
      value: formatCurrency(kpis.fySpend),
      change: null,
      icon: Calendar,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      clickable: true,
      tab: 'insights',
    },
    {
      title: 'Open Payables',
      value: formatCurrency(kpis.openPayables),
      subtitle: `₹${kpis.overdueAmount.toLocaleString('en-IN')} overdue`,
      change: null,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      clickable: true,
      tab: 'payables',
    },
    {
      title: 'Invoice Count (This Month)',
      value: kpis.invoiceCount.toString(),
      change: null,
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      clickable: true,
      tab: 'purchases',
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
    },
  ];

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
                // Navigate to tab - this would be handled by parent component
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
