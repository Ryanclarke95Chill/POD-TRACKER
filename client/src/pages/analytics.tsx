import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, MapPin, Package, Truck, Calendar } from "lucide-react";
import { Consignment } from "@shared/schema";

export default function Analytics() {
  const { data: consignments = [], isLoading } = useQuery<Consignment[]>({
    queryKey: ["/api/consignments"],
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <header className="bg-primary text-white shadow-md z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">ChillTrack</h1>
              <span className="ml-4 text-white/80">Analytics</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                className="h-9 px-3 text-white hover:bg-white/10 hover:text-white"
                onClick={() => window.location.href = '/dashboard'}
              >
                Dashboard
              </Button>
              <Button 
                variant="ghost" 
                className="h-9 px-3 text-white hover:bg-white/10 hover:text-white"
                onClick={() => window.location.href = '/simple-import'}
              >
                Import Data
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Calculate analytics from Axylog data
  const totalConsignments = consignments.length;
  
  // Status breakdown using delivery_StateLabel
  const statusCounts = consignments.reduce((acc, c) => {
    const status = c.delivery_StateLabel || c.pickUp_StateLabel || "Unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Temperature zone analysis from documentNote field
  const temperatureZoneCounts = consignments.reduce((acc, c) => {
    const note = c.documentNote || "";
    let tempZone = "Unknown";
    if (note.toLowerCase().includes("frozen") || note.toLowerCase().includes("-18")) {
      tempZone = "Frozen";
    } else if (note.toLowerCase().includes("chilled") || note.toLowerCase().includes("2-8")) {
      tempZone = "Chilled";
    } else if (note.toLowerCase().includes("ambient")) {
      tempZone = "Ambient";
    }
    acc[tempZone] = (acc[tempZone] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // City distribution using shipToCity
  const cityCounts = consignments.reduce((acc, c) => {
    const city = c.shipToCity;
    if (city && city !== "Unknown") {
      acc[city] = (acc[city] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topCities = Object.entries(cityCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  // Use qty1 and qty2 from Axylog data
  const totalItems = consignments.reduce((sum, c) => sum + (c.qty1 || 0), 0);
  const totalPallets = consignments.reduce((sum, c) => sum + (c.qty2 || 0), 0);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-white">ChillTrack</h1>
            <span className="ml-4 text-white/80">Analytics</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              className="h-9 px-3 text-white hover:bg-white/10 hover:text-white"
              onClick={() => window.location.href = '/dashboard'}
            >
              Dashboard
            </Button>

          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Delivery Analytics</h1>
          <p className="text-gray-600">Insights from your imported delivery data</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Consignments</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalConsignments.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Imported delivery records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Items across all deliveries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pallets</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPallets.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Pallets managed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivery Cities</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(cityCounts).length}</div>
              <p className="text-xs text-muted-foreground">
                Unique delivery locations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Delivery Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{status}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: `${(count / totalConsignments) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Temperature Zone Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(temperatureZoneCounts).map(([zone, count]) => (
                  <div key={zone} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{zone}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${(count / totalConsignments) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Delivery Cities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Top Delivery Cities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCities.map(([city, count]) => (
                <div key={city} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{city}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${(count / Math.max(...Object.values(cityCounts))) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600">{count} deliveries</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}