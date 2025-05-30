import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  ArrowLeft,
  Filter,
  X
} from "lucide-react";
import { Link } from "wouter";
import { Consignment } from "@shared/schema";

// Download functionality
const downloadData = (data: any[], format: 'csv' | 'xlsx', filename: string) => {
  const headers = [
    'Consignment No',
    'From',
    'To',
    'Status',
    'Driver',
    'Vehicle',
    'Temperature Zone',
    'Delivery Date',
    'Depot'
  ];

  const csvData = data.map(item => [
    (item as any).consignmentNo || '',
    (item as any).shipFromCompanyName || '',
    (item as any).shipToCompanyName || '',
    (item as any).delivery_StateLabel || '',
    (item as any).driverName || 'Unassigned',
    (item as any).tractorPlateNumber || (item as any).plateNumber || '',
    (item as any).temperatureZone || '',
    (item as any).contextPlannedDeliveryDateTime || '',
    (item as any).warehouseCompanyName || (item as any).shipFromCompanyName || ''
  ]);

  if (format === 'csv') {
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } else {
    // For Excel format, we'll use the same CSV approach but with .xlsx extension
    // In a real app, you'd use a library like xlsx or exceljs
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }
};

// Component to show all deliveries breakdown
function AllDeliveriesBreakdown({ consignments }: { consignments: Consignment[] }) {
  const statusCounts = consignments.reduce((acc, c) => {
    const deliveryState = (c as any).delivery_StateLabel;
    const status = deliveryState === 'Positive outcome' ? 'Completed' :
                  deliveryState === 'Delivered' ? 'Completed' :
                  deliveryState === 'Not delivered' ? 'Failed' :
                  deliveryState === 'Traveling' ? 'In Transit' : 'Other';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4 text-sm">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="text-center">
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-muted-foreground">{status}</div>
          </div>
        ))}
      </div>
      <div className="max-h-96 overflow-y-auto space-y-2">
        {consignments.slice(0, 50).map((consignment, index) => (
          <div key={index} className="p-2 border rounded">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{(consignment as any).consignmentNo}</div>
                <div className="text-xs text-muted-foreground">
                  {(consignment as any).shipFromCompanyName} → {(consignment as any).shipToCompanyName}
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {(consignment as any).delivery_StateLabel || 'Unknown'}
              </Badge>
            </div>
          </div>
        ))}
        {consignments.length > 50 && (
          <div className="text-center space-y-3">
            <div className="text-muted-foreground text-sm">
              Showing first 50 of {consignments.length} deliveries
            </div>
            <div className="text-sm font-medium">Want to see more?</div>
            <div className="flex justify-center gap-2 flex-wrap">
              <Link href="/view-all?type=all">
                <Button variant="default" size="sm">
                  View All Data
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => downloadData(consignments, 'csv', 'all-deliveries')}
              >
                Download CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => downloadData(consignments, 'xlsx', 'all-deliveries')}
              >
                Download Excel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Component to show delivery rate breakdown
