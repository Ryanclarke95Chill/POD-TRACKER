import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Consignment } from "@shared/schema";

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

  return (
    <Card className="bg-white rounded-lg shadow-md overflow-hidden border border-neutral-200 hover:shadow-lg transition-shadow duration-200">
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-mono text-lg font-bold consignment-number text-primary">
            {consignment.consignmentNumber}
          </h3>
          <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusBadgeClass(consignment.status)}`}>
            {consignment.status}
          </span>
        </div>
        
        <div className="mb-4">
          <p className="text-neutral-800 font-medium">{consignment.customerName}</p>
          <div className="mt-1 flex items-center text-sm text-neutral-500">
            <span className={`inline-block w-3 h-3 rounded-full ${getTempZoneClass(consignment.temperatureZone)} mr-2`}></span>
            <span>{consignment.temperatureZone}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-neutral-500">From</p>
            <p className="text-sm font-medium">{consignment.pickupAddress}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">To</p>
            <p className="text-sm font-medium">{consignment.deliveryAddress}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">
              {consignment.status === "Delivered" ? "Delivered On" : "Estimated Delivery"}
            </p>
            <p className="text-sm font-medium">{consignment.estimatedDeliveryDate}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Last Known Location</p>
            <p className="text-sm font-medium">{consignment.lastKnownLocation}</p>
          </div>
        </div>
        
        <Button 
          onClick={onViewDetails}
          variant="outline" 
          className="w-full mt-2 py-2 px-3 border-primary text-primary hover:bg-primary-light/10 font-medium"
        >
          View Details
        </Button>
      </div>
    </Card>
  );
}
