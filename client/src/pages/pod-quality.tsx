import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Camera, 
  ExternalLink, 
  Thermometer, 
  FileSignature, 
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  LogOut,
  Home,
  Package,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Filter
} from "lucide-react";
import { Link } from "wouter";
import { getUser, logout, getToken, isAuthenticated } from "@/lib/auth";
import { Consignment } from "@shared/schema";

// Simple interfaces for POD analysis
interface PODSummary {
  total: number;
  validPODs: number;
  missingSignatures: number;
  noPhotos: number;
  temperatureIssues: number;
  missingReceiver: number;
}

interface PODIssues {
  missingSignature: boolean;
  noPhotos: boolean;
  temperatureIssue: boolean;
  missingReceiver: boolean;
  hasAnyIssues: boolean;
}

interface ConsignmentWithIssues {
  consignment: Consignment;
  issues: PODIssues;
  photoCount: number;
}

// Photo modal components (keep exactly as they were)
interface InlinePhotoModalProps {
  photos: string[];
  isOpen: boolean;
  onClose: () => void;
  initialPhotoIndex?: number;
  consignmentNo: string;
}

interface PhotoGalleryProps {
  trackingLink: string;
  consignmentNo: string;
}

// Global cache for photos
const photoCache = new Map<string, {photos: string[], signaturePhotos: string[]}>();

// Component for inline photo thumbnails in consignment cards
interface ConsignmentThumbnailsProps {
  consignment: Consignment;
  onPhotoClick: (photoIndex: number) => void;
}

function ConsignmentThumbnails({ consignment, onPhotoClick }: ConsignmentThumbnailsProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [signatures, setSignatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    
    const loadThumbnails = async () => {
      if (!consignment.deliveryLiveTrackLink && !consignment.pickupLiveTrackLink) return;
      
      const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
      if (!trackingLink) return;
      
      // Extract token from URL (e.g., https://live.axylog.com/TOKEN -> TOKEN)
      const trackingToken = trackingLink.split('/').pop();
      if (!trackingToken) return;
      
      // Check cache first
      const cached = photoCache.get(trackingToken);
      if (cached) {
        setPhotos(cached.photos);
        setSignatures(cached.signaturePhotos);
        return;
      }

      try {
        setLoading(true);
        const token = getToken();
        if (!token || !isAuthenticated()) {
          setLoading(false);
          return;
        }
        
        const response = await fetch(`/api/pod-photos?trackingToken=${encodeURIComponent(trackingToken)}&priority=low`, {
          headers: { 
            'Authorization': `Bearer ${token}`
          },
          signal: abortController.signal
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const regularPhotos = data.photos || [];
            const signaturePhotos = data.signaturePhotos || [];
            setPhotos(regularPhotos);
            setSignatures(signaturePhotos);
            photoCache.set(trackingToken, {photos: regularPhotos, signaturePhotos});
          }
        } else {
          console.warn(`Failed to load thumbnails: ${response.status} ${response.statusText}`);
        }
      } catch (err: any) {
        // Ignore aborted requests - they're not errors
        if (err.name === 'AbortError') return;
        // Silently handle other fetch errors - they're not critical for thumbnails
        console.debug('Thumbnail loading failed (non-critical):', err);
      } finally {
        setLoading(false);
      }
    };

    loadThumbnails().catch(() => {
      // Catch any remaining async errors to prevent unhandled rejections
      setLoading(false);
    });
    
    // Cleanup: abort the request if component unmounts
    return () => {
      abortController.abort();
    };
  }, [consignment.deliveryLiveTrackLink, consignment.pickupLiveTrackLink]);

  if (loading) {
    return (
      <div className="flex gap-2">
        <div className="w-12 h-12 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-12 h-12 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (photos.length === 0 && signatures.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Camera className="h-4 w-4" />
        <span className="text-xs">No photos</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {/* Photo thumbnails */}
      {photos.slice(0, 3).map((photo, index) => (
        <button
          key={index}
          onClick={() => onPhotoClick(index)}
          className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors group"
          data-testid={`photo-thumb-${index}`}
        >
          <img
            src={`/api/image?src=${encodeURIComponent(photo)}&w=100&q=70&fmt=webp`}
            alt={`Photo ${index + 1}`}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
        </button>
      ))}
      
      {/* Show count if more photos */}
      {photos.length > 3 && (
        <button
          onClick={() => onPhotoClick(0)}
          className="w-12 h-12 rounded-lg border-2 border-gray-300 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center"
        >
          <span className="text-xs font-medium text-gray-600">+{photos.length - 3}</span>
        </button>
      )}
      
      {/* Signature thumbnails */}
      {signatures.slice(0, 2).map((signature, index) => (
        <button
          key={`sig-${index}`}
          onClick={() => onPhotoClick(photos.length + index)}
          className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-green-200 hover:border-green-400 transition-colors group"
          data-testid={`signature-thumb-${index}`}
        >
          <img
            src={`/api/image?src=${encodeURIComponent(signature)}&w=100&q=70&fmt=webp`}
            alt={`Signature ${index + 1}`}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          />
          <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-white"></div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
        </button>
      ))}
    </div>
  );
}

