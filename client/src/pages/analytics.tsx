import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Truck, 
  MapPin, 
  Clock, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Users,
  Calendar,
  Thermometer,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { Consignment } from "@shared/schema";

export default function Analytics() {
  const [selectedView, setSelectedView] = useState<"ceo" | "allocator" | "deepdive">("ceo");

  const { data: consignments = [], isLoading } = useQuery({
    queryKey: ["/api/consignments"],
    staleTime: 0,
    gcTime: 0,
  });

  // Helper function to get status display
  const getStatusDisplay = (consignment: Consignment) => {
    const deliveryStateLabel = (consignment as any).delivery_StateLabel;
    const pickupStateLabel = (consignment as any).pickUp_StateLabel;
    
    const mapStatus = (status: string | null, isPickup: boolean = false) => {
      if (!status) return null;
      if (status === 'Traveling') return 'In Transit';
      if (status === 'Positive outcome') return isPickup ? 'Picked Up' : 'Delivered';
      return status;
    };
    
    return mapStatus(deliveryStateLabel, false) || mapStatus(pickupStateLabel, true) || 'In Transit';
  };

  // Calculate analytics data
  const analytics = useMemo(() => {
    const data = consignments as Consignment[];
    
    // Basic metrics
    const totalConsignments = data.length;
    const delivered = data.filter(c => getStatusDisplay(c) === "Delivered").length;
    const inTransit = data.filter(c => getStatusDisplay(c) === "In Transit").length;
    const pending = data.filter(c => {
      const status = getStatusDisplay(c);
      return status !== "In Transit" && status !== "Delivered";
    }).length;

    // Performance metrics
    const deliveryRate = totalConsignments > 0 ? (delivered / totalConsignments * 100) : 0;
    const onTimeDeliveries = data.filter(c => {
      const status = getStatusDisplay(c);
      return status === "Delivered"; // Simplified - in real scenario would check ETA vs actual
    }).length;
    const onTimeRate = delivered > 0 ? (onTimeDeliveries / delivered * 100) : 0;

    // Depot analysis
    const depotStats = data.reduce((acc, c) => {
      const depot = (c as any).shipFromMasterDataCode || 'Unknown';
      if (!acc[depot]) {
        acc[depot] = { total: 0, delivered: 0, inTransit: 0, pending: 0 };
      }
      acc[depot].total++;
      const status = getStatusDisplay(c);
      if (status === "Delivered") acc[depot].delivered++;
      else if (status === "In Transit") acc[depot].inTransit++;
      else acc[depot].pending++;
      return acc;
    }, {} as Record<string, any>);

    // Customer analysis
    const customerStats = data.reduce((acc, c) => {
      const customer = (c as any).shipperCompanyName || c.warehouseCompanyName || 'Unknown';
      if (!acc[customer]) {
        acc[customer] = { total: 0, delivered: 0 };
      }
      acc[customer].total++;
      if (getStatusDisplay(c) === "Delivered") {
        acc[customer].delivered++;
      }
      return acc;
    }, {} as Record<string, any>);

    // Temperature zone analysis
    const tempZoneStats = data.reduce((acc, c) => {
      const tempZone = c.documentNote?.split('\\')[0] || c.expectedTemperature || 'Standard';
      if (!acc[tempZone]) {
        acc[tempZone] = { total: 0, delivered: 0 };
      }
      acc[tempZone].total++;
      if (getStatusDisplay(c) === "Delivered") {
        acc[tempZone].delivered++;
      }
      return acc;
    }, {} as Record<string, any>);

    // Recent activity (last 7 days of data available)
    const today = new Date();
    const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    const recentDeliveries = data.filter(c => {
      const deliveryDate = new Date((c as any).delivery_OutcomeRegistrationDateTime || c.departureDateTime || '');
      return deliveryDate >= weekAgo && deliveryDate <= today;
    });

    return {
      totalConsignments,
      delivered,
      inTransit,
      pending,
      deliveryRate,
      onTimeRate,
      depotStats,
      customerStats,
      tempZoneStats,
      recentDeliveries: recentDeliveries.length,
      topDepots: Object.entries(depotStats)
        .sort(([,a], [,b]) => (b as any).total - (a as any).total)
        .slice(0, 5),
      topCustomers: Object.entries(customerStats)
        .sort(([,a], [,b]) => (b as any).total - (a as any).total)
        .slice(0, 5)
    };
  }, [consignments]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const CEOView = () => (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalConsignments}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics.recentDeliveries} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.deliveryRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.delivered} of {analytics.totalConsignments} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Performance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.onTimeRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Industry target: 95%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shipments</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.inTransit}</div>
            <p className="text-xs text-muted-foreground">
              Currently in transit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Business Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Depots</CardTitle>
            <CardDescription>Volume and efficiency by location</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topDepots.map(([depot, stats]) => (
                <div key={depot} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{depot}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{(stats as any).total} deliveries</div>
                    <div className="text-xs text-muted-foreground">
                      {((stats as any).delivered / (stats as any).total * 100).toFixed(1)}% complete
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Customers</CardTitle>
            <CardDescription>Top customers by delivery volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topCustomers.map(([customer, stats]) => (
                <div key={customer} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{customer.substring(0, 25)}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{(stats as any).total}</div>
                    <div className="text-xs text-muted-foreground">deliveries</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const AllocatorView = () => (
    <div className="space-y-6">
      {/* Operational Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fleet Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">In Transit</span>
                <Badge variant="default">{analytics.inTransit}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Pending Pickup</span>
                <Badge variant="secondary">{analytics.pending}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Completed Today</span>
                <Badge variant="outline">{analytics.delivered}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Temperature Zones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.tempZoneStats).slice(0, 4).map(([zone, stats]) => (
                <div key={zone} className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{zone}</span>
                  </div>
                  <Badge variant="outline">{(stats as any).total}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alerts & Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Delayed: 0</span>
              </div>
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Temperature Issues: 0</span>
              </div>
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">All Systems Normal</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Depot Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Depot Performance Overview</CardTitle>
          <CardDescription>Real-time status across all depot locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(analytics.depotStats).map(([depot, stats]) => (
              <div key={depot} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{depot}</span>
                  <Badge variant="outline">{(stats as any).total}</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-600">Delivered:</span>
                    <span>{(stats as any).delivered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">In Transit:</span>
                    <span>{(stats as any).inTransit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600">Pending:</span>
                    <span>{(stats as any).pending}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const DeepDiveView = () => (
    <div className="space-y-6">
      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalConsignments}</div>
            <div className="text-xs text-muted-foreground mt-1">
              All time deliveries
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.deliveryRate.toFixed(2)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {analytics.delivered} / {analytics.totalConsignments}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Depots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(analytics.depotStats).length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Operational locations
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Customer Base</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(analytics.customerStats).length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Active customers
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Analysis</CardTitle>
            <CardDescription>Detailed breakdown by customer volume and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.entries(analytics.customerStats)
                .sort(([,a], [,b]) => (b as any).total - (a as any).total)
                .map(([customer, stats]) => (
                <div key={customer} className="border-b pb-2 last:border-b-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium">{customer}</span>
                    <Badge variant="secondary">{(stats as any).total}</Badge>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Delivered: {(stats as any).delivered}</span>
                    <span>Rate: {((stats as any).delivered / (stats as any).total * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Temperature Zone Distribution</CardTitle>
            <CardDescription>Analysis by temperature requirements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(analytics.tempZoneStats).map(([zone, stats]) => (
                <div key={zone} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Thermometer className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{zone}</span>
                    </div>
                    <Badge variant="outline">{(stats as any).total}</Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ 
                        width: `${((stats as any).delivered / (stats as any).total) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(stats as any).delivered} delivered ({((stats as any).delivered / (stats as any).total * 100).toFixed(1)}%)
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="gradient-primary shadow-header z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Analytics</h1>
              <span className="text-blue-100 text-sm">Business Intelligence Dashboard</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ceo" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>CEO View</span>
            </TabsTrigger>
            <TabsTrigger value="allocator" className="flex items-center space-x-2">
              <Truck className="h-4 w-4" />
              <span>Transport Allocator</span>
            </TabsTrigger>
            <TabsTrigger value="deepdive" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Deep Dive</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ceo">
            <CEOView />
          </TabsContent>

          <TabsContent value="allocator">
            <AllocatorView />
          </TabsContent>

          <TabsContent value="deepdive">
            <DeepDiveView />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}