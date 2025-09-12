import { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
  TrendingUp,
  TrendingDown,
  Filter,
  RefreshCw,
  Download,
  Camera,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Thermometer,
  FileSignature,
  Shield,
  Award,
  Target
} from 'lucide-react';
import type { Consignment } from '@shared/schema';

interface PODAnalyticsFilters {
  startDate: string;
  endDate: string;
  warehouse: string;
  driver: string;
  qualityFilter: string;
}

interface PODAnalyticsResponse {
  totalPODs: number;
  gateSuccessRate: number;
  avgQualityScore: number;
  componentStats: {
    photos: { passRate: number; avgCount: number };
    signature: { passRate: number };
    receiverName: { passRate: number };
    temperature: { passRate: number };
  };
  qualityDistribution: {
    gold: number; // 90-100
    silver: number; // 75-89
    bronze: number; // 60-74
    nonCompliant: number; // 0
  };
  photoDistribution: {
    zero: number;
    one: number;
    two: number;
    three: number;
    fourPlus: number;
  };
  gateFailureReasons: Array<{ reason: string; count: number; percentage: number }>;
  driverPerformance: Array<{
    name: string;
    totalDeliveries: number;
    avgScore: number;
    goldRate: number;
    gatePassRate: number;
  }>;
  warehousePerformance: Array<{
    name: string;
    totalPODs: number;
    avgScore: number;
    gatePassRate: number;
  }>;
  trends: Array<{
    date: string;
    avgScore: number;
    gatePassRate: number;
    photoComplianceRate: number;
    tempComplianceRate: number;
  }>;
}

// Chart color tokens for consistent theming
const CHART_COLORS = {
  gold: 'hsl(var(--chart-1))', // Green for high performance
  silver: 'hsl(var(--chart-2))', // Blue for good performance  
  bronze: 'hsl(var(--chart-3))', // Orange for fair performance
  nonCompliant: 'hsl(var(--chart-5))', // Red for non-compliant
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--chart-4))', // Purple
  accent: 'hsl(var(--chart-6))' // Cyan
};

// Quality tier definitions matching POD quality page
const QUALITY_TIERS = {
  gold: { min: 90, max: 100, label: 'Gold (90-100)', color: CHART_COLORS.gold },
  silver: { min: 75, max: 89, label: 'Silver (75-89)', color: CHART_COLORS.silver },
  bronze: { min: 60, max: 74, label: 'Bronze (60-74)', color: CHART_COLORS.bronze },
  nonCompliant: { min: 0, max: 0, label: 'Non-Compliant', color: CHART_COLORS.nonCompliant }
};

// POD Analysis Helper Functions (mirrored from POD quality page)
const getRequiredPhotoCount = (consignment: Consignment): { min: number; max: number; description: string } => {
  const pallets = Number(consignment.qty2) || 0;
  const cartons = Number(consignment.qty1) || 0;
  
  if (pallets > 0 && cartons > 0) {
    if (pallets === 1) return { min: 2, max: 2, description: '2 photos required for 1 pallet' };
    if (pallets >= 2 && pallets <= 3) return { min: 3, max: 3, description: `3 photos minimum for ${pallets} pallets` };
    if (pallets > 3) return { min: 4, max: 4, description: `4 photos minimum for ${pallets} pallets` };
  }
  
  if (pallets > 0) {
    if (pallets === 1) return { min: 2, max: 2, description: '2 photos required for 1 pallet' };
    if (pallets >= 2 && pallets <= 3) return { min: 3, max: 3, description: `3 photos minimum for ${pallets} pallets` };
    if (pallets > 3) return { min: 4, max: 4, description: `4 photos minimum for ${pallets} pallets` };
  }
  
  if (cartons > 0) {
    if (cartons >= 1 && cartons <= 10) return { min: 1, max: 2, description: `1-2 photos for ${cartons} cartons` };
    if (cartons > 10) return { min: 3, max: 3, description: `3 photos minimum for ${cartons} cartons` };
  }
  
  return { min: 3, max: 3, description: '3 photos minimum (default)' };
};

