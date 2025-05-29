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
import { ExternalLink, Package, Clock, MapPin, Thermometer, AlertTriangle, CheckCircle, Map } from "lucide-react";
import { useState, useEffect } from "react";

interface ConsignmentDetailModalProps {
  consignment: Consignment;
  onClose: () => void;
}

export default function ConsignmentDetailModal({
  consignment,
  onClose,
}: ConsignmentDetailModalProps) {
  const [showMap, setShowMap] = useState(false);
  
  // Parse events from JSON string if needed
  const events = typeof consignment.events === 'string' 
    ? JSON.parse(consignment.events || '[]') 
    : consignment.events || [];

  // Parse coordinates from lat,lon string
  const parseCoordinates = (latLonString: string | null) => {
    if (!latLonString) return null;
    const [lat, lon] = latLonString.split(',').map(s => parseFloat(s.trim()));
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon };
  };

  const deliveryCoords = parseCoordinates(consignment.shipToLatLon);
  const currentCoords = parseCoordinates(consignment.delivery_LastPositionLatLon);

  // Status mapping function
  const getStatusDisplay = () => {
    const deliveryOutcomeEnum = (consignment as any).delivery_OutcomeEnum;
    const pickupOutcomeEnum = (consignment as any).pickUp_OutcomeEnum;
    const deliveryOutcomeReason = (consignment as any).delivery_OutcomePODReason;
    const deliveryPositionType = (consignment as any).delivery_LastPositionType;
    const pickupPositionType = (consignment as any).pickUp_LastPositionType;
    
    const mapStatus = (status: string | null) => {
      if (!status) return null;
      if (status === 'Traveling' || status === 'App_Traveling') return 'In Transit';
      if (status === 'Positive Outcome') return 'Delivered';
      if (status.includes('On Time') || status.includes('Completed')) return 'Delivered';
      return status; // Return exact value for anything else
    };
    
    return mapStatus(deliveryOutcomeEnum) || mapStatus(pickupOutcomeEnum) || 
           mapStatus(deliveryOutcomeReason) || mapStatus(deliveryPositionType) || 
           mapStatus(pickupPositionType) || 'In Transit';
  };



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
      <DialogContent className="sm:max-w-4xl p-0 overflow-auto max-h-[85vh] rounded-xl">
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

        <div className="p-4 space-y-4">
          {/* Live Tracking Link */}
          {consignment.deliveryLiveTrackLink && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ExternalLink className="h-4 w-4 text-blue-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-800">Live Tracking Available</h4>
                    <p className="text-xs text-blue-600">View real-time tracking from carrier</p>
                  </div>
                </div>
                <Button
                  onClick={() => window.open(consignment.deliveryLiveTrackLink || '', '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2"
                  size="sm"
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Open Live Tracking
                </Button>
              </div>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* ETA Status */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-3 w-3 text-orange-600 flex-shrink-0" />
                <h4 className="text-xs font-semibold text-orange-800">ETA Status</h4>
              </div>
              <div className="space-y-1">
                <div>
                  <p className="text-xs text-orange-600">Planned Delivery ETA</p>
                  <p className="text-xs font-medium text-orange-800 break-words">{formatDate(consignment.delivery_PlannedETA) || 'Not available'}</p>
                </div>
                {consignment.deliveryState === 'Delivered' && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3 flex-shrink-0" />
                    <span className="text-xs">Delivered on time</span>
                  </div>
                )}
              </div>
            </div>

            {/* Package Details */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-3 w-3 text-purple-600 flex-shrink-0" />
                <h4 className="text-xs font-semibold text-purple-800">Package Details</h4>
              </div>
              <div className="space-y-1">
                <div>
                  <p className="text-xs text-purple-600">Temperature Zone</p>
                  <p className="text-xs font-medium text-purple-800">
                    {consignment.documentNote?.split('\\')[0] || consignment.expectedTemperature || 'Standard'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-purple-600">Status</p>
                  <p className="text-xs font-medium text-purple-800 break-words">{getStatusDisplay()}</p>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-3 w-3 text-green-600 flex-shrink-0" />
                  <h4 className="text-xs font-semibold text-gray-700">Location</h4>
                </div>
                {currentCoords && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMap(!showMap)}
                    className="text-gray-700 border-gray-300 hover:bg-gray-100 text-xs px-2 py-1 h-6 flex-shrink-0"
                  >
                    <Map className="h-2 w-2 mr-1" />
                    {showMap ? 'Hide' : 'Map'}
                  </Button>
                )}
              </div>
              <div className="space-y-1 min-w-0">
                <div>
                  <p className="text-xs text-gray-500">Last Known Location</p>
                  <p className="text-xs font-medium">
                    {currentCoords ? `${currentCoords.lat}, ${currentCoords.lon}` : 'In transit'}
                  </p>
                  {(consignment.delivery_LastPositionDateTime || consignment.pickUp_LastPositionDateTime || consignment.lastPositionDateTime) && (
                    <p className="text-xs text-gray-400 truncate">
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
                    title="Vehicle Current Location Map"
                  />
                  <div className="bg-gray-50 p-2 text-xs text-gray-600 border-t border-gray-300">
                    <a 
                      href={`https://www.openstreetmap.org/?mlat=${currentCoords.lat}&mlon=${currentCoords.lon}&zoom=16`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View larger map
                    </a>
                  </div>
                </div>
              )}
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
                {deliveryCoords && (
                  <p className="text-xs text-green-600 mt-1">
                    📍 {deliveryCoords.lat.toFixed(4)}, {deliveryCoords.lon.toFixed(4)}
                  </p>
                )}
              </div>
            </div>


          </div>

          {/* Events Timeline - Only show if there are events */}
          {events.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Clock className="h-3 w-3 mr-2" />
                Tracking Events
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {events.map((event: any, index: number) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm">
                    <div className="h-1.5 w-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">
                        {event.description || 'Event occurred'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(event.timestamp)} • {event.location || 'Unknown location'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}