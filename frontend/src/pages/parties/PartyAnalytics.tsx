import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, Building2,
  Calendar, Download, Filter, AlertTriangle, CheckCircle, Clock,
  IndianRupee, CreditCard, FileText, BarChart3,
} from 'lucide-react';
import { getParties } from '@/services/partyService';
import { fetchHomeKPIs, fetchMonthlyTrend } from '@/services/api';
import type { Party } from '@/types/party';

export default function PartyAnalytics() {
  const [timeRange, setTimeRange] = useState('6months');
  const [selectedMetric, setSelectedMetric] = useState('spend');

  // Fetch real data from backend
  const { data: parties = [], isLoading: partiesLoading } = useQuery({
    queryKey: ['parties'],
    queryFn: () => getParties({}),
  });

  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['kpis', 'home'],
    queryFn: fetchHomeKPIs,
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['analytics', 'trends'],
    queryFn: fetchMonthlyTrend,
  });

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Calculate real metrics from actual party data
  const supplierCount = parties.filter(p => p.partyType === 'supplier').length;
  const customerCount = parties.filter(p => p.partyType === 'customer').length;
  const bothCount = parties.filter(p => p.partyType === 'both').length;
  const activeCount = parties.filter(p => p.status === 'active').length;

  // Generate real party type distribution data
  const partyTypeData = [
    { type: 'Supplier Only', count: supplierCount, percentage: parties.length > 0 ? (supplierCount / parties.length) * 100 : 0 },
    { type: 'Customer Only', count: customerCount, percentage: parties.length > 0 ? (customerCount / parties.length) * 100 : 0 },
    { type: 'Both', count: bothCount, percentage: parties.length > 0 ? (bothCount / parties.length) * 100 : 0 },
  ].filter(item => item.count > 0);

  // Generate real state-wise distribution
  const stateData = parties.reduce((acc, party) => {
    const state = party.state || 'Not Set';
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stateChartData = Object.entries(stateData)
    .map(([state, count]) => ({
      state,
      count,
      percentage: parties.length > 0 ? (count / parties.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Use real KPI data or fallback to calculated values
  const realKpiData = {
    totalParties: parties.length,
    activeParties: activeCount,
    totalSpend: kpiData?.totalPurchases || 0,
    totalRevenue: kpiData?.totalSales || 0,
    avgOnTimePayment: kpiData?.avgPaymentDays || 0,
    complianceScore: kpiData?.complianceScore || 0,
    highRiskParties: parties.filter(p => p.status === 'inactive').length,
    msmeParties: 0, // Backend doesn't provide MSME data yet
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  if (partiesLoading || kpiLoading || trendLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader 
          title="Party Analytics" 
          description="Loading analytics data..."
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-20 bg-muted animate-pulse rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (parties.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader 
          title="Party Analytics" 
          description="Comprehensive insights into your supplier and customer relationships"
          actions={
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          }
        />

        <Card className="p-8">
          <div className="text-center py-8">
            <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Analytics Data Available</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Party analytics will appear once you have created parties and have transaction data.
              Start by adding suppliers and customers to see insights here.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="text-center p-4 border rounded-lg">
                <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <h4 className="font-medium mb-1">Add Parties</h4>
                <p className="text-sm text-muted-foreground">Create suppliers and customers</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <FileText className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h4 className="font-medium mb-1">Create Transactions</h4>
                <p className="text-sm text-muted-foreground">Generate invoices and bills</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <TrendingUp className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <h4 className="font-medium mb-1">View Analytics</h4>
                <p className="text-sm text-muted-foreground">See insights and trends</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="Party Analytics" 
        description="Comprehensive insights into your supplier and customer relationships"
        actions={
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Parties</p>
              <p className="text-2xl font-bold">{realKpiData.totalParties}</p>
              <p className="text-xs text-green-600">{realKpiData.activeParties} active</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Spend</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(realKpiData.totalSpend)}</p>
              <p className="text-xs text-orange-500">From purchases</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-orange-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(realKpiData.totalRevenue)}</p>
              <p className="text-xs text-green-500">From sales</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Parties</p>
              <p className="text-2xl font-bold text-purple-600">{realKpiData.activeParties}</p>
              <p className="text-xs text-purple-500">Currently active</p>
            </div>
            <CheckCircle className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Party Type Distribution */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Party Type Distribution</h3>
          </div>
          {partyTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={partyTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ type, percentage }) => `${type}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {partyTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'Parties']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No party type data available
            </div>
          )}
        </Card>

        {/* State-wise Distribution */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">State-wise Distribution</h3>
          </div>
          {stateChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stateChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="state" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    value, 
                    name === 'count' ? 'Parties' : 'Percentage'
                  ]}
                  labelFormatter={(label) => `State: ${label}`}
                />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No state data available
            </div>
          )}
        </Card>

        {/* Monthly Trends (if available) */}
        {trendData && trendData.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Monthly Trends</h3>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">3 Months</SelectItem>
                  <SelectItem value="6months">6 Months</SelectItem>
                  <SelectItem value="1year">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), '']}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Line type="monotone" dataKey="purchases" stroke="#f97316" strokeWidth={2} />
                <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Top Performing Parties */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Recent Parties</h3>
          </div>
          
          <div className="space-y-4">
            {parties.slice(0, 5).map((party, index) => (
              <div key={party.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{party.legalName}</span>
                    <Badge variant={
                      party.partyType === 'supplier' ? 'default' :
                      party.partyType === 'customer' ? 'secondary' : 'outline'
                    }>
                      {party.partyType === 'both' ? 'Both' : party.partyType.charAt(0).toUpperCase() + party.partyType.slice(1)}
                    </Badge>
                    <Badge variant={party.status === 'active' ? 'default' : 'secondary'}>
                      {party.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">GSTIN:</span>
                      <span className="ml-2 font-medium">{party.gstin || 'Not Set'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">State:</span>
                      <span className="ml-2 font-medium">{party.state || 'Not Set'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Suppliers</span>
          </div>
          <p className="text-lg font-bold text-blue-600">{supplierCount}</p>
          <p className="text-xs text-muted-foreground">active suppliers</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Inactive Parties</span>
          </div>
          <p className="text-lg font-bold text-orange-600">{realKpiData.highRiskParties}</p>
          <p className="text-xs text-muted-foreground">require attention</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Customers</span>
          </div>
          <p className="text-lg font-bold text-green-600">{customerCount}</p>
          <p className="text-xs text-muted-foreground">active customers</p>
        </Card>
      </div>
    </div>
  );
}