function DeliveryRateBreakdown({ consignments }: { consignments: Consignment[] }) {
  const delivered = consignments.filter(c => (c as any).delivery_StateLabel === 'Positive outcome');
  const pending = consignments.filter(c => (c as any).delivery_StateLabel !== 'Positive outcome');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">{delivered.length}</div>
          <div className="text-muted-foreground">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-amber-600">{pending.length}</div>
          <div className="text-muted-foreground">Pending</div>
        </div>
      </div>
      {/* Combined View Option */}
      <div className="text-center pb-4 border-b mb-4">
        <div className="text-sm font-medium mb-2">Want to see all data together?</div>
        <Link href="/view-all?type=all&status=all">
          <Button variant="secondary" size="sm">
            View Combined Data
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium text-green-600 mb-2">Completed Deliveries</h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {delivered.slice(0, 20).map((consignment, index) => (
              <div key={index} className="p-2 bg-green-50 border-l-4 border-green-200 rounded">
                <div className="font-medium text-sm">{(consignment as any).consignmentNo}</div>
                <div className="text-xs text-muted-foreground">
                  {(consignment as any).shipFromCompanyName} → {(consignment as any).shipToCompanyName}
                </div>
              </div>
            ))}
            {delivered.length > 20 && (
              <div className="text-center pt-2 space-y-2">
                <div className="text-xs text-muted-foreground">
                  Showing 20 of {delivered.length} completed deliveries
                </div>
                <div className="text-xs font-medium">Want to see more?</div>
                <div className="flex justify-center gap-2 flex-wrap">
                  <Link href="/view-all?type=completed">
                    <Button variant="default" size="sm">
                      View All Completed
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadData(delivered, 'csv', 'completed-deliveries')}
                  >
                    Download CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadData(delivered, 'xlsx', 'completed-deliveries')}
                  >
                    Download Excel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <h4 className="font-medium text-amber-600 mb-2">Pending Deliveries</h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {pending.slice(0, 20).map((consignment, index) => (
              <div key={index} className="p-2 bg-amber-50 border-l-4 border-amber-200 rounded">
                <div className="font-medium text-sm">{(consignment as any).consignmentNo}</div>
                <div className="text-xs text-muted-foreground">
                  {(consignment as any).shipFromCompanyName} → {(consignment as any).shipToCompanyName}
                </div>
                <div className="text-xs text-amber-700">
                  Status: {(consignment as any).delivery_StateLabel || 'Unknown'}
                </div>
              </div>
            ))}
            {pending.length > 20 && (
              <div className="text-center pt-2 space-y-2">
                <div className="text-xs text-muted-foreground">
                  Showing 20 of {pending.length} pending deliveries
                </div>
                <div className="text-xs font-medium">Want to see more?</div>
                <div className="flex justify-center gap-2 flex-wrap">
                  <Link href="/view-all?type=pending">
                    <Button variant="default" size="sm">
                      View All Pending
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadData(pending, 'csv', 'pending-deliveries')}
                  >
                    Download CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadData(pending, 'xlsx', 'pending-deliveries')}
                  >
                    Download Excel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Component to show depot breakdown