const countPhotos = (consignment: Consignment): number => {
  const deliveryFileCount = (consignment as any).deliveryReceivedFileCount || 0;
  const pickupFileCount = (consignment as any).pickupReceivedFileCount || 0;
  let count = Number(deliveryFileCount) + Number(pickupFileCount);
  
  if (consignment.deliverySignatureName && deliveryFileCount > 0) count = Math.max(0, count - 1);
  if (consignment.pickupSignatureName && pickupFileCount > 0) count = Math.max(0, count - 1);
  
  return count;
};

const checkTemperatureCompliance = (consignment: Consignment): boolean => {
  const actualTemp = (consignment as any).delivery_Temperature;
  const expectedTemp = (consignment as any).shipmentExpectedTemperatureRange;
  
  if (!actualTemp || !expectedTemp) return true; // No temp data = compliant
  
  // Parse temperature range from expected
  const parseRange = (label: string) => {
    const patterns = [
      /(-?\d+(?:\.\d+)?)\s*°?C?\s+to\s+(-?\d+(?:\.\d+)?)\s*°?C?/i,
      /(-?\d+(?:\.\d+)?)\s*to\s+(-?\d+(?:\.\d+)?)\s*°?C/i,
      /(-?\d+(?:\.\d+)?)\s*°?C?\s*-\s*(-?\d+(?:\.\d+)?)\s*°?C?/i
    ];
    
    for (const pattern of patterns) {
      const match = label.match(pattern);
      if (match) {
        const val1 = parseFloat(match[1]);
        const val2 = parseFloat(match[2]);
        return { min: Math.min(val1, val2), max: Math.max(val1, val2) };
      }
    }
    return null;
  };
  
  const range = parseRange(expectedTemp);
  if (!range) return true;
  
  const actual = parseFloat(actualTemp);
  return !isNaN(actual) && actual >= range.min && actual <= range.max;
};

const passesGates = (consignment: Consignment): { ok: boolean; missing: string[] } => {
  const missing: string[] = [];
  
  if (!consignment.deliverySignatureName) missing.push('Signature present');
  
  const receiverName = consignment.deliverySignatureName?.trim();
  if (!receiverName || receiverName.length < 2) missing.push('Receiver name present');
  
  if (!checkTemperatureCompliance(consignment)) missing.push('Temperature compliance requirement');
  
  const photoCount = countPhotos(consignment);
  const photoRequirement = getRequiredPhotoCount(consignment);
  if (photoCount < photoRequirement.min) missing.push(`Photos requirement (${photoRequirement.description})`);
  
  return { ok: missing.length === 0, missing };
};

