import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Clock, MapPin, ExternalLink, Map, Thermometer, CheckCircle, Truck } from "lucide-react";
import { useState } from "react";

interface ConsignmentDetailModalProps {
  consignment: any;
  onClose: () => void;
}

export default function ConsignmentDetailModal({
  consignment,
  onClose,
}: ConsignmentDetailModalProps) {
  const [showMap, setShowMap] = useState(false);

  if (!consignment) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusDisplay = () => {
    const deliveryStateLabel = consignment.delivery_StateLabel;
    const pickupStateLabel = consignment.pickUp_StateLabel;
    
    const mapStatus = (status: string | null, isPickup: boolean = false) => {
      if (!status) return null;
      if (status === 'Traveling') return 'In Transit';
      if (status === 'Positive outcome') return isPickup ? 'Picked Up' : 'Delivered';
      return status;
    };
    
    return mapStatus(deliveryStateLabel, false) || mapStatus(pickupStateLabel, true) || 'In Transit';
  };

  const getStatusColor = (status: string) => {
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

  // Parse GPS coordinates
  const parseCoordinates = (coordString: string | null) => {
    if (!coordString) return null;
    const parts = coordString.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lon)) {
        return { lat, lon };
      }
    }
    return null;
  };

  const currentCoords = parseCoordinates(consignment.delivery_LastPositionLatLon || consignment.pickUp_LastPositionLatLon || consignment.lastPositionLatLon);

  return (
    <Dialog open={!!consignment} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-5xl w-[95vw] p-0 overflow-auto max-h-[90vh] rounded-xl">
        <DialogHeader className="p-6 border-b bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Package className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-xl font-bold font-mono truncate">
                  {consignment.orderNumberRef || consignment.consignmentNo || `${consignment.year}-${consignment.code}-${consignment.prog}` || 'Unknown'}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 truncate">
                  {consignment.shipToCompanyName || 'Unknown Customer'}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={`px-2 py-1 text-xs ${getStatusColor(getStatusDisplay())}`}>
                {getStatusDisplay()}
              </Badge>
              <Badge variant="outline" className="text-gray-600 text-xs px-2 py-1">
                <Thermometer className="h-3 w-3 mr-1" />
                {consignment.documentNote?.split('\\n')[0] || consignment.expectedTemperature || 'Standard'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Address Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pickup Address */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-600" />
                Pickup Address
              </h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{consignment.shipFromCompanyName || 'Not specified'}</p>
                <p className="text-gray-600">
                  {[
                    consignment.shipFromAddress,
                    consignment.shipFromCity,
                    consignment.shipFromZipCode
                  ].filter(Boolean).join(', ') || 'Address not available'}
                </p>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                Delivery Address
              </h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{consignment.shipToCompanyName || 'Not specified'}</p>
                <p className="text-gray-600">
                  {[
                    consignment.shipToAddress,
                    consignment.shipToCity,
                    consignment.shipToZipCode
                  ].filter(Boolean).join(', ') || 'Address not available'}
                </p>
              </div>
            </div>
          </div>



          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Delivery Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Delivery Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Planned ETA</p>
                  <p className="text-sm font-medium">{formatDate(consignment.delivery_PlannedETA) || 'Not scheduled'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <Badge className={`${getStatusColor(getStatusDisplay())} text-xs mb-2`}>
                    {getStatusDisplay()}
                  </Badge>
                  {(consignment.delivery_OutcomePODReasonContextCode || consignment.pickUp_OutcomePODReasonContextCode) && (
                    <div className="mb-2">
                      <p className="text-xs text-red-600 font-medium">
                        Issue: {consignment.delivery_OutcomePODReason || consignment.pickUp_OutcomePODReason}
                      </p>
                      {(consignment.delivery_OutcomePODReasonGroup || consignment.pickUp_OutcomePODReasonGroup) && (
                        <p className="text-xs text-gray-500">
                          Category: {consignment.delivery_OutcomePODReasonGroup || consignment.pickUp_OutcomePODReasonGroup}
                        </p>
                      )}
                    </div>
                  )}
                  {consignment.deliveryLiveTrackLink && (
                    <div>
                      <Button
                        onClick={() => window.open(consignment.deliveryLiveTrackLink || '', '_blank')}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 h-auto"
                        size="sm"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Track Live
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Package Details */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600" />
                Package Details
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Temperature Zone</p>
                  <p className="text-sm font-medium">
                    {consignment.documentNote?.split('\\n')[0] || consignment.expectedTemperature || 'Standard'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Items</p>
                    <p className="text-sm font-medium">{consignment.qty1 || 0} {consignment.um1 || 'Items'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pallets</p>
                    <p className="text-sm font-medium">{consignment.qty2 || 0} {consignment.um2 || 'Pallets'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Volume</p>
                    <p className="text-sm font-medium">{consignment.volumeInM3 || 0}m³</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Weight</p>
                    <p className="text-sm font-medium">{consignment.totalWeightInKg || 0}kg</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Window Analysis */}
          {(() => {
            const status = getStatusDisplay();
            const isDelivered = status === 'Delivered' || status === 'Complete';
            const isPickedUp = status === 'Picked Up';
            const hasPickupData = consignment.pickUp_PlannedDateTime || consignment.pickUp_ActualDateTime || consignment.pickupDate || consignment.pickupActualDateTime;
            const hasDeliveryData = consignment.delivery_PlannedDateTime || consignment.delivery_ActualDateTime || consignment.deliveryDate || consignment.deliveryActualDateTime || consignment.estimatedDeliveryDate;
            
            if (!hasPickupData && !hasDeliveryData) return null;
            
            return (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    {isDelivered ? 'Delivery Window Analysis' : isPickedUp ? 'Pickup Window Analysis' : 'Time Window Analysis'}
                  </h3>
                </div>
                <div className="space-y-4">
                  {/* Show Pickup Window only if we have pickup data and it's relevant */}
                  {hasPickupData && (
                    <div className="border-l-4 border-orange-400 pl-4">
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">PICKUP WINDOW</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Planned Pickup</p>
                          <p className="text-sm font-medium">
                            {formatDate(consignment.pickUp_PlannedDateTime) || formatDate(consignment.pickupDate) || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Actual Pickup</p>
                          <p className="text-sm font-medium">
                            {formatDate(consignment.pickUp_ActualDateTime) || formatDate(consignment.pickupActualDateTime) || '-'}
                          </p>
                        </div>
                      </div>
                      {consignment.pickUp_PlannedDateTime && consignment.pickUp_ActualDateTime && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Pickup Performance</p>
                          <Badge className={
                            new Date(consignment.pickUp_ActualDateTime) <= new Date(consignment.pickUp_PlannedDateTime) 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-red-100 text-red-800 border-red-200'
                          }>
                            {new Date(consignment.pickUp_ActualDateTime) <= new Date(consignment.pickUp_PlannedDateTime) 
                              ? 'On Time' 
                              : 'Late'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show Delivery Window only if we have delivery data and it's a delivery */}
                  {hasDeliveryData && !isPickedUp && (
                    <div className="border-l-4 border-green-400 pl-4">
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">DELIVERY WINDOW</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Planned Delivery</p>
                          <p className="text-sm font-medium">
                            {formatDate(consignment.delivery_PlannedDateTime) || formatDate(consignment.deliveryDate) || formatDate(consignment.estimatedDeliveryDate) || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Actual Delivery</p>
                          <p className="text-sm font-medium">
                            {formatDate(consignment.delivery_ActualDateTime) || formatDate(consignment.deliveryActualDateTime) || '-'}
                          </p>
                        </div>
                      </div>
                      {(consignment.delivery_PlannedDateTime || consignment.deliveryDate || consignment.estimatedDeliveryDate) && 
                       (consignment.delivery_ActualDateTime || consignment.deliveryActualDateTime) && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Delivery Performance</p>
                          <Badge className={
                            new Date(consignment.delivery_ActualDateTime || consignment.deliveryActualDateTime) <= 
                            new Date(consignment.delivery_PlannedDateTime || consignment.deliveryDate || consignment.estimatedDeliveryDate)
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-red-100 text-red-800 border-red-200'
                          }>
                            {new Date(consignment.delivery_ActualDateTime || consignment.deliveryActualDateTime) <= 
                             new Date(consignment.delivery_PlannedDateTime || consignment.deliveryDate || consignment.estimatedDeliveryDate)
                              ? 'On Time' 
                              : 'Late'}
                          </Badge>
                          <div className="mt-1 text-xs text-gray-500">
                            {(() => {
                              const planned = new Date(consignment.delivery_PlannedDateTime || consignment.deliveryDate || consignment.estimatedDeliveryDate);
                              const actual = new Date(consignment.delivery_ActualDateTime || consignment.deliveryActualDateTime);
                              const diffMs = actual.getTime() - planned.getTime();
                              const diffHours = Math.round(diffMs / (1000 * 60 * 60));
                              return diffHours > 0 ? `${diffHours}h late` : `${Math.abs(diffHours)}h early`;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Transit Time - only show if we have both pickup and delivery actual times */}
                  {consignment.pickUp_ActualDateTime && (consignment.delivery_ActualDateTime || consignment.deliveryActualDateTime) && (
                    <div className="border-l-4 border-blue-400 pl-4">
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">TRANSIT TIME</h4>
                      <p className="text-sm font-medium">
                        {(() => {
                          const pickup = new Date(consignment.pickUp_ActualDateTime);
                          const delivery = new Date(consignment.delivery_ActualDateTime || consignment.deliveryActualDateTime);
                          const diffMs = delivery.getTime() - pickup.getTime();
                          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                          return diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${diffHours}h`;
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Location Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                Location Tracking
              </h3>
              {currentCoords && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMap(!showMap)}
                  className="text-gray-700 border-gray-300 hover:bg-gray-100"
                >
                  <Map className="h-4 w-4 mr-2" />
                  {showMap ? 'Hide Map' : 'Show Map'}
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Last Known Position</p>
                <p className="text-sm font-medium">
                  {currentCoords ? `${currentCoords.lat}, ${currentCoords.lon}` : 'Position not available'}
                </p>
                {(consignment.delivery_LastPositionDateTime || consignment.pickUp_LastPositionDateTime || consignment.lastPositionDateTime) && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last updated: {formatDate(consignment.delivery_LastPositionDateTime || consignment.pickUp_LastPositionDateTime || consignment.lastPositionDateTime)}
                  </p>
                )}
              </div>
            </div>

            {/* Map View */}
            {showMap && currentCoords && (
              <div className="mt-4 border border-gray-300 rounded-lg overflow-hidden">
                <iframe
                  width="100%"
                  height="250"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${currentCoords.lon-0.005},${currentCoords.lat-0.005},${currentCoords.lon+0.005},${currentCoords.lat+0.005}&layer=mapnik&marker=${currentCoords.lat},${currentCoords.lon}`}
                  style={{ border: 0 }}
                  title="Location Map"
                />
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}