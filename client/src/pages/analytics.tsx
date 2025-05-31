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
import ConsignmentDetailModal from "@/components/consignment-detail-modal";
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
  Building2,
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
  const depotConsignments = consignments.filter(c => {
    const fullDepotCode = (c as any).shipFromMasterDataCode || '';
    const depotState = fullDepotCode.includes('_') ? fullDepotCode.split('_')[0] : fullDepotCode;
    return depotState === depotName ||
           (c as any).warehouseMasterDataCode === depotName ||
           (c as any).shipFromCompanyName?.includes(depotName) || 
           (c as any).warehouseCompanyName?.includes(depotName);
  });

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
    ((c as any).driverName || 'Unassigned').trim() === driverName || ((c as any).driverName === null && driverName === 'Unassigned')
  );

  const getDeliveryStatus = (consignment: Consignment) => {
    const deliveryState = (consignment as any).delivery_StateLabel;
    const pickupState = (consignment as any).pickUp_StateLabel;
    const deliveryReason = (consignment as any).delivery_OutcomePODReason;
    const pickupReason = (consignment as any).pickUp_OutcomePODReason;
    
    if (deliveryState === 'Positive outcome') return { status: 'Completed', type: 'success' };
    if (deliveryState === 'Delivered') return { status: 'Completed', type: 'success' };
    if (pickupState === 'Positive outcome') return { status: 'Completed', type: 'success' };
    if (deliveryState === 'Negative outcome') return { status: 'Failed to Deliver', type: 'failure', reason: deliveryReason || deliveryState };
    if (pickupState === 'Negative outcome') return { status: 'Failed to Pickup', type: 'failure', reason: pickupReason || pickupState };
    if (deliveryState === 'Not delivered') return { status: 'Failed to Deliver', type: 'failure', reason: deliveryReason || deliveryState };
    if (deliveryState === 'GPS not present') return { status: 'GPS Issue', type: 'failure', reason: deliveryReason || deliveryState };
    if (pickupState === 'Not picked up') return { status: 'Failed to Pickup', type: 'failure', reason: pickupReason || pickupState };
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

// Executive View Component - Optimized for large datasets and board presentations
function ExecutiveView() {
  const { data: consignments = [] } = useQuery({
    queryKey: ["/api/consignments"]
  });

  // Get date range from analytics hook for display
  const { data: filteredConsignments = [] } = useQuery({
    queryKey: ["/api/consignments"]
  });

  const analytics = useMemo(() => {
    const data = filteredConsignments as Consignment[];
    
    // Calculate actual date range from the data
    const allDates = data.map(c => {
      const date = (c as any).departureDateTime || (c as any).delivery_OutcomeRegistrationDateTime || (c as any).delivery_PlannedETA;
      return date ? new Date(date) : null;
    }).filter(date => date !== null);

    const dateRange = allDates.length > 0 ? {
      earliest: new Date(Math.min(...allDates.map(d => d!.getTime()))),
      latest: new Date(Math.max(...allDates.map(d => d!.getTime())))
    } : null;

    return { dateRange };
  }, [filteredConsignments]);

  const executiveAnalytics = useMemo(() => {
    const data = consignments as Consignment[];
    const totalConsignments = data.length;
    
    // Status analysis with accurate calculations
    const statusCounts = data.reduce((acc, c) => {
      const deliveryState = (c as any).delivery_StateLabel;
      const pickupState = (c as any).pickup_StateLabel;
      
      if (deliveryState === 'Positive outcome') acc.completed++;
      else if (deliveryState === 'Negative outcome' || deliveryState === 'Not delivered') acc.failed++;
      else if (pickupState === 'Positive outcome' && !deliveryState) acc.inTransit++;
      else acc.active++;
      
      return acc;
    }, { completed: 0, failed: 0, inTransit: 0, active: 0 });

    // State-based depot performance (grouping by NSW, VIC, QLD, WA)
    const statePerformance = data.reduce((acc, c) => {
      const fullDepotCode = (c as any).shipFromMasterDataCode || 'Unknown';
      const state = fullDepotCode.includes('_') ? fullDepotCode.split('_')[0] : fullDepotCode;
      
      if (!acc[state]) {
        acc[state] = { total: 0, completed: 0, efficiency: 0 };
      }
      acc[state].total++;
      if ((c as any).delivery_StateLabel === 'Positive outcome') {
        acc[state].completed++;
      }
      return acc;
    }, {} as Record<string, any>);

    // Calculate efficiency percentages for states
    Object.keys(statePerformance).forEach(state => {
      const stats = statePerformance[state];
      stats.efficiency = stats.total > 0 ? (stats.completed / stats.total * 100) : 0;
    });

    // Customer analysis
    const customerAnalysis = data.reduce((acc, c) => {
      const customer = (c as any).shipperCompanyName || 'Unknown';
      if (!acc[customer]) {
        acc[customer] = { total: 0, completed: 0, satisfaction: 0 };
      }
      acc[customer].total++;
      if ((c as any).delivery_StateLabel === 'Positive outcome') {
        acc[customer].completed++;
      }
      return acc;
    }, {} as Record<string, any>);

    // Calculate satisfaction rates
    Object.keys(customerAnalysis).forEach(customer => {
      const stats = customerAnalysis[customer];
      stats.satisfaction = stats.total > 0 ? (stats.completed / stats.total * 100) : 0;
    });

    // Temperature zone distribution - using actual data fields
    const tempZoneAnalysis = data.reduce((acc, c) => {
      // Extract temperature zone from actual data fields
      let zone = 'Standard';
      
      // Check multiple potential temperature fields from Axylog data
      const tempIndicators = [
        (c as any).temperatureZone,
        (c as any).expectedTemperature, 
        (c as any).documentNote,
        (c as any).shipFromMasterDataCode,
        (c as any).warehouseCompanyName,
        (c as any).shipperCompanyName,
        (c as any).delivery_MasterDataCode
      ].filter(Boolean).join(' ').toLowerCase();
      
      // Categorize based on actual data patterns
      if (tempIndicators.includes('frozen') || tempIndicators.includes('freeze') || tempIndicators.includes('-18')) zone = 'Frozen';
      else if (tempIndicators.includes('chill') || tempIndicators.includes('cold') || tempIndicators.includes('2-8')) zone = 'Chilled';
      else if (tempIndicators.includes('wine') || tempIndicators.includes('cellar')) zone = 'Wine';
      else if (tempIndicators.includes('confect') || tempIndicators.includes('chocolate')) zone = 'Confectionery';
      else if (tempIndicators.includes('dry') || tempIndicators.includes('ambient')) zone = 'Dry/Ambient';
      else if (tempIndicators.includes('pharma') || tempIndicators.includes('medical')) zone = 'Pharmaceutical';
      else if (tempIndicators.includes('produce') || tempIndicators.includes('fresh')) zone = 'Fresh Produce';
      
      acc[zone] = (acc[zone] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate on-time performance using the same logic as the detailed breakdown
    const onTimeCount = data.reduce((count, consignment) => {
      const isOnTime = (
        (consignment as any).deliveryPunctuality === 'On time' || 
        (consignment as any).deliveryPunctuality === 'Early' ||
        ((consignment as any).delivery_Outcome && !(consignment as any).delivery_NotDeliverd)
      );
      return count + (isOnTime ? 1 : 0);
    }, 0);

    return {
      totalConsignments,
      statusCounts,
      statePerformance: Object.entries(statePerformance)
        .sort(([,a], [,b]) => (b as any).total - (a as any).total)
        .slice(0, 4),
      topCustomers: Object.entries(customerAnalysis)
        .sort(([,a], [,b]) => (b as any).total - (a as any).total)
        .slice(0, 5),
      tempZoneAnalysis,
      completionRate: totalConsignments > 0 ? (statusCounts.completed / totalConsignments * 100) : 0,
      failureRate: totalConsignments > 0 ? (statusCounts.failed / totalConsignments * 100) : 0,
      onTimeRate: totalConsignments > 0 ? (onTimeCount / totalConsignments * 100) : 0,
      onTimeDeliveries: onTimeCount,
      totalDeliveries: totalConsignments
    };
  }, [consignments]);

  return (
    <div className="space-y-8">
      {/* Executive KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Dialog>
          <DialogTrigger asChild>
            <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:bg-gray-50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
                <Package className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{executiveAnalytics.totalConsignments.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active consignments
                  {analytics.dateRange && (
                    <span className="block">
                      {analytics.dateRange.earliest.toLocaleDateString()} - {analytics.dateRange.latest.toLocaleDateString()}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Total Operations Breakdown ({executiveAnalytics.totalConsignments.toLocaleString()})</DialogTitle>
              <DialogDescription>Complete operational overview and volume analysis</DialogDescription>
            </DialogHeader>
            <AllDeliveriesBreakdown consignments={consignments as Consignment[]} />
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="border-l-4 border-l-green-500 cursor-pointer hover:bg-gray-50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{executiveAnalytics.completionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">{executiveAnalytics.statusCounts.completed.toLocaleString()} completed</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Success Rate Analysis ({executiveAnalytics.completionRate.toFixed(1)}%)</DialogTitle>
              <DialogDescription>Detailed breakdown of successful vs failed deliveries</DialogDescription>
            </DialogHeader>
            <DeliveryRateBreakdown consignments={consignments as Consignment[]} />
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="border-l-4 border-l-red-500 cursor-pointer hover:bg-gray-50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Risk Exposure</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{executiveAnalytics.failureRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">{executiveAnalytics.statusCounts.failed.toLocaleString()} failed deliveries</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Risk Exposure Analysis ({executiveAnalytics.failureRate.toFixed(1)}%)</DialogTitle>
              <DialogDescription>Failed deliveries and operational risk factors</DialogDescription>
            </DialogHeader>
            <div className="p-8 text-center">
              <h3 className="text-lg font-medium mb-2">Risk Analysis</h3>
              <p className="text-muted-foreground">Detailed risk exposure analysis for your delivery operations</p>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="border-l-4 border-l-purple-500 cursor-pointer hover:bg-gray-50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Network</CardTitle>
                <Building2 className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{executiveAnalytics.topCustomers.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Major customers</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Active Network Analysis ({executiveAnalytics.topCustomers.length} Major Customers)</DialogTitle>
              <DialogDescription>Customer portfolio and network insights</DialogDescription>
            </DialogHeader>
            <div className="p-8 text-center">
              <h3 className="text-lg font-medium mb-2">Network Analysis</h3>
              <p className="text-muted-foreground">Customer portfolio and network insights for your active customer base</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* State Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            Top Performing Depots
          </CardTitle>
          <CardDescription>
            Volume and efficiency by location
            {analytics.dateRange && (
              <span className="block text-xs text-muted-foreground mt-1">
                Data period: {analytics.dateRange.earliest.toLocaleDateString()} - {analytics.dateRange.latest.toLocaleDateString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {executiveAnalytics.statePerformance.map(([state, stats], index) => (
              <div key={state} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-lg">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{state}</p>
                    <p className="text-sm text-muted-foreground">{(stats as any).total.toLocaleString()} consignments</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{(stats as any).total.toLocaleString()} deliveries</div>
                  <div className="text-sm text-muted-foreground">{(stats as any).efficiency.toFixed(1)}% complete</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Customer Portfolio Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Customer Portfolio Performance
          </CardTitle>
          <CardDescription>
            Key client relationships and satisfaction metrics
            {analytics.dateRange && (
              <span className="block text-xs text-muted-foreground mt-1">
                Data period: {analytics.dateRange.earliest.toLocaleDateString()} - {analytics.dateRange.latest.toLocaleDateString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Customer</th>
                  <th className="text-left py-3 px-4 font-medium">Volume</th>
                  <th className="text-left py-3 px-4 font-medium">Success Rate</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {executiveAnalytics.topCustomers.map(([customer, stats], index) => (
                  <tr key={customer} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{customer}</td>
                    <td className="py-3 px-4">{(stats as any).total.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{(stats as any).satisfaction.toFixed(1)}%</span>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${(stats as any).satisfaction}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={(stats as any).satisfaction > 90 ? "default" : "secondary"}>
                        {(stats as any).satisfaction > 90 ? "Excellent" : "Good"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Temperature Compliance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Thermometer className="h-5 w-5 mr-2" />
            Temperature Compliance Portfolio
          </CardTitle>
          <CardDescription>
            Distribution of temperature-controlled cargo
            {analytics.dateRange && (
              <span className="block text-xs text-muted-foreground mt-1">
                Data period: {analytics.dateRange.earliest.toLocaleDateString()} - {analytics.dateRange.latest.toLocaleDateString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {Object.entries(executiveAnalytics.tempZoneAnalysis).map(([zone, count]) => (
              <div key={zone} className="text-center p-4 border rounded-lg">
                <div className="text-3xl font-bold mb-2">{count.toLocaleString()}</div>
                <div className="font-medium">{zone}</div>
                <div className="text-sm text-muted-foreground">
                  {((count / executiveAnalytics.totalConsignments) * 100).toFixed(1)}% of total
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Analytics() {
  const [selectedView, setSelectedView] = useState<"ceo" | "allocator" | "deepdive" | "executive">("ceo");
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

    // Date filtering with proper AEST timezone handling
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter(c => {
        const consignmentDate = (c as any).departureDateTime || (c as any).delivery_PlannedETA;
        if (!consignmentDate) return true;
        
        // Parse the original date and convert to AEST for proper local date comparison
        const utcDate = new Date(consignmentDate);
        // Convert to AEST (UTC+10) for date comparison
        const aestOffset = 10 * 60; // 10 hours in minutes
        const localDate = new Date(utcDate.getTime() + (aestOffset * 60 * 1000));
        const dateString = localDate.toISOString().split('T')[0];
        
        const fromMatch = !filters.dateFrom || dateString >= filters.dateFrom;
        const toMatch = !filters.dateTo || dateString <= filters.dateTo;
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

  // Helper function to get status display for analytics (converts to "Completed" for both stages)
  const getStatusDisplay = (consignment: Consignment) => {
    const deliveryStateLabel = (consignment as any).delivery_StateLabel;
    const pickupStateLabel = (consignment as any).pickUp_StateLabel;
    
    // For analytics, we want to show both successful pickups and deliveries as "Completed"
    if (deliveryStateLabel === 'Positive outcome' || deliveryStateLabel === 'Delivered') {
      return 'Completed';
    }
    if (pickupStateLabel === 'Positive outcome') {
      return 'Completed';
    }
    if (deliveryStateLabel === 'Traveling' || pickupStateLabel === 'Traveling') {
      return 'In Transit';
    }
    if (deliveryStateLabel === 'Negative outcome' || pickupStateLabel === 'Negative outcome' || 
        deliveryStateLabel === 'Not delivered' || pickupStateLabel === 'Not delivered') {
      return 'Failed';
    }
    
    // Return the actual status for other cases
    return deliveryStateLabel || pickupStateLabel || 'In Transit';
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

  // Check if any filters are applied
  const hasFilters = filters.dateFrom || filters.dateTo || filters.status !== "all" || filters.depot !== "all" || filters.driver !== "all";

  // Calculate analytics data using filtered data
  const analytics = useMemo(() => {
    if (!hasFilters) return null;
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

    // Build all stats objects first
    // Depot analysis - group by state (everything before underscore)
    const depotStats = data.reduce((acc, c) => {
      const fullDepotCode = (c as any).shipFromMasterDataCode || 'Unknown';
      const depot = fullDepotCode.includes('_') ? fullDepotCode.split('_')[0] : fullDepotCode;
      
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
      const driverName = ((c as any).driverName || 'Unassigned').trim();
      const driverId = (c as any).driverId;
      const vehicleCode = (c as any).tractorPlateNumber || (c as any).plateNumber || 'No Vehicle';
      
      if (!acc[driverName]) {
        acc[driverName] = { 
          total: 0, 
          completed: 0, 
          inTransit: 0, 
          failed: 0,
          driverId: driverId,
          vehicle: vehicleCode,
          delivered: 0
        };
      }
      acc[driverName].total++;
      const status = getStatusDisplay(c);
      
      if (status === "Completed") {
        acc[driverName].completed++;
        acc[driverName].delivered++;
      } else if (status === "In Transit") {
        acc[driverName].inTransit++;
      } else if (status.includes("Failed") || status === "GPS Issue") {
        acc[driverName].failed++;
      }
      return acc;
    }, {} as Record<string, any>);

    // Temperature zone analysis
    const tempZoneStats = data.reduce((acc, c) => {
      const tempZone = c.documentNote?.split('\\')[0] || c.expectedTemperature || 'Standard';
      if (!acc[tempZone]) {
        acc[tempZone] = { total: 0, completed: 0, failed: 0, inTransit: 0 };
      }
      acc[tempZone].total++;
      const status = getStatusDisplay(c);
      if (status === "Completed") acc[tempZone].completed++;
      else if (status.includes("Failed") || status === "GPS Issue") acc[tempZone].failed++;
      else if (status === "In Transit") acc[tempZone].inTransit++;
      return acc;
    }, {} as Record<string, any>);

    // Risk exposure analysis based on actual data patterns
    const riskFactors = {
      highVolumeRoutes: [] as any[],
      temperatureRisks: [] as any[],
      customerConcentration: [] as any[],
      operationalRisks: [] as any[]
    };

    // Identify high-volume routes with delivery issues
    const routeRiskAnalysis = data.reduce((acc, c) => {
      const fromLocation = (c as any).shipFromMasterDataCode || 'Unknown';
      const toLocation = (c as any).delivery_MasterDataCode || (c as any).delivery_StateLabel || 'Unknown';
      const routeKey = `${fromLocation} → ${toLocation}`;
      
      if (!acc[routeKey]) {
        acc[routeKey] = { total: 0, failed: 0, delayed: 0, tempIssues: 0 };
      }
      
      acc[routeKey].total++;
      const status = getStatusDisplay(c);
      if (status.includes("Failed") || status === "GPS Issue") acc[routeKey].failed++;
      if ((c as any).delivery_ETA && (c as any).delivery_ActualETA) {
        const eta = new Date((c as any).delivery_ETA);
        const actual = new Date((c as any).delivery_ActualETA);
        if (actual > eta) acc[routeKey].delayed++;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Identify routes with >5% failure rate and high volume
    riskFactors.highVolumeRoutes = Object.entries(routeRiskAnalysis)
      .filter(([_, stats]) => (stats as any).total >= 20 && ((stats as any).failed / (stats as any).total) > 0.05)
      .map(([route, stats]) => ({
        route,
        volume: (stats as any).total,
        failureRate: ((stats as any).failed / (stats as any).total * 100).toFixed(1),
        risk: 'High volume route with elevated failure rate'
      }))
      .sort((a, b) => parseFloat(b.failureRate) - parseFloat(a.failureRate));

    // Temperature zone risk analysis
    const tempZoneRisks = Object.entries(tempZoneStats)
      .filter(([zone, stats]) => {
        const failureRate = ((stats as any).failed / (stats as any).total);
        return (stats as any).total >= 10 && failureRate > 0.03;
      })
      .map(([zone, stats]) => ({
        zone,
        volume: (stats as any).total,
        failureRate: ((stats as any).failed / (stats as any).total * 100).toFixed(1),
        risk: 'Temperature sensitive cargo with delivery issues'
      }));

    riskFactors.temperatureRisks = tempZoneRisks;

    // Customer concentration risk
    const customerVolumes = Object.entries(customerStats)
      .sort(([,a], [,b]) => (b as any).total - (a as any).total);
    
    const totalVolume = data.length;
    const top5Volume = customerVolumes.slice(0, 5).reduce((sum, [_, stats]) => sum + (stats as any).total, 0);
    const concentrationRisk = (top5Volume / totalVolume * 100);

    if (concentrationRisk > 60) {
      riskFactors.customerConcentration.push({
        risk: 'High customer concentration',
        percentage: concentrationRisk.toFixed(1),
        detail: `Top 5 customers represent ${concentrationRisk.toFixed(1)}% of total volume`
      });
    }

    // Operational risk indicators
    const driverWorkload = Object.entries(driverStats)
      .filter(([_, stats]) => (stats as any).total > 50)
      .map(([driver, stats]) => ({
        driver,
        volume: (stats as any).total,
        activeLoad: (stats as any).inTransit || 0
      }));

    const highWorkloadDrivers = driverWorkload.filter(d => d.activeLoad > 10);
    if (highWorkloadDrivers.length > 0) {
      riskFactors.operationalRisks.push({
        risk: 'Driver overload risk',
        count: highWorkloadDrivers.length,
        detail: `${highWorkloadDrivers.length} drivers with >10 active deliveries`
      });
    }

    // Depot capacity risks
    const depotVolumes = Object.entries(depotStats)
      .sort(([,a], [,b]) => (b as any).total - (a as any).total);
    
    const highVolumeDepots = depotVolumes.filter(([_, stats]) => (stats as any).total > 1000);
    if (highVolumeDepots.length > 0) {
      const avgFailureRate = highVolumeDepots.reduce((sum, [_, stats]) => 
        sum + ((stats as any).failed / (stats as any).total), 0) / highVolumeDepots.length;
      
      if (avgFailureRate > 0.02) {
        riskFactors.operationalRisks.push({
          risk: 'High-volume depot performance',
          rate: (avgFailureRate * 100).toFixed(1),
          detail: `${highVolumeDepots.length} high-volume depots with ${(avgFailureRate * 100).toFixed(1)}% avg failure rate`
        });
      }
    }

    // Performance metrics
    const completionRate = totalConsignments > 0 ? (completed / totalConsignments * 100) : 0;
    
    // Calculate on-time deliveries using delivery window logic
    const onTimeDeliveries = data.filter(c => {
      const wasDelivered = (c as any).delivery_Outcome && !(c as any).delivery_NotDeliverd;
      const actualDateTime = (c as any).delivery_OutcomeDateTime;
      const deliveryWindowFrom = (c as any).minScheduledDeliveryTime;
      const deliveryWindowTo = (c as any).maxScheduledDeliveryTime;
      
      if (wasDelivered && actualDateTime) {
        if (deliveryWindowFrom && deliveryWindowTo) {
          // Check if delivery falls within the delivery window (convert to AEST)
          const actual = new Date(actualDateTime);
          const windowStart = new Date(deliveryWindowFrom);
          const windowEnd = new Date(deliveryWindowTo);
          
          // Convert UTC to AEST (UTC+10) for Australian timezone
          const aestOffset = 10 * 60 * 60 * 1000; // 10 hours in milliseconds
          const actualAEST = new Date(actual.getTime() + aestOffset);
          const windowStartAEST = new Date(windowStart.getTime() + aestOffset);
          const windowEndAEST = new Date(windowEnd.getTime() + aestOffset);
          
          return actualAEST >= windowStartAEST && actualAEST <= windowEndAEST;
        } else if ((c as any).deliveryPunctuality === 'On time' || (c as any).deliveryPunctuality === 'Early') {
          // Use Axylog's punctuality assessment if delivery windows not available
          return true;
        } else {
          // If delivery windows are N/A or null and consignment is delivered, mark as on-time
          return true;
        }
      } else {
        // Not delivered = not on time
        return false;
      }
    }).length;
    const onTimeRate = totalConsignments > 0 ? (onTimeDeliveries / totalConsignments * 100) : 0;



    // Recent activity (last 7 days of data available)
    const today = new Date();
    const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    const recentDeliveries = data.filter(c => {
      const deliveryDate = new Date((c as any).delivery_OutcomeRegistrationDateTime || c.departureDateTime || '');
      return deliveryDate >= weekAgo && deliveryDate <= today;
    });

    // Active drivers count
    const activeDrivers = Object.values(driverStats).filter(stats => (stats as any).inTransit > 0).length;

    // Calculate actual date range from the data
    const allDates = data.map(c => {
      const date = (c as any).departureDateTime || (c as any).delivery_OutcomeRegistrationDateTime || (c as any).delivery_PlannedETA;
      return date ? new Date(date) : null;
    }).filter(date => date !== null);

    const dateRange = allDates.length > 0 ? {
      earliest: new Date(Math.min(...allDates.map(d => d!.getTime()))),
      latest: new Date(Math.max(...allDates.map(d => d!.getTime())))
    } : null;

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
      riskFactors,
      dateRange,
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
      activeDrivers
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

  const CEOView = () => {
    if (!analytics) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Apply Filters to View Analytics</h3>
            <p className="text-gray-600 mb-6">
              Select a date range or other filters above to load the performance analytics dashboard.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                For optimal performance, please apply filters to analyze a specific time period or subset of your delivery data.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
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

        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50">
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
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden">
            <DialogHeader className="pb-2">
              <DialogTitle>On-Time Performance Analysis</DialogTitle>
              <DialogDescription>Detailed breakdown of delivery punctuality across all routes</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(85vh-100px)]">
              <OnTimePerformanceBreakdown consignments={filteredConsignments as Consignment[]} />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50">
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
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Active Shipments Overview</DialogTitle>
              <DialogDescription>Real-time tracking of all shipments currently in transit</DialogDescription>
            </DialogHeader>
            <ActiveShipmentsBreakdown consignments={filteredConsignments as Consignment[]} />
          </DialogContent>
        </Dialog>
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
                          {((stats as any).completed / (stats as any).total * 100).toFixed(1)}% complete
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
                        <div className="text-xs flex gap-2">
                          {(stats as any).completed > 0 && <span className="text-green-600">{(stats as any).completed} completed</span>}
                          {(stats as any).inTransit > 0 && <span className="text-blue-600">{(stats as any).inTransit} active</span>}
                          {(stats as any).failed > 0 && <span className="text-red-600">{(stats as any).failed} failed</span>}
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
                <Badge variant="outline">{analytics.completed}</Badge>
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
          <CardDescription>
            Real-time status across all depot locations
            {analytics.dateRange && (
              <span className="block text-xs text-muted-foreground mt-1">
                Data period: {analytics.dateRange.earliest.toLocaleDateString()} - {analytics.dateRange.latest.toLocaleDateString()}
              </span>
            )}
          </CardDescription>
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
              {analytics.dateRange && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Data period: {analytics.dateRange.earliest.toLocaleDateString()} - {analytics.dateRange.latest.toLocaleDateString()}
                </span>
              )}
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
                        width: `${((stats as any).completed / (stats as any).total) * 100}%` 
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
  };

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
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="executive" className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Executive</span>
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
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Apply Filters to View Analytics</h3>
                <p className="text-gray-600 mb-6">
                  Select a date range or other filters above to load the performance analytics dashboard.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    For optimal performance, please apply filters to analyze a specific time period or subset of your delivery data.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deepdive">
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Apply Filters to View Analytics</h3>
                <p className="text-gray-600 mb-6">
                  Select a date range or other filters above to load the performance analytics dashboard.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    For optimal performance, please apply filters to analyze a specific time period or subset of your delivery data.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="executive">
            <ExecutiveView />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Enhanced on-time performance analysis with comprehensive drill-downs
const OnTimePerformanceBreakdown: React.FC<{ consignments: Consignment[] }> = ({ consignments }) => {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [selectedDepot, setSelectedDepot] = useState<string | null>(null);
  const [selectedShipper, setSelectedShipper] = useState<string | null>(null);
  const [selectedConsignment, setSelectedConsignment] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'drivers' | 'depots' | 'shippers' | 'timeline'>('depots');
  
  const onTimeAnalysis = useMemo(() => {
    // Route-based analysis
    const routePerformance: Record<string, { onTime: number; late: number; total: number; details: any[] }> = {};
    
    // Driver-based analysis  
    const driverPerformance: Record<string, { onTime: number; late: number; total: number; details: any[] }> = {};
    
    // Depot-based analysis
    const depotPerformance: Record<string, { onTime: number; late: number; total: number; details: any[] }> = {};
    
    // Shipper-based analysis
    const shipperPerformance: Record<string, { onTime: number; late: number; total: number; details: any[] }> = {};
    
    // Timeline analysis (by month)
    const timelinePerformance: Record<string, { onTime: number; late: number; total: number }> = {};
    
    // Track unassigned driver consignments separately
    const unassignedDriverConsignments: any[] = [];
    
    consignments.forEach(consignment => {
      // Check if driver is assigned
      const driverName = (consignment as any).driverName || 'Unassigned';
      
      if (driverName === 'Unassigned' || !driverName) {
        // Track separately but don't include in performance metrics
        unassignedDriverConsignments.push({
          consignmentNo: (consignment as any).consignmentNo,
          customer: (consignment as any).shipToCompanyName,
          status: (consignment as any).delivery_StateLabel || (consignment as any).pickUp_StateLabel,
          departureDateTime: (consignment as any).departureDateTime
        });
        return; // Skip this consignment for on-time performance calculations
      }
      
      // Determine if this is a pickup or delivery consignment
      const isPickupConsignment = (consignment as any).pickUp_StateLabel !== null;
      const isDeliveryConsignment = (consignment as any).delivery_StateLabel !== null;
      
      let isOnTime = false;
      let wasCompleted = false;
      let actualDateTime = null;
      
      if (isPickupConsignment) {
        // For pickup consignments, check pickup completion
        wasCompleted = (consignment as any).pickUp_Outcome && !(consignment as any).pickUp_NotPickedup;
        actualDateTime = (consignment as any).pickUp_OutcomeDateTime;
        
        if (wasCompleted && actualDateTime) {
          // Check pickup punctuality or default to on-time if completed
          if ((consignment as any).pickupPunctuality === 'On time' || (consignment as any).pickupPunctuality === 'Early') {
            isOnTime = true;
          } else {
            isOnTime = true; // Default to on-time for completed pickups without punctuality data
          }
        } else {
          isOnTime = false; // Not picked up = not on time
        }
      } else if (isDeliveryConsignment) {
        // For delivery consignments, check delivery completion
        wasCompleted = (consignment as any).delivery_Outcome && !(consignment as any).delivery_NotDeliverd;
        actualDateTime = (consignment as any).delivery_OutcomeDateTime;
        const deliveryWindowFrom = (consignment as any).minScheduledDeliveryTime;
        const deliveryWindowTo = (consignment as any).maxScheduledDeliveryTime;
        
        if (wasCompleted && actualDateTime) {
          if (deliveryWindowFrom && deliveryWindowTo) {
            // Check if delivery falls within the delivery window
            const actualTime = new Date(actualDateTime).getTime();
            const windowStartTime = new Date(deliveryWindowFrom).getTime();
            const windowEndTime = new Date(deliveryWindowTo).getTime();
            isOnTime = actualTime >= windowStartTime && actualTime <= windowEndTime;
          } else if ((consignment as any).deliveryPunctuality === 'On time' || (consignment as any).deliveryPunctuality === 'Early') {
            isOnTime = true;
          } else {
            isOnTime = true; // Default to on-time for delivered items without window data
          }
        } else {
          isOnTime = false; // Not delivered = not on time
        }
      }
      
      const route = `${(consignment as any).shipFromCity || 'Unknown'} → ${(consignment as any).shipToCity || 'Unknown'}`;
      const depot = (consignment as any).shipFromMasterDataCode?.split('_')[0] || 'Unknown';
      const shipper = (consignment as any).shipperCompanyName || (consignment as any).shipFromCompanyName || 'Unknown';
      
      // Get month from departure date
      const departureDate = (consignment as any).departureDateTime;
      const month = departureDate ? new Date(departureDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown';
      
      // Get window data based on consignment type
      const windowFrom = isDeliveryConsignment ? 
        (consignment as any).minScheduledDeliveryTime : 
        (consignment as any).minScheduledPickupTime;
      const windowTo = isDeliveryConsignment ? 
        (consignment as any).maxScheduledDeliveryTime : 
        (consignment as any).maxScheduledPickupTime;
      
      const deliveryDetail = {
        consignmentNo: (consignment as any).consignmentNo,
        customer: (consignment as any).shipToCompanyName,
        departureDateTime: (consignment as any).departureDateTime,
        deliveryDateTime: actualDateTime,
        deliveryWindowFrom: windowFrom,
        deliveryWindowTo: windowTo,
        punctuality: isDeliveryConsignment ? 
          (consignment as any).deliveryPunctuality : 
          (consignment as any).pickupPunctuality,
        driver: driverName,
        vehicle: (consignment as any).vehicleCode,
        wasDelivered: wasCompleted,
        isOnTime
      };
      
      // Route analysis
      if (!routePerformance[route]) {
        routePerformance[route] = { onTime: 0, late: 0, total: 0, details: [] };
      }
      routePerformance[route].total++;
      routePerformance[route].details.push(deliveryDetail);
      if (isOnTime) routePerformance[route].onTime++;
      else routePerformance[route].late++;
      
      // Driver analysis
      if (!driverPerformance[driver]) {
        driverPerformance[driver] = { onTime: 0, late: 0, total: 0, details: [] };
      }
      driverPerformance[driver].total++;
      driverPerformance[driver].details.push(deliveryDetail);
      if (isOnTime) driverPerformance[driver].onTime++;
      else driverPerformance[driver].late++;
      
      // Depot analysis
      if (!depotPerformance[depot]) {
        depotPerformance[depot] = { onTime: 0, late: 0, total: 0, details: [] };
      }
      depotPerformance[depot].total++;
      depotPerformance[depot].details.push(deliveryDetail);
      if (isOnTime) depotPerformance[depot].onTime++;
      else depotPerformance[depot].late++;
      
      // Shipper analysis
      if (!shipperPerformance[shipper]) {
        shipperPerformance[shipper] = { onTime: 0, late: 0, total: 0, details: [] };
      }
      shipperPerformance[shipper].total++;
      shipperPerformance[shipper].details.push(deliveryDetail);
      if (isOnTime) shipperPerformance[shipper].onTime++;
      else shipperPerformance[shipper].late++;
      
      // Timeline analysis
      if (!timelinePerformance[month]) {
        timelinePerformance[month] = { onTime: 0, late: 0, total: 0 };
      }
      timelinePerformance[month].total++;
      if (isOnTime) timelinePerformance[month].onTime++;
      else timelinePerformance[month].late++;
    });
    
    const routes = Object.entries(routePerformance)
      .map(([route, stats]) => ({
        route,
        percentage: stats.total > 0 ? (stats.onTime / stats.total * 100).toFixed(1) : '0.0',
        onTime: stats.onTime,
        late: stats.late,
        total: stats.total,
        details: stats.details
      }))
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
    
    const drivers = Object.entries(driverPerformance)
      .map(([driver, stats]) => ({
        driver,
        percentage: stats.total > 0 ? (stats.onTime / stats.total * 100).toFixed(1) : '0.0',
        onTime: stats.onTime,
        late: stats.late,
        total: stats.total,
        details: stats.details
      }))
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
    
    const depots = Object.entries(depotPerformance)
      .map(([depot, stats]) => ({
        depot,
        percentage: stats.total > 0 ? (stats.onTime / stats.total * 100).toFixed(1) : '0.0',
        onTime: stats.onTime,
        late: stats.late,
        total: stats.total,
        details: stats.details
      }))
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
    
    const shippers = Object.entries(shipperPerformance)
      .map(([shipper, stats]) => ({
        shipper,
        percentage: stats.total > 0 ? (stats.onTime / stats.total * 100).toFixed(1) : '0.0',
        onTime: stats.onTime,
        late: stats.late,
        total: stats.total,
        details: stats.details
      }))
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
    
    const timeline = Object.entries(timelinePerformance)
      .map(([month, stats]) => ({
        month,
        percentage: stats.total > 0 ? (stats.onTime / stats.total * 100).toFixed(1) : '0.0',
        onTime: stats.onTime,
        late: stats.late,
        total: stats.total
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
    
    return { routes, drivers, depots, shippers, timeline };
  }, [consignments]);
  
  const renderSelectedDetails = () => {
    let selectedData: any = null;
    let title = '';
    
    if (selectedRoute) {
      selectedData = onTimeAnalysis.routes.find(r => r.route === selectedRoute);
      title = `Route Details: ${selectedRoute}`;
    } else if (selectedDriver) {
      selectedData = onTimeAnalysis.drivers.find(d => d.driver === selectedDriver);
      title = `Driver Details: ${selectedDriver}`;
    } else if (selectedDepot) {
      selectedData = onTimeAnalysis.depots.find(d => d.depot === selectedDepot);
      title = `Depot Details: ${selectedDepot}`;
    } else if (selectedShipper) {
      selectedData = onTimeAnalysis.shippers.find(s => s.shipper === selectedShipper);
      title = `Shipper Details: ${selectedShipper}`;
    }
    
    if (!selectedData) return null;
    
    return (
      <div className="border-t pt-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-medium text-lg">{title}</h4>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setSelectedRoute(null);
              setSelectedDriver(null);
              setSelectedDepot(null);
              setSelectedShipper(null);
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-3 text-center">
          <div className="p-2 bg-green-50 rounded">
            <div className="text-lg font-bold text-green-600">{selectedData.onTime}</div>
            <div className="text-xs text-green-700">On-Time</div>
          </div>
          <div className="p-2 bg-red-50 rounded">
            <div className="text-lg font-bold text-red-600">{selectedData.late}</div>
            <div className="text-xs text-red-700">Late</div>
          </div>
          <div className="p-2 bg-blue-50 rounded">
            <div className="text-lg font-bold text-blue-600">{selectedData.percentage}%</div>
            <div className="text-xs text-blue-700">Success Rate</div>
          </div>
        </div>
        
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-2">Consignment</th>
                <th className="text-left p-2">Customer</th>
                <th className="text-left p-2">Driver</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Punctuality</th>
                <th className="text-center p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedData.details.slice(0, 50).map((detail: any, idx: number) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <button 
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      onClick={() => {
                        // Find the full consignment data from the original consignments array
                        const fullConsignment = consignments.find(c => c.consignmentNo === detail.consignmentNo);
                        if (fullConsignment) {
                          setSelectedConsignment(fullConsignment);
                        }
                      }}
                    >
                      {detail.consignmentNo}
                    </button>
                  </td>
                  <td className="p-2">{detail.customer}</td>
                  <td className="p-2">{detail.driver}</td>
                  <td className="p-2">
                    <Badge variant={detail.isOnTime ? "default" : "destructive"} className="text-xs">
                      {detail.isOnTime ? "On-Time" : "Late"}
                    </Badge>
                  </td>
                  <td className="p-2">{detail.punctuality || 'N/A'}</td>
                  <td className="text-center p-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs px-2 py-1 h-6"
                      onClick={() => {
                        // Find the full consignment data from the original consignments array
                        const fullConsignment = consignments.find(c => c.consignmentNo === detail.consignmentNo);
                        if (fullConsignment) {
                          setSelectedConsignment(fullConsignment);
                        }
                      }}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedData.details.length > 50 && (
            <div className="text-center text-sm text-muted-foreground p-2">
              Showing first 50 of {selectedData.details.length} deliveries
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Check if any details are selected
  const hasSelectedDetails = selectedRoute || selectedDriver || selectedDepot || selectedShipper;
  
  return (
    <div className="space-y-6">
      {/* Show details if something is selected, otherwise show main view */}
      {hasSelectedDetails ? (
        renderSelectedDetails()
      ) : (
        <>
          {/* Depot Performance Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {onTimeAnalysis.depots.slice(0, 4).map((depot, index) => (
              <div key={depot.depot} className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">
                  {depot.percentage}%
                </div>
                <div className="text-sm text-blue-700 font-medium">{depot.depot}</div>
                <div className="text-xs text-blue-600 mt-1">
                  {depot.onTime}/{depot.total} on-time
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      
      {/* Only show the main view when no details are selected */}
      {!hasSelectedDetails && (
        <>
          {/* View Mode Selector */}
          <div className="flex gap-2 border-b">
            <Button 
              variant={viewMode === 'depots' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('depots')}
            >
              <Building2 className="h-4 w-4 mr-1" />
              By Depots ({onTimeAnalysis.depots.length})
            </Button>
            <Button 
              variant={viewMode === 'drivers' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('drivers')}
            >
              <Users className="h-4 w-4 mr-1" />
              By Drivers ({onTimeAnalysis.drivers.length})
            </Button>
            <Button 
              variant={viewMode === 'shippers' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('shippers')}
            >
              <Package className="h-4 w-4 mr-1" />
              By Shippers ({onTimeAnalysis.shippers.length})
            </Button>
            <Button 
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Timeline ({onTimeAnalysis.timeline.length})
            </Button>
          </div>
          
          {/* Data Table */}
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-2">
                    {viewMode === 'drivers' && 'Driver'}
                    {viewMode === 'depots' && 'Depot'}
                    {viewMode === 'shippers' && 'Shipper'}
                    {viewMode === 'timeline' && 'Month'}
                  </th>
                  <th className="text-center p-2">On-Time %</th>
                  <th className="text-center p-2">Performance</th>
                  <th className="text-center p-2">Volume</th>
                  <th className="text-center p-2">Actions</th>
                </tr>
              </thead>
              <tbody>

                
                {viewMode === 'drivers' && onTimeAnalysis.drivers.map((driver, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{driver.driver}</td>
                    <td className="text-center p-2">
                      <Badge variant={parseFloat(driver.percentage) >= 95 ? "default" : parseFloat(driver.percentage) >= 85 ? "secondary" : "destructive"}>
                        {driver.percentage}%
                      </Badge>
                    </td>
                    <td className="text-center p-2">
                      <span className="text-green-600">{driver.onTime}</span>/
                      <span className="text-red-600">{driver.late}</span>
                    </td>
                    <td className="text-center p-2">{driver.total}</td>
                    <td className="text-center p-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedDriver(driver.driver)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
                
                {viewMode === 'depots' && onTimeAnalysis.depots.map((depot, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{depot.depot}</td>
                    <td className="text-center p-2">
                      <Badge variant={parseFloat(depot.percentage) >= 95 ? "default" : parseFloat(depot.percentage) >= 85 ? "secondary" : "destructive"}>
                        {depot.percentage}%
                      </Badge>
                    </td>
                    <td className="text-center p-2">
                      <span className="text-green-600">{depot.onTime}</span>/
                      <span className="text-red-600">{depot.late}</span>
                    </td>
                    <td className="text-center p-2">{depot.total}</td>
                    <td className="text-center p-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedDepot(depot.depot)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
                
                {viewMode === 'shippers' && onTimeAnalysis.shippers.map((shipper, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{shipper.shipper}</td>
                    <td className="text-center p-2">
                      <Badge variant={parseFloat(shipper.percentage) >= 95 ? "default" : parseFloat(shipper.percentage) >= 85 ? "secondary" : "destructive"}>
                        {shipper.percentage}%
                      </Badge>
                    </td>
                    <td className="text-center p-2">
                      <span className="text-green-600">{shipper.onTime}</span>/
                      <span className="text-red-600">{shipper.late}</span>
                    </td>
                    <td className="text-center p-2">{shipper.total}</td>
                    <td className="text-center p-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedShipper(shipper.shipper)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
                
                {viewMode === 'timeline' && onTimeAnalysis.timeline.map((month, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{month.month}</td>
                    <td className="text-center p-2">
                      <Badge variant={parseFloat(month.percentage) >= 95 ? "default" : parseFloat(month.percentage) >= 85 ? "secondary" : "destructive"}>
                        {month.percentage}%
                      </Badge>
                    </td>
                    <td className="text-center p-2">
                      <span className="text-green-600">{month.onTime}</span>/
                      <span className="text-red-600">{month.late}</span>
                    </td>
                    <td className="text-center p-2">{month.total}</td>
                    <td className="text-center p-2">-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Consignment Detail Modal */}
      {selectedConsignment && (
        <ConsignmentDetailModal
          consignment={selectedConsignment}
          onClose={() => setSelectedConsignment(null)}
        />
      )}

    </div>
  );
};

// Drill-down component for active shipments
const ActiveShipmentsBreakdown: React.FC<{ consignments: Consignment[] }> = ({ consignments }) => {
  const activeShipments = useMemo(() => {
    return consignments
      .filter(c => !c.delivery_Outcome && !c.delivery_NotDeliverd)
      .map(consignment => ({
        id: consignment.id,
        consignmentNo: consignment.consignmentNo || 'N/A',
        driver: consignment.driverName || 'Unassigned',
        vehicle: consignment.vehicleCode || 'N/A',
        route: `${consignment.shipFromCity || 'Unknown'} → ${consignment.shipToCity || 'Unknown'}`,
        customer: consignment.shipToCompanyName || 'Unknown',
        tempZone: consignment.expectedTemperature || 'Standard',
        departureTime: consignment.departureDateTime,
        estimatedDelivery: consignment.delivery_OutcomeDateTime || consignment.maxScheduledDeliveryTime
      }))
      .slice(0, 50);
  }, [consignments]);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4 text-center">
        <div className="p-4 bg-blue-50 rounded">
          <div className="text-2xl font-bold text-blue-600">{activeShipments.length}</div>
          <div className="text-sm text-blue-700">Active Shipments</div>
        </div>
        <div className="p-4 bg-purple-50 rounded">
          <div className="text-2xl font-bold text-purple-600">
            {new Set(activeShipments.map(s => s.driver)).size}
          </div>
          <div className="text-sm text-purple-700">Active Drivers</div>
        </div>
        <div className="p-4 bg-orange-50 rounded">
          <div className="text-2xl font-bold text-orange-600">
            {new Set(activeShipments.map(s => s.vehicle)).size}
          </div>
          <div className="text-sm text-orange-700">Vehicles in Use</div>
        </div>
        <div className="p-4 bg-green-50 rounded">
          <div className="text-2xl font-bold text-green-600">
            {new Set(activeShipments.map(s => s.tempZone)).size}
          </div>
          <div className="text-sm text-green-700">Temp Zones</div>
        </div>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left p-2">Consignment</th>
              <th className="text-left p-2">Driver</th>
              <th className="text-left p-2">Route</th>
              <th className="text-left p-2">Customer</th>
              <th className="text-left p-2">Temp Zone</th>
            </tr>
          </thead>
          <tbody>
            {activeShipments.map((shipment, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="p-2 font-medium">{shipment.consignmentNo}</td>
                <td className="p-2">{shipment.driver}</td>
                <td className="p-2">{shipment.route}</td>
                <td className="p-2">{shipment.customer}</td>
                <td className="p-2">
                  <Badge variant="outline">{shipment.tempZone}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};