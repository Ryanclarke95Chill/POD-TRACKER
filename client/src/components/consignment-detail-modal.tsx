import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Consignment } from "@shared/schema";
import { ExternalLink, Package, Clock, MapPin, Thermometer, AlertTriangle, CheckCircle } from "lucide-react";

interface ConsignmentDetailModalProps {
  consignment: Consignment;
  onClose: () => void;
}

export default function ConsignmentDetailModal({
  consignment,
  onClose,
}: ConsignmentDetailModalProps) {
  // Parse events from JSON string if needed
  const events = typeof consignment.events === 'string' 
    ? JSON.parse(consignment.events || '[]') 
    : consignment.events || [];

  // Format date helper
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Get status color
  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'picked up':
      case 'in transit':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  // Get temperature zone color
  const getTempColor = (tempZone: string | null) => {
    if (tempZone?.includes('Frozen')) return 'text-blue-600';
    if (tempZone?.includes('Chilled')) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <Dialog open={!!consignment} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-5xl p-0 overflow-auto max-h-[90vh] rounded-xl">
        <DialogHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-blue-600" />
                <div>
                  <DialogTitle className="text-xl font-bold font-mono">
                    {consignment.orderNumberRef || consignment.consignmentNo || `${consignment.year}-${consignment.code}-${consignment.prog}` || 'Unknown'}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600">
                    {consignment.shipToCompanyName || 'Unknown Customer'}
                  </DialogDescription>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`px-3 py-1 ${getStatusColor(consignment.deliveryState || consignment.pickupState)}`}>
                {consignment.deliveryState || consignment.pickupState || 'In Transit'}
              </Badge>
              <Badge variant="outline" className={getTempColor(consignment.expectedTemperature)}>
                <Thermometer className="h-3 w-3 mr-1" />
                {consignment.expectedTemperature || 'Standard'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Live Tracking Link */}
          {consignment.deliveryLiveTrackLink && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-800">Live Tracking Available</h4>
                    <p className="text-xs text-blue-600">View real-time tracking from carrier</p>
                  </div>
                </div>
                <Button
                  onClick={() => window.open(consignment.deliveryLiveTrackLink || '', '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Live Tracking
                </Button>
              </div>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ETA Comparison */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-orange-600" />
                <h4 className="text-sm font-semibold text-gray-700">ETA Status</h4>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Planned Delivery ETA</p>
                  <p className="text-sm font-medium">{formatDate(consignment.delivery_PlannedETA)}</p>
                </div>
                {consignment.deliveryState === 'Delivered' && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span className="text-xs">Delivered on time</span>
                  </div>
                )}
              </div>
            </div>

            {/* Package Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-purple-600" />
                <h4 className="text-sm font-semibold text-gray-700">Package Details</h4>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Temperature Zone</p>
                  <p className={`text-sm font-medium ${getTempColor(consignment.expectedTemperature)}`}>
                    {consignment.expectedTemperature || 'Standard'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Current Status</p>
                  <p className="text-sm font-medium">{consignment.deliveryState || consignment.pickupState || 'In Transit'}</p>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-green-600" />
                <h4 className="text-sm font-semibold text-gray-700">Location</h4>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Last Known Location</p>
                  <p className="text-sm font-medium">{consignment.deliveryLastPosition || consignment.pickupLastPosition || 'In transit'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Route Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pickup Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                Pickup Location
              </h4>
              <div className="text-sm text-blue-700">
                <p className="font-medium">{consignment.shipFromCompanyName}</p>
                <p>{consignment.shipFromAddress}</p>
                <p>{consignment.shipFromCity} {consignment.shipFromZipCode}</p>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                Delivery Location
              </h4>
              <div className="text-sm text-green-700">
                <p className="font-medium">{consignment.shipToCompanyName}</p>
                <p>{consignment.shipToAddress}</p>
                <p>{consignment.shipToCity} {consignment.shipToZipCode}</p>
              </div>
            </div>
          </div>

          {/* Events Timeline */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Tracking Events
            </h4>
            <div className="max-h-64 overflow-y-auto space-y-3">
              {events.length > 0 ? (
                events.map((event: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="h-2 w-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {event.description || 'Event occurred'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(event.timestamp)} • {event.location || 'Unknown location'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No tracking events available</p>
                  <p className="text-xs text-gray-400">Events will appear here as the shipment progresses</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}