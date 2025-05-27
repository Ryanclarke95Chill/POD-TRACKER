import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Consignment } from "@shared/schema";
import TimelineEvent from "./timeline-event";

interface ConsignmentDetailModalProps {
  consignment: Consignment;
  onClose: () => void;
}

export default function ConsignmentDetailModal({
  consignment,
  onClose,
}: ConsignmentDetailModalProps) {
  // Helper to determine status badge color
  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "In Transit":
        return "bg-status-transit";
      case "Delivered":
        return "bg-status-delivered";
      case "Awaiting Pickup":
        return "bg-status-awaiting";
      default:
        return "bg-neutral-400";
    }
  };

  // Helper to determine temperature zone dot color
  const getTempZoneClass = (tempZone: string): string => {
    if (tempZone.includes("Dry")) return "bg-temp-dry";
    if (tempZone.includes("Chiller")) return "bg-temp-chiller";
    if (tempZone.includes("Freezer")) return "bg-temp-freezer";
    if (tempZone.includes("Wine")) return "bg-temp-wine";
    if (tempZone.includes("Confectionery")) return "bg-temp-confectionery";
    if (tempZone.includes("Pharma")) return "bg-temp-pharma";
    return "bg-neutral-400";
  };

  // Helper to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "In Transit":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
            <path d="M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 13.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
            <circle cx="7" cy="6" r="5" opacity=".2"></circle>
            <path d="M18 6v4c0 2-2 2-2 2h-4a2 2 0 0 1-2-2v-1"></path>
            <path d="M14 13.5v3c0 2-2 2-2 2H8a2 2 0 0 1-2-2v-1"></path>
          </svg>
        );
      case "Delivered":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
            <path d="M21 7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7Z" opacity=".2"></path>
            <path d="m9 10 3 3 9-9"></path>
            <path d="M20 12v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h9"></path>
          </svg>
        );
      case "Awaiting Pickup":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
            <path d="M12 2v20"></path>
            <path d="M2 12h20"></path>
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        );
    }
  };

  return (
    <Dialog open={!!consignment} onOpenChange={() => onClose()}>
      <DialogTitle className="sr-only">Consignment Details</DialogTitle>
      <DialogDescription className="sr-only">View detailed information about this shipment</DialogDescription>
      <DialogContent className="sm:max-w-4xl p-0 overflow-auto max-h-[80vh] rounded-xl">
        {/* Header section with color based on status */}
        <div className={`px-6 py-5 border-b ${
          consignment.status === "Delivered" ? 'bg-green-50 border-green-100' : 
          consignment.status === "In Transit" ? 'bg-amber-50 border-amber-100' : 
          'bg-blue-50 border-blue-100'
        }`}>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center">
              <div className="mr-4">{getStatusIcon(consignment.status)}</div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold consignment-number font-mono text-primary">
                    {consignment.consignmentNumber}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStatusBadgeClass(consignment.status)}`}>
                    {consignment.status}
                  </span>
                </div>
                <p className="text-neutral-700 font-medium mt-1">{consignment.customerName}</p>
              </div>
            </div>
            
            <div>
              <div className={`inline-flex items-center px-3 py-1.5 rounded ${getTempZoneClass(consignment.temperatureZone)} bg-opacity-20`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"></path>
                </svg>
                <span className="font-medium">{consignment.temperatureZone}</span>
              </div>
            </div>
          </div>
          
          {/* External Tracking Link Section */}
          {consignment.trackingLink && (
            <div className="mx-6 mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 mr-3">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  <div>
                    <h4 className="text-sm font-semibold text-blue-800">External Tracking Available</h4>
                    <p className="text-xs text-blue-600">View detailed tracking from carrier's system</p>
                  </div>
                </div>
                <a 
                  href={consignment.trackingLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                >
                  Open Tracking
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2">
                    <path d="M7 7h10v10"></path>
                    <path d="M7 17 17 7"></path>
                  </svg>
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Route and delivery info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Route visualization */}
            <div className="bg-white rounded-xl border border-neutral-100 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                </svg>
                Shipping Route
              </h4>
              
              <div className="flex items-stretch mb-2 gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-6 w-6 rounded-full bg-blue-100 border-2 border-blue-500 z-10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </div>
                  <div className="flex-1 w-0.5 bg-neutral-200 my-1.5 relative">
                    {consignment.status === "In Transit" && (
                      <div className="absolute -left-3 top-1/3 w-6 h-6 rounded-full border-2 border-amber-400 bg-amber-50 animate-pulse z-10 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                          <polyline points="17 2 12 7 7 2"></polyline>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="h-6 w-6 rounded-full bg-green-100 border-2 border-green-500 z-10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-700 font-semibold">Origin</p>
                    <p className="text-sm font-medium mb-1">{consignment.pickupAddress}</p>
                  </div>
                  <div className="my-2 px-3">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 mr-2">
                        <path d="M3 17h6M7 21V3M14 17h7M14 3h7M14 10h7"></path>
                      </svg>
                      <span className="text-xs text-neutral-500">{consignment.lastKnownLocation}</span>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-700 font-semibold">Destination</p>
                    <p className="text-sm font-medium mb-1">{consignment.deliveryAddress}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Delivery Info */}
            <div className="bg-white rounded-xl border border-neutral-100 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                Delivery Information
              </h4>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-neutral-100 p-2 rounded-full mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-medium">
                      {consignment.status === "Delivered" ? "Delivered On" : "Estimated Delivery"}
                    </p>
                    <p className="text-sm font-semibold text-neutral-800">{consignment.estimatedDeliveryDate}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-neutral-100 p-2 rounded-full mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
                      <path d="M21 8.25c0 2.485-2.01 4.5-4.5 4.5S12 10.735 12 8.25 14.01 3.75 16.5 3.75 21 5.765 21 8.25zm-18 0c0 2.485 2.01 4.5 4.5 4.5s4.5-2.015 4.5-4.5S9.99 3.75 7.5 3.75 3 5.765 3 8.25zM7.5 15.75c-2.485 0-4.5 2.015-4.5 4.5s2.015 4.5 4.5 4.5 4.5-2.015 4.5-4.5-2.015-4.5-4.5-4.5zm9 0c-2.485 0-4.5 2.015-4.5 4.5s2.015 4.5 4.5 4.5 4.5-2.015 4.5-4.5-2.015-4.5-4.5-4.5z"></path>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-medium">Status</p>
                    <p className="text-sm font-semibold text-neutral-800">{consignment.status}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-neutral-100 p-2 rounded-full mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
                      <path d="M8 6h10"></path>
                      <path d="M6 12h9"></path>
                      <path d="M11 18h7"></path>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-medium">Last Event</p>
                    <p className="text-sm font-semibold text-neutral-800">
                      {consignment.events[0]?.description || "No events recorded"}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {consignment.events[0]?.timestamp || ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Timeline */}
          <div className="mb-6">
            <h4 className="text-base font-semibold text-neutral-800 mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary">
                <path d="M21 8V6.2c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C19.48 3 18.92 3 17.8 3H6.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C3 4.52 3 5.08 3 6.2v1.8"></path>
                <path d="M2 12h20"></path>
                <path d="M3 16.8v1c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21h11.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 19.48 21 18.92 21 17.8v-1"></path>
                <path d="M12 12v9"></path>
                <path d="M12 12L2 7"></path>
                <path d="M12 12l10-5"></path>
              </svg>
              Tracking Timeline
            </h4>
            
            <div className="bg-white rounded-xl border border-neutral-100 p-6 shadow-sm">
              <div className="flow-root max-w-3xl mx-auto">
                <ul role="list" className="-mb-8">
                  {Array.isArray(consignment.events) ? consignment.events.map((event, index) => (
                    <TimelineEvent
                      key={index}
                      event={event}
                      isLast={index === consignment.events.length - 1}
                    />
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No timeline events available for this consignment</p>
                    </div>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={onClose} 
              className="bg-primary hover:bg-primary-dark text-white shadow"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M18 6 6 18"></path>
                <path d="m6 6 12 12"></path>
              </svg>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
