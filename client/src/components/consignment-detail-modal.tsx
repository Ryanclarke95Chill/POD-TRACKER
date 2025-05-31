import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Clock, MapPin, ExternalLink, Map, Thermometer, CheckCircle, Truck, AlertTriangle } from "lucide-react";
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

  const isConsignmentAtRisk = () => {
    const status = getStatusDisplay();
    // Only check active consignments
    if (status === "Delivered" || status === "Picked Up" || status === "Complete" || status === "Failed") {
      return { isAtRisk: false, reason: "" };
    }

    // Try multiple ETA field variations from the Axylog API
    const calculatedETA = consignment.delivery_calculatedETA || 
                          consignment.pickUp_calculatedETA ||
                          consignment.delivery_FirstCalculatedETA ||
                          consignment.pickUp_FirstCalculatedETA ||
                          consignment.delivery_ETA ||
                          consignment.pickUp_ETA;
                          
    if (!calculatedETA) {
      return { isAtRisk: false, reason: "" };
    }

    const etaDate = new Date(calculatedETA);

    // Check delivery window - try multiple field variations
    const deliveryFromTime = consignment.delivery_FromTime || consignment.deliveryFromTime;
    const deliveryToTime = consignment.delivery_ToTime || consignment.deliveryToTime;
    
    if (deliveryFromTime && deliveryToTime) {
      const deliveryEnd = new Date(deliveryToTime);
      
      if (etaDate > deliveryEnd) {
        const delayMinutes = Math.round((etaDate.getTime() - deliveryEnd.getTime()) / (1000 * 60));
        const delayHours = Math.floor(delayMinutes / 60);
        const remainingMinutes = delayMinutes % 60;
        
        let delayText = "";
        if (delayHours > 0) {
          delayText = `${delayHours}h ${remainingMinutes}m`;
        } else {
          delayText = `${remainingMinutes}m`;
        }
        
        return { 
          isAtRisk: true, 
          reason: `Delivery is expected ${delayText} after the scheduled window ends (${formatDate(deliveryToTime)}).`
        };
      }
    }

    // Check pickup window - try multiple field variations
    const pickupFromTime = consignment.pickUp_FromTime || consignment.pickupFromTime;
    const pickupToTime = consignment.pickUp_ToTime || consignment.pickupToTime;
    
    if (pickupFromTime && pickupToTime) {
      const pickupEnd = new Date(pickupToTime);
      
      if (etaDate > pickupEnd) {
        const delayMinutes = Math.round((etaDate.getTime() - pickupEnd.getTime()) / (1000 * 60));
        const delayHours = Math.floor(delayMinutes / 60);
        const remainingMinutes = delayMinutes % 60;
        
        let delayText = "";
        if (delayHours > 0) {
          delayText = `${delayHours}h ${remainingMinutes}m`;
        } else {
          delayText = `${remainingMinutes}m`;
        }
        
        return { 
          isAtRisk: true, 
          reason: `Pickup is expected ${delayText} after the scheduled window ends (${formatDate(pickupToTime)}).`
        };
      }
    }

    // Debug: For testing, let's add a temporary condition to show warning for GPS not present
    if (status === "GPS not present" || (consignment.delivery_StateLabel && consignment.delivery_StateLabel.includes('GPS not present'))) {
      return { 
        isAtRisk: true, 
        reason: `Delivery tracking is unavailable - GPS signal not present. Unable to monitor real-time progress.`
      };
    }

    return { isAtRisk: false, reason: "" };
  };

  const riskStatus = isConsignmentAtRisk();

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
          {/* At Risk Warning */}
          {riskStatus.isAtRisk && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-800 mb-1">Delivery At Risk</h3>
                  <p className="text-sm text-amber-700">{riskStatus.reason}</p>
                </div>
              </div>
            </div>
          )}
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

          {/* Time Window Analysis */}
          {(() => {
            // Determine consignment type based on which state labels are populated
            const isPickupConsignment = consignment.pickUp_StateLabel !== null;
            const isDeliveryConsignment = consignment.delivery_StateLabel !== null;
            
            if (!isPickupConsignment && !isDeliveryConsignment) return null;
            
            return (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    {isPickupConsignment ? 'Pickup Window Analysis' : 'Delivery Window Analysis'}
                  </h3>
                </div>
                <div className="space-y-4">
                  {/* Pickup Window - only for pickup consignments */}
                  {isPickupConsignment && (
                    <div className="border-l-4 border-orange-400 pl-4">
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">PICKUP DETAILS</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Scheduled Time</p>
                          <p className="text-sm font-medium">
                            {formatDate(consignment.pickUp_PlannedDateTime) || 
                             formatDate(consignment.minScheduledPickupTime) || 
                             formatDate(consignment.maxScheduledPickupTime) || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Completed Time</p>
                          <p className="text-sm font-medium">
                            {formatDate(consignment.pickUp_OutcomeDateTime) || '-'}
                          </p>
                        </div>
                      </div>
                      {consignment.pickUp_PlannedDateTime && consignment.pickUp_OutcomeDateTime && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Performance</p>
                          <Badge className={
                            new Date(consignment.pickUp_OutcomeDateTime) <= new Date(consignment.pickUp_PlannedDateTime) 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-red-100 text-red-800 border-red-200'
                          }>
                            {new Date(consignment.pickUp_OutcomeDateTime) <= new Date(consignment.pickUp_PlannedDateTime) 
                              ? 'On Time' 
                              : 'Late'}
                          </Badge>
                          <div className="mt-1 text-xs text-gray-500">
                            {(() => {
                              const planned = new Date(consignment.pickUp_PlannedDateTime);
                              const actual = new Date(consignment.pickUp_OutcomeDateTime);
                              const diffMs = actual.getTime() - planned.getTime();
                              const diffHours = Math.round(diffMs / (1000 * 60 * 60));
                              return diffHours > 0 ? `${diffHours}h late` : `${Math.abs(diffHours)}h early`;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delivery Window - only for delivery consignments */}
                  {isDeliveryConsignment && (
                    <div className="border-l-4 border-green-400 pl-4">
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">DELIVERY DETAILS</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Scheduled Window</p>
                          <div className="text-sm font-medium">
                            {consignment.minScheduledDeliveryTime && consignment.maxScheduledDeliveryTime ? (
                              <div>
                                <div>{formatDate(consignment.minScheduledDeliveryTime)}</div>
                                <div className="text-xs text-gray-400">to</div>
                                <div>{formatDate(consignment.maxScheduledDeliveryTime)}</div>
                              </div>
                            ) : (
                              formatDate(consignment.delivery_PlannedDateTime) || 
                              formatDate(consignment.delivery_PlannedETA) || '-'
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Completed Time</p>
                          <p className="text-sm font-medium">
                            {formatDate(consignment.delivery_OutcomeDateTime) || '-'}
                          </p>
                        </div>
                      </div>
                      {(consignment.minScheduledDeliveryTime || consignment.delivery_PlannedDateTime) && consignment.delivery_OutcomeDateTime && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Performance</p>
                          <Badge className={
                            (() => {
                              const actualTime = new Date(consignment.delivery_OutcomeDateTime);
                              if (consignment.minScheduledDeliveryTime && consignment.maxScheduledDeliveryTime) {
                                const windowStart = new Date(consignment.minScheduledDeliveryTime);
                                const windowEnd = new Date(consignment.maxScheduledDeliveryTime);
                                return actualTime >= windowStart && actualTime <= windowEnd;
                              } else if (consignment.delivery_PlannedDateTime) {
                                return actualTime <= new Date(consignment.delivery_PlannedDateTime);
                              }
                              return true;
                            })() ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
                          }>
                            {(() => {
                              const actualTime = new Date(consignment.delivery_OutcomeDateTime);
                              if (consignment.minScheduledDeliveryTime && consignment.maxScheduledDeliveryTime) {
                                const windowStart = new Date(consignment.minScheduledDeliveryTime);
                                const windowEnd = new Date(consignment.maxScheduledDeliveryTime);
                                return actualTime >= windowStart && actualTime <= windowEnd ? 'On Time' : 'Late';
                              } else if (consignment.delivery_PlannedDateTime) {
                                return actualTime <= new Date(consignment.delivery_PlannedDateTime) ? 'On Time' : 'Late';
                              }
                              return 'Completed';
                            })()}
                          </Badge>
                          <div className="mt-1 text-xs text-gray-500">
                            {(() => {
                              const actualTime = new Date(consignment.delivery_OutcomeDateTime);
                              if (consignment.minScheduledDeliveryTime && consignment.maxScheduledDeliveryTime) {
                                const windowEnd = new Date(consignment.maxScheduledDeliveryTime);
                                const diffMs = actualTime.getTime() - windowEnd.getTime();
                                const diffHours = Math.round(diffMs / (1000 * 60 * 60));
                                return diffHours > 0 ? `${diffHours}h after window` : `Within window`;
                              } else if (consignment.delivery_PlannedDateTime) {
                                const planned = new Date(consignment.delivery_PlannedDateTime);
                                const diffMs = actualTime.getTime() - planned.getTime();
                                const diffHours = Math.round(diffMs / (1000 * 60 * 60));
                                return diffHours > 0 ? `${diffHours}h late` : `${Math.abs(diffHours)}h early`;
                              }
                              return '';
                            })()}
                          </div>
                        </div>
                      )}
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