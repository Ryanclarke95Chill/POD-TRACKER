import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Download } from "lucide-react";
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
    'Depot',
    'Customer',
    'Delivery State'
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
    (item as any).warehouseCompanyName || (item as any).shipFromCompanyName || '',
    (item as any).shipToCompanyName || '',
    (item as any).delivery_StateLabel || ''
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

export default function ViewAll() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const viewType = urlParams.get('type') || 'all';
  const initialStatus = urlParams.get('status') || 'all';

  const [filters, setFilters] = useState({
    search: "",
    status: initialStatus,
    driver: "all",
    depot: "all",
    customer: "all",
    tempZone: "all"
  });

  const { data: consignments = [], isLoading } = useQuery({
    queryKey: ['/api/consignments'],
  });

  const filteredData = useMemo(() => {
    let filtered = consignments as Consignment[];

    // Apply initial type filter
    if (viewType === 'completed') {
      filtered = filtered.filter(c => (c as any).delivery_StateLabel === 'Positive outcome');
    } else if (viewType === 'pending') {
      filtered = filtered.filter(c => (c as any).delivery_StateLabel !== 'Positive outcome');
    }

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(c =>
        (c as any).consignmentNo?.toLowerCase().includes(searchLower) ||
        (c as any).shipFromCompanyName?.toLowerCase().includes(searchLower) ||
        (c as any).shipToCompanyName?.toLowerCase().includes(searchLower) ||
        (c as any).driverName?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      if (filters.status === 'delivered') {
        filtered = filtered.filter(c => (c as any).delivery_StateLabel === 'Positive outcome');
      } else if (filters.status === 'pending') {
        filtered = filtered.filter(c => (c as any).delivery_StateLabel !== 'Positive outcome');
      } else if (filters.status === 'in-transit') {
        filtered = filtered.filter(c => (c as any).delivery_StateLabel === 'Traveling');
      }
    }

    // Apply driver filter
    if (filters.driver !== 'all') {
      filtered = filtered.filter(c => 
        filters.driver === 'unassigned' 
          ? !(c as any).driverName 
          : (c as any).driverName === filters.driver
      );
    }

    // Apply depot filter
    if (filters.depot !== 'all') {
      filtered = filtered.filter(c =>
        (c as any).warehouseCompanyName?.includes(filters.depot) ||
        (c as any).shipFromCompanyName?.includes(filters.depot)
      );
    }

    // Apply customer filter
    if (filters.customer !== 'all') {
      filtered = filtered.filter(c =>
        (c as any).shipToCompanyName?.includes(filters.customer)
      );
    }

    // Apply temperature zone filter
    if (filters.tempZone !== 'all') {
      filtered = filtered.filter(c => (c as any).temperatureZone === filters.tempZone);
    }

    return filtered;
  }, [consignments, filters, viewType]);

  const getPageTitle = () => {
    switch (viewType) {
      case 'completed': return 'Completed Deliveries';
      case 'pending': return 'Pending Deliveries';
      default: return 'All Deliveries';
    }
  };

  const getStatusBadge = (consignment: any) => {
    const status = consignment.delivery_StateLabel;
    if (status === 'Positive outcome') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Delivered</Badge>;
    } else if (status === 'Traveling') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Transit</Badge>;
    } else if (status === 'Not delivered') {
      return <Badge variant="secondary" className="bg-red-100 text-red-800">Failed</Badge>;
    } else {
      return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  // Get unique values for filter dropdowns
  const uniqueDrivers = Array.from(new Set((consignments as any[]).map(c => c.driverName).filter(Boolean)));
  const uniqueDepots = Array.from(new Set((consignments as any[]).map(c => c.warehouseCompanyName).filter(Boolean)));
  const uniqueCustomers = Array.from(new Set((consignments as any[]).map(c => c.shipToCompanyName).filter(Boolean)));
  const uniqueTempZones = Array.from(new Set((consignments as any[]).map(c => c.temperatureZone).filter(Boolean)));

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/analytics">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Analytics
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
            <p className="text-muted-foreground">
              {filteredData.length} of {(consignments as any[]).length} deliveries
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => downloadData(filteredData, 'csv', getPageTitle().toLowerCase().replace(' ', '-'))}
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
          <Button 
            variant="outline"
            onClick={() => downloadData(filteredData, 'xlsx', getPageTitle().toLowerCase().replace(' ', '-'))}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter and search through all delivery data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Consignment, company, driver..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-transit">In Transit</SelectItem>
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
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {uniqueDrivers.slice(0, 20).map((driver) => (
                    <SelectItem key={driver} value={driver}>
                      {driver}
                    </SelectItem>
                  ))}
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
                  {uniqueDepots.map((depot) => (
                    <SelectItem key={depot} value={depot}>
                      {depot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Results ({filteredData.length})</CardTitle>
          <CardDescription>All delivery details with complete information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredData.map((consignment, index) => (
              <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-lg">{(consignment as any).consignmentNo}</div>
                    <div className="text-sm text-muted-foreground">
                      {(consignment as any).shipFromCompanyName} → {(consignment as any).shipToCompanyName}
                    </div>
                  </div>
                  {getStatusBadge(consignment)}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Driver:</span>
                    <div className="text-muted-foreground">{(consignment as any).driverName || 'Unassigned'}</div>
                  </div>
                  <div>
                    <span className="font-medium">Vehicle:</span>
                    <div className="text-muted-foreground">{(consignment as any).tractorPlateNumber || (consignment as any).plateNumber || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="font-medium">Depot:</span>
                    <div className="text-muted-foreground">{(consignment as any).warehouseCompanyName || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="font-medium">Temp Zone:</span>
                    <div className="text-muted-foreground">{(consignment as any).temperatureZone || 'N/A'}</div>
                  </div>
                </div>

                {(consignment as any).contextPlannedDeliveryDateTime && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium">Planned Delivery:</span>
                    <span className="text-muted-foreground ml-1">
                      {new Date((consignment as any).contextPlannedDeliveryDateTime).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {filteredData.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No deliveries match your current filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}