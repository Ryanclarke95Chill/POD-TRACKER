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

  // Temperature zone analysis from multiple fields
  const temperatureZoneCounts = consignments.reduce((acc, c) => {
    const note = (c.documentNote || "").toLowerCase();
    const temp = c.expectedTemperature || "";
    const warehouseName = (c.warehouseCompanyName || "").toLowerCase();
    
    let tempZone = "Ambient"; // Default to ambient
    
    // Check various fields for temperature indicators
    if (note.includes("frozen") || note.includes("-18") || note.includes("freeze") ||
        temp.includes("frozen") || temp.includes("-18") ||
        warehouseName.includes("frozen")) {
      tempZone = "Frozen";
    } else if (note.includes("chilled") || note.includes("chill") || note.includes("2-8") || note.includes("cold") ||
               temp.includes("chilled") || temp.includes("2-8") ||
               warehouseName.includes("chill")) {
      tempZone = "Chilled";
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

  // Use qty1 and qty2 from Axylog data with proper number conversion
  const totalItems = consignments.reduce((sum, c) => {
    const qty = typeof c.qty1 === 'number' ? c.qty1 : parseInt(String(c.qty1 || 0), 10) || 0;
    return sum + qty;
  }, 0);
  
  const totalPallets = consignments.reduce((sum, c) => {
    const qty = typeof c.qty2 === 'number' ? c.qty2 : parseInt(String(c.qty2 || 0), 10) || 0;
    return sum + qty;
  }, 0);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header - exact same as dashboard */}
      <header className="gradient-primary shadow-header z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-white">ChillTrack</h1>
            <span className="ml-3 text-blue-100 text-sm">Professional Logistics Dashboard</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center text-white/90 text-sm mr-4 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              <span>api.chill@axylog.com</span>
            </div>
            <Button 
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
              onClick={() => window.location.href = '/dashboard'}
            >
              <Package className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button 
              className="gradient-accent hover:opacity-90 text-white border-0"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button 
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
              onClick={() => window.location.href = '/dashboard'}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Delivery Analytics</h1>
          <p className="text-gray-600">Real-time insights from your Axylog consignment data</p>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="gradient-card shadow-card rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Consignments</p>
                <p className="text-3xl font-bold text-gray-900">{totalConsignments.toLocaleString()}</p>
              </div>
              <div className="bg-primary/10 p-3 rounded-lg">
                <Package className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>
          
          <div className="gradient-card shadow-card rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-3xl font-bold text-blue-600">{totalItems.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="gradient-card shadow-card rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pallets</p>
                <p className="text-3xl font-bold text-green-600">{totalPallets.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <Truck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="gradient-card shadow-card rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Delivery Cities</p>
                <p className="text-3xl font-bold text-purple-600">{Object.keys(cityCounts).length}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <MapPin className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
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
      </main>
    </div>
  );
}