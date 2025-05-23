import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

  return (
    <Dialog open={!!consignment} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-lg font-medium text-neutral-900 consignment-number font-mono">
              {consignment.consignmentNumber}
            </DialogTitle>
            <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusBadgeClass(consignment.status)}`}>
              {consignment.status}
            </span>
          </div>
        </DialogHeader>

        <div className="bg-neutral-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-neutral-500">Customer</p>
              <p className="text-sm font-medium">{consignment.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Temperature Zone</p>
              <div className="mt-1 flex items-center text-sm">
                <span className={`inline-block w-3 h-3 rounded-full ${getTempZoneClass(consignment.temperatureZone)} mr-2`}></span>
                <span>{consignment.temperatureZone}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-neutral-500">
                {consignment.status === "Delivered" ? "Delivered On" : "Estimated Delivery"}
              </p>
              <p className="text-sm font-medium">{consignment.estimatedDeliveryDate}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">From</p>
              <p className="text-sm font-medium">{consignment.pickupAddress}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">To</p>
              <p className="text-sm font-medium">{consignment.deliveryAddress}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Last Known Location</p>
              <p className="text-sm font-medium">{consignment.lastKnownLocation}</p>
            </div>
          </div>
        </div>

        <h4 className="font-medium text-neutral-800 mb-4">Tracking Timeline</h4>

        {/* Timeline */}
        <div className="flow-root">
          <ul role="list" className="-mb-8">
            {consignment.events.map((event, index) => (
              <TimelineEvent
                key={index}
                event={event}
                isLast={index === consignment.events.length - 1}
              />
            ))}
          </ul>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
