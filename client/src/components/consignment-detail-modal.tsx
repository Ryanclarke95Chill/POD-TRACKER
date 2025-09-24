import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Clock, MapPin, ExternalLink, Map, Thermometer, CheckCircle, Truck, AlertTriangle, Camera, ChevronLeft, ChevronRight, X, Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { isAuthenticated, logout } from "@/lib/auth";

interface ConsignmentDetailModalProps {
  consignment: any;
  onClose: () => void;
}

// Photo Modal Component (extracted from pod-quality.tsx)
interface InlinePhotoModalProps {
  photos: string[];
  isOpen: boolean;
  onClose: () => void;
  initialPhotoIndex?: number;
  consignmentNo: string;
}

function InlinePhotoModal({ photos, isOpen, onClose, initialPhotoIndex = 0, consignmentNo }: InlinePhotoModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialPhotoIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setIsLoading(true);
    setIsZoomed(false);
  };

  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setIsLoading(true);
    setIsZoomed(false);
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowRight') nextPhoto();
    if (e.key === 'ArrowLeft') prevPhoto();
    if (e.key === 'Escape') onClose();
    if (e.key === ' ') {
      e.preventDefault();
      toggleZoom();
    }
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setCurrentIndex(initialPhotoIndex);
    setIsLoading(true);
    setIsZoomed(false);
  }, [initialPhotoIndex]);

  if (!isOpen || photos.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full h-[95vh] p-0 bg-black border-none">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-6">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <span className="font-medium">Photo {currentIndex + 1} of {photos.length}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <span className="text-sm opacity-90">{consignmentNo}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleZoom}
                className="text-white hover:bg-white/20 transition-all duration-200"
                title="Toggle zoom (Spacebar)"
                data-testid="button-toggle-zoom"
              >
                {isZoomed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="text-white hover:bg-white/20 transition-all duration-200"
                data-testid="button-close-photo-modal"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Main Photo Display */}
        <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
          {/* Loading Skeleton */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
          
          {/* Navigation Buttons */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="lg"
                className="absolute left-6 z-10 h-16 w-16 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white border border-white/20 rounded-full transition-all duration-300 hover:scale-110"
                onClick={prevPhoto}
                data-testid="button-prev-photo"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="absolute right-6 z-10 h-16 w-16 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white border border-white/20 rounded-full transition-all duration-300 hover:scale-110"
                onClick={nextPhoto}
                data-testid="button-next-photo"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}
          
          {/* Photo Display */}
          <div 
            className={`transition-all duration-500 cursor-pointer ${
              isZoomed ? 'scale-150 origin-center' : 'scale-100'
            }`}
            onClick={toggleZoom}
          >
            <img
              src={`/api/image?src=${encodeURIComponent(photos[currentIndex])}&w=${isZoomed ? '2000' : '1400'}&q=95&fmt=webp`}
              alt={`Photo ${currentIndex + 1} for ${consignmentNo}`}
              className="max-w-full max-h-[95vh] object-contain transition-opacity duration-300"
              onLoad={() => setIsLoading(false)}
              data-testid={`photo-modal-${currentIndex}`}
            />
          </div>
        </div>
        
        {/* Navigation Bar */}
        {photos.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="flex justify-center items-center gap-3">
              {/* Thumbnail Navigation */}
              <div className="flex gap-2 bg-white/10 backdrop-blur-sm rounded-full p-2 max-w-md overflow-x-auto">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    className={`flex-shrink-0 relative overflow-hidden rounded-lg transition-all duration-300 ${
                      index === currentIndex 
                        ? 'ring-2 ring-white scale-110 shadow-lg' 
                        : 'hover:scale-105 opacity-60 hover:opacity-100'
                    }`}
                    onClick={() => {
                      setCurrentIndex(index);
                      setIsLoading(true);
                      setIsZoomed(false);
                    }}
                    data-testid={`photo-thumb-nav-${index}`}
                  >
                    <img
                      src={`/api/image?src=${encodeURIComponent(photo)}&w=60&q=80&fmt=webp`}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-12 h-12 object-cover"
                    />
                    {index === currentIndex && (
                      <div className="absolute inset-0 bg-white/20" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Progress Indicator */}
            <div className="mt-4 bg-white/10 rounded-full h-1 overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-500 ease-out"
                style={{ width: `${((currentIndex + 1) / photos.length) * 100}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Keyboard Shortcuts Hint */}
        <div className="absolute top-20 right-6 z-20 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-xs opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="space-y-1">
            <div>← → Navigate</div>
            <div>Space: Zoom</div>
            <div>Esc: Close</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ConsignmentDetailModal({
  consignment,
  onClose,
}: ConsignmentDetailModalProps) {
  const [showMap, setShowMap] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

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
      if (status === 'GPS not present') return 'In Transit'; // Show GPS not present as In Transit
      if (status === 'Positive outcome') return isPickup ? 'Picked Up' : 'Delivered';
      if (status === 'Delivered') return 'Delivered';
      if (status === 'Not delivered') return 'Failed Delivery';
      if (status === 'Not picked up') return 'Failed Pickup';
      if (status === 'Negative outcome') return isPickup ? 'Failed Pickup' : 'Failed Delivery';
      if (status === 'Arrived') return 'Arrived';
      return status; // Return exact value for anything else
    };
    
    return mapStatus(deliveryStateLabel, false) || mapStatus(pickupStateLabel, true) || 'In Transit';
  };

  const isConsignmentAtRisk = () => {
    // Use the same at-risk logic as the dashboard
    const status = getStatusDisplay();
    
    // Only check active consignments - exclude completed, failed, or delivered
    if (status === 'Delivered' || status === 'Picked Up' || status === 'Complete' || status === 'Failed' || status === 'Cancelled') {
      return { isAtRisk: false, reason: "" };
    }
    
    // Check if delivery was already attempted and failed
    const deliveryOutcome = consignment.delivery_Outcome;
    const deliveryNotDelivered = consignment.delivery_NotDeliverd;
    if (deliveryOutcome || deliveryNotDelivered) {
      return { isAtRisk: false, reason: "" }; // Already completed (success or failure)
    }
    
    const calculatedETA = consignment.delivery_CalculatedETA || consignment.delivery_PlannedETA;
    const windowStart = consignment.minScheduledDeliveryTime || consignment.minScheduledPickupTime;
    const windowEnd = consignment.maxScheduledDeliveryTime || consignment.maxScheduledPickupTime;
    
    if (calculatedETA && windowEnd) {
      const etaTime = new Date(calculatedETA);
      const windowEndTime = new Date(windowEnd);
      
      // At risk if ETA is after the delivery window end
      if (etaTime > windowEndTime) {
        const delayMinutes = Math.round((etaTime.getTime() - windowEndTime.getTime()) / (1000 * 60));
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
          reason: `Delivery is expected ${delayText} after the scheduled window ends (${formatDate(windowEnd)}).`
        };
      }
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

          {/* Photo Gallery Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Camera className="h-4 w-4 text-purple-600" />
              Delivery Photos
            </h3>
            
            {photoLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin" />
                <span className="text-sm">Loading photos...</span>
              </div>
            )}
            
            {photoError && (
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{photoError}</span>
              </div>
            )}
            
            {!photoLoading && !photoError && photos.length === 0 && (
              <div className="flex items-center gap-2 text-gray-500">
                <Camera className="h-4 w-4" />
                <span className="text-sm">No photos available</span>
              </div>
            )}
            
            {!photoLoading && photos.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {photos.length} photo{photos.length !== 1 ? 's' : ''} available
                  </span>
                  <Button
                    onClick={() => {
                      setSelectedPhotoIndex(0);
                      setPhotoModalOpen(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 h-auto"
                    size="sm"
                    data-testid="button-view-all-photos"
                  >
                    <Camera className="h-3 w-3 mr-1" />
                    View All Photos
                  </Button>
                </div>
                
                {/* Photo Thumbnails Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {photos.slice(0, 8).map((photo, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedPhotoIndex(index);
                        setPhotoModalOpen(true);
                      }}
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-purple-300 transition-colors group"
                      data-testid={`photo-thumbnail-${index}`}
                    >
                      <img
                        src={`/api/image?src=${encodeURIComponent(photo)}&w=200&q=75&fmt=webp`}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                        onError={(e) => {
                          // Show a placeholder instead of hiding the image
                          const img = e.target as HTMLImageElement;
                          img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iODAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UGhvdG8gTm90PC90ZXh0Pgo8dGV4dCB4PSIxMDAiIHk9IjEwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjNmI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5BdmFpbGFibGU8L3RleHQ+Cjx0ZXh0IHg9IjEwMCIgeT0iMTMwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNsaWNrIHRvIFRyeSBNb2RhbDwvdGV4dD4KPC9zdmc+';
                          img.className = 'w-full h-full object-cover opacity-50';
                          img.title = 'Image failed to load - click to try viewing in modal';
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                        <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    </button>
                  ))}
                  {photos.length > 8 && (
                    <div className="aspect-square rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                      <span className="text-xs text-gray-500 font-medium">+{photos.length - 8}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
        
        {/* Photo Modal */}
        <InlinePhotoModal
          photos={photos}
          isOpen={photoModalOpen}
          onClose={() => setPhotoModalOpen(false)}
          initialPhotoIndex={selectedPhotoIndex}
          consignmentNo={consignment.orderNumberRef || consignment.consignmentNo || `${consignment.year}-${consignment.code}-${consignment.prog}` || 'Unknown'}
        />
      </DialogContent>
    </Dialog>
  );
}