function DepotBreakdown({ consignments, depotName }: { consignments: Consignment[]; depotName: string }) {
  const depotConsignments = consignments.filter(c => 
    (c as any).shipFromMasterDataCode === depotName || 
    (c as any).warehouseMasterDataCode === depotName ||
    (c as any).shipFromCompanyName?.includes(depotName) || 
    (c as any).warehouseCompanyName?.includes(depotName)
  );

  const statusCounts = depotConsignments.reduce((acc, c) => {
    const status = (c as any).delivery_StateLabel === 'Positive outcome' ? 'delivered' : 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { delivered: 0, pending: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold">{depotConsignments.length}</div>
          <div className="text-muted-foreground">Total</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">{statusCounts.delivered}</div>
          <div className="text-muted-foreground">Delivered</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-600">{statusCounts.pending}</div>
          <div className="text-muted-foreground">Pending</div>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto space-y-2">
        {depotConsignments.map((consignment, index) => (
          <div key={index} className="p-2 border rounded">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{(consignment as any).consignmentNo}</div>
                <div className="text-xs text-muted-foreground">
                  To: {(consignment as any).shipToCompanyName}
                </div>
                <div className="text-xs text-muted-foreground">
                  Driver: {(consignment as any).driverName || 'Unassigned'}
                </div>
              </div>
              <Badge variant={(consignment as any).delivery_StateLabel === 'Positive outcome' ? 'secondary' : 'outline'} className="text-xs">
                {(consignment as any).delivery_StateLabel || 'Unknown'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Component to show detailed delivery breakdown for a driver
function DriverDeliveryDetails({ driverName, consignments, filterType = "all" }: { 
  driverName: string; 
  consignments: Consignment[]; 
  filterType?: "all" | "completed" | "active" | "failed" 
}) {
  const driverConsignments = consignments.filter(c => 
    (c as any).driverName === driverName || ((c as any).driverName === null && driverName === 'Unassigned')
  );

  const getDeliveryStatus = (consignment: Consignment) => {
    const deliveryState = (consignment as any).delivery_StateLabel;
    const pickupState = (consignment as any).pickUp_StateLabel;
    
    if (deliveryState === 'Positive outcome') return { status: 'Completed', type: 'success' };
    if (deliveryState === 'Delivered') return { status: 'Completed', type: 'success' };
    if (deliveryState === 'Not delivered') return { status: 'Failed to Deliver', type: 'failure', reason: deliveryState };
    if (deliveryState === 'GPS not present') return { status: 'GPS Issue', type: 'failure', reason: deliveryState };
    if (pickupState === 'Not picked up') return { status: 'Failed to Pickup', type: 'failure', reason: pickupState };
    if (deliveryState === 'Traveling' || pickupState === 'Traveling') return { status: 'In Transit', type: 'active' };
    if (deliveryState === 'Arrived') return { status: 'Arrived at Destination', type: 'active' };
    
    return { status: deliveryState || pickupState || 'Unknown', type: 'unknown' };
  };

  const statusBreakdown = driverConsignments.reduce((acc, consignment) => {
    const { status, type, reason } = getDeliveryStatus(consignment);
    if (!acc[type]) acc[type] = [];
    acc[type].push({ consignment, status, reason });
    return acc;
  }, {} as Record<string, Array<{ consignment: Consignment; status: string; reason?: string }>>);

  // Filter based on filterType
  const getFilteredData = () => {
    switch (filterType) {
      case "completed":
        return statusBreakdown.success || [];
      case "active":
        return statusBreakdown.active || [];
      case "failed":
        return statusBreakdown.failure || [];
      default:
        return Object.values(statusBreakdown).flat();
    }
  };

  const filteredData = getFilteredData();

  return (
    <div className="space-y-4">
      {filterType === "all" && (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{statusBreakdown.success?.length || 0}</div>
            <div className="text-muted-foreground">Successful</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{statusBreakdown.failure?.length || 0}</div>
            <div className="text-muted-foreground">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{statusBreakdown.active?.length || 0}</div>
            <div className="text-muted-foreground">Active</div>
          </div>
        </div>
      )}

      {/* Display filtered deliveries */}
      <div>
        <h4 className="font-medium mb-2 flex items-center gap-2">
          {filterType === "completed" && <CheckCircle className="h-4 w-4 text-green-600" />}
          {filterType === "active" && <Truck className="h-4 w-4 text-blue-600" />}
          {filterType === "failed" && <AlertTriangle className="h-4 w-4 text-red-600" />}
          {filterType === "all" && <Package className="h-4 w-4" />}
          {filterType === "completed" && `Completed Deliveries (${filteredData.length})`}
          {filterType === "active" && `Active Deliveries (${filteredData.length})`}
          {filterType === "failed" && `Failed Deliveries (${filteredData.length})`}
          {filterType === "all" && `All Deliveries (${filteredData.length})`}
        </h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredData.map(({ consignment, status, reason }, index) => (
            <div key={index} className={`p-3 rounded border-l-4 ${
              filterType === "completed" || (filterType === "all" && status === "Delivered") ? "bg-green-50 border-green-200" :
              filterType === "failed" || (filterType === "all" && (status.includes("Failed") || status.includes("GPS"))) ? "bg-red-50 border-red-200" :
              "bg-blue-50 border-blue-200"
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm">{(consignment as any).consignmentNo}</div>
                  <div className="text-xs text-muted-foreground">
                    {(consignment as any).shipFromCompanyName} → {(consignment as any).shipToCompanyName}
                  </div>
                  {(consignment as any).delivery_PlannedETA && (
                    <div className="text-xs text-muted-foreground">
                      ETA: {new Date((consignment as any).delivery_PlannedETA).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <Badge variant={
                  status === "Delivered" ? "secondary" :
                  status.includes("Failed") || status.includes("GPS") ? "destructive" :
                  "outline"
                } className="text-xs">
                  {status}
                </Badge>
              </div>
              {reason && (
                <div className="text-xs text-red-700 mt-1">Reason: {reason}</div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default function Analytics() {
  const [selectedView, setSelectedView] = useState<"ceo" | "allocator" | "deepdive">("ceo");
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    status: "all",
    depot: "all",
    driver: "all"
  });

  const { data: consignments = [], isLoading } = useQuery({
    queryKey: ["/api/consignments"],
    staleTime: 0,
    gcTime: 0,
  });

  // Filter consignments based on current filters
  const filteredConsignments = useMemo(() => {
    let filtered = consignments as Consignment[];

    // Date filtering
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter(c => {
        const consignmentDate = (c as any).departureDateTime || (c as any).delivery_PlannedETA;
        if (!consignmentDate) return true;
        
        const date = new Date(consignmentDate).toISOString().split('T')[0];
        const fromMatch = !filters.dateFrom || date >= filters.dateFrom;
        const toMatch = !filters.dateTo || date <= filters.dateTo;
        return fromMatch && toMatch;
      });
    }

    // Status filtering
    if (filters.status !== "all") {
      filtered = filtered.filter(c => {
        const deliveryState = (c as any).delivery_StateLabel;
        const pickupState = (c as any).pickUp_StateLabel;
        
        if (filters.status === "delivered") return deliveryState === 'Positive outcome';
        if (filters.status === "failed") return deliveryState === 'Not delivered' || deliveryState === 'GPS not present' || pickupState === 'Not picked up';
        if (filters.status === "active") return deliveryState === 'Traveling' || pickupState === 'Traveling';
        return true;
      });
    }

    // Depot filtering
    if (filters.depot !== "all") {
      filtered = filtered.filter(c => 
        (c as any).shipFromCompanyName?.includes(filters.depot) || 
        (c as any).warehouseCompanyName?.includes(filters.depot)
      );
    }

    // Driver filtering
    if (filters.driver !== "all") {
      filtered = filtered.filter(c => (c as any).driverName === filters.driver);
    }

    return filtered;
  }, [consignments, filters]);

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

  // Get unique values for filter dropdowns
  const uniqueDepots = useMemo(() => {
    const depots = new Set<string>();
    (consignments as Consignment[]).forEach(c => {
      const depot = (c as any).shipFromCompanyName || (c as any).warehouseCompanyName;
      if (depot) depots.add(depot);
    });
    return Array.from(depots).sort();
  }, [consignments]);

  const uniqueDrivers = useMemo(() => {
    const drivers = new Set<string>();
    (consignments as Consignment[]).forEach(c => {
      const driver = (c as any).driverName;
      if (driver) drivers.add(driver);
    });
    return Array.from(drivers).sort();
  }, [consignments]);

  // Calculate analytics data using filtered data
  const analytics = useMemo(() => {
    const data = filteredConsignments;
    
    // Basic metrics
    const totalConsignments = data.length;
    const completed = data.filter(c => getStatusDisplay(c) === "Completed").length;
    const inTransit = data.filter(c => getStatusDisplay(c) === "In Transit").length;
    const failed = data.filter(c => {
      const status = getStatusDisplay(c);
      return status.includes("Failed") || status === "GPS Issue" || status === "Not delivered";
    }).length;
    const pending = data.filter(c => {
      const status = getStatusDisplay(c);
      return status !== "In Transit" && status !== "Completed" && !status.includes("Failed") && status !== "GPS Issue" && status !== "Not delivered";
    }).length;

    // Performance metrics
    const completionRate = totalConsignments > 0 ? (completed / totalConsignments * 100) : 0;
    const onTimeDeliveries = data.filter(c => {
      const status = getStatusDisplay(c);
      return status === "Completed"; // Simplified - in real scenario would check ETA vs actual
    }).length;
    const onTimeRate = completed > 0 ? (onTimeDeliveries / completed * 100) : 0;

    // Depot analysis
    const depotStats = data.reduce((acc, c) => {
      const depot = (c as any).shipFromMasterDataCode || 'Unknown';
      if (!acc[depot]) {
        acc[depot] = { total: 0, completed: 0, inTransit: 0, pending: 0, failed: 0 };
      }
      acc[depot].total++;
      const status = getStatusDisplay(c);
      if (status === "Completed") acc[depot].completed++;
      else if (status === "In Transit") acc[depot].inTransit++;
      else if (status.includes("Failed") || status === "GPS Issue") acc[depot].failed++;
      else acc[depot].pending++;
      return acc;
    }, {} as Record<string, any>);

    // Customer analysis
    const customerStats = data.reduce((acc, c) => {
      const customer = (c as any).shipperCompanyName || c.warehouseCompanyName || 'Unknown';
      if (!acc[customer]) {
        acc[customer] = { total: 0, completed: 0 };
      }
      acc[customer].total++;
      if (getStatusDisplay(c) === "Completed") {
        acc[customer].completed++;
      }
      return acc;
    }, {} as Record<string, any>);

    // Driver analysis
    const driverStats = data.reduce((acc, c) => {
      const driverName = (c as any).driverName || 'Unassigned';
      const driverId = (c as any).driverId;
      const vehicleCode = (c as any).tractorPlateNumber || (c as any).plateNumber || 'No Vehicle';
      
      if (!acc[driverName]) {
        acc[driverName] = { 
          total: 0, 
          completed: 0, 
          inTransit: 0, 
          driverId: driverId,
          vehicle: vehicleCode
        };
      }
      acc[driverName].total++;
      const status = getStatusDisplay(c);
      if (status === "Completed") {
        acc[driverName].completed++;
      } else if (status === "In Transit") {
        acc[driverName].inTransit++;
      }
      return acc;
    }, {} as Record<string, any>);

    // Temperature zone analysis
    const tempZoneStats = data.reduce((acc, c) => {
      const tempZone = c.documentNote?.split('\\')[0] || c.expectedTemperature || 'Standard';
      if (!acc[tempZone]) {
        acc[tempZone] = { total: 0, completed: 0 };
      }
      acc[tempZone].total++;
      if (getStatusDisplay(c) === "Completed") {
        acc[tempZone].completed++;
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
      completed,
      inTransit,
      pending,
      failed,
      completionRate,
      onTimeRate,
      depotStats,
      customerStats,
      driverStats,
      tempZoneStats,
      recentDeliveries: recentDeliveries.length,
      topDepots: Object.entries(depotStats)
        .sort(([,a], [,b]) => (b as any).total - (a as any).total)
        .slice(0, 5),
      topCustomers: Object.entries(customerStats)
        .sort(([,a], [,b]) => (b as any).total - (a as any).total)
        .slice(0, 5),
      topDrivers: Object.entries(driverStats)
        .sort(([,a], [,b]) => (b as any).total - (a as any).total)
        .slice(0, 10),
      activeDrivers: Object.entries(driverStats)
        .filter(([,stats]) => (stats as any).inTransit > 0)
        .length
    };
  }, [filteredConsignments, getStatusDisplay]);

  const clearFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      status: "all",
      depot: "all",
      driver: "all"
    });
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.status !== "all" || filters.depot !== "all" || filters.driver !== "all";

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
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
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
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>All Deliveries ({analytics.totalConsignments})</DialogTitle>
              <DialogDescription>Complete list of all consignments</DialogDescription>
            </DialogHeader>
            <AllDeliveriesBreakdown consignments={filteredConsignments as Consignment[]} />
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.completionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.completed} of {analytics.totalConsignments} completed
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Delivery Performance Breakdown</DialogTitle>
              <DialogDescription>Completed vs pending deliveries</DialogDescription>
            </DialogHeader>
            <DeliveryRateBreakdown consignments={filteredConsignments as Consignment[]} />
          </DialogContent>
        </Dialog>

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
                <Dialog key={depot}>
                  <DialogTrigger asChild>
                    <button className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded">
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
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Depot Performance - {depot}</DialogTitle>
                      <DialogDescription>All deliveries from this depot</DialogDescription>
                    </DialogHeader>
                    <DepotBreakdown consignments={filteredConsignments as Consignment[]} depotName={depot} />
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Drivers</CardTitle>
            <CardDescription>Driver performance and delivery volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topDrivers.map(([driverName, stats]) => (
                <Dialog key={driverName}>
                  <DialogTrigger asChild>
                    <button className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium text-sm">{driverName}</span>
                          {(stats as any).vehicle && (stats as any).vehicle !== 'No Vehicle' && (
                            <div className="text-xs text-muted-foreground">{(stats as any).vehicle}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{(stats as any).total}</div>
                        <div className="text-xs text-muted-foreground">
                          {(stats as any).completed} completed, {(stats as any).inTransit} active
                        </div>
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Driver Performance - {driverName}</DialogTitle>
                      <DialogDescription>Complete breakdown of all deliveries</DialogDescription>
                    </DialogHeader>
                    <DriverDeliveryDetails driverName={driverName} consignments={filteredConsignments as Consignment[]} filterType="all" />
                  </DialogContent>
                </Dialog>
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
            <CardTitle className="text-lg">Driver Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Active Drivers: {analytics.activeDrivers}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Total Drivers: {Object.keys(analytics.driverStats).length}</span>
              </div>
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Fleet Operational</span>
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
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
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
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>All Deliveries ({analytics.totalConsignments})</DialogTitle>
              <DialogDescription>Complete list of all consignments</DialogDescription>
            </DialogHeader>
            <AllDeliveriesBreakdown consignments={filteredConsignments as Consignment[]} />
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
              <CardHeader>
                <CardTitle className="text-sm">Completion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.completionRate.toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {analytics.completed} / {analytics.totalConsignments}
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Delivery Performance Breakdown</DialogTitle>
              <DialogDescription>Completed vs pending deliveries</DialogDescription>
            </DialogHeader>
            <DeliveryRateBreakdown consignments={filteredConsignments as Consignment[]} />
          </DialogContent>
        </Dialog>

        <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
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

        <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
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
            <CardTitle>Driver Performance Analysis</CardTitle>
            <CardDescription>
              Shows each driver's delivery statistics: completed deliveries, active shipments, and success rate (percentage of total deliveries completed)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.entries(analytics.driverStats)
                .sort(([,a], [,b]) => (b as any).total - (a as any).total)
                .map(([driverName, stats]) => (
                <div key={driverName} className="border-b pb-3 last:border-b-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-medium">{driverName}</span>
                      {(stats as any).vehicle && (stats as any).vehicle !== 'No Vehicle' && (
                        <div className="text-xs text-muted-foreground">Vehicle: {(stats as any).vehicle}</div>
                      )}
                      {(stats as any).driverId && (
                        <div className="text-xs text-muted-foreground">ID: {(stats as any).driverId}</div>
                      )}
                    </div>
                    <Badge variant="secondary">{(stats as any).total}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-green-600">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="hover:underline">
                            Completed: {(stats as any).delivered}
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Completed Deliveries - {driverName}</DialogTitle>
                            <DialogDescription>
                              All successfully completed deliveries
                            </DialogDescription>
                          </DialogHeader>
                          <DriverDeliveryDetails driverName={driverName} consignments={filteredConsignments as Consignment[]} filterType="completed" />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="text-blue-600">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="hover:underline">
                            Active: {(stats as any).inTransit}
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Active Deliveries - {driverName}</DialogTitle>
                            <DialogDescription>
                              All deliveries currently in transit
                            </DialogDescription>
                          </DialogHeader>
                          <DriverDeliveryDetails driverName={driverName} consignments={filteredConsignments as Consignment[]} filterType="active" />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="text-amber-600">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="hover:underline">
                            Success Rate: {((stats as any).delivered / (stats as any).total * 100).toFixed(1)}%
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>All Deliveries - {driverName}</DialogTitle>
                            <DialogDescription>
                              Complete breakdown of all deliveries and their status
                            </DialogDescription>
                          </DialogHeader>
                          <DriverDeliveryDetails driverName={driverName} consignments={filteredConsignments as Consignment[]} filterType="all" />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ 
                        width: `${((stats as any).delivered / (stats as any).total) * 100}%` 
                      }}
                    ></div>
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

          {/* Global Filters Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Data Filters
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters}
                    className="ml-auto"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">
                    {filteredConsignments.length} of {(consignments as Consignment[]).length} records
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Filter data across all analytics views by date range, status, depot, and driver
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <Label htmlFor="dateFrom">Date From</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="dateTo">Date To</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="active">In Transit</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="depot">Depot</Label>
                  <Select value={filters.depot} onValueChange={(value) => setFilters(prev => ({ ...prev, depot: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Depots" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Depots</SelectItem>
                      {uniqueDepots.map(depot => (
                        <SelectItem key={depot} value={depot}>{depot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="driver">Driver</Label>
                  <Select value={filters.driver} onValueChange={(value) => setFilters(prev => ({ ...prev, driver: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Drivers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Drivers</SelectItem>
                      {uniqueDrivers.map(driver => (
                        <SelectItem key={driver} value={driver}>{driver}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

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