const calculatePODAnalytics = (analyses: any[]): PODAnalyticsResponse => {
  const total = analyses.length;
  if (total === 0) {
    return {
      totalPODs: 0, gateSuccessRate: 0, avgQualityScore: 0,
      componentStats: { photos: { passRate: 0, avgCount: 0 }, signature: { passRate: 0 }, receiverName: { passRate: 0 }, temperature: { passRate: 0 } },
      qualityDistribution: { gold: 0, silver: 0, bronze: 0, nonCompliant: 0 },
      photoDistribution: { zero: 0, one: 0, two: 0, three: 0, fourPlus: 0 },
      gateFailureReasons: [], driverPerformance: [], warehousePerformance: [], trends: []
    };
  }
  
  const gatesPassed = analyses.filter(a => a.metrics.gatesPassed).length;
  const avgScore = analyses.reduce((sum, a) => sum + a.metrics.qualityScore, 0) / total;
  
  const gold = analyses.filter(a => a.metrics.qualityScore >= 90).length;
  const silver = analyses.filter(a => a.metrics.qualityScore >= 75 && a.metrics.qualityScore < 90).length;
  const bronze = analyses.filter(a => a.metrics.qualityScore >= 60 && a.metrics.qualityScore < 75).length;
  const nonCompliant = analyses.filter(a => a.metrics.qualityScore === 0).length;
  
  const photoStats = { passRate: 0, avgCount: 0 };
  const signatureStats = { passRate: 0 };
  const receiverNameStats = { passRate: 0 };
  const temperatureStats = { passRate: 0 };
  
  let totalPhotos = 0;
  analyses.forEach(a => {
    totalPhotos += a.metrics.photoCount;
    if (a.metrics.hasSignature) signatureStats.passRate++;
    if (a.metrics.hasReceiverName) receiverNameStats.passRate++;
    if (a.metrics.temperatureCompliant) temperatureStats.passRate++;
  });
  
  photoStats.avgCount = totalPhotos / total;
  photoStats.passRate = (analyses.filter(a => a.metrics.photoCount >= getRequiredPhotoCount(a.consignment).min).length / total) * 100;
  signatureStats.passRate = (signatureStats.passRate / total) * 100;
  receiverNameStats.passRate = (receiverNameStats.passRate / total) * 100;
  temperatureStats.passRate = (temperatureStats.passRate / total) * 100;
  
  // Photo distribution
  const photoDistribution = {
    zero: analyses.filter(a => a.metrics.photoCount === 0).length,
    one: analyses.filter(a => a.metrics.photoCount === 1).length,
    two: analyses.filter(a => a.metrics.photoCount === 2).length,
    three: analyses.filter(a => a.metrics.photoCount === 3).length,
    fourPlus: analyses.filter(a => a.metrics.photoCount >= 4).length
  };
  
  return {
    totalPODs: total,
    gateSuccessRate: (gatesPassed / total) * 100,
    avgQualityScore: avgScore,
    componentStats: {
      photos: photoStats,
      signature: signatureStats,
      receiverName: receiverNameStats,
      temperature: temperatureStats
    },
    qualityDistribution: {
      gold: (gold / total) * 100,
      silver: (silver / total) * 100,
      bronze: (bronze / total) * 100,
      nonCompliant: (nonCompliant / total) * 100
    },
    photoDistribution,
    gateFailureReasons: [],
    driverPerformance: [],
    warehousePerformance: [],
    trends: []
  };
};

