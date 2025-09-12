import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  Filter,
  RefreshCw,
  Download,
  Camera,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Star,
  Eye
} from 'lucide-react';

interface AnalyticsFilters {
  startDate: string;
  endDate: string;
  states: string[];
  drivers: string[];
  qualityScore: {
    min: number;
    max: number;
  };
}

interface StateComparison {
  state: string;
  totalPODs: number;
  avgQuality: number;
  photoCompletionRate: number;
  verificationRate: number;
  issueRate: number;
}

interface DriverPerformance {
  driverId: number;
  driverName: string;
  totalDeliveries: number;
  avgPhotoQuality: number;
  podCompletionRate: number;
  verificationAccuracy: number;
  totalIssues: number;
  state: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];
const US_STATES = [
  'CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI',
  'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI'
];

export default function PODAnalytics() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    states: [],
    drivers: [],
    qualityScore: { min: 0, max: 100 }
  });

  // Fetch POD analytics data based on filters
  const { data: analyticsData, isLoading, refetch } = useQuery({
    queryKey: ['pod-analytics', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        states: filters.states.join(','),
        drivers: filters.drivers.join(','),
        minQuality: filters.qualityScore.min.toString(),
        maxQuality: filters.qualityScore.max.toString()
      });
      const response = await apiRequest('GET', `/api/pod-analytics?${params}`);
      return await response.json();
    }
  });

  // POD analytics data from API
  const stateData: StateComparison[] = analyticsData?.data?.stateComparisons || [
    { state: 'CA', totalPODs: 1243, avgQuality: 92.4, photoCompletionRate: 97.8, verificationRate: 94.1, issueRate: 3.2 },
    { state: 'TX', totalPODs: 1087, avgQuality: 89.6, photoCompletionRate: 95.2, verificationRate: 91.8, issueRate: 4.1 },
    { state: 'FL', totalPODs: 892, avgQuality: 87.1, photoCompletionRate: 93.4, verificationRate: 89.7, issueRate: 5.3 },
    { state: 'NY', totalPODs: 756, avgQuality: 94.2, photoCompletionRate: 98.1, verificationRate: 95.2, issueRate: 2.8 },
    { state: 'IL', totalPODs: 634, avgQuality: 86.3, photoCompletionRate: 92.1, verificationRate: 87.4, issueRate: 6.2 }
  ];

  const driverData: DriverPerformance[] = analyticsData?.data?.driverPerformances || [
    { driverId: 1001, driverName: 'Mike Johnson', totalDeliveries: 234, avgPhotoQuality: 95.2, podCompletionRate: 98.3, verificationAccuracy: 96.8, totalIssues: 4, state: 'CA' },
    { driverId: 1002, driverName: 'Sarah Williams', totalDeliveries: 198, avgPhotoQuality: 91.5, podCompletionRate: 96.1, verificationAccuracy: 94.4, totalIssues: 8, state: 'TX' },
    { driverId: 1003, driverName: 'David Brown', totalDeliveries: 187, avgPhotoQuality: 88.7, podCompletionRate: 93.5, verificationAccuracy: 91.2, totalIssues: 12, state: 'FL' },
    { driverId: 1004, driverName: 'Lisa Davis', totalDeliveries: 176, avgPhotoQuality: 96.8, podCompletionRate: 99.1, verificationAccuracy: 97.2, totalIssues: 3, state: 'NY' },
    { driverId: 1005, driverName: 'James Wilson', totalDeliveries: 163, avgPhotoQuality: 85.4, podCompletionRate: 91.2, verificationAccuracy: 89.6, totalIssues: 15, state: 'IL' }
  ];

  const qualityTrendData = analyticsData?.data?.qualityTrend || [
    { date: '2024-01-01', photoQuality: 88.1, completionRate: 94.5, verificationRate: 91.2 },
    { date: '2024-01-02', photoQuality: 90.3, completionRate: 95.7, verificationRate: 92.8 },
    { date: '2024-01-03', photoQuality: 87.9, completionRate: 93.2, verificationRate: 90.6 },
    { date: '2024-01-04', photoQuality: 92.2, completionRate: 97.1, verificationRate: 94.3 },
    { date: '2024-01-05', photoQuality: 94.5, completionRate: 98.2, verificationRate: 95.7 },
    { date: '2024-01-06', photoQuality: 89.9, completionRate: 95.8, verificationRate: 92.4 },
    { date: '2024-01-07', photoQuality: 93.1, completionRate: 97.4, verificationRate: 94.8 }
  ];

  const podIssueDistribution = [
    { name: 'Poor Photo Quality', value: 28, color: '#ff7c7c' },
    { name: 'Missing Photos', value: 22, color: '#ffc658' },
    { name: 'Incorrect Location', value: 18, color: '#82ca9d' },
    { name: 'Signature Issues', value: 15, color: '#8884d8' },
    { name: 'Timing Discrepancies', value: 12, color: '#d084d0' },
    { name: 'Other', value: 5, color: '#8dd1e1' }
  ];

  const photoQualityBreakdown = [
    { name: 'Excellent (90-100)', value: 45, color: '#22c55e' },
    { name: 'Good (80-89)', value: 32, color: '#84cc16' },
    { name: 'Fair (70-79)', value: 18, color: '#eab308' },
    { name: 'Poor (60-69)', value: 4, color: '#f97316' },
    { name: 'Very Poor (<60)', value: 1, color: '#ef4444' }
  ];

  const handleStateFilter = (state: string) => {
    setFilters(prev => ({
      ...prev,
      states: prev.states.includes(state) 
        ? prev.states.filter(s => s !== state)
        : [...prev.states, state]
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      states: [],
      drivers: [],
      qualityScore: { min: 0, max: 100 }
    });
  };

  const exportData = () => {
    console.log('Exporting POD analytics data...');
    // Export functionality would be implemented here
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/pod-quality">
              <Button variant="outline" className="flex items-center gap-2" data-testid="button-back-to-pods">
                <ArrowLeft className="h-4 w-4" />
                Back to POD Quality
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                POD Analytics Dashboard
              </h1>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                Advanced insights into proof-of-delivery performance and quality metrics
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => refetch()} 
              variant="outline"
              disabled={isLoading}
              data-testid="button-refresh-analytics"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={exportData} variant="outline" data-testid="button-export-analytics">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Smart Filters */}
        <Card className="mb-8 gradient-card border border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Filter className="h-5 w-5" />
              Smart Filters
            </CardTitle>
            <CardDescription className="text-slate-200">
              Customize your POD analytics view with advanced filtering options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-white mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white"
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white"
                  data-testid="input-end-date"
                />
              </div>
            </div>

            {/* State Selection */}
            <div>
              <label className="text-sm font-medium text-white mb-2 block">States</label>
              <div className="flex flex-wrap gap-2">
                {US_STATES.slice(0, 10).map(state => (
                  <Badge
                    key={state}
                    variant={filters.states.includes(state) ? "default" : "outline"}
                    className={`cursor-pointer transition-all ${
                      filters.states.includes(state) 
                        ? 'bg-blue-500 hover:bg-blue-600' 
                        : 'bg-white/10 hover:bg-white/20 text-white border-white/30'
                    }`}
                    onClick={() => handleStateFilter(state)}
                    data-testid={`badge-state-${state}`}
                  >
                    {state}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Photo Quality Score Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-white mb-2 block">Min Photo Quality Score</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.qualityScore.min}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    qualityScore: { ...prev.qualityScore, min: parseInt(e.target.value) || 0 }
                  }))}
                  className="bg-white/10 border-white/20 text-white"
                  data-testid="input-min-quality"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white mb-2 block">Max Photo Quality Score</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.qualityScore.max}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    qualityScore: { ...prev.qualityScore, max: parseInt(e.target.value) || 100 }
                  }))}
                  className="bg-white/10 border-white/20 text-white"
                  data-testid="input-max-quality"
                />
              </div>
            </div>

            <Button onClick={clearFilters} variant="outline" className="border-white/30 text-white hover:bg-white/10" data-testid="button-clear-filters">
              Clear All Filters
            </Button>
          </CardContent>
        </Card>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white/10 border border-white/20">
            <TabsTrigger value="overview" className="text-white data-[state=active]:bg-white/20">Overview</TabsTrigger>
            <TabsTrigger value="states" className="text-white data-[state=active]:bg-white/20">State Comparison</TabsTrigger>
            <TabsTrigger value="drivers" className="text-white data-[state=active]:bg-white/20">Driver Performance</TabsTrigger>
            <TabsTrigger value="quality" className="text-white data-[state=active]:bg-white/20">Photo Quality</TabsTrigger>
            <TabsTrigger value="trends" className="text-white data-[state=active]:bg-white/20">Trends</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key POD Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="gradient-card border border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Total PODs</p>
                      <p className="text-3xl font-bold text-white">{analyticsData?.data?.totalPODs || 4612}</p>
                      <p className="text-sm text-green-400 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +12.5% from last month
                      </p>
                    </div>
                    <Camera className="h-8 w-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card border border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Avg Photo Quality</p>
                      <p className="text-3xl font-bold text-white">{analyticsData?.data?.summary?.avgPhotoQuality || 91.4}%</p>
                      <p className="text-sm text-green-400 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +3.2% from last month
                      </p>
                    </div>
                    <Star className="h-8 w-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card border border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">POD Completion Rate</p>
                      <p className="text-3xl font-bold text-white">{analyticsData?.data?.summary?.completionRate || 96.8}%</p>
                      <p className="text-sm text-green-400 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +1.7% from last month
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card border border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Verification Issues</p>
                      <p className="text-3xl font-bold text-white">{analyticsData?.data?.summary?.issueRate || 2.7}%</p>
                      <p className="text-sm text-green-400 flex items-center">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        -0.8% from last month
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* POD Issue Distribution */}
              <Card className="gradient-card border border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">POD Issue Distribution</CardTitle>
                  <CardDescription className="text-slate-200">
                    Common issues in proof-of-delivery process
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={podIssueDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {podIssueDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Photo Quality Breakdown */}
              <Card className="gradient-card border border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Photo Quality Distribution</CardTitle>
                  <CardDescription className="text-slate-200">
                    Breakdown of photo quality scores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={photoQualityBreakdown} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9CA3AF" />
                      <YAxis dataKey="name" type="category" width={120} stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="value" fill={(entry, index) => photoQualityBreakdown[index]?.color || '#8884d8'}>
                        {photoQualityBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* State Comparison Tab */}
          <TabsContent value="states" className="space-y-6">
            <Card className="gradient-card border border-white/20">
              <CardHeader>
                <CardTitle className="text-white">State POD Performance Comparison</CardTitle>
                <CardDescription className="text-slate-200">
                  Compare POD quality and completion rates across states
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="state" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="avgQuality" fill="#8884d8" name="Avg Photo Quality %" />
                    <Bar dataKey="photoCompletionRate" fill="#82ca9d" name="Photo Completion Rate %" />
                    <Bar dataKey="verificationRate" fill="#ffc658" name="Verification Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Detailed State Table */}
            <Card className="gradient-card border border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Detailed State POD Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-white">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-3 px-4">State</th>
                        <th className="text-left py-3 px-4">Total PODs</th>
                        <th className="text-left py-3 px-4">Photo Quality</th>
                        <th className="text-left py-3 px-4">Completion Rate</th>
                        <th className="text-left py-3 px-4">Verification Rate</th>
                        <th className="text-left py-3 px-4">Issue Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stateData.map((state, index) => (
                        <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                          <td className="py-3 px-4 font-medium">{state.state}</td>
                          <td className="py-3 px-4">{state.totalPODs.toLocaleString()}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {state.avgQuality}%
                              {state.avgQuality >= 90 ? (
                                <Star className="h-4 w-4 text-yellow-400" />
                              ) : state.avgQuality >= 85 ? (
                                <CheckCircle className="h-4 w-4 text-green-400" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-orange-400" />
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">{state.photoCompletionRate}%</td>
                          <td className="py-3 px-4">{state.verificationRate}%</td>
                          <td className="py-3 px-4">
                            <span className={`${state.issueRate < 4 ? 'text-green-400' : state.issueRate < 6 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {state.issueRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Driver Performance Tab */}
          <TabsContent value="drivers" className="space-y-6">
            <Card className="gradient-card border border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Driver POD Performance Rankings</CardTitle>
                <CardDescription className="text-slate-200">
                  Top performing drivers based on POD quality and completion metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-white">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-3 px-4">Rank</th>
                        <th className="text-left py-3 px-4">Driver</th>
                        <th className="text-left py-3 px-4">State</th>
                        <th className="text-left py-3 px-4">Deliveries</th>
                        <th className="text-left py-3 px-4">Photo Quality</th>
                        <th className="text-left py-3 px-4">POD Completion</th>
                        <th className="text-left py-3 px-4">Verification Accuracy</th>
                        <th className="text-left py-3 px-4">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverData
                        .sort((a, b) => (b.avgPhotoQuality + b.podCompletionRate) - (a.avgPhotoQuality + a.podCompletionRate))
                        .map((driver, index) => (
                        <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {index + 1}
                              {index < 3 && <Star className="h-4 w-4 text-yellow-400" />}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium">{driver.driverName}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-xs">
                              {driver.state}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">{driver.totalDeliveries}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {driver.avgPhotoQuality}%
                              {driver.avgPhotoQuality >= 95 ? (
                                <Star className="h-4 w-4 text-yellow-400" />
                              ) : driver.avgPhotoQuality >= 90 ? (
                                <CheckCircle className="h-4 w-4 text-green-400" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-orange-400" />
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">{driver.podCompletionRate}%</td>
                          <td className="py-3 px-4">{driver.verificationAccuracy}%</td>
                          <td className="py-3 px-4">
                            <span className={`${driver.totalIssues < 5 ? 'text-green-400' : driver.totalIssues < 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {driver.totalIssues}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Photo Quality Tab */}
          <TabsContent value="quality" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="gradient-card border border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Photo Quality Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-bold text-green-400">94.2%</div>
                      <div className="text-sm text-slate-200">Photos Above 80%</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-blue-400">2.3s</div>
                      <div className="text-sm text-slate-200">Avg Processing Time</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-200">Excellent (90-100%)</span>
                      <span className="text-green-400">45% of photos</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-green-400 h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-200">Good (80-89%)</span>
                      <span className="text-blue-400">32% of photos</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{ width: '32%' }}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-200">Needs Improvement (&lt;80%)</span>
                      <span className="text-orange-400">23% of photos</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-orange-400 h-2 rounded-full" style={{ width: '23%' }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card border border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Common Quality Issues</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <span className="text-sm text-slate-200">Blurry Images</span>
                    </div>
                    <span className="text-red-400">28%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                      <span className="text-sm text-slate-200">Poor Lighting</span>
                    </div>
                    <span className="text-orange-400">22%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <span className="text-sm text-slate-200">Obstructed View</span>
                    </div>
                    <span className="text-yellow-400">18%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <span className="text-sm text-slate-200">Wrong Angle</span>
                    </div>
                    <span className="text-blue-400">15%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                      <span className="text-sm text-slate-200">Incomplete Coverage</span>
                    </div>
                    <span className="text-purple-400">12%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="text-sm text-slate-200">Other Issues</span>
                    </div>
                    <span className="text-gray-400">5%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <Card className="gradient-card border border-white/20">
              <CardHeader>
                <CardTitle className="text-white">POD Quality Trends Over Time</CardTitle>
                <CardDescription className="text-slate-200">
                  Track photo quality, completion rates, and verification accuracy over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={qualityTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="photoQuality" 
                      stroke="#8884d8" 
                      strokeWidth={3}
                      name="Photo Quality %"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="completionRate" 
                      stroke="#82ca9d" 
                      strokeWidth={3}
                      name="Completion Rate %"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="verificationRate" 
                      stroke="#ffc658" 
                      strokeWidth={3}
                      name="Verification Rate %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}