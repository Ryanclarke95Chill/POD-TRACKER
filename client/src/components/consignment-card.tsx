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

  return (
    <Card className="bg-white rounded-lg border border-neutral-200 hover:border-primary hover:shadow-sm transition-all duration-200">
      <div className="p-3">
        <div className="flex items-center justify-between">
          {/* Left section - Consignment info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Temperature zone indicator */}
            <div className={`w-3 h-3 rounded-full ${getTempZoneClass(consignment.temperatureZone)}`}></div>
            
            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold consignment-number font-mono text-primary">
                  {consignment.consignmentNumber}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${getStatusBadgeClass(consignment.status)}`}>
                  {consignment.status}
                </span>
              </div>
              <p className="text-xs text-neutral-600 font-medium truncate">{consignment.customerName}</p>
              <p className="text-xs text-neutral-500 truncate">{consignment.deliveryAddress}</p>
            </div>
            
            {/* Delivery info */}
            <div className="text-right text-xs flex-shrink-0">
              <p className="text-neutral-500 mb-1">
                {consignment.status === "Delivered" ? "Delivered" : "Est. Delivery"}
              </p>
              <p className="font-medium text-neutral-700">{formatToAEST(consignment.estimatedDeliveryDate)}</p>
            </div>
          </div>

          {/* Action button */}
          <div className="ml-3 flex-shrink-0">
            <Button 
              onClick={onViewDetails}
              variant="outline"
              size="sm"
              className="text-xs px-3 py-1.5 h-auto"
            >
              Details
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}