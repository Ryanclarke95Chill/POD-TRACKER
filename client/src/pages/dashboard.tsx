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
      <header className="bg-gradient-to-r from-primary-dark via-primary to-primary-light text-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-white">ChillTrack</h1>
            <span className="ml-2 bg-white text-primary text-xs px-2 py-0.5 rounded-full font-medium">Temperature Tracking</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center px-3 py-1 bg-white/20 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span className="text-sm">{user?.email}</span>
            </div>
            <Button 
              variant="secondary" 
              className="bg-white text-primary hover:bg-white/90 transition-all shadow-sm"
              onClick={() => window.location.href = '/admin'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Admin
            </Button>
            <Button 
              variant="outline" 
              className="border-white/30 text-white hover:bg-white/10 hover:text-white"
              onClick={logout}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-neutral-800">Your Consignments</h2>
            <p className="text-neutral-500 mt-1">Track your temperature-controlled shipments in real-time</p>
          </div>
          
          {/* Summary Stats Cards */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-blue-50 rounded-lg px-4 py-2 border border-blue-100 flex items-center">
              <div className="bg-blue-100 p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </div>
              <div>
                <p className="text-xs text-blue-500 font-medium">Active</p>
                <p className="text-lg font-bold text-blue-700">{consignments.filter(c => c.status === "In Transit").length}</p>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg px-4 py-2 border border-green-100 flex items-center">
              <div className="bg-green-100 p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div>
                <p className="text-xs text-green-500 font-medium">Delivered</p>
                <p className="text-lg font-bold text-green-700">{consignments.filter(c => c.status === "Delivered").length}</p>
              </div>
            </div>
            
            <div className="bg-amber-50 rounded-lg px-4 py-2 border border-amber-100 flex items-center">
              <div className="bg-amber-100 p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div>
                <p className="text-xs text-amber-500 font-medium">Awaiting</p>
                <p className="text-lg font-bold text-amber-700">{consignments.filter(c => c.status === "Awaiting Pickup").length}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Temperature Zone Filter */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative w-full md:w-96">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"></path>
                </svg>
                <label htmlFor="temperature-filter" className="text-sm font-medium text-neutral-700">
                  Filter by Temperature Zone
                </label>
              </div>
              <Select value={selectedTempZone} onValueChange={handleTempZoneChange}>
                <SelectTrigger className="w-full border border-neutral-200 rounded-lg focus:ring-primary">
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
            
            <div className="flex items-center bg-neutral-50 rounded-full px-4 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500 mr-2">
                <path d="m21 21-6-6m2-5a7.001 7.001 0 0 1-11.095 5.679A7 7 0 1 1 17 10z"></path>
              </svg>
              <span className="text-sm font-medium text-neutral-700">{filteredConsignments.length}</span>
              <span className="text-sm text-neutral-500 ml-1">consignments found</span>
            </div>
          </div>
          
          {/* Temperature Zone Legend */}
          <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-neutral-100">
            {temperatureZones.map((zone, index) => {
              const zoneKey = zone.split(" ")[0].toLowerCase();
              return (
                <div 
                  key={index} 
                  className={`text-xs flex items-center rounded-full px-2 py-1 ${
                    selectedTempZone === zone ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-700'
                  } cursor-pointer`}
                  onClick={() => handleTempZoneChange(zone)}
                >
                  <span className={`inline-block w-2 h-2 rounded-full bg-temp-${zoneKey} mr-1`}></span>
                  {zone}
                </div>
              );
            })}
            <div 
              className={`text-xs flex items-center rounded-full px-2 py-1 ${
                selectedTempZone === 'all' ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-700'
              } cursor-pointer`}
              onClick={() => handleTempZoneChange('all')}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-neutral-400 mr-1"></span>
              Show All
            </div>
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
