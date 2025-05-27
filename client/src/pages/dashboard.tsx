import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConsignmentCard from "@/components/consignment-card";
import ConsignmentDetailModal from "@/components/consignment-detail-modal";
import { getUser, logout } from "@/lib/auth";
import { Consignment, temperatureZones } from "@shared/schema";

export default function Dashboard() {
  const [selectedTempZone, setSelectedTempZone] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const user = getUser();

  const { data: consignments = [], isLoading } = useQuery<Consignment[]>({
    queryKey: ["/api/consignments"],
  });

  const filteredConsignments = consignments.filter(c => {
    // Filter by search term if provided
    if (searchTerm.trim() !== "") {
      return c.consignmentNumber.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

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
      <header className="bg-primary text-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-white">ChillTrack</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center text-white/80 text-sm mr-2">
              <span>{user?.email}</span>
            </div>
            <Button 
              variant="ghost" 
              className="h-9 px-3 text-white hover:bg-white/10 hover:text-white"
              onClick={() => window.location.href = '/analytics'}
            >
              Analytics
            </Button>
            <Button 
              variant="ghost" 
              className="h-9 px-3 text-white hover:bg-white/10 hover:text-white"
              onClick={() => window.location.href = '/simple-import'}
            >
              Import Data
            </Button>
            <Button 
              variant="ghost" 
              className="h-9 px-3 text-white hover:bg-white/10 hover:text-white"
              onClick={() => window.location.href = '/admin'}
            >
              Admin
            </Button>
            <Button 
              variant="ghost" 
              className="h-9 px-3 text-white hover:bg-white/10 hover:text-white"
              onClick={logout}
            >
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
        
        {/* Search Filter */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative w-full md:w-96">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="m21 21-6-6m2-5a7.001 7.001 0 0 1-11.095 5.679A7 7 0 1 1 17 10z"></path>
                </svg>
                <label htmlFor="reference-search" className="text-sm font-medium text-neutral-700">
                  Search by Reference Number
                </label>
              </div>
              <Input
                id="reference-search"
                placeholder="Enter consignment reference number..."
                className="w-full border border-neutral-200 rounded-lg focus:ring-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center bg-neutral-50 rounded-full px-4 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500 mr-2">
                <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10"></path>
                <line x1="16" y1="5" x2="22" y2="5"></line>
                <line x1="19" y1="2" x2="19" y2="8"></line>
                <circle cx="9" cy="9" r="2"></circle>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
              </svg>
              <span className="text-sm font-medium text-neutral-700">{filteredConsignments.length}</span>
              <span className="text-sm text-neutral-500 ml-1">consignments found</span>
            </div>
          </div>
        </div>
        
        {/* Consignments List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-200 p-4 font-medium text-neutral-700 text-sm">
            <div className="col-span-1">Reference #</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Customer</div>
            <div className="col-span-1">From</div>
            <div className="col-span-1">To</div>
            <div className="col-span-1">Temperature</div>
            <div className="col-span-1 text-center">Action</div>
          </div>
          
          {isLoading ? (
            /* Loading skeletons */
            <>
              {[...Array(5)].map((_, index) => (
                <div key={index} className="grid grid-cols-7 p-4 border-b border-neutral-100 items-center">
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
            /* Consignment list items */
            <>
              {filteredConsignments.map((consignment) => (
                <div key={consignment.id} className="grid grid-cols-7 p-4 border-b border-neutral-100 items-center hover:bg-neutral-50 transition-colors">
                  <div className="col-span-1 font-mono font-medium text-primary">{consignment.consignmentNumber}</div>
                  <div className="col-span-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${
                      consignment.status === "In Transit" ? "bg-status-transit" : 
                      consignment.status === "Delivered" ? "bg-status-delivered" : 
                      "bg-status-awaiting"
                    }`}>
                      {consignment.status}
                    </span>
                  </div>
                  <div className="col-span-1 truncate text-sm">{consignment.customerName}</div>
                  <div className="col-span-1 truncate text-sm">{consignment.pickupAddress}</div>
                  <div className="col-span-1 truncate text-sm">{consignment.deliveryAddress}</div>
                  <div className="col-span-1">
                    <div className="flex items-center text-xs">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        consignment.temperatureZone.includes("Dry") ? "bg-temp-dry" :
                        consignment.temperatureZone.includes("Chiller") ? "bg-temp-chiller" :
                        consignment.temperatureZone.includes("Freezer") ? "bg-temp-freezer" :
                        consignment.temperatureZone.includes("Wine") ? "bg-temp-wine" :
                        consignment.temperatureZone.includes("Confectionery") ? "bg-temp-confectionery" :
                        consignment.temperatureZone.includes("Pharma") ? "bg-temp-pharma" :
                        "bg-neutral-400"
                      } mr-1`}></span>
                      <span className="truncate">{consignment.temperatureZone}</span>
                    </div>
                  </div>
                  <div className="col-span-1 text-center">
                    <Button 
                      onClick={() => handleViewDetails(consignment)}
                      variant="outline" 
                      className="text-xs h-8 px-3 border-primary text-primary hover:bg-primary/5"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            /* No consignments found */
            <div className="text-center py-12">
              <p className="text-neutral-500">No consignments found matching your search criteria.</p>
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