export default function PODAnalytics() {
  const [filters, setFilters] = useState<PODAnalyticsFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    warehouse: 'all',
    driver: 'all',
    qualityFilter: 'all'
  });

  // Fetch real consignments and run POD analysis
  const { data: consignments, isLoading: loadingConsignments, refetch } = useQuery({
    queryKey: ['consignments'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/consignments');
      return await response.json();
    }
  });

  // Process consignments through POD quality analysis
  const podAnalytics = useMemo(() => {
    if (!consignments) return null;

    // Analyze each consignment using POD quality functions (mirrored from POD quality page)
    const analyses = consignments.map((consignment: Consignment) => {
      const photoCount = countPhotos(consignment);
      const hasSignature = Boolean(consignment.deliverySignatureName);
      const hasReceiverName = Boolean(consignment.deliverySignatureName?.trim() && consignment.deliverySignatureName.trim().length > 1);
      const temperatureCompliant = checkTemperatureCompliance(consignment);
      const gateCheck = passesGates(consignment);
      
      // Calculate quality score using same logic as POD quality page
      let qualityScore = 0;
      if (gateCheck.ok) {
        const photoRequirement = getRequiredPhotoCount(consignment);
        let score = 0;
        
        // Photos (40 points) 
        if (photoCount >= photoRequirement.min) {
          score += 35 + Math.min(5, photoCount - photoRequirement.min);
        }
        
        // Signature (20 points)
        if (hasSignature) score += 20;
        
        // Receiver name (15 points)  
        if (hasReceiverName) score += 15;
        
        // Temperature compliance (25 points)
        if (temperatureCompliant) score += 25;
        
        qualityScore = Math.min(100, score);
      }
      
      return {
        consignment,
        metrics: {
          photoCount,
          hasSignature,
          hasReceiverName,
          temperatureCompliant,
          qualityScore,
          gatesPassed: gateCheck.ok,
          gateFailures: gateCheck.missing,
          deliveryTime: consignment.delivery_OutcomeDateTime
        }
      };
    });

    // Apply filters
    const filteredAnalyses = analyses.filter(analysis => {
      // Date range filter
      if (filters.startDate && filters.endDate) {
        const deliveryTime = analysis.metrics.deliveryTime;
        if (deliveryTime) {
          const utcDate = new Date(deliveryTime);
          const aestDate = new Date(utcDate.getTime() + (10 * 60 * 60 * 1000));
          const dateString = aestDate.toISOString().split('T')[0];
          if (dateString < filters.startDate || dateString > filters.endDate) return false;
        }
      }
      
      // Warehouse filter
      if (filters.warehouse !== 'all') {
        if ((analysis.consignment as any).shipFromCompanyName !== filters.warehouse) return false;
      }
      
      // Driver filter
      if (filters.driver !== 'all') {
        if (analysis.consignment.driverName !== filters.driver) return false;
      }
      
      // Quality filter
      if (filters.qualityFilter !== 'all') {
        const score = analysis.metrics.qualityScore;
        switch (filters.qualityFilter) {
          case 'gold': return score >= 90;
          case 'silver': return score >= 75 && score < 90;
          case 'bronze': return score >= 60 && score < 75;
          case 'non-compliant': return score === 0;
          default: return true;
        }
      }
      
      return true;
    });

    // Calculate comprehensive analytics from filtered data
    return calculatePODAnalytics(filteredAnalyses);
  }, [consignments, filters]);

  const isLoading = loadingConsignments;

  // Get available filter options from consignments
  const filterOptions = useMemo(() => {
    if (!consignments) return { warehouses: [], drivers: [] };
    
    const warehouses = [...new Set(consignments.map((c: Consignment) => (c as any).shipFromCompanyName).filter(Boolean))];
    const drivers = [...new Set(consignments.map((c: Consignment) => c.driverName).filter(Boolean))];
    
    return { warehouses, drivers };
  }, [consignments]);

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
    <div className="min-h-screen bg-background">
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
        <Card className="mb-8 bg-card border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Filter className="h-5 w-5" />
              Smart Filters
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Customize your POD analytics view with advanced filtering options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-card-foreground mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="bg-input border text-foreground"
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-card-foreground mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="bg-input border text-foreground"
                  data-testid="input-end-date"
                />
              </div>
            </div>

            {/* Warehouse Filter */}
            <div>
              <label className="text-sm font-medium text-card-foreground mb-2 block">Warehouse</label>
              <Select value={filters.warehouse} onValueChange={(value) => setFilters(prev => ({ ...prev, warehouse: value }))}>
                <SelectTrigger className="bg-input border text-foreground" data-testid="select-warehouse">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {filterOptions.warehouses.map(warehouse => (
                    <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Driver Filter */}
            <div>
              <label className="text-sm font-medium text-card-foreground mb-2 block">Driver</label>
              <Select value={filters.driver} onValueChange={(value) => setFilters(prev => ({ ...prev, driver: value }))}>
                <SelectTrigger className="bg-input border text-foreground" data-testid="select-driver">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {filterOptions.drivers.map(driver => (
                    <SelectItem key={driver} value={driver}>{driver}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quality Tier Filter */}
            <div>
              <label className="text-sm font-medium text-card-foreground mb-2 block">Quality Tier</label>
              <Select value={filters.qualityFilter} onValueChange={(value) => setFilters(prev => ({ ...prev, qualityFilter: value }))}>
                <SelectTrigger className="bg-input border text-foreground" data-testid="select-quality">
                  <SelectValue placeholder="Select quality tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quality Levels</SelectItem>
                  <SelectItem value="gold">Gold (90-100)</SelectItem>
                  <SelectItem value="silver">Silver (75-89)</SelectItem>
                  <SelectItem value="bronze">Bronze (60-74)</SelectItem>
                  <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setFilters({ startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], warehouse: 'all', driver: 'all', qualityFilter: 'all' })} variant="outline" className="border text-foreground hover:bg-accent hover:text-accent-foreground" data-testid="button-clear-filters">
              Clear All Filters
            </Button>
          </CardContent>
        </Card>

        {/* POD Quality Analytics Results */}
        {isLoading ? (
          <Card className="bg-card border shadow-sm">
            <CardContent className="p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Analyzing POD quality data...</p>
            </CardContent>
          </Card>
        ) : podAnalytics ? (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-lg">
              <TabsTrigger value="overview" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">POD Overview</TabsTrigger>
              <TabsTrigger value="quality" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Quality Analysis</TabsTrigger>
              <TabsTrigger value="components" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Components</TabsTrigger>
            </TabsList>

            {/* POD Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Key POD Quality Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-card border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total PODs</p>
                        <p className="text-3xl font-bold text-card-foreground">{podAnalytics.totalPODs}</p>
                        <p className="text-xs text-muted-foreground mt-1">Filtered results</p>
                      </div>
                      <Target className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Gate Success Rate</p>
                        <p className="text-3xl font-bold text-card-foreground">{podAnalytics.gateSuccessRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Meets all requirements</p>
                      </div>
                      <Shield className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Avg Quality Score</p>
                        <p className="text-3xl font-bold text-card-foreground">{podAnalytics.avgQualityScore.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Out of 100 points</p>
                      </div>
                      <Award className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Photo Compliance</p>
                        <p className="text-3xl font-bold text-card-foreground">{podAnalytics.componentStats.photos.passRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Avg: {podAnalytics.componentStats.photos.avgCount.toFixed(1)} photos</p>
                      </div>
                      <Camera className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quality Distribution Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center text-card-foreground">
                      <Award className="h-5 w-5 mr-2" />
                      Quality Tier Distribution
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      POD quality scores grouped by performance tiers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Gold (90-100)', value: podAnalytics.qualityDistribution.gold, color: CHART_COLORS.gold },
                            { name: 'Silver (75-89)', value: podAnalytics.qualityDistribution.silver, color: CHART_COLORS.silver },
                            { name: 'Bronze (60-74)', value: podAnalytics.qualityDistribution.bronze, color: CHART_COLORS.bronze },
                            { name: 'Non-Compliant', value: podAnalytics.qualityDistribution.nonCompliant, color: CHART_COLORS.nonCompliant }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: 'Gold (90-100)', value: podAnalytics.qualityDistribution.gold, color: CHART_COLORS.gold },
                            { name: 'Silver (75-89)', value: podAnalytics.qualityDistribution.silver, color: CHART_COLORS.silver },
                            { name: 'Bronze (60-74)', value: podAnalytics.qualityDistribution.bronze, color: CHART_COLORS.bronze },
                            { name: 'Non-Compliant', value: podAnalytics.qualityDistribution.nonCompliant, color: CHART_COLORS.nonCompliant }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

              {/* Photo Quality Components Breakdown */}
              <Card className="bg-card border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center text-card-foreground">
                    <Camera className="h-5 w-5 mr-2" />
                    Photo Distribution Analysis
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Number of photos captured per POD delivery
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { name: '0 Photos', value: podAnalytics.photoDistribution.zero },
                      { name: '1 Photo', value: podAnalytics.photoDistribution.one },
                      { name: '2 Photos', value: podAnalytics.photoDistribution.two },
                      { name: '3 Photos', value: podAnalytics.photoDistribution.three },
                      { name: '4+ Photos', value: podAnalytics.photoDistribution.fourPlus }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="fill-muted-foreground" />
                      <YAxis className="fill-muted-foreground" />
                      <Tooltip />
                      <Bar dataKey="value" fill={CHART_COLORS.primary} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* State Comparison Tab */}
          <TabsContent value="states" className="space-y-6">
            <Card className="bg-card border shadow-sm">
              <CardHeader>
                <CardTitle className="text-card-foreground">State POD Performance Comparison</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Compare POD quality and completion rates across states
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                    <XAxis dataKey="state" stroke="hsl(var(--chart-axis))" fontSize={12} />
                    <YAxis stroke="hsl(var(--chart-axis))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--card-foreground))'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="avgQuality" fill={COLORS[1]} name="Avg Photo Quality %" />
                    <Bar dataKey="photoCompletionRate" fill={COLORS[0]} name="Photo Completion Rate %" />
                    <Bar dataKey="verificationRate" fill={COLORS[2]} name="Verification Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Detailed State Table */}
            <Card className="bg-card border shadow-sm">
              <CardHeader>
                <CardTitle className="text-card-foreground">Detailed State POD Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-card-foreground">
                    <thead>
                      <tr className="border-b border-border">
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
                        <tr key={index} className="border-b border-border/50 hover:bg-muted/50">
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
            <Card className="bg-card border shadow-sm">
              <CardHeader>
                <CardTitle className="text-card-foreground">Driver POD Performance Rankings</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Top performing drivers based on POD quality and completion metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-card-foreground">
                    <thead>
                      <tr className="border-b border-border">
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
                        <tr key={index} className="border-b border-border/50 hover:bg-muted/50">
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
              <Card className="bg-card border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Photo Quality Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-bold text-green-400">94.2%</div>
                      <div className="text-sm text-muted-foreground">Photos Above 80%</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-blue-400">2.3s</div>
                      <div className="text-sm text-muted-foreground">Avg Processing Time</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Excellent (90-100%)</span>
                      <span className="text-green-400">45% of photos</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-green-400 h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Good (80-89%)</span>
                      <span className="text-blue-400">32% of photos</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{ width: '32%' }}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Needs Improvement (&lt;80%)</span>
                      <span className="text-orange-400">23% of photos</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-orange-400 h-2 rounded-full" style={{ width: '23%' }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Common Quality Issues</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Blurry Images</span>
                    </div>
                    <span className="text-red-400">28%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Poor Lighting</span>
                    </div>
                    <span className="text-orange-400">22%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Obstructed View</span>
                    </div>
                    <span className="text-yellow-400">18%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Wrong Angle</span>
                    </div>
                    <span className="text-blue-400">15%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Incomplete Coverage</span>
                    </div>
                    <span className="text-purple-400">12%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Other Issues</span>
                    </div>
                    <span className="text-gray-400">5%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <Card className="bg-card border shadow-sm">
              <CardHeader>
                <CardTitle className="text-card-foreground">POD Quality Trends Over Time</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Track photo quality, completion rates, and verification accuracy over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={qualityTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                    <XAxis dataKey="date" stroke="hsl(var(--chart-axis))" fontSize={12} />
                    <YAxis stroke="hsl(var(--chart-axis))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--card-foreground))'
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

          {/* Components Tab */}
          <TabsContent value="components" className="space-y-6">
            <Card className="bg-card border shadow-sm">
              <CardHeader>
                <CardTitle className="text-card-foreground">Component Pass Rates</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Breakdown of POD quality requirements and compliance rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={[
                    { name: 'Photos', rate: podAnalytics?.componentStats.photos.passRate || 0, color: CHART_COLORS.primary },
                    { name: 'Signature', rate: podAnalytics?.componentStats.signature.passRate || 0, color: CHART_COLORS.secondary },
                    { name: 'Receiver Name', rate: podAnalytics?.componentStats.receiverName.passRate || 0, color: CHART_COLORS.accent },
                    { name: 'Temperature', rate: podAnalytics?.componentStats.temperature.passRate || 0, color: CHART_COLORS.gold }
                  ]} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} className="fill-muted-foreground" />
                    <YAxis dataKey="name" type="category" width={100} className="fill-muted-foreground" />
                    <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Pass Rate']} />
                    <Bar dataKey="rate" fill={CHART_COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        ) : (
          <Card className="bg-card border shadow-sm">
            <CardContent className="p-12 text-center">
              <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-card-foreground mb-2">No Data Available</p>
              <p className="text-muted-foreground">Unable to load POD analytics data. Please check your filters and try again.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}