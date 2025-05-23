import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ConsignmentCard from "@/components/consignment-card";
import ConsignmentDetailModal from "@/components/consignment-detail-modal";
import { getUser, logout } from "@/lib/auth";
import { Consignment, temperatureZones } from "@shared/schema";

export default function Dashboard() {
  const [selectedTempZone, setSelectedTempZone] = useState<string>("all");
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const user = getUser();

  const { data: consignments = [], isLoading } = useQuery<Consignment[]>({
    queryKey: ["/api/consignments"],
  });

  const filteredConsignments = selectedTempZone === "all" 
    ? consignments 
    : consignments.filter(c => c.temperatureZone === selectedTempZone);

  const handleTempZoneChange = (value: string) => {
    setSelectedTempZone(value);
  };

  const handleViewDetails = (consignment: Consignment) => {
    setSelectedConsignment(consignment);
  };

  const handleCloseModal = () => {
    setSelectedConsignment(null);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-primary">ChillTrack</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-neutral-600 hidden sm:inline-block">{user?.email}</span>
            <Button 
              variant="outline" 
              className="text-neutral-600"
              onClick={() => window.location.href = '/admin'}
            >
              Admin
            </Button>
            <Button 
              variant="ghost" 
              className="text-neutral-600 hover:text-neutral-900"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-800">Your Consignments</h2>
          <p className="text-neutral-500 mt-1">Track your shipments in real-time</p>
        </div>
        
        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative w-full sm:w-64">
            <label htmlFor="temperature-filter" className="block text-sm font-medium text-neutral-700 mb-1">
              Filter by Temperature Zone
            </label>
            <Select value={selectedTempZone} onValueChange={handleTempZoneChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Temperature Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Temperature Zones</SelectItem>
                {temperatureZones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-right text-sm text-neutral-500 pt-5">
            <span>{filteredConsignments.length}</span> consignments found
          </div>
        </div>
        
        {/* Consignments Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden border border-neutral-200 p-5">
                <Skeleton className="h-6 w-32 mb-3" />
                <Skeleton className="h-4 w-48 mb-4" />
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredConsignments.length > 0 ? (
              filteredConsignments.map((consignment) => (
                <ConsignmentCard 
                  key={consignment.id}
                  consignment={consignment}
                  onViewDetails={() => handleViewDetails(consignment)}
                />
              ))
            ) : (
              <div className="col-span-3 text-center py-8">
                <p className="text-neutral-500">No consignments found with the selected filter.</p>
              </div>
            )}
          </div>
        )}
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
