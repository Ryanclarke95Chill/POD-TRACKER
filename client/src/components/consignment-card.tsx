import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Consignment } from "@shared/schema";
import { formatToAEST } from "@/lib/utils";

interface ConsignmentCardProps {
  consignment: Consignment;
  onViewDetails: () => void;
}

export default function ConsignmentCard({ consignment, onViewDetails }: ConsignmentCardProps) {
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
            <path d="M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 13.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
            <circle cx="7" cy="6" r="5" opacity=".2"></circle>
            <path d="M18 6v4c0 2-2 2-2 2h-4a2 2 0 0 1-2-2v-1"></path>
            <path d="M14 13.5v3c0 2-2 2-2 2H8a2 2 0 0 1-2-2v-1"></path>
          </svg>
        );
      case "Delivered":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
            <path d="M21 7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7Z" opacity=".2"></path>
            <path d="m9 10 3 3 9-9"></path>
            <path d="M20 12v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h9"></path>
          </svg>
        );
      case "Awaiting Pickup":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
            <path d="M12 2v20"></path>
            <path d="M2 12h20"></path>
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        );
    }
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm overflow-hidden border border-neutral-100 hover:shadow-md transition-all duration-200">
      <div className="p-6">
        {/* Status badge and consignment number */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-2">
            {getStatusIcon(consignment.status)}
            <h3 className="font-mono text-base font-bold consignment-number text-primary">
              {consignment.consignmentNumber}
            </h3>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStatusBadgeClass(consignment.status)}`}>
            {consignment.status}
          </span>
        </div>
        
        {/* Customer and temperature info */}
        <div className="mb-4">
          <p className="text-neutral-800 font-medium text-lg">{consignment.customerName}</p>
          <div className="mt-1 flex items-center">
            <div className={`px-2 py-1 rounded text-xs font-medium flex items-center ${getTempZoneClass(consignment.temperatureZone)} bg-opacity-20`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"></path>
              </svg>
              <span>{consignment.temperatureZone}</span>
            </div>
          </div>
        </div>
        
        {/* Route info with visual indicator */}
        <div className="flex items-stretch mb-4 gap-1.5">
          <div className="flex flex-col items-center">
            <div className="h-4 w-4 rounded-full bg-blue-100 border-2 border-blue-400 z-10"></div>
            <div className="flex-1 w-0.5 bg-neutral-200 my-1"></div>
            <div className="h-4 w-4 rounded-full bg-green-100 border-2 border-green-400 z-10"></div>
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div className="bg-blue-50 rounded p-2">
              <p className="text-xs text-blue-700 font-medium">From</p>
              <p className="text-sm font-medium">{consignment.pickupAddress}</p>
            </div>
            <div className="bg-green-50 rounded p-2">
              <p className="text-xs text-green-700 font-medium">To</p>
              <p className="text-sm font-medium">{consignment.deliveryAddress}</p>
            </div>
          </div>
        </div>
        
        {/* Additional details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-neutral-50 rounded p-2">
            <p className="text-xs text-neutral-500 font-medium">
              {consignment.status === "Delivered" ? "Delivered On" : "Estimated Delivery"}
            </p>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 mr-1">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <p className="text-sm font-medium">{formatToAEST(consignment.estimatedDeliveryDate)}</p>
            </div>
          </div>
          <div className="bg-neutral-50 rounded p-2">
            <p className="text-xs text-neutral-500 font-medium">Last Known Location</p>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 mr-1">
                <path d="M19 5H5l7 7Z" opacity=".2"></path>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <p className="text-sm font-medium">{consignment.lastKnownLocation}</p>
            </div>
          </div>
        </div>
        
        {/* View details button */}
        <Button 
          onClick={onViewDetails}
          variant="default" 
          className="w-full rounded-lg bg-primary hover:bg-primary-dark text-white font-medium flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          View Details
        </Button>
      </div>
    </Card>
  );
}
