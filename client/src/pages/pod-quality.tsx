import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Camera, 
  ExternalLink, 
  Thermometer, 
  FileSignature, 
  Download,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  LogOut,
  BarChart3,
  RefreshCw,
  Home,
  X,
  Info,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { getUser, logout } from "@/lib/auth";
import { Consignment, ScoreBreakdown } from "@shared/schema";

interface PODMetrics {
  photoCount: number;
  hasSignature: boolean;
  temperatureCompliant: boolean;
  hasTrackingLink: boolean;
  deliveryTime: string | null;
  qualityScore: number;
  hasReceiverName: boolean;
  scoreBreakdown?: ScoreBreakdown;
}

interface PhotoGalleryProps {
  trackingLink: string;
  consignmentNo: string;
}

interface InlinePhotoModalProps {
  photos: string[];
  isOpen: boolean;
  onClose: () => void;
  initialPhotoIndex?: number;
  consignmentNo: string;
}

interface PhotoThumbnailsProps {
  consignment: Consignment;
  photoCount: number;
  onPhotoLoad: (consignmentId: number, photos: string[]) => void;
  loadImmediately?: boolean; // For current page items - load right away
}

// Global cache for photos to avoid re-extraction
const photoCache = new Map<string, {photos: string[], signaturePhotos: string[]}>;

function PhotoThumbnails({ consignment, photoCount, onPhotoLoad, loadImmediately = false }: PhotoThumbnailsProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const hasStartedLoading = useRef(false);

  const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink || '';
  const cacheKey = trackingLink;

  const loadPhotos = useCallback(async () => {
    if (hasStartedLoading.current || !trackingLink) return;
    hasStartedLoading.current = true;

    // Check cache first
    if (photoCache.has(cacheKey)) {
      const cachedData = photoCache.get(cacheKey);
      if (cachedData) {
        setPhotos(cachedData.photos);
        onPhotoLoad(consignment.id, cachedData.photos);
      }
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/pod-photos?trackingToken=${encodeURIComponent(trackingLink)}&priority=low`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load photos');
      
      const data = await response.json();
      const loadedPhotos = data.photos || [];
      const signaturePhotos = data.signaturePhotos || [];
      
      setPhotos(loadedPhotos);
      photoCache.set(cacheKey, {photos: loadedPhotos, signaturePhotos});
      onPhotoLoad(consignment.id, loadedPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [trackingLink, cacheKey, consignment.id, onPhotoLoad]);

  // Load immediately for current page items, or use intersection observer for ahead-of-scroll loading
  useEffect(() => {
    if (loadImmediately) {
      // Load immediately for current page items
      loadPhotos();
      return;
    }

    // Use intersection observer for future page items with large margin
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStartedLoading.current) {
            loadPhotos();
          }
        });
      },
      { threshold: 0.1, rootMargin: '800px' } // Even larger margin for ahead-of-scroll loading
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [loadPhotos, loadImmediately]);

  if (loading) {
    return (
      <div ref={elementRef} className="flex items-center gap-2">
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-8 h-8 bg-gray-200 rounded animate-pulse"
            />
          ))}
        </div>
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={elementRef} className="flex items-center gap-2 text-red-500">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">Failed to load</span>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div ref={elementRef} className="flex items-center gap-2 text-gray-500">
        <Camera className="h-4 w-4" />
        <span className="text-sm">{photoCount} photos</span>
      </div>
    );
  }

  return (
    <div ref={elementRef} className="flex items-center gap-2">
      <div className="grid grid-cols-3 gap-1">
        {photos.slice(0, 3).map((photo, index) => (
          <img
            key={index}
            src={`/api/image?src=${encodeURIComponent(photo)}&w=32&q=60&fmt=webp`}
            alt={`Preview ${index + 1}`}
            className="w-8 h-8 object-cover rounded border"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ))}
        {photos.length > 3 && (
          <div className="w-8 h-8 bg-gray-100 rounded border flex items-center justify-center">
            <span className="text-xs text-gray-600">+{photos.length - 3}</span>
          </div>
        )}
      </div>
      <span className="text-sm text-gray-700">{photos.length} photos</span>
    </div>
  );
}

// Inline Photo Modal Component
function InlinePhotoModal({ photos, isOpen, onClose, initialPhotoIndex = 0, consignmentNo }: InlinePhotoModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialPhotoIndex);

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowRight') nextPhoto();
    if (e.key === 'ArrowLeft') prevPhoto();
    if (e.key === 'Escape') onClose();
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setCurrentIndex(initialPhotoIndex);
  }, [initialPhotoIndex]);

  if (!isOpen || photos.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-[90vh] p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center justify-between">
            <span>Photo {currentIndex + 1} of {photos.length} - {consignmentNo}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 relative flex items-center justify-center bg-black">
          {/* Navigation buttons */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-4 z-10 bg-black/50 hover:bg-black/70 text-white"
                onClick={prevPhoto}
                data-testid="button-prev-photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 z-10 bg-black/50 hover:bg-black/70 text-white"
                onClick={nextPhoto}
                data-testid="button-next-photo"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
          
          {/* Main photo */}
          <img
            src={`/api/image?src=${encodeURIComponent(photos[currentIndex])}&w=1200&q=90&fmt=webp`}
            alt={`Photo ${currentIndex + 1} for ${consignmentNo}`}
            className="max-w-full max-h-full object-contain"
            data-testid={`photo-modal-${currentIndex}`}
          />
        </div>
        
        {/* Photo navigation dots */}
        {photos.length > 1 && (
          <div className="flex justify-center p-4 bg-gray-50 gap-2">
            {photos.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                onClick={() => setCurrentIndex(index)}
                data-testid={`photo-dot-${index}`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  index: number;
}

function ProgressiveImage({ src, alt, className, index }: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  
  // Generate optimized image URLs using our proxy
  const thumbUrl = `/api/image?src=${encodeURIComponent(src)}&w=32&q=20&fmt=webp`;
  const smallUrl = `/api/image?src=${encodeURIComponent(src)}&w=320&q=75&fmt=webp`;
  const mediumUrl = `/api/image?src=${encodeURIComponent(src)}&w=640&q=80&fmt=webp`;
  const largeUrl = `/api/image?src=${encodeURIComponent(src)}&w=960&q=85&fmt=webp`;
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Tiny blur placeholder */}
      <img
        src={thumbUrl}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover blur-sm scale-110 transition-opacity duration-300 ${
          thumbLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setThumbLoaded(true)}
        data-testid={`photo-thumb-${index}`}
      />
      
      {/* High-res image */}
      <img
        src={smallUrl}
        srcSet={`
          ${smallUrl} 320w,
          ${mediumUrl} 640w,
          ${largeUrl} 960w
        `}
        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        alt={alt}
        className={`relative w-full h-full object-cover transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setIsLoaded(true)}
        loading={index < 6 ? "eager" : "lazy"} // Load first 6 eagerly
        decoding="async"
        data-testid={`photo-full-${index}`}
      />
      
      {/* Loading skeleton */}
      {!thumbLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" data-testid={`photo-skeleton-${index}`} />
      )}
    </div>
  );
}