// Photo Modal Component (unchanged)
function InlinePhotoModal({ photos, isOpen, onClose, initialPhotoIndex = 0, consignmentNo }: InlinePhotoModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialPhotoIndex);

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    setCurrentIndex(initialPhotoIndex);
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Photo Display */}
        <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="lg"
                className="absolute left-6 z-10 h-16 w-16 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white border border-white/20 rounded-full"
                onClick={prevPhoto}
                data-testid="button-prev-photo"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="absolute right-6 z-10 h-16 w-16 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white border border-white/20 rounded-full"
                onClick={nextPhoto}
                data-testid="button-next-photo"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}
          
          <img
            src={`/api/image?src=${encodeURIComponent(photos[currentIndex])}&w=1400&q=95&fmt=webp`}
            alt={`Photo ${currentIndex + 1} for ${consignmentNo}`}
            className="max-w-full max-h-[95vh] object-contain"
            data-testid={`photo-modal-${currentIndex}`}
          />
        </div>
        
        {/* Navigation Bar */}
        {photos.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="flex justify-center items-center gap-3">
              <div className="flex gap-2 bg-white/10 backdrop-blur-sm rounded-full p-2 max-w-md overflow-x-auto">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    className={`flex-shrink-0 relative overflow-hidden rounded-lg transition-all duration-300 ${
                      index === currentIndex 
                        ? 'ring-2 ring-white scale-110 shadow-lg' 
                        : 'hover:scale-105 opacity-60 hover:opacity-100'
                    }`}
                    onClick={() => setCurrentIndex(index)}
                    data-testid={`photo-thumb-nav-${index}`}
                  >
                    <img
                      src={`/api/image?src=${encodeURIComponent(photo)}&w=60&q=80&fmt=webp`}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-12 h-12 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Photo Gallery Component (unchanged)
function PhotoGallery({ trackingLink, consignmentNo }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();
    
    const loadPhotos = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Extract token from URL (e.g., https://live.axylog.com/TOKEN -> TOKEN)
        const trackingToken = trackingLink.split('/').pop();
        if (!trackingToken) {
          throw new Error('Invalid tracking link format');
        }
        
        const token = getToken();
        if (!token || !isAuthenticated()) {
          throw new Error('No valid authentication token available');
        }
        
        const response = await fetch(`/api/pod-photos?trackingToken=${encodeURIComponent(trackingToken)}&priority=high`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: abortController.signal
        });
        
        if (response.status === 401) {
          logout();
          return;
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch photos: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          const regularPhotos = data.photos || [];
          setPhotos(regularPhotos);
          photoCache.set(trackingToken, {photos: regularPhotos, signaturePhotos: data.signaturePhotos || []});
        } else {
          throw new Error(data.message || 'Failed to extract photos');
        }
        
      } catch (err: any) {
        // Ignore aborted requests - they're not errors
        if (err.name === 'AbortError') return;
        console.error('Error loading photos:', err);
        setError('Unable to load photos from tracking system');
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    };

    if (trackingLink) {
      loadPhotos();
    }
    
    // Cleanup: abort the request if component unmounts
    return () => {
      abortController.abort();
    };
  }, [trackingLink]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading photos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh] py-8">
        <div className="text-center text-red-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
          <p className="text-lg font-medium">{error}</p>
          <Button 
            onClick={() => window.open(trackingLink, '_blank')} 
            variant="outline" 
            className="mt-4"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Tracking Page
          </Button>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh] py-8 text-gray-500">
        <div className="text-center">
          <Camera className="h-8 w-8 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No photos found</p>
          <p className="text-sm text-gray-600 mb-4">No delivery photos found on this tracking page.</p>
          <Button 
            onClick={() => window.open(trackingLink, '_blank')} 
            variant="outline" 
            size="sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Tracking Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-white min-h-[70vh]">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">POD Photos - {consignmentNo}</h2>
        <p className="text-sm text-gray-600">{photos.length} photos available</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
        {photos.map((photoUrl, index) => (
          <div 
            key={index}
            className="group relative cursor-pointer transform transition-all duration-200 hover:scale-105"
            onClick={() => {
              setSelectedPhotoIndex(index);
              setPhotoModalOpen(true);
            }}
            data-testid={`photo-${index}`}
          >
            <div className="relative bg-white rounded-xl overflow-hidden shadow-sm group-hover:shadow-lg transition-shadow border border-gray-100">
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                <img
                  src={`/api/image?src=${encodeURIComponent(photoUrl)}&w=320&q=80&fmt=webp`}
                  alt={`POD Photo ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `/api/image?src=${encodeURIComponent(photoUrl)}&w=320&q=60&fmt=webp`;
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                  <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-700">Photo {index + 1}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <InlinePhotoModal
        photos={photos}
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        initialPhotoIndex={selectedPhotoIndex}
        consignmentNo={consignmentNo}
      />
    </div>
  );
}

// Simple POD Analysis Helper Functions (restored to original simplicity)
const countPhotos = (consignment: Consignment): number => {
  const deliveryFileCount = (consignment as any).deliveryReceivedFileCount || 0;
  const pickupFileCount = (consignment as any).pickupReceivedFileCount || 0;
  let count = Number(deliveryFileCount) + Number(pickupFileCount);
  
  // Subtract signature files from photo count
  if (consignment.deliverySignatureName && deliveryFileCount > 0) count = Math.max(0, count - 1);
  if (consignment.pickupSignatureName && pickupFileCount > 0) count = Math.max(0, count - 1);
  
  return count;
};

const hasSignature = (consignment: Consignment): boolean => {
  return !!(consignment.deliverySignatureName || consignment.pickupSignatureName);
};

const hasReceiverName = (consignment: Consignment): boolean => {
  const receiverName = consignment.shipToCompanyName?.trim();
  return !!(receiverName && receiverName.length >= 2);
};

const isTemperatureCompliant = (consignment: Consignment): boolean => {
  const actualTemp = (consignment as any).delivery_Temperature;
  const expectedTemp = (consignment as any).shipmentExpectedTemperatureRange;
  
  if (!actualTemp || !expectedTemp) return true; // No temp data = compliant
  
  // Parse temperature range from expected
  const parseRange = (label: string) => {
    const patterns = [
      /(-?\d+(?:\.\d+)?)\s*°?C?\s+to\s+(-?\d+(?:\.\d+)?)\s*°?C?/i,
      /(-?\d+(?:\.\d+)?)\s*to\s+(-?\d+(?:\.\d+)?)\s*°?C/i,
      /(-?\d+(?:\.\d+)?)\s*°?C?\s*-\s*(-?\d+(?:\.\d+)?)\s*°?C?/i
    ];
    
    for (const pattern of patterns) {
      const match = label.match(pattern);
      if (match) {
        const val1 = parseFloat(match[1]);
        const val2 = parseFloat(match[2]);
        return { min: Math.min(val1, val2), max: Math.max(val1, val2) };
      }
    }
    return null;
  };
  
  const range = parseRange(expectedTemp);
  if (!range) return true;
  
  const actual = parseFloat(actualTemp);
  return !isNaN(actual) && actual >= range.min && actual <= range.max;
};

// Simple POD analysis function
const analyzePODCompliance = (consignment: Consignment): ConsignmentWithIssues => {
  const photoCount = countPhotos(consignment);
  const missingSignature = !hasSignature(consignment);
  const noPhotos = photoCount === 0;
  const temperatureIssue = !isTemperatureCompliant(consignment);
  const missingReceiver = !hasReceiverName(consignment);
  
  const hasAnyIssues = missingSignature || noPhotos || temperatureIssue || missingReceiver;
  
  return {
    consignment,
    issues: {
      missingSignature,
      noPhotos,
      temperatureIssue,
      missingReceiver,
      hasAnyIssues
    },
    photoCount
  };
};

// Helper functions for date filtering
function isToday(date: string | null): boolean {
  if (!date) return false;
  const today = new Date();
  const itemDate = new Date(date);
  return itemDate.toDateString() === today.toDateString();
}

function isThisWeek(date: string | null): boolean {
  if (!date) return false;
  const today = new Date();
  const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
  const itemDate = new Date(date);
  return itemDate >= weekStart;
}

function isThisMonth(date: string | null): boolean {
  if (!date) return false;
  const today = new Date();
  const itemDate = new Date(date);
  return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
}

// Main POD Quality Component
export default function PODQuality() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  
  // Filter states - restored original filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [deliveryState, setDeliveryState] = useState<string>("all");

  const user = getUser();

  // Fetch consignments data
  const { data: consignments = [], isLoading } = useQuery({
    queryKey: ['/api/consignments'],
    enabled: !!user,
  });

  // Process consignments for POD analysis
  const podAnalyses = consignments
    .filter(c => c.delivery_StateLabel === 'Delivered')
    .map(analyzePODCompliance);

  // Get unique values for filters
  const uniqueDrivers = [...new Set(consignments
    .filter(c => c.driverName)
    .map(c => c.driverName!)
  )].sort();

  const uniqueDeliveryStates = [...new Set(consignments
    .filter(c => c.delivery_StateLabel)
    .map(c => c.delivery_StateLabel!)
  )].sort();

  const uniqueWarehouses = [...new Set(consignments
    .filter(c => c.warehouseCompanyName)
    .map(c => c.warehouseCompanyName!)
  )].sort();

  // Calculate simple summary metrics
  const summary: PODSummary = {
    total: podAnalyses.length,
    validPODs: podAnalyses.filter(p => !p.issues.hasAnyIssues).length,
    missingSignatures: podAnalyses.filter(p => p.issues.missingSignature).length,
    noPhotos: podAnalyses.filter(p => p.issues.noPhotos).length,
    temperatureIssues: podAnalyses.filter(p => p.issues.temperatureIssue).length,
    missingReceiver: podAnalyses.filter(p => p.issues.missingReceiver).length,
  };

  // Filter and search logic (simplified)
  const filteredAnalyses = podAnalyses
    .filter(analysis => {
      const consignment = analysis.consignment;
      
      // Date range filter (From/To)
      const deliveryDate = consignment.delivery_OutcomeDateTime;
      if (fromDate || toDate) {
        if (!deliveryDate) return false; // Skip if no actual delivery date
        const deliveryDateObj = new Date(deliveryDate);
        
        if (fromDate) {
          const fromDateObj = new Date(fromDate);
          if (deliveryDateObj < fromDateObj) return false;
        }
        
        if (toDate) {
          const toDateObj = new Date(toDate);
          // Set to end of day for inclusive filtering
          toDateObj.setHours(23, 59, 59, 999);
          if (deliveryDateObj > toDateObj) return false;
        }
      }
      
      // Warehouse filter
      if (selectedWarehouse !== "all" && consignment.warehouseCompanyName !== selectedWarehouse) {
        return false;
      }
      
      // Driver filter
      if (selectedDriver !== "all" && consignment.driverName !== selectedDriver) {
        return false;
      }
      
      // Delivery state filter
      if (deliveryState !== "all" && consignment.delivery_StateLabel !== deliveryState) {
        return false;
      }
      
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          consignment.consignmentNo?.toLowerCase().includes(term) ||
          consignment.driverName?.toLowerCase().includes(term) ||
          consignment.shipToCompanyName?.toLowerCase().includes(term)
        );
      }
      
      return true;
    })
    .filter(analysis => {
      // Issues filter - show only PODs with issues
      if (showIssuesOnly) {
        return analysis.issues.hasAnyIssues;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by issues first (issues at top), then by date
      if (a.issues.hasAnyIssues && !b.issues.hasAnyIssues) return -1;
      if (!a.issues.hasAnyIssues && b.issues.hasAnyIssues) return 1;
      const dateA = new Date(a.consignment.delivery_OutcomeDateTime || '');
      const dateB = new Date(b.consignment.delivery_OutcomeDateTime || '');
      return dateB.getTime() - dateA.getTime();
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading POD data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with minor UI improvements */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">POD Quality</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Simple Summary Cards with minor styling improvements */}
        <div className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-700" data-testid="text-valid-pods">
                  {summary.validPODs}
                </div>
                <p className="text-sm text-green-600 font-medium">Valid PODs</p>
                <p className="text-xs text-gray-500 mt-1">No issues found</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-700" data-testid="text-total-pods">
                  {summary.total}
                </div>
                <p className="text-sm text-blue-600 font-medium">Total PODs</p>
                <p className="text-xs text-gray-500 mt-1">All deliveries</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <FileSignature className="h-8 w-8 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-700" data-testid="text-missing-signatures">
                  {summary.missingSignatures}
                </div>
                <p className="text-sm text-red-600 font-medium">No Signature</p>
                <p className="text-xs text-gray-500 mt-1">Missing signatures</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Camera className="h-8 w-8 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-orange-700" data-testid="text-no-photos">
                  {summary.noPhotos}
                </div>
                <p className="text-sm text-orange-600 font-medium">No Photos</p>
                <p className="text-xs text-gray-500 mt-1">Missing photos</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Thermometer className="h-8 w-8 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-purple-700" data-testid="text-temp-issues">
                  {summary.temperatureIssues}
                </div>
                <p className="text-sm text-purple-600 font-medium">Temp Issues</p>
                <p className="text-xs text-gray-500 mt-1">Temperature problems</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="text-2xl font-bold text-yellow-700" data-testid="text-missing-receiver">
                  {summary.missingReceiver}
                </div>
                <p className="text-sm text-yellow-600 font-medium">No Receiver</p>
                <p className="text-xs text-gray-500 mt-1">Missing receiver name</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters with enhanced styling */}
        <Card className="mb-6 shadow-sm bg-gradient-to-r from-gray-50 to-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filters:</span>
              </div>
              
              <div className="flex flex-wrap gap-4 flex-1">
                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search consignments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>

                {/* Date From/To Range */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">From:</span>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-[140px]"
                    data-testid="input-from-date"
                  />
                  <span className="text-sm text-gray-600">To:</span>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-[140px]"
                    data-testid="input-to-date"
                  />
                </div>

                {/* Warehouse Filter */}
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                  <SelectTrigger className="w-[180px]" data-testid="select-warehouse">
                    <SelectValue placeholder="All warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All warehouses</SelectItem>
                    {uniqueWarehouses.map(warehouse => (
                      <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Driver Filter */}
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger className="w-[160px]" data-testid="select-driver">
                    <SelectValue placeholder="All drivers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All drivers</SelectItem>
                    {uniqueDrivers.map(driver => (
                      <SelectItem key={driver} value={driver}>{driver}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Delivery State Filter */}
                <Select value={deliveryState} onValueChange={setDeliveryState}>
                  <SelectTrigger className="w-[140px]" data-testid="select-delivery-state">
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    {uniqueDeliveryStates.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Issues Only Toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showIssuesOnly}
                    onCheckedChange={setShowIssuesOnly}
                    data-testid="switch-issues-only"
                  />
                  <span className="text-sm text-gray-700">Issues only</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredAnalyses.length} of {podAnalyses.length} PODs
            {showIssuesOnly && " with issues"}
          </p>
        </div>

        {/* POD List with minor styling improvements */}
        <div className="space-y-4">
          {filteredAnalyses.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No PODs found</h3>
                <p className="text-gray-600">Try adjusting your filters to see more results.</p>
              </CardContent>
            </Card>
          ) : (
            filteredAnalyses.map(analysis => (
              <Card 
                key={analysis.consignment.id} 
                className={`hover:shadow-lg transition-all duration-200 ${
                  analysis.issues.hasAnyIssues 
                    ? 'border-red-200 bg-gradient-to-r from-red-50 to-red-25 shadow-red-100/50' 
                    : 'border-gray-200 bg-gradient-to-r from-white to-gray-50 hover:from-blue-50 hover:to-blue-25'
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900" data-testid={`text-consignment-${analysis.consignment.consignmentNo}`}>
                          {analysis.consignment.consignmentNo}
                        </h3>
                        <Badge 
                          variant={analysis.issues.hasAnyIssues ? "destructive" : "default"}
                          className="text-xs"
                        >
                          {analysis.issues.hasAnyIssues ? "Has Issues" : "Valid"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Driver: <span className="font-medium text-gray-900">{analysis.consignment.driverName || 'N/A'}</span></p>
                          <p className="text-gray-600">Customer: <span className="font-medium text-gray-900">{analysis.consignment.shipToCompanyName || 'N/A'}</span></p>
                        </div>
                        <div>
                          <p className="text-gray-600">State: <span className="font-medium text-gray-900">{analysis.consignment.delivery_StateLabel || 'N/A'}</span></p>
                          <p className="text-gray-600">Photos: <span className="font-medium text-gray-900">{analysis.photoCount}</span></p>
                        </div>
                        <div>
                          <p className="text-gray-600">
                            Date: <span className="font-medium text-gray-900">
                              {analysis.consignment.delivery_OutcomeDateTime ? 
                                new Date(analysis.consignment.delivery_OutcomeDateTime).toLocaleDateString() : 
                                'N/A'
                              }
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Issue indicators */}
                      {analysis.issues.hasAnyIssues && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {analysis.issues.missingSignature && (
                            <Badge variant="destructive" className="text-xs">
                              <FileSignature className="h-3 w-3 mr-1" />
                              No Signature
                            </Badge>
                          )}
                          {analysis.issues.noPhotos && (
                            <Badge variant="destructive" className="text-xs">
                              <Camera className="h-3 w-3 mr-1" />
                              No Photos
                            </Badge>
                          )}
                          {analysis.issues.temperatureIssue && (
                            <Badge variant="destructive" className="text-xs">
                              <Thermometer className="h-3 w-3 mr-1" />
                              Temp Issue
                            </Badge>
                          )}
                          {analysis.issues.missingReceiver && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              No Receiver
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 ml-4">
                      {/* Photo and signature thumbnails */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Photos:</span>
                        <ConsignmentThumbnails
                          consignment={analysis.consignment}
                          onPhotoClick={(photoIndex) => {
                            setSelectedConsignment(analysis.consignment);
                            setPhotoModalOpen(true);
                          }}
                        />
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {(analysis.consignment.deliveryLiveTrackLink || analysis.consignment.pickupLiveTrackLink) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedConsignment(analysis.consignment);
                              setPhotoModalOpen(true);
                            }}
                            className="flex items-center gap-2"
                            data-testid={`button-view-photos-${analysis.consignment.consignmentNo}`}
                          >
                            <Eye className="h-4 w-4" />
                            View Photos
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(analysis.consignment.deliveryLiveTrackLink || analysis.consignment.pickupLiveTrackLink, '_blank')}
                          className="flex items-center gap-2"
                          data-testid={`button-tracking-${analysis.consignment.consignmentNo}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Tracking
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Photo Modal */}
        {selectedConsignment && (
          <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>POD Photos - {selectedConsignment.consignmentNo}</DialogTitle>
                <DialogDescription>
                  Delivery photos and signatures for this consignment
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-auto max-h-[calc(90vh-120px)]">
                <PhotoGallery
                  trackingLink={selectedConsignment.deliveryLiveTrackLink || selectedConsignment.pickupLiveTrackLink!}
                  consignmentNo={selectedConsignment.consignmentNo!}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
}