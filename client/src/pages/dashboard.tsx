import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, LogOut, Search, Package, TrendingUp, Clock, MapPin, Calendar } from "lucide-react";
import DashboardTable from "@/components/dashboard-table";
import ConsignmentDetailModal from "@/components/consignment-detail-modal";
import SyncDataButton from "@/components/sync-data-button";
import { Link } from "wouter";
import { getUser, logout } from "@/lib/auth";
import { Consignment, temperatureZones } from "@shared/schema";

export default function Dashboard() {
  const [selectedTempZone, setSelectedTempZone] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");



  const clearLocalStorage = () => {
    localStorage.clear();
    window.location.reload();
  };
  const user = getUser();

  const queryClient = useQueryClient();

  const { data: consignments = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/consignments"],
    staleTime: 0,
    gcTime: 0,
  });

  // Force refresh when component mounts and clear cache
  useEffect(() => {
    queryClient.clear();
    refetch();
  }, [refetch, queryClient]);

  // Get unique warehouse company names for filter dropdown
  const warehouseCompanies = Array.from(
    new Set((consignments as Consignment[]).map(c => c.warehouseCompanyName).filter(Boolean))
  ).sort();

  // Helper function to extract temperature from documentNote
  const getTemperatureZone = (consignment: Consignment) => {
    return consignment.documentNote?.split('\\')[0] || consignment.expectedTemperature || 'Standard';
  };

  // Helper function to map status labels
  const getStatusDisplay = (consignment: Consignment) => {
    const deliveryStateLabel = (consignment as any).delivery_StateLabel;
    const pickupStateLabel = (consignment as any).pickUp_StateLabel;
    
    const mapStatus = (status: string | null, isPickup: boolean = false) => {
      if (!status) return null;
      if (status === 'Traveling') return 'In Transit';
      if (status === 'Positive outcome') return isPickup ? 'Picked Up' : 'Delivered';
      return status; // Return exact value for anything else
    };
    
    return mapStatus(deliveryStateLabel, false) || mapStatus(pickupStateLabel, true) || 'In Transit';
  };

  // Filter consignments based on search term, temperature zone, warehouse company, and date range
  const filteredConsignments = (consignments as Consignment[]).filter((consignment: Consignment) => {
    const matchesSearch = searchTerm === "" || 
      (consignment.consignmentNo && consignment.consignmentNo.toLowerCase().includes(searchTerm.toLowerCase()));
    const tempZone = getTemperatureZone(consignment);
    const matchesTempZone = selectedTempZone === "all" || tempZone === selectedTempZone;
    const matchesWarehouse = selectedWarehouse === "all" || 
      consignment.warehouseCompanyName === selectedWarehouse;
    
    // Date filtering logic
    const matchesDateRange = (() => {
      if (!fromDate && !toDate) return true;
      
      const consignmentDate = consignment.departureDateTime || consignment.delivery_PlannedETA;
      if (!consignmentDate) return false;
      
      const date = new Date(consignmentDate).toISOString().split('T')[0];
      
      if (fromDate && toDate) {
        return date >= fromDate && date <= toDate;
      } else if (fromDate) {
        return date >= fromDate;
      } else if (toDate) {
        return date <= toDate;
      }
      return true;
    })();
    
    return matchesSearch && matchesTempZone && matchesWarehouse && matchesDateRange;
  });

  const handleViewDetails = (consignment: Consignment) => {
    setSelectedConsignment(consignment);
  };

  const handleCloseModal = () => {
    setSelectedConsignment(null);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="gradient-primary shadow-header z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-white">ChillTrack</h1>
            <span className="ml-3 text-blue-100 text-sm">Professional Logistics Dashboard</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center text-white/90 text-sm mr-4 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              <span>{user?.email}</span>
            </div>
            <Button 
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
              onClick={() => window.location.href = '/analytics'}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button 
              className="gradient-accent hover:opacity-90 text-white border-0"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="gradient-card shadow-card rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Consignments</p>
                <p className="text-3xl font-bold text-gray-900">{consignments.length}</p>
              </div>
              <div className="bg-primary/10 p-3 rounded-lg">
                <Package className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>
          
          <div className="gradient-card shadow-card rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Transit</p>
                <p className="text-3xl font-bold text-blue-600">{consignments.filter(c => c.status === "In Transit").length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="gradient-card shadow-card rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Delivered</p>
                <p className="text-3xl font-bold text-green-600">{consignments.filter(c => c.status === "Delivered").length}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <Package className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="gradient-card shadow-card rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{consignments.filter(c => c.status !== "In Transit" && c.status !== "Delivered").length}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Consignment Overview</h2>
            <p className="text-gray-600 mt-1">Monitor and track your temperature-controlled shipments</p>
          </div>
          <div className="flex gap-2">
            <SyncDataButton />
          </div>
        </div>
        
        {/* Search and Filter */}
        <div className="gradient-card shadow-card rounded-xl p-6 mb-8 border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-5 w-5 text-primary" />
                <label htmlFor="reference-search" className="text-sm font-semibold text-gray-700">
                  Search by Reference
                </label>
              </div>
              <Input
                id="reference-search"
                placeholder="Enter reference number..."
                className="w-full border-gray-200 focus:border-primary focus:ring-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  Warehouse
                </label>
              </div>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger className="w-full border-gray-200 focus:border-primary focus:ring-primary/20">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouseCompanies.map((warehouse) => (
                    <SelectItem key={warehouse} value={warehouse}>
                      {warehouse}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  From Date
                </label>
              </div>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border-gray-200 focus:border-primary focus:ring-primary/20"
              />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  To Date
                </label>
              </div>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border-gray-200 focus:border-primary focus:ring-primary/20"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                <Package className="h-4 w-4 text-gray-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">{filteredConsignments.length}</span>
                <span className="text-sm text-gray-500 ml-1">found</span>
              </div>
              {(fromDate || toDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                  className="text-xs"
                >
                  Clear Dates
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Consignments List */}
        <div className="gradient-card shadow-card rounded-xl overflow-hidden border border-white/20">
          {isLoading ? (
            /* Loading skeletons */
            <>
              {[...Array(5)].map((_, index) => (
                <div key={index} className="grid grid-cols-7 p-4 border-b border-gray-100 items-center">
                  <div className="col-span-1"><Skeleton className="h-5 w-28" /></div>
                  <div className="col-span-1"><Skeleton className="h-5 w-20" /></div>
                  <div className="col-span-1"><Skeleton className="h-5 w-24" /></div>
                  <div className="col-span-1"><Skeleton className="h-5 w-20" /></div>
                  <div className="col-span-1"><Skeleton className="h-5 w-20" /></div>
                  <div className="col-span-1"><Skeleton className="h-5 w-16" /></div>
                  <div className="col-span-1 text-center"><Skeleton className="h-9 w-24 mx-auto" /></div>
                </div>
              ))}
            </>
          ) : filteredConsignments.length > 0 ? (
            /* Consignments table */
            <DashboardTable
              consignments={filteredConsignments}
              onViewDetails={handleViewDetails}
              getStatusDisplay={getStatusDisplay}
            />
          ) : (
            /* No consignments found */
            <div className="text-center py-12">
              <div className="flex flex-col items-center">
                <Package className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 font-medium">No consignments found matching your search criteria.</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your search term or filters.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedConsignment && (
        <ConsignmentDetailModal
          consignment={selectedConsignment}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}