function PhotoGallery({ trackingLink, consignmentNo }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Check cache first for instant loading
  useEffect(() => {
    const cachedData = photoCache.get(trackingLink);
    if (cachedData) {
      setPhotos(cachedData.photos);
      setLoading(false);
      return;
    }
    // If not cached, proceed with normal loading
    extractPhotos();
  }, [trackingLink]);

  const extractPhotos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/pod-photos?trackingToken=${encodeURIComponent(trackingLink)}&priority=high`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const regularPhotos = data.photos || [];
        const signaturePhotos = data.signaturePhotos || [];
        setPhotos(regularPhotos);
        // Update cache with both types
        photoCache.set(trackingLink, {photos: regularPhotos, signaturePhotos});
      } else {
        throw new Error(data.message || 'Failed to extract photos');
      }
      
    } catch (err) {
      console.error('Error fetching POD photos:', err);
      setError('Unable to load photos from tracking system');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trackingLink) {
      extractPhotos();
    }
  }, [trackingLink]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] py-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-lg font-medium">Loading photos...</p>
          <p className="text-sm text-gray-500">Extracting photos from tracking system</p>
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
        <div className="text-center max-w-md">
          <Camera className="h-8 w-8 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No photos found</p>
          <p className="text-sm text-gray-600 mb-4">
            The photo scraper didn't find any delivery photos on this tracking page.
          </p>
          <Button 
            onClick={() => window.open(trackingLink, '_blank')} 
            variant="outline" 
            className="mt-4"
            size="sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Tracking Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Found {photos.length} photo{photos.length !== 1 ? 's' : ''} for {consignmentNo}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto">
        {photos.map((photoUrl, index) => (
          <div 
            key={index}
            className="relative group cursor-pointer border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white"
            onClick={() => {
              setSelectedPhotoIndex(index);
              setPhotoModalOpen(true);
            }}
            data-testid={`photo-${index}`}
          >
            <ProgressiveImage
              src={photoUrl}
              alt={`POD Photo ${index + 1} for ${consignmentNo}`}
              className="w-full h-48"
              index={index}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
              <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <p className="text-white text-sm font-medium">Photo {index + 1}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Inline Photo Modal */}
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

interface PODAnalysis {
  consignment: Consignment;
  metrics: PODMetrics;
}

// Remove duplicate ScoreBreakdown interface - it's now defined in shared/schema.ts

export default function PODQuality() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [selectedShipper, setSelectedShipper] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState("all");
  const [selectedTempZone, setSelectedTempZone] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<PODAnalysis | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Track loaded photos for instant modal opening
  const [loadedPhotos, setLoadedPhotos] = useState<Map<number, string[]>>(new Map());
  
  const handlePhotoLoad = useCallback((consignmentId: number, photos: string[]) => {
    setLoadedPhotos(prev => new Map(prev).set(consignmentId, photos));
  }, []);
  const user = getUser();

  // Fetch all consignments and filter for delivered ones
  const { data: allConsignments = [], isLoading } = useQuery({
    queryKey: ['/api/consignments'],
  });

  // Helper function to map status labels
  const getStatusDisplay = (consignment: Consignment) => {
    const deliveryStateLabel = (consignment as any).delivery_StateLabel;
    const pickupStateLabel = (consignment as any).pickUp_StateLabel;
    
    const mapStatus = (status: string | null, isPickup: boolean = false) => {
      if (!status) return null;
      if (status === 'Traveling') return 'In Transit';
      if (status === 'GPS not present') return 'In Transit';
      if (status === 'Positive outcome') return isPickup ? 'Picked Up' : 'Delivered';
      if (status === 'Delivered') return 'Delivered';
      if (status === 'Not delivered') return 'Failed Delivery';
      if (status === 'Not picked up') return 'Failed Pickup';
      if (status === 'Negative outcome') return isPickup ? 'Failed Pickup' : 'Failed Delivery';
      if (status === 'Arrived') return 'Arrived';
      return status;
    };
    
    return mapStatus(deliveryStateLabel, false) || mapStatus(pickupStateLabel, true) || 'In Transit';
  };

  // Helper function to extract temperature zone from documentNote
  const getTemperatureZone = (consignment: Consignment) => {
    const tempZone = consignment.documentNote?.split('\\')[0] || consignment.expectedTemperature || 'Standard';
    
    // Filter out internal depot operations
    if (tempZone === 'Return to depot' || tempZone?.toLowerCase().includes('return to depot')) {
      return 'Internal Transfer';
    }
    
    return tempZone;
  };

  // Filter for delivered consignments
  const deliveredConsignments = (allConsignments as Consignment[]).filter((consignment: Consignment) => {
    const status = getStatusDisplay(consignment);
    return status === 'Delivered';
  });

  // Get unique values for filter dropdowns
  const warehouseCompanies = Array.from(
    new Set(deliveredConsignments.map(c => c.warehouseCompanyName).filter(Boolean))
  ).sort();

  const shipperCompanies = Array.from(
    new Set(deliveredConsignments.map(c => (c as any).shipperCompanyName).filter(Boolean))
  ).sort();

  const driverNames = Array.from(
    new Set(deliveredConsignments.map(c => c.driverName).filter(Boolean))
  ).sort();

  const temperatureZones = Array.from(
    new Set(deliveredConsignments.map(c => getTemperatureZone(c)).filter(Boolean))
  ).sort();

  // Analyze POD quality for each consignment
  const analyzePOD = (consignment: Consignment): PODAnalysis => {
    const photoCount = countPhotos(consignment);
    const hasSignature = Boolean(consignment.deliverySignatureName);
    const hasReceiverName = Boolean(consignment.deliverySignatureName && consignment.deliverySignatureName.trim().length > 0);
    const temperatureCompliant = checkTemperatureCompliance(consignment);
    const hasTrackingLink = Boolean(consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink);
    const deliveryTime = consignment.delivery_OutcomeDateTime;
    
    // Calculate quality score based on your 5 criteria and create detailed breakdown
    let score = 0;
    
    // Create detailed scoring breakdown
    const breakdown: ScoreBreakdown = {
      photos: { points: 0, reason: '', status: 'fail' },
      signature: { points: 0, reason: '', status: 'fail' },
      receiverName: { points: 0, reason: '', status: 'fail' },
      temperature: { points: 0, reason: '', status: 'fail' },
      clearPhotos: { points: 0, reason: 'Not yet implemented', status: 'pending' },
      total: 0
    };
    
    // Photo scoring: 3+ = good, 2 = negative, 1 = more negative, 0 = complete fail
    if (photoCount >= 3) {
      score += 25;
      breakdown.photos = { points: 25, reason: `Found ${photoCount} photos (3+ required)`, status: 'pass' };
    } else if (photoCount === 2) {
      score -= 10;
      breakdown.photos = { points: -10, reason: `Only 2 photos found (3+ required)`, status: 'partial' };
    } else if (photoCount === 1) {
      score -= 20;
      breakdown.photos = { points: -20, reason: `Only 1 photo found (3+ required)`, status: 'partial' };
    } else {
      score -= 50;
      breakdown.photos = { points: -50, reason: `No photos found (3+ required)`, status: 'fail' };
    }
    
    // Signature scoring
    if (hasSignature) {
      score += 25;
      breakdown.signature = { points: 25, reason: 'Delivery signature present', status: 'pass' };
    } else {
      breakdown.signature = { points: 0, reason: 'No delivery signature found', status: 'fail' };
    }
    
    // Receiver name scoring
    if (hasReceiverName) {
      score += 25;
      breakdown.receiverName = { points: 25, reason: `Receiver name: "${consignment.deliverySignatureName}"`, status: 'pass' };
    } else {
      breakdown.receiverName = { points: 0, reason: 'No receiver name captured', status: 'fail' };
    }
    
    // Temperature compliance scoring
    if (temperatureCompliant) {
      score += 25;
      breakdown.temperature = { points: 25, reason: 'Temperature within expected range', status: 'pass' };
    } else {
      breakdown.temperature = { points: 0, reason: 'Temperature outside expected range', status: 'fail' };
    }
    
    // Ensure score doesn't go below 0
    score = Math.max(0, score);
    breakdown.total = score;
    
    const metrics: PODMetrics = {
      photoCount,
      hasSignature,
      temperatureCompliant,
      hasTrackingLink,
      deliveryTime,
      qualityScore: score,
      hasReceiverName,
      scoreBreakdown: breakdown
    };

    return { consignment, metrics };
  };

  // Count photos from POD files using Axylog file count data
  const countPhotos = (consignment: Consignment): number => {
    let count = 0;
    
    // First check if we have actual file count data from Axylog API
    const deliveryFileCount = (consignment as any).deliveryReceivedFileCount || 0;
    const pickupFileCount = (consignment as any).pickupReceivedFileCount || 0;
    
    // Use the file count data from Axylog API if available
    if (deliveryFileCount > 0 || pickupFileCount > 0) {
      count = Number(deliveryFileCount) + Number(pickupFileCount);
      
      // Subtract signatures from file count since they're included in the total
      // but we want to count actual photos only
      if (consignment.deliverySignatureName && deliveryFileCount > 0) {
        count = Math.max(0, count - 1); // Subtract delivery signature
      }
      if (consignment.pickupSignatureName && pickupFileCount > 0) {
        count = Math.max(0, count - 1); // Subtract pickup signature  
      }
      
      return count;
    }
    
    // Fallback: Check if actual file paths are provided
    if (consignment.deliveryPodFiles) {
      count += consignment.deliveryPodFiles.split(',').filter(f => f.trim()).length;
    }
    if (consignment.receivedDeliveryPodFiles) {
      count += consignment.receivedDeliveryPodFiles.split(',').filter(f => f.trim()).length;
    }
    
    // If no file paths but we have delivery signatures and tracking links,
    // estimate based on presence of other delivery evidence
    if (count === 0) {
      // If there's a delivery signature, likely at least 1 photo
      if (consignment.deliverySignatureName) {
        count += 1;
      }
      
      // If there's a tracking link and it's delivered, likely photos exist
      if (consignment.deliveryLiveTrackLink && getStatusDisplay(consignment) === 'Delivered') {
        count += Math.max(1, count); // At least 1 photo if delivered with tracking
      }
    }
    
    return count;
  };

  // Format temperature display for expected vs actual
  const formatTemperatureDisplay = (consignment: Consignment) => {
    // Extract expected temperature from document_note (e.g., "Frozen -18C to -20C")
    let expected = 'N/A';
    if (consignment.documentNote) {
      const tempMatch = consignment.documentNote.match(/^([^\\n]+)/);
      if (tempMatch) {
        expected = tempMatch[1].trim();
        // Clean up the temperature format
        if (expected.includes('\\n') || expected.includes('\\')) {
          expected = expected.split('\\')[0].trim();
        }
      }
    }
    
    // Fallback to expectedTemperature field if available
    if (expected === 'N/A' && consignment.expectedTemperature) {
      expected = consignment.expectedTemperature;
    }
    
    // Get actual temperature readings from Axylog fields
    const temp1 = (consignment as any).amountToCollect;
    const temp2 = (consignment as any).amountCollected;
    const tempPayment = (consignment as any).paymentMethod;
    
    let actualTemps = [];
    
    // amountToCollect = Temp 1 (999 = default/blank)
    if (temp1 && temp1 !== 999 && temp1 !== '999' && !isNaN(parseFloat(temp1.toString()))) {
      actualTemps.push(`${temp1}°C`);
    }
    
    // amountCollected = Temp 2  
    if (temp2 && temp2 !== 999 && temp2 !== '999' && !isNaN(parseFloat(temp2.toString()))) {
      actualTemps.push(`${temp2}°C`);
    }
    
    // paymentMethod = Additional temp reading  
    if (tempPayment && tempPayment !== 999 && tempPayment !== '999' && !isNaN(parseFloat(tempPayment))) {
      actualTemps.push(`${tempPayment}°C`);
    }
    
    let actual = actualTemps.length > 0 ? actualTemps.join(', ') : 'No readings available';
    
    return { expected, actual };
  };

  // Check if temperature requirements were met using actual recorded temperatures
  const checkTemperatureCompliance = (consignment: Consignment): boolean => {
    // Get expected temperature from document_note or expectedTemperature field
    let expectedTemp = consignment.expectedTemperature;
    if (!expectedTemp && consignment.documentNote) {
      const tempMatch = consignment.documentNote.match(/^([^\\n]+)/);
      if (tempMatch) {
        expectedTemp = tempMatch[1].trim();
      }
    }
    
    // If no expected temperature is specified, we can't determine compliance
    if (!expectedTemp) return true;
    
    // Parse temperature range from expected temp zone (e.g., "Frozen -18C to -20C")
    const parseTemperatureRange = (tempZone: string) => {
      // Look for patterns like "-18C to -20C", "0C to +4C", "-18 to -20", "0–4°C", "2–8°C", etc.
      // Updated regex to handle optional + signs and various separators
      const rangeMatch = tempZone.match(/([+-]?\d+)\s*(?:C|°C)?\s*(?:to|–|-)\s*([+-]?\d+)\s*(?:C|°C)?/i);
      if (rangeMatch) {
        const temp1 = parseFloat(rangeMatch[1]);
        const temp2 = parseFloat(rangeMatch[2]);
        return {
          min: Math.min(temp1, temp2),
          max: Math.max(temp1, temp2)
        };
      }
      
      // Look for single temperature values (e.g., "14°C", "+14°C")
      const singleMatch = tempZone.match(/([+-]?\d+)\s*(?:C|°C)/i);
      if (singleMatch) {
        const temp = parseFloat(singleMatch[1]);
        return { min: temp, max: temp };
      }
      return null;
    };
    
    // Get the expected temperature range
    const expectedRange = parseTemperatureRange(expectedTemp);
    if (!expectedRange) {
      // Fallback to text matching if we can't parse numeric ranges
      const expectedLower = expectedTemp.toLowerCase();
      const documentNote = consignment.documentNote;
      if (!documentNote) return true;
      
      const actualTempZone = documentNote.split('\\')[0].toLowerCase();
      
      if (expectedLower.includes('frozen') || expectedLower.includes('freezer')) {
        return actualTempZone.includes('frozen') || actualTempZone.includes('freezer');
      }
      
      if (expectedLower.includes('chiller')) {
        return actualTempZone.includes('chiller');
      }
      
      return true; // If we can't determine, assume compliant
    }
    
    // Get all actual temperature readings
    const temp1 = (consignment as any).amountToCollect;
    const temp2 = (consignment as any).amountCollected;
    const tempPayment = (consignment as any).paymentMethod;
    
    let actualTemps = [];
    
    // Collect all valid temperature readings (filter out 999 values)
    if (temp1 && temp1 !== 999 && temp1 !== '999' && !isNaN(parseFloat(temp1.toString()))) {
      actualTemps.push(parseFloat(temp1.toString()));
    }
    if (temp2 && temp2 !== 999 && temp2 !== '999' && !isNaN(parseFloat(temp2.toString()))) {
      actualTemps.push(parseFloat(temp2.toString()));
    }
    if (tempPayment && tempPayment !== 999 && tempPayment !== '999' && !isNaN(parseFloat(tempPayment))) {
      actualTemps.push(parseFloat(tempPayment));
    }
    
    // If no actual temperature readings, assume compliant
    if (actualTemps.length === 0) return true;
    
    // Check if ANY actual temperature falls within the expected range
    return actualTemps.some(actualTemp => 
      actualTemp >= expectedRange.min && actualTemp <= expectedRange.max
    );
  };

  // Process and filter consignments - ALL filtered data for stats
  const allFilteredAnalyses: PODAnalysis[] = deliveredConsignments
    .map(analyzePOD)
    .filter((analysis: PODAnalysis) => {
      const consignment = analysis.consignment;
      const metrics = analysis.metrics;
      
      // Text search filter
      const matchesSearch = searchTerm === "" || 
        consignment.consignmentNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        consignment.shipToCompanyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        consignment.driverName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Warehouse filter
      const matchesWarehouse = selectedWarehouse === "all" || 
        consignment.warehouseCompanyName === selectedWarehouse;
      
      // Shipper filter
      const matchesShipper = selectedShipper === "all" || 
        (consignment as any).shipperCompanyName === selectedShipper;
      
      // Driver filter
      const matchesDriver = selectedDriver === "all" || 
        consignment.driverName === selectedDriver;
      
      // Temperature zone filter
      const tempZone = getTemperatureZone(consignment);
      const matchesTempZone = selectedTempZone === "all" || tempZone === selectedTempZone;
      
      // Date range filter (use delivery outcome date)
      const matchesDateRange = (() => {
        if (!fromDate && !toDate) return true;
        
        const deliveryDate = metrics.deliveryTime;
        if (!deliveryDate) return true; // Show consignments without delivery dates
        
        // Convert to AEST timezone for comparison
        const utcDate = new Date(deliveryDate);
        const aestDate = new Date(utcDate.getTime() + (10 * 60 * 60 * 1000)); // Add 10 hours for AEST
        const dateString = aestDate.toISOString().split('T')[0];
        
        if (fromDate && toDate) {
          return dateString >= fromDate && dateString <= toDate;
        } else if (fromDate) {
          return dateString >= fromDate;
        } else if (toDate) {
          return dateString <= toDate;
        }
        return true;
      })();
      
      // Quality filter
      const matchesQuality = (() => {
        switch (selectedFilter) {
          case "excellent":
            return metrics.qualityScore >= 80;
          case "good":
            return metrics.qualityScore >= 60 && metrics.qualityScore < 80;
          case "poor":
            return metrics.qualityScore < 60;
          case "missing-photos":
            return metrics.photoCount === 0;
          case "missing-signature":
            return !metrics.hasSignature;
          case "temp-issues":
            return !metrics.temperatureCompliant;
          default:
            return true;
        }
      })();
      
      return matchesSearch && matchesWarehouse && matchesShipper && 
             matchesDriver && matchesTempZone && matchesDateRange && matchesQuality;
    });

  // Pagination calculations
  const totalItems = allFilteredAnalyses.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  // Current page data (for display)
  const podAnalyses = allFilteredAnalyses.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, selectedWarehouse, selectedShipper, selectedDriver, selectedTempZone, searchTerm, fromDate, toDate, pageSize]);

  // Calculate summary statistics from ALL filtered data (not just current page)
  const totalDeliveries = allFilteredAnalyses.length;
  const avgPhotoCount = totalDeliveries > 0 ? 
    allFilteredAnalyses.reduce((sum, a) => sum + a.metrics.photoCount, 0) / totalDeliveries : 0;
  const signatureRate = totalDeliveries > 0 ? 
    (allFilteredAnalyses.filter(a => a.metrics.hasSignature).length / totalDeliveries) * 100 : 0;
  const tempComplianceRate = totalDeliveries > 0 ? 
    (allFilteredAnalyses.filter(a => a.metrics.temperatureCompliant).length / totalDeliveries) * 100 : 0;
  const avgQualityScore = totalDeliveries > 0 ? 
    allFilteredAnalyses.reduce((sum, a) => sum + a.metrics.qualityScore, 0) / totalDeliveries : 0;

  const getQualityBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Handle sync from Axylog
  const handleSyncFromAxylog = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/axylog/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          syncFromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
          syncToDate: new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        // Refresh the consignments data
        window.location.reload();
      } else {
        console.error('Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="gradient-primary shadow-header z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-white">ChillTrack</h1>
            <span className="ml-3 text-blue-100 text-sm">POD Quality Analysis</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link href="/">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            
            <Button 
              onClick={handleSyncFromAxylog}
              disabled={isSyncing}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Axylog'}
            </Button>
            
            <div className="hidden md:flex items-center text-white/90 text-sm mr-4 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              <span>{user?.email}</span>
            </div>

            <Button 
              className="gradient-accent hover:opacity-90 text-white border-0"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 bg-gradient-to-br from-blue-50 via-white to-purple-50">

        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDeliveries}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Photos per POD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgPhotoCount.toFixed(1)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Signature Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{signatureRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Quality Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgQualityScore.toFixed(0)}/100</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="gradient-card shadow-card rounded-xl p-6 mb-8 border border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters & Search</h3>
          
          {/* Main Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end mb-6">
            <div className="relative lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  Search
                </label>
              </div>
              <Input
                placeholder="Consignment no, company, driver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-gray-200 focus:border-primary focus:ring-primary/20"
                data-testid="input-search-pod"
              />
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 bg-blue-500 rounded"></div>
                <label className="text-sm font-semibold text-gray-700">
                  Warehouse
                </label>
              </div>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:border-primary focus:ring-primary/20 focus:outline-none"
                data-testid="select-warehouse"
              >
                <option value="all">All Warehouses</option>
                {warehouseCompanies.map((warehouse) => (
                  <option key={warehouse || 'unknown'} value={warehouse || ''}>
                    {warehouse}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 bg-green-500 rounded"></div>
                <label className="text-sm font-semibold text-gray-700">
                  Shipper
                </label>
              </div>
              <select
                value={selectedShipper}
                onChange={(e) => setSelectedShipper(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:border-primary focus:ring-primary/20 focus:outline-none"
                data-testid="select-shipper"
              >
                <option value="all">All Shippers</option>
                {shipperCompanies.map((shipper) => (
                  <option key={shipper} value={shipper}>
                    {shipper}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 bg-purple-500 rounded"></div>
                <label className="text-sm font-semibold text-gray-700">
                  Driver
                </label>
              </div>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:border-primary focus:ring-primary/20 focus:outline-none"
                data-testid="select-driver"
              >
                <option value="all">All Drivers</option>
                {driverNames.map((driver) => (
                  <option key={driver} value={driver || ''}>
                    {driver || 'Unknown Driver'}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Thermometer className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  Temp Zone
                </label>
              </div>
              <select
                value={selectedTempZone}
                onChange={(e) => setSelectedTempZone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:border-primary focus:ring-primary/20 focus:outline-none"
                data-testid="select-temp-zone"
              >
                <option value="all">All Zones</option>
                {temperatureZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6">
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  From Date
                </label>
              </div>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border-gray-200 focus:border-primary focus:ring-primary/20"
                data-testid="input-from-date"
              />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  To Date
                </label>
              </div>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border-gray-200 focus:border-primary focus:ring-primary/20"
                data-testid="input-to-date"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                <span className="text-sm font-medium text-gray-700">{podAnalyses.length}</span>
                <span className="text-sm text-gray-500 ml-1">found</span>
              </div>
              {(fromDate || toDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                  className="text-xs"
                  data-testid="button-clear-dates"
                >
                  Clear Dates
                </Button>
              )}
            </div>
          </div>
          
          {/* Quality Filter Buttons */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-5 w-5 bg-yellow-500 rounded"></div>
              <label className="text-sm font-semibold text-gray-700">
                Quality Filters
              </label>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedFilter === "all" ? "default" : "outline"}
                onClick={() => setSelectedFilter("all")}
                size="sm"
                data-testid="button-filter-all"
              >
                All
              </Button>
              <Button
                variant={selectedFilter === "excellent" ? "default" : "outline"}
                onClick={() => setSelectedFilter("excellent")}
                size="sm"
                data-testid="button-filter-excellent"
              >
                Excellent (80+)
              </Button>
              <Button
                variant={selectedFilter === "good" ? "default" : "outline"}
                onClick={() => setSelectedFilter("good")}
                size="sm"
                data-testid="button-filter-good"
              >
                Good (60-79)
              </Button>
              <Button
                variant={selectedFilter === "poor" ? "default" : "outline"}
                onClick={() => setSelectedFilter("poor")}
                size="sm"
                data-testid="button-filter-poor"
              >
                Poor (&lt;60)
              </Button>
              <Button
                variant={selectedFilter === "missing-photos" ? "default" : "outline"}
                onClick={() => setSelectedFilter("missing-photos")}
                size="sm"
                data-testid="button-filter-missing-photos"
              >
                No Photos
              </Button>
              <Button
                variant={selectedFilter === "missing-signature" ? "default" : "outline"}
                onClick={() => setSelectedFilter("missing-signature")}
                size="sm"
                data-testid="button-filter-missing-signature"
              >
                No Signature
              </Button>
            </div>
          </div>
        </div>

        {/* POD Quality List */}
        <div className="gradient-card shadow-card rounded-xl border border-white/20">
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delivery POD Analysis</h3>
                <p className="text-gray-600 mt-1">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} delivered consignments
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="select-page-size"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    ← Previous
                  </Button>
                  <span className="text-sm text-gray-600 px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Next →
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {podAnalyses.map((analysis, index) => {
                const { consignment, metrics } = analysis;
                return (
                  <div
                    key={consignment.id}
                    className="bg-white border-2 border-gray-100 rounded-xl p-6 hover:border-primary/20 hover:shadow-md transition-all duration-200"
                    data-testid={`pod-analysis-${consignment.id}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-gray-900 mb-2" data-testid={`text-consignment-${consignment.id}`}>
                          {consignment.consignmentNo}
                        </h3>
                        <p className="text-base text-gray-700 font-medium mb-1" data-testid={`text-company-${consignment.id}`}>
                          {consignment.shipToCompanyName}
                        </p>
                        <p className="text-sm text-gray-600" data-testid={`text-delivery-time-${consignment.id}`}>
                          Delivered: {formatDate(metrics.deliveryTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAnalysis(analysis);
                            setScoreBreakdownOpen(true);
                          }}
                          className={`${
                            metrics.qualityScore >= 80 ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                            metrics.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
                            'bg-red-100 text-red-800 hover:bg-red-200'
                          } border-0 font-medium cursor-pointer text-lg px-4 py-2`}
                          data-testid={`button-score-breakdown-${consignment.id}`}
                        >
                          <Info className="h-4 w-4 mr-2" />
                          {metrics.qualityScore >= 80 ? "Excellent" :
                           metrics.qualityScore >= 60 ? "Good" : "Poor"} {metrics.qualityScore}/100
                        </Button>
                      </div>
                    </div>

                    {/* POD Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                      <div 
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                        onClick={() => {
                          setSelectedConsignment(consignment);
                          setPhotoModalOpen(true);
                        }}
                        data-testid={`button-photos-${consignment.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-semibold text-gray-700">Photos</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {metrics.photoCount === 0 && <XCircle className="h-5 w-5 text-red-500" />}
                            {metrics.photoCount > 0 && <CheckCircle className="h-5 w-5 text-green-500" />}
                            <ExternalLink className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                        <PhotoThumbnails 
                          consignment={consignment}
                          photoCount={metrics.photoCount}
                          onPhotoLoad={handlePhotoLoad}
                          loadImmediately={index < 10} // Only load first 10 items immediately to prevent overload
                        />
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileSignature className="h-5 w-5 text-purple-600" />
                            <span className="text-sm font-semibold text-gray-700">Signature</span>
                          </div>
                          {metrics.hasSignature ? 
                            <CheckCircle className="h-5 w-5 text-green-500" /> : 
                            <XCircle className="h-5 w-5 text-red-500" />
                          }
                        </div>
                        <p className="text-lg font-bold text-gray-900" data-testid={`text-signature-${consignment.id}`}>
                          {metrics.hasSignature ? 'Signed' : 'Missing'}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Thermometer className="h-5 w-5 text-orange-600" />
                            <span className="text-sm font-semibold text-gray-700">Temperature</span>
                          </div>
                          {metrics.temperatureCompliant ? 
                            <CheckCircle className="h-5 w-5 text-green-500" /> : 
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          }
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">
                            Expected: <span className="font-medium">{formatTemperatureDisplay(consignment).expected}</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Actual: <span className="font-medium text-gray-900">{formatTemperatureDisplay(consignment).actual}</span>
                          </p>
                          <p className={`text-lg font-bold ${metrics.temperatureCompliant ? 'text-green-600' : 'text-yellow-600'}`} data-testid={`text-temperature-${consignment.id}`}>
                            {metrics.temperatureCompliant ? 'Compliant' : 'Non-Compliant'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-semibold text-gray-700">Tracking</span>
                          </div>
                        </div>
                        {metrics.hasTrackingLink && consignment.deliveryLiveTrackLink ? (
                          <a
                            href={consignment.deliveryLiveTrackLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`button-track-${consignment.id}`}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Live Track
                            </Button>
                          </a>
                        ) : (
                          <p className="text-sm text-gray-500">No tracking link</p>
                        )}
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">Driver:</span>
                          <span className="ml-2 text-gray-900" data-testid={`text-driver-${consignment.id}`}>
                            {consignment.driverName || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Temp Zone:</span>
                          <span className="ml-2 text-gray-900" data-testid={`text-temp-zone-${consignment.id}`}>
                            {consignment.expectedTemperature || getTemperatureZone(consignment) || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {podAnalyses.length === 0 && (
                <div className="text-center py-8 text-gray-500" data-testid="text-no-results">
                  No delivered consignments found matching your criteria.
                </div>
              )}
            </div>
          </div>
        </div>
        </main>

        {/* Photo Viewer Modal */}
        <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>POD Photos - {selectedConsignment?.consignmentNo}</DialogTitle>
              <DialogDescription>
                {selectedConsignment?.shipToCompanyName} • {selectedConsignment && countPhotos(selectedConsignment)} photos
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {selectedConsignment?.deliveryLiveTrackLink || selectedConsignment?.pickupLiveTrackLink ? (
                <PhotoGallery 
                  trackingLink={selectedConsignment.deliveryLiveTrackLink || selectedConsignment.pickupLiveTrackLink || ''}
                  consignmentNo={selectedConsignment.consignmentNo || ''}
                />
              ) : (
                <div className="flex items-center justify-center h-[70vh] text-gray-500 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">No tracking link available</p>
                    <p className="text-sm">Photos cannot be displayed without a live tracking link</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-gray-600">
                Use the tracking system to view and assess photo quality for POD scoring.
              </p>
              {(selectedConsignment?.deliveryLiveTrackLink || selectedConsignment?.pickupLiveTrackLink) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const link = selectedConsignment.deliveryLiveTrackLink || selectedConsignment.pickupLiveTrackLink;
                    if (link) window.open(link, '_blank');
                  }}
                  data-testid="button-open-external"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Tracking Page
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Score Breakdown Modal */}
        <Dialog open={scoreBreakdownOpen} onOpenChange={setScoreBreakdownOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>POD Quality Score Breakdown</DialogTitle>
              <DialogDescription>
                {selectedAnalysis && `Detailed scoring for ${selectedAnalysis.consignment.consignmentNo}`}
              </DialogDescription>
            </DialogHeader>
            
            {selectedAnalysis?.metrics.scoreBreakdown && (
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {selectedAnalysis.metrics.qualityScore}/100
                  </div>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    selectedAnalysis.metrics.qualityScore >= 80 ? 'bg-green-100 text-green-800' :
                    selectedAnalysis.metrics.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {selectedAnalysis.metrics.qualityScore >= 80 ? "Excellent" :
                     selectedAnalysis.metrics.qualityScore >= 60 ? "Good" : "Poor"} Quality
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Photos */}
                  <div className={`p-4 rounded-lg border-2 ${
                    selectedAnalysis.metrics.scoreBreakdown.photos.status === 'pass' ? 'border-green-200 bg-green-50' :
                    selectedAnalysis.metrics.scoreBreakdown.photos.status === 'partial' ? 'border-yellow-200 bg-yellow-50' :
                    'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        <span className="font-semibold">Photos</span>
                      </div>
                      <div className={`font-bold ${
                        selectedAnalysis.metrics.scoreBreakdown.photos.points > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedAnalysis.metrics.scoreBreakdown.photos.points > 0 ? '+' : ''}{selectedAnalysis.metrics.scoreBreakdown.photos.points} pts
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{selectedAnalysis.metrics.scoreBreakdown.photos.reason}</p>
                  </div>

                  {/* Signature */}
                  <div className={`p-4 rounded-lg border-2 ${
                    selectedAnalysis.metrics.scoreBreakdown.signature.status === 'pass' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileSignature className="h-5 w-5" />
                        <span className="font-semibold">Signature</span>
                      </div>
                      <div className={`font-bold ${
                        selectedAnalysis.metrics.scoreBreakdown.signature.points > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedAnalysis.metrics.scoreBreakdown.signature.points > 0 ? '+' : ''}{selectedAnalysis.metrics.scoreBreakdown.signature.points} pts
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{selectedAnalysis.metrics.scoreBreakdown.signature.reason}</p>
                  </div>

                  {/* Receiver Name */}
                  <div className={`p-4 rounded-lg border-2 ${
                    selectedAnalysis.metrics.scoreBreakdown.receiverName.status === 'pass' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        <span className="font-semibold">Receiver Name</span>
                      </div>
                      <div className={`font-bold ${
                        selectedAnalysis.metrics.scoreBreakdown.receiverName.points > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedAnalysis.metrics.scoreBreakdown.receiverName.points > 0 ? '+' : ''}{selectedAnalysis.metrics.scoreBreakdown.receiverName.points} pts
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{selectedAnalysis.metrics.scoreBreakdown.receiverName.reason}</p>
                  </div>

                  {/* Temperature */}
                  <div className={`p-4 rounded-lg border-2 ${
                    selectedAnalysis.metrics.scoreBreakdown.temperature.status === 'pass' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-5 w-5" />
                        <span className="font-semibold">Temperature Compliance</span>
                      </div>
                      <div className={`font-bold ${
                        selectedAnalysis.metrics.scoreBreakdown.temperature.points > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedAnalysis.metrics.scoreBreakdown.temperature.points > 0 ? '+' : ''}{selectedAnalysis.metrics.scoreBreakdown.temperature.points} pts
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{selectedAnalysis.metrics.scoreBreakdown.temperature.reason}</p>
                  </div>

                  {/* Clear Photos (Future) */}
                  <div className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        <span className="font-semibold">Clear Photos</span>
                      </div>
                      <div className="font-bold text-gray-500">
                        +0 pts
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{selectedAnalysis.metrics.scoreBreakdown.clearPhotos.reason}</p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Scoring System</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• <strong>Photos:</strong> 3+ photos = +25 pts, 2 photos = -10 pts, 1 photo = -20 pts, 0 photos = -50 pts</p>
                    <p>• <strong>Signature:</strong> Present = +25 pts, Missing = 0 pts</p>
                    <p>• <strong>Receiver Name:</strong> Captured = +25 pts, Missing = 0 pts</p>
                    <p>• <strong>Temperature:</strong> Compliant = +25 pts, Non-compliant = 0 pts</p>
                    <p>• <strong>Clear Photos:</strong> Not yet implemented = 0 pts</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}