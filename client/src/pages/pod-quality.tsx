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
  EyeOff,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Globe
} from "lucide-react";
import { Link } from "wouter";
import { getUser, logout, getToken, isAuthenticated } from "@/lib/auth";
import { Consignment, ScoreBreakdown } from "@shared/schema";
import { calculateDriverStats, getDriversByCohort, getCohortSummary, DriverStats, DriverCohortConfig, DEFAULT_COHORT_CONFIG } from "@/utils/driverStats";

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

interface SignaturePhotosProps {
  consignment: Consignment;
}

interface PhotoThumbnailsProps {
  consignment: Consignment;
  photoCount: number;
  onPhotoLoad: (consignmentId: number, photos: string[]) => void;
  loadImmediately?: boolean; // For current page items - load right away
}

interface SignatureThumbnailProps {
  consignment: Consignment;
  onSignatureLoad: (consignmentId: number, signatures: string[]) => void;
  loadImmediately?: boolean;
  onSignatureClick?: (signatures: string[], consignmentNo: string) => void;
}

// Global cache for photos to avoid re-extraction
const photoCache = new Map<string, {photos: string[], signaturePhotos: string[]}>;

// Global cache for signature photos specifically
const signaturePhotoState = new Map<number, string[]>();

function PhotoThumbnails({ consignment, photoCount, onPhotoLoad, loadImmediately = false }: PhotoThumbnailsProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink || '';
  const cacheKey = trackingLink;

  const loadPhotos = useCallback(async () => {
    // Prevent multiple simultaneous loads and ensure we have a tracking link
    if (loading || !trackingLink) return;

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
    setError(false);
    
    try {
      const token = getToken();
      if (!token || !isAuthenticated()) {
        console.error('No valid authentication token available');
        setError(true);
        return;
      }
      
      const response = await fetch(`/api/pod-photos?trackingToken=${encodeURIComponent(trackingLink)}&priority=high`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        console.error('Authentication failed - token may be expired');
        // Redirect to login or refresh page
        logout();
        return;
      }
      
      if (!response.ok) throw new Error('Failed to load photos');
      
      const data = await response.json();
      
      if (data.success) {
        const loadedPhotos = data.photos || [];
        const loadedSignatures = data.signaturePhotos || [];
        setPhotos(loadedPhotos);
        photoCache.set(cacheKey, {photos: loadedPhotos, signaturePhotos: loadedSignatures});
        onPhotoLoad(consignment.id, loadedPhotos);
      } else {
        throw new Error(data.error || 'Failed to load photos');
      }
    } catch (error) {
      console.error('Error loading photos:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [trackingLink, cacheKey, consignment.id, onPhotoLoad, loading]);

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
          if (entry.isIntersecting) {
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

// Signature Thumbnail Component
function SignatureThumbnail({ consignment, onSignatureLoad, loadImmediately = false, onSignatureClick }: SignatureThumbnailProps) {
  const [signatures, setSignatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink || '';
  const cacheKey = trackingLink;

  const loadSignatures = useCallback(async () => {
    // Prevent multiple simultaneous loads and ensure we have a tracking link
    if (loading || !trackingLink) return;

    // Check cache first
    if (photoCache.has(cacheKey)) {
      const cachedData = photoCache.get(cacheKey);
      if (cachedData && cachedData.signaturePhotos) {
        setSignatures(cachedData.signaturePhotos);
        onSignatureLoad(consignment.id, cachedData.signaturePhotos);
      }
      return;
    }

    setLoading(true);
    setError(false);
    
    try {
      const token = getToken();
      if (!token || !isAuthenticated()) {
        console.error('No valid authentication token available');
        setError(true);
        return;
      }
      
      const response = await fetch(`/api/pod-photos?trackingToken=${encodeURIComponent(trackingLink)}&priority=high`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        console.error('Authentication failed - token may be expired');
        logout();
        return;
      }
      
      if (!response.ok) throw new Error('Failed to load signatures');
      
      const data = await response.json();
      
      if (data.success) {
        const loadedPhotos = data.photos || [];
        const loadedSignatures = data.signaturePhotos || [];
        setSignatures(loadedSignatures);
        photoCache.set(cacheKey, {photos: loadedPhotos, signaturePhotos: loadedSignatures});
        onSignatureLoad(consignment.id, loadedSignatures);
      } else {
        throw new Error(data.error || 'Failed to load signatures');
      }
    } catch (error) {
      console.error('Error loading signatures:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [trackingLink, cacheKey, consignment.id, onSignatureLoad, loading]);

  // Load immediately for current page items, or use intersection observer for ahead-of-scroll loading
  useEffect(() => {
    if (loadImmediately) {
      loadSignatures();
      return;
    }

    // Use intersection observer for future page items with large margin
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadSignatures();
          }
        });
      },
      { threshold: 0.1, rootMargin: '800px' }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [loadSignatures]);

  if (loading) {
    return (
      <div ref={elementRef} className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
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

  if (signatures.length === 0) {
    return (
      <div ref={elementRef} className="flex items-center gap-2 text-gray-500">
        <FileSignature className="h-4 w-4" />
        <span className="text-sm">No signature</span>
      </div>
    );
  }

  const displayPhoto = signatures[0];
  
  const handleClick = () => {
    if (onSignatureClick && signatures.length > 0) {
      onSignatureClick(signatures, consignment.consignmentNo || consignment.orderNumberRef || consignment.id.toString());
    }
  };
  
  return (
    <div 
      ref={elementRef} 
      className={`flex items-center gap-2 ${onSignatureClick ? 'cursor-pointer hover:bg-gray-50 rounded p-1 -m-1 transition-colors' : ''}`}
      onClick={handleClick}
    >
      <img
        src={`/api/image?src=${encodeURIComponent(displayPhoto!)}&w=32&q=60&fmt=webp`}
        alt="Signature"
        className="w-8 h-8 object-cover rounded border"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <span className="text-sm text-gray-700">Signature</span>
    </div>
  );
}

// Modern Photo Modal Component with Enhanced UX
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
        {/* Enhanced Header */}
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
              >
                {isZoomed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="text-white hover:bg-white/20 transition-all duration-200"
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
          
          {/* Navigation Buttons with Enhanced Design */}
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
          
          {/* Enhanced Photo Display */}
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
        
        {/* Enhanced Navigation Bar */}
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
  const [retryCount, setRetryCount] = useState(0);
  const [retryTimeoutId, setRetryTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  const MAX_RETRIES = 5;
  const BASE_RETRY_DELAY = 2000; // Start with 2 seconds

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
      
      // Clear any existing retry timeout
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        setRetryTimeoutId(null);
      }
      
      const token = getToken();
      if (!token || !isAuthenticated()) {
        throw new Error('No valid authentication token available');
      }
      
      const response = await fetch(`/api/pod-photos?trackingToken=${encodeURIComponent(trackingLink)}&priority=high`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        console.error('Authentication failed - redirecting to login');
        logout();
        return;
      }
      
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
      console.error('Error loading photos:', err);
      setError('Unable to load photos from tracking system');
      setPhotos([]);
      setRetryCount(0); // Reset retry count on error
    } finally {
      setLoading(false);
    }
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
    };
  }, [retryTimeoutId]);

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
    <div className="p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 min-h-[70vh]">
      {/* Enhanced Header with Stats */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              POD Photos - {consignmentNo}
            </h2>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium">{photos.length} photos</span>
              </div>
              <div className="text-xs opacity-75">
                Use the tracking system to view and assess photo quality for POD scoring.
              </div>
            </div>
          </div>
          <Button 
            onClick={() => window.open(trackingLink, '_blank')} 
            variant="outline"
            size="sm"
            className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <ExternalLink className="h-4 w-4" />
            View Full Tracking Page
          </Button>
        </div>
      </div>

      {/* Modern Photo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-[60vh] overflow-y-auto pr-2">
        {photos.map((photoUrl, index) => (
          <div 
            key={index}
            className="group relative cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
            onClick={() => {
              setSelectedPhotoIndex(index);
              setPhotoModalOpen(true);
            }}
            data-testid={`photo-${index}`}
          >
            {/* Enhanced Photo Card */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md group-hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
              {/* Photo Container */}
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-700">
                <ProgressiveImage
                  src={photoUrl}
                  alt={`POD Photo ${index + 1} for ${consignmentNo}`}
                  className="w-full h-full"
                  index={index}
                />
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/20 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Eye className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
                
                {/* Photo Number Badge */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-sm font-medium px-3 py-1 rounded-full">
                  {index + 1}
                </div>
                
                {/* Quick Actions */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex gap-1">
                    <button className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full p-2 transition-colors duration-200">
                      <Download className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Enhanced Footer */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      Photo {index + 1}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Click to view full size
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="High Quality" />
                  </div>
                </div>
              </div>
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
  const [regionalComparisonMode, setRegionalComparisonMode] = useState(false);

  // Regional stats calculation
  const calculateRegionalStats = (consignments: Consignment[]) => {
    const regions = ['NSW', 'QLD', 'WA', 'VIC'];
    const regionalData = regions.map(region => {
      // Filter consignments for this region based on warehouse company name
      const regionConsignments = consignments.filter(c => 
        c.warehouseCompanyName?.toUpperCase().includes(region)
      );
      
      const totalDeliveries = regionConsignments.length;
      const signaturesReceived = regionConsignments.filter(c => c.deliverySignatureName).length;
      const signatureRate = totalDeliveries > 0 ? signaturesReceived / totalDeliveries : 0;
      
      // Get unique drivers in this region
      const uniqueDrivers = new Set(
        regionConsignments
          .map(c => c.driverName)
          .filter(Boolean)
      ).size;
      
      return {
        region: `Chill ${region}`,
        totalDeliveries,
        signaturesReceived,
        signatureRate,
        uniqueDrivers,
        avgDeliveriesPerDriver: uniqueDrivers > 0 ? totalDeliveries / uniqueDrivers : 0
      };
    });
    
    return regionalData.filter(r => r.totalDeliveries > 0); // Only show regions with data
  };
  const [selectedTempZone, setSelectedTempZone] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<PODAnalysis | null>(null);
  const [photoAnalysisLoading, setPhotoAnalysisLoading] = useState<number | null>(null);
  const [photoAnalysisResults, setPhotoAnalysisResults] = useState<Map<number, any>>(new Map());
  
  // Signature modal state
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [selectedSignatures, setSelectedSignatures] = useState<string[]>([]);
  const [selectedSignatureConsignment, setSelectedSignatureConsignment] = useState<string>("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Summary state
  const [showSummary, setShowSummary] = useState(false);
  
  // Driver comparison state  
  const [timeWindowWeeks, setTimeWindowWeeks] = useState(4);
  
  // Track loaded photos for instant modal opening
  const [loadedPhotos, setLoadedPhotos] = useState<Map<number, string[]>>(new Map());
  
  const handlePhotoLoad = useCallback((consignmentId: number, photos: string[]) => {
    setLoadedPhotos(prev => new Map(prev).set(consignmentId, photos));
  }, []);

  // Handle signature loading for caching
  const handleSignatureLoad = useCallback((consignmentId: number, signatures: string[]) => {
    // Store signature data for future use
    signaturePhotoState.set(consignmentId, signatures);
  }, []);

  // Handle signature click to open modal
  const handleSignatureClick = useCallback((signatures: string[], consignmentNo: string) => {
    setSelectedSignatures(signatures);
    setSelectedSignatureConsignment(consignmentNo);
    setSignatureModalOpen(true);
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

  // Helper function to check if consignment is an internal transfer
  const isInternalTransfer = (consignment: Consignment): boolean => {
    // First check if temperature zone indicates internal transfer
    const tempZone = getTemperatureZone(consignment);
    if (tempZone === 'Internal Transfer') {
      return true;
    }
    
    // Also check for depot transfer patterns as fallback
    const shipFrom = (consignment as any).shipFromMasterDataCode;
    const shipTo = (consignment as any).shipToMasterDataCode;
    
    if (!shipFrom || !shipTo) return false;
    
    // Depot transfer patterns (same as in axylog.ts)
    const depotTransferPatterns = [
      { from: 'WA_8', to: 'WA_8D' },
      { from: 'WA_8D', to: 'WA_8' },
      { from: 'NSW_5', to: 'NSW_5D' },
      { from: 'NSW_5D', to: 'NSW_5' },
      { from: 'VIC_29963', to: 'VIC_29963D' },
      { from: 'VIC_29963D', to: 'VIC_29963' },
      { from: 'QLD_829', to: 'QLD_829D' },
      { from: 'QLD_829D', to: 'QLD_829' }
    ];
    
    return depotTransferPatterns.some(pattern => 
      pattern.from === shipFrom && pattern.to === shipTo
    );
  };

  // Helper function to check if consignment is a return
  const isReturn = (consignment: Consignment): boolean => {
    const orderType = consignment.type?.toLowerCase();
    const shipToCompany = (consignment as any).shipToCompanyName?.toLowerCase();
    const shipFromCompany = (consignment as any).shipFromCompanyName?.toLowerCase();
    const warehouseCompany = consignment.warehouseCompanyName?.toLowerCase();
    const receiverCompany = (consignment as any).receiverCompanyName?.toLowerCase();
    
    // Check for return indicators in the type field
    const hasReturnType = !!(orderType && (
      orderType.includes('return') ||
      orderType.includes('rts') ||  // Return to sender
      orderType.includes('reverse') ||
      orderType.includes('pickup') ||
      orderType.includes('collect')
    ));
    
    // Check if shipTo or receiver is the same as warehouse (indicating return to depot)
    const isReturnToDepot = !!(
      (shipToCompany && warehouseCompany && shipToCompany.includes(warehouseCompany)) ||
      (receiverCompany && warehouseCompany && receiverCompany.includes(warehouseCompany)) ||
      (shipToCompany && shipFromCompany && shipToCompany === shipFromCompany)
    );
    
    return hasReturnType || isReturnToDepot;
  };

  // Filter for delivered consignments, excluding returns and internal transfers
  const deliveredConsignments = (allConsignments as Consignment[]).filter((consignment: Consignment) => {
    const status = getStatusDisplay(consignment);
    const isDelivered = status === 'Delivered';
    const isInternalTx = isInternalTransfer(consignment);
    const isReturnOrder = isReturn(consignment);
    
    
    // Only include delivered consignments that are NOT returns or internal transfers
    return isDelivered && !isInternalTx && !isReturnOrder;
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
  
  // Create filtered consignments based on all filters
  const filteredConsignments = (allConsignments as Consignment[]).filter((consignment: Consignment) => {
    // Text search filter
    const matchesSearch = !searchTerm || 
      Object.values(consignment).some(value => 
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    
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
    const matchesTempZone = selectedTempZone === "all" || 
      getTemperatureZone(consignment)?.toLowerCase() === selectedTempZone.toLowerCase();
    
    // Status filter
    const matchesStatus = selectedFilter === "all" || 
      (() => {
        const metrics = calculatePODMetrics(consignment);
        if (selectedFilter === "compliant") {
          return metrics.qualityScore >= 60;
        } else if (selectedFilter === "non-compliant") {
          return metrics.qualityScore < 60;
        }
        return true;
      })();
    
    // Date range filter
    const matchesDateRange = (() => {
      if (!fromDate && !toDate) return true;
      
      const consignmentDate = consignment.delivery_OutcomeDateTime;
      if (!consignmentDate) return false;
      
      const utcDate = new Date(consignmentDate);
      const aestDate = new Date(utcDate.getTime() + (10 * 60 * 60 * 1000));
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
    
    return matchesSearch && matchesWarehouse && matchesShipper && matchesDriver && matchesTempZone && matchesStatus && matchesDateRange;
  });
  
  // For regional comparison, get delivered consignments with all filters except warehouse
  const deliveredConsignmentsForRegional = regionalComparisonMode 
    ? (allConsignments as Consignment[]).filter((consignment: Consignment) => {
        const status = getStatusDisplay(consignment);
        const isDelivered = status === 'Delivered';
        const isInternalTx = isInternalTransfer(consignment);
        const isReturnOrder = isReturn(consignment);
        
        if (!isDelivered || isInternalTx || isReturnOrder) return false;
        
        // Apply all filters except warehouse filter
        const matchesSearch = !searchTerm || 
          Object.values(consignment).some(value => 
            value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
          );
        
        const matchesTempZone = selectedTempZone === "all" || 
          getTemperatureZone(consignment)?.toLowerCase() === selectedTempZone.toLowerCase();
        
        const matchesShipper = selectedShipper === "all" || 
          (consignment as any).shipperCompanyName === selectedShipper;
        
        const matchesDriver = selectedDriver === "all" || 
          consignment.driverName === selectedDriver;
        
        const matchesStatus = selectedFilter === "all" || 
          (() => {
            const metrics = calculatePODMetrics(consignment);
            if (selectedFilter === "compliant") {
              return metrics.qualityScore >= 60;
            } else if (selectedFilter === "non-compliant") {
              return metrics.qualityScore < 60;
            }
            return true;
          })();
        
        const matchesDateRange = (() => {
          if (!fromDate && !toDate) return true;
          
          const consignmentDate = consignment.delivery_OutcomeDateTime;
          if (!consignmentDate) return false;
          
          const utcDate = new Date(consignmentDate);
          const aestDate = new Date(utcDate.getTime() + (10 * 60 * 60 * 1000));
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
        
        return matchesSearch && matchesTempZone && matchesShipper && matchesDriver && matchesStatus && matchesDateRange;
      })
    : filteredConsignments.filter(consignment => {
        const status = getStatusDisplay(consignment);
        return status === 'Delivered';
      });

  // Helper function to parse temperature band from label strings like "-18C to -20C" or "0 to 5 C"
  const parseBandFromLabel = (label: string): { min: number; max: number } | null => {
    if (!label) return null;
    
    // Match patterns like "-18C to -20C", "0 to 5 C", "2C to 8C", etc.
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
        // Return with min/max regardless of order in text
        return {
          min: Math.min(val1, val2),
          max: Math.max(val1, val2)
        };
      }
    }
    
    return null;
  };

  // Calculate required photo count based on cartons and pallets
  const getRequiredPhotoCount = (consignment: Consignment): { min: number; max: number; description: string } => {
    const pallets = Number(consignment.qty2) || 0;
    const cartons = Number(consignment.qty1) || 0;
    
    // If both pallets and cartons exist, use pallet logic only
    if (pallets > 0 && cartons > 0) {
      if (pallets === 1) {
        return { min: 2, max: 2, description: '2 photos required for 1 pallet' };
      } else if (pallets >= 2 && pallets <= 3) {
        return { min: 3, max: 3, description: `3 photos minimum for ${pallets} pallets` };
      } else if (pallets > 3) {
        return { min: 4, max: 4, description: `4 photos minimum for ${pallets} pallets` };
      }
    }
    
    // If only pallets exist
    if (pallets > 0) {
      if (pallets === 1) {
        return { min: 2, max: 2, description: '2 photos required for 1 pallet' };
      } else if (pallets >= 2 && pallets <= 3) {
        return { min: 3, max: 3, description: `3 photos minimum for ${pallets} pallets` };
      } else if (pallets > 3) {
        return { min: 4, max: 4, description: `4 photos minimum for ${pallets} pallets` };
      }
    }
    
    // If only cartons exist
    if (cartons > 0) {
      if (cartons >= 1 && cartons <= 10) {
        return { min: 1, max: 2, description: `1-2 photos for ${cartons} cartons (1 if label visible)` };
      } else if (cartons > 10) {
        return { min: 3, max: 3, description: `3 photos minimum for ${cartons} cartons (must include label)` };
      }
    }
    
    // Default fallback if no quantity information
    return { min: 3, max: 3, description: '3 photos minimum (default)' };
  };

  // Gate checks (pass/fail before scoring)
  const passesGates = (consignment: Consignment): { ok: boolean; missing: string[] } => {
    const missing: string[] = [];
    
    // Signature present
    if (!consignment.deliverySignatureName) {
      missing.push('Signature present');
    }
    
    // Receiver name present (first name, last name or initial)
    const receiverName = consignment.deliverySignatureName?.trim();
    if (!receiverName || receiverName.length < 2) {
      missing.push('Receiver name present (first name)');
    }
    
    // Temperature compliance using existing logic
    const isTemperatureCompliant = checkTemperatureCompliance(consignment);
    if (!isTemperatureCompliant) {
      missing.push('Temperature compliance requirement');
    }
    
    // Photos requirement: dynamic based on cartons and pallets
    const photoCount = countPhotos(consignment);
    const photoRequirement = getRequiredPhotoCount(consignment);
    if (photoCount < photoRequirement.min) {
      missing.push(`Photos requirement (${photoRequirement.description})`);
    }
    
    // QTY provided (optional if available - don't gate on it if not in data)
    // Skip this check for now as it's optional
    
    return {
      ok: missing.length === 0,
      missing
    };
  };

  // Helper function to evaluate individual component compliance
  const evaluateComponentCompliance = (consignment: Consignment, photoCount: number, hasSignature: boolean, hasReceiverName: boolean) => {
    const temperatureCompliant = checkTemperatureCompliance(consignment);
    const photoRequirement = getRequiredPhotoCount(consignment);
    
    return {
      photos: {
        compliant: photoCount >= photoRequirement.min,
        reason: photoCount >= photoRequirement.min ? 
          `${photoCount} photos provided (${photoRequirement.description})` : 
          `${photoCount} out of ${photoRequirement.min} minimum photos`
      },
      signature: {
        compliant: hasSignature,
        reason: hasSignature ? 'Signature provided' : 'No signature provided'
      },
      receiverName: {
        compliant: hasReceiverName,
        reason: hasReceiverName ? 'Receiver name provided' : 'No receiver name provided'
      },
      temperature: {
        compliant: temperatureCompliant,
        reason: temperatureCompliant ? 'Temperature compliant' : 'Temperature non-compliant'
      }
    };
  };

  // Analyze POD quality for each consignment using new gated + bucketed system
  const analyzePOD = (consignment: Consignment): PODAnalysis => {
    const photoCount = countPhotos(consignment);
    const hasSignature = Boolean(consignment.deliverySignatureName);
    const hasReceiverName = Boolean(consignment.deliverySignatureName && consignment.deliverySignatureName.trim().length > 0);
    const hasTrackingLink = Boolean(consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink);
    const deliveryTime = consignment.delivery_OutcomeDateTime;
    const temperatureCompliant = checkTemperatureCompliance(consignment);
    
    // Evaluate individual component compliance
    const componentStatus = evaluateComponentCompliance(consignment, photoCount, hasSignature, hasReceiverName);
    
    // Check gates first
    const gateCheck = passesGates(consignment);
    
    // If gates fail, show individual component status but mark overall as non-compliant
    if (!gateCheck.ok) {
      const breakdown: ScoreBreakdown = {
        photos: { 
          points: 0, 
          reason: `${componentStatus.photos.reason} (Gate: ${componentStatus.photos.compliant ? 'PASS' : 'FAIL'})`, 
          status: componentStatus.photos.compliant ? 'pass' : 'fail' 
        },
        signature: { 
          points: 0, 
          reason: `${componentStatus.signature.reason} (Gate: ${componentStatus.signature.compliant ? 'PASS' : 'FAIL'})`, 
          status: componentStatus.signature.compliant ? 'pass' : 'fail' 
        },
        receiverName: { 
          points: 0, 
          reason: `${componentStatus.receiverName.reason} (Gate: ${componentStatus.receiverName.compliant ? 'PASS' : 'FAIL'})`, 
          status: componentStatus.receiverName.compliant ? 'pass' : 'fail' 
        },
        temperature: { 
          points: 0, 
          reason: `${componentStatus.temperature.reason} (Gate: ${componentStatus.temperature.compliant ? 'PASS' : 'FAIL'})`, 
          status: componentStatus.temperature.compliant ? 'pass' : 'fail' 
        },
        clearPhotos: { points: 0, reason: 'Photo clarity/OCR analysis pending', status: 'pending' },
        total: 0
      };
      
      const metrics: PODMetrics = {
        photoCount,
        hasSignature,
        temperatureCompliant,
        hasTrackingLink,
        deliveryTime,
        qualityScore: 0,
        hasReceiverName,
        scoreBreakdown: breakdown
      };

      return { consignment, metrics };
    }
    
    // Gates passed - proceed with bucketed scoring (total 100)
    let score = 0;
    const breakdown: ScoreBreakdown = {
      photos: { points: 0, reason: '', status: 'fail' },
      signature: { points: 0, reason: '', status: 'fail' },
      receiverName: { points: 0, reason: '', status: 'fail' },
      temperature: { points: 0, reason: '', status: 'fail' },
      clearPhotos: { points: 0, reason: 'Photo clarity/OCR not yet implemented', status: 'pending' },
      total: 0
    };
    
    // 1. Photos (40 points total) - dynamic based on cartons/pallets
    let photoPoints = 0;
    const photoRequirement = getRequiredPhotoCount(consignment);
    if (photoCount >= photoRequirement.min) {
      photoPoints += 35; // Mandatory set present
      // Extra useful photos bonus: +1 each up to +5 (cap 40 total)
      const extraPhotos = Math.min(5, photoCount - photoRequirement.min);
      photoPoints += extraPhotos;
      breakdown.photos = { 
        points: photoPoints, 
        reason: `Required photos (${photoCount} ≥ ${photoRequirement.min}) +35pts, ${extraPhotos} extra photos +${extraPhotos}pts`, 
        status: 'pass' 
      };
    } else {
      breakdown.photos = { 
        points: 0, 
        reason: `${photoCount} out of ${photoRequirement.min} minimum photos (${photoRequirement.description})`, 
        status: 'fail' 
      };
    }
    score += photoPoints;
    
    // 2. Signature (20 points total)
    let signaturePoints = 0;
    if (hasSignature) {
      signaturePoints = 20; // Signature present → +20
      breakdown.signature = { 
        points: signaturePoints, 
        reason: 'Signature provided', 
        status: 'pass' 
      };
    } else {
      breakdown.signature = { 
        points: 0, 
        reason: 'No signature provided', 
        status: 'fail' 
      };
    }
    score += signaturePoints;
    
    // 3. Receiver Name (15 points total) - check if receiver name is provided in signature
    let receiverNamePoints = 0;
    if (hasReceiverName) {
      receiverNamePoints = 15; // Full points for having receiver name
      breakdown.receiverName = { 
        points: receiverNamePoints, 
        reason: 'Receiver name provided', 
        status: 'pass' 
      };
    } else {
      breakdown.receiverName = { 
        points: 0, 
        reason: 'No receiver name provided', 
        status: 'fail' 
      };
    }
    score += receiverNamePoints;
    
    // 4. Temperature compliance (25 points total) - using existing temperature logic
    let tempPoints = 0;
    const isTemperatureCompliant = checkTemperatureCompliance(consignment);
    const { expected, actual } = formatTemperatureDisplay(consignment);
    
    // Award full 25 points if temperature is compliant using existing logic
    if (isTemperatureCompliant) {
      tempPoints = 25;
      breakdown.temperature = { 
        points: tempPoints, 
        reason: `Temperature compliant: Expected ${expected}, Actual ${actual}`, 
        status: 'pass' 
      };
    } else {
      breakdown.temperature = { 
        points: 0, 
        reason: `Temperature non-compliant: Expected ${expected}, Actual ${actual}`, 
        status: 'fail' 
      };
    }
    score += tempPoints;
    
    // 5. Photo clarity/OCR - not counted in scoring for now
    breakdown.clearPhotos = { 
      points: 0, 
      reason: 'Photo analysis not counted in scoring', 
      status: 'pending' 
    };
    
    // Cap total at 100
    score = Math.min(100, score);
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
          case "gold":
            return metrics.qualityScore >= 90;
          case "silver":
            return metrics.qualityScore >= 75 && metrics.qualityScore < 90;
          case "bronze":
            return metrics.qualityScore >= 60 && metrics.qualityScore < 75;
          case "non-compliant":
            return metrics.qualityScore === 0;
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

  // Additional summary analytics
  const goldCount = allFilteredAnalyses.filter(a => a.metrics.qualityScore >= 90).length;
  const silverCount = allFilteredAnalyses.filter(a => a.metrics.qualityScore >= 75 && a.metrics.qualityScore < 90).length;
  const bronzeCount = allFilteredAnalyses.filter(a => a.metrics.qualityScore >= 60 && a.metrics.qualityScore < 75).length;
  const nonCompliantCount = allFilteredAnalyses.filter(a => a.metrics.qualityScore === 0).length;
  
  const missingPhotosCount = allFilteredAnalyses.filter(a => a.metrics.photoCount === 0).length;
  const onePhotoCount = allFilteredAnalyses.filter(a => a.metrics.photoCount === 1).length;
  const twoPhotosCount = allFilteredAnalyses.filter(a => a.metrics.photoCount === 2).length;
  const threeOrMorePhotosCount = allFilteredAnalyses.filter(a => a.metrics.photoCount >= 3).length;
  const missingSignatureCount = allFilteredAnalyses.filter(a => !a.metrics.hasSignature).length;
  const tempIssuesCount = allFilteredAnalyses.filter(a => !a.metrics.temperatureCompliant).length;
  const hasReceiverNameCount = allFilteredAnalyses.filter(a => a.metrics.hasReceiverName).length;
  
  // Quality distribution
  const qualityDistribution = {
    gold: totalDeliveries > 0 ? ((goldCount / totalDeliveries) * 100) : 0,
    silver: totalDeliveries > 0 ? ((silverCount / totalDeliveries) * 100) : 0,
    bronze: totalDeliveries > 0 ? ((bronzeCount / totalDeliveries) * 100) : 0,
    nonCompliant: totalDeliveries > 0 ? ((nonCompliantCount / totalDeliveries) * 100) : 0
  };

  // Calculate driver performance
  const driverPerformance = (() => {
    const driverStats = new Map<string, { 
      totalDeliveries: number; 
      totalScore: number; 
      goldCount: number;
      nonCompliantCount: number;
    }>();

    allFilteredAnalyses.forEach(analysis => {
      const driverName = analysis.consignment.driverName;
      if (!driverName) return;

      if (!driverStats.has(driverName)) {
        driverStats.set(driverName, { 
          totalDeliveries: 0, 
          totalScore: 0, 
          goldCount: 0,
          nonCompliantCount: 0
        });
      }

      const stats = driverStats.get(driverName)!;
      stats.totalDeliveries++;
      stats.totalScore += analysis.metrics.qualityScore;
      
      if (analysis.metrics.qualityScore >= 90) {
        stats.goldCount++;
      } else if (analysis.metrics.qualityScore === 0) {
        stats.nonCompliantCount++;
      }
    });

    // Convert to array and calculate averages
    const drivers = Array.from(driverStats.entries()).map(([name, stats]) => ({
      name,
      totalDeliveries: stats.totalDeliveries,
      avgScore: stats.totalScore / stats.totalDeliveries,
      goldRate: (stats.goldCount / stats.totalDeliveries) * 100,
      nonCompliantRate: (stats.nonCompliantCount / stats.totalDeliveries) * 100
    }));

    // Filter drivers with at least 3 deliveries for meaningful statistics
    const qualifiedDrivers = drivers.filter(d => d.totalDeliveries >= 3);
    
    // Sort by average score
    qualifiedDrivers.sort((a, b) => b.avgScore - a.avgScore);

    return {
      topPerformers: qualifiedDrivers.slice(0, 3),
      bottomPerformers: qualifiedDrivers.slice(-3).reverse(),
      totalQualifiedDrivers: qualifiedDrivers.length
    };
  })();

  // Generate summary analysis text
  const generateSummaryAnalysis = () => {
    if (totalDeliveries === 0) {
      return "No deliveries found matching the selected filters.";
    }

    const analysisPoints = [];

    // Overall performance
    if (avgQualityScore >= 85) {
      analysisPoints.push("🎯 **Excellent overall performance** - High quality POD standards being maintained.");
    } else if (avgQualityScore >= 70) {
      analysisPoints.push("✅ **Good performance** - POD quality is above average with room for improvement.");
    } else if (avgQualityScore >= 50) {
      analysisPoints.push("⚠️ **Moderate performance** - Several areas need attention to improve POD quality.");
    } else {
      analysisPoints.push("🚨 **Performance issues** - Significant improvements needed in POD quality standards.");
    }

    // Quality distribution insights
    if (qualityDistribution.gold >= 40) {
      analysisPoints.push(`🏆 **Strong Gold tier performance** - ${goldCount} deliveries (${qualityDistribution.gold.toFixed(1)}%) achieving Gold standard.`);
    } else if (qualityDistribution.nonCompliant >= 30) {
      analysisPoints.push(`📋 **High non-compliance rate** - ${nonCompliantCount} deliveries (${qualityDistribution.nonCompliant.toFixed(1)}%) failing to meet basic requirements.`);
    }

    // Specific issue identification
    const issues = [];
    if (missingPhotosCount > 0) {
      issues.push(`${missingPhotosCount} deliveries missing photos`);
    }
    if (missingSignatureCount > 0) {
      issues.push(`${missingSignatureCount} deliveries missing signatures`);
    }
    if (tempIssuesCount > 0) {
      issues.push(`${tempIssuesCount} deliveries with temperature compliance issues`);
    }

    if (issues.length > 0) {
      analysisPoints.push(`🔍 **Key issues identified**: ${issues.join(", ")}.`);
    }

    // Photo performance
    if (avgPhotoCount >= 4) {
      analysisPoints.push(`📸 **Strong photo documentation** - Average of ${avgPhotoCount.toFixed(1)} photos per delivery.`);
    } else if (avgPhotoCount < 3) {
      analysisPoints.push(`📸 **Photo documentation needs improvement** - Average of only ${avgPhotoCount.toFixed(1)} photos per delivery.`);
    }

    // Signature performance
    if (signatureRate >= 90) {
      analysisPoints.push(`✍️ **Excellent signature capture** - ${signatureRate.toFixed(1)}% of deliveries have signatures.`);
    } else if (signatureRate < 80) {
      analysisPoints.push(`✍️ **Signature capture needs attention** - Only ${signatureRate.toFixed(1)}% of deliveries have signatures.`);
    }

    // Temperature compliance
    if (tempComplianceRate >= 95) {
      analysisPoints.push(`🌡️ **Excellent temperature compliance** - ${tempComplianceRate.toFixed(1)}% compliance rate.`);
    } else if (tempComplianceRate < 90) {
      analysisPoints.push(`🌡️ **Temperature compliance issues** - Only ${tempComplianceRate.toFixed(1)}% compliance rate.`);
    }

    // Receiver name performance
    const receiverNameRate = totalDeliveries > 0 ? ((hasReceiverNameCount / totalDeliveries) * 100) : 0;
    if (receiverNameRate < 85) {
      analysisPoints.push(`👤 **Receiver name capture needs improvement** - Only ${receiverNameRate.toFixed(1)}% have receiver names recorded.`);
    }

    // Driver performance insights
    if (driverPerformance.totalQualifiedDrivers > 0) {
      const topDriver = driverPerformance.topPerformers[0];
      const bottomDriver = driverPerformance.bottomPerformers[0];
      
      if (topDriver && bottomDriver && topDriver.avgScore - bottomDriver.avgScore > 20) {
        analysisPoints.push(`🚛 **Significant driver performance gap** - Top performer (${topDriver.name}: ${topDriver.avgScore.toFixed(1)}) vs bottom performer (${bottomDriver.name}: ${bottomDriver.avgScore.toFixed(1)}).`);
      } else if (topDriver) {
        analysisPoints.push(`🚛 **Driver performance** - ${driverPerformance.totalQualifiedDrivers} drivers analyzed, top performer: ${topDriver.name} (${topDriver.avgScore.toFixed(1)} avg score).`);
      }
    }

    return analysisPoints.join("\n\n");
  };

  const getQualityBadge = (score: number) => {
    if (score === 0) return <Badge className="bg-gray-100 text-gray-800">Non-compliant</Badge>;
    if (score >= 90) return <Badge className="bg-green-100 text-green-800">Gold</Badge>;
    if (score >= 75) return <Badge className="bg-blue-100 text-blue-800">Silver</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Bronze</Badge>;
    return <Badge className="bg-red-100 text-red-800">Non-compliant</Badge>;
  };

  // Generate non-compliance reason text based on scoreBreakdown
  const getNonComplianceReasons = (scoreBreakdown: ScoreBreakdown): string[] => {
    const reasons: string[] = [];
    
    // Check photos
    if (scoreBreakdown.photos.status === 'fail') {
      if (scoreBreakdown.photos.reason.includes('No photos')) {
        reasons.push('No photos provided');
      } else if (scoreBreakdown.photos.reason.includes('minimum')) {
        // Extract number from reason like "Only 2 photos (minimum 3 required)"
        const match = scoreBreakdown.photos.reason.match(/Only (\d+) photos.*minimum (\d+)/);
        if (match) {
          reasons.push(`${match[1]} out of ${match[2]} minimum photos`);
        } else {
          reasons.push('Insufficient photos');
        }
      }
    }
    
    // Check signature
    if (scoreBreakdown.signature.status === 'fail') {
      if (scoreBreakdown.signature.reason.includes('No signature')) {
        reasons.push('No signature provided');
      } else {
        reasons.push('Missing signature');
      }
    }
    
    // Check receiver name
    if (scoreBreakdown.receiverName.status === 'fail') {
      if (scoreBreakdown.receiverName.reason.includes('No receiver name')) {
        reasons.push('No receiver name provided');
      } else {
        reasons.push('Missing receiver name');
      }
    }
    
    // Check temperature
    if (scoreBreakdown.temperature.status === 'fail') {
      if (scoreBreakdown.temperature.reason.includes('Temperature out of range')) {
        reasons.push('Temperature out of range');
      } else if (scoreBreakdown.temperature.reason.includes('No temperature data')) {
        reasons.push('No temperature data');
      } else {
        reasons.push('Temperature non-compliant');
      }
    }
    
    return reasons;
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

  // Fetch POD photos for a tracking token
  const fetchPODPhotos = async (trackingToken: string) => {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/pod-photos?trackingToken=${encodeURIComponent(trackingToken)}&priority=high`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load photos');
      
      const data = await response.json();
      return {
        success: true,
        photos: data.photos || [],
        signaturePhotos: data.signaturePhotos || []
      };
    } catch (error) {
      console.error('Error fetching POD photos:', error);
      return {
        success: false,
        photos: [],
        signaturePhotos: []
      };
    }
  };

  // Analyze photos for a specific consignment
  const analyzePhotosForConsignment = async (consignment: Consignment) => {
    setPhotoAnalysisLoading(consignment.id);
    
    try {
      // Fetch photos for this consignment
      const trackingToken = consignment.deliveryLiveTrackLink?.split('/').pop() || '';
      const podPhotos = await fetchPODPhotos(trackingToken);
      
      if (!podPhotos.success || podPhotos.photos.length === 0) {
        const result = {
          points: 0,
          reason: 'No photos available for analysis',
          status: 'fail'
        };
        setPhotoAnalysisResults(prev => new Map(prev.set(consignment.id, result)));
        return;
      }

      // Analyze up to 3 photos for performance
      const photosToAnalyze = podPhotos.photos.slice(0, 3);
      const response = await fetch('/api/analyze-photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ imageUrls: photosToAnalyze })
      });

      if (response.ok) {
        const analysisData = await response.json();
        const analyses = analysisData.results;

        // Calculate OCR points based on analysis
        const avgQualityScore = analyses.reduce((sum: number, a: any) => sum + a.overall.qualityScore, 0) / analyses.length;
        const ocrPoints = Math.round(avgQualityScore); // Convert 0-15 score directly

        const issues = analyses.flatMap((a: any) => a.overall.issues).slice(0, 3);
        const hasTemperature = analyses.some((a: any) => a.ocr.hasTemperatureDisplay);
        const hasLabel = analyses.some((a: any) => a.ocr.hasShippingLabel);

        const result = {
          points: ocrPoints,
          reason: `Photo analysis: Avg quality ${avgQualityScore.toFixed(1)}/15, ${hasTemperature ? 'temp display found' : 'no temp display'}, ${hasLabel ? 'label found' : 'no label'}, ${issues.length} issues`,
          status: ocrPoints >= 10 ? 'pass' : ocrPoints >= 5 ? 'partial' : 'fail'
        };
        
        setPhotoAnalysisResults(prev => new Map(prev.set(consignment.id, result)));
      } else {
        const result = {
          points: 0,
          reason: 'Photo analysis failed - API error',
          status: 'fail'
        };
        setPhotoAnalysisResults(prev => new Map(prev.set(consignment.id, result)));
      }
    } catch (error) {
      console.error('Photo analysis error:', error);
      const result = {
        points: 0,
        reason: 'Photo analysis failed - network error',
        status: 'fail'
      };
      setPhotoAnalysisResults(prev => new Map(prev.set(consignment.id, result)));
    } finally {
      setPhotoAnalysisLoading(null);
    }
  };

  // Handle sync from Axylog
  const handleSyncFromAxylog = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/axylog/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
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

        {/* Summary and Analytics Section */}
        <div className="flex justify-center gap-4 mb-6">
          <Button
            onClick={() => setShowSummary(!showSummary)}
            className="gradient-accent hover:opacity-90 text-white border-0 px-6 py-3 text-lg font-semibold shadow-lg"
            data-testid="button-get-summary"
          >
            <div className="flex items-center gap-2">
              {showSummary ? (
                <>
                  <EyeOff className="h-5 w-5" />
                  Hide Summary
                </>
              ) : (
                <>
                  <Eye className="h-5 w-5" />
                  Get Summary
                </>
              )}
            </div>
          </Button>
        </div>

        {/* Summary Display */}
        {showSummary && (
          <div className="gradient-card shadow-card rounded-xl p-8 mb-8 border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">POD Quality Analysis Summary</h3>
                <p className="text-gray-600">Based on {totalDeliveries} filtered deliveries</p>
              </div>
            </div>

            {/* Quality Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-800">{goldCount}</div>
                  <div className="text-sm text-green-600">Gold ({qualityDistribution.gold.toFixed(1)}%)</div>
                  <div className="text-xs text-gray-500 mt-1">≥90 points</div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-800">{silverCount}</div>
                  <div className="text-sm text-blue-600">Silver ({qualityDistribution.silver.toFixed(1)}%)</div>
                  <div className="text-xs text-gray-500 mt-1">75-89 points</div>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-800">{bronzeCount}</div>
                  <div className="text-sm text-yellow-600">Bronze ({qualityDistribution.bronze.toFixed(1)}%)</div>
                  <div className="text-xs text-gray-500 mt-1">60-74 points</div>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-800">{nonCompliantCount}</div>
                  <div className="text-sm text-red-600">Non-compliant ({qualityDistribution.nonCompliant.toFixed(1)}%)</div>
                  <div className="text-xs text-gray-500 mt-1">0 points</div>
                </div>
              </div>
            </div>

            {/* Analysis Text */}
            <div className="bg-white rounded-lg p-6 border border-gray-100">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Key Insights
              </h4>
              <div 
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                style={{ whiteSpace: 'pre-line' }}
                data-testid="text-summary-analysis"
              >
                {generateSummaryAnalysis()}
              </div>
            </div>

            {/* Photo Breakdown */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
              <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <Camera className="h-5 w-5 text-blue-600" />
                Photo Documentation Breakdown
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-800">{missingPhotosCount}</div>
                  <div className="text-sm text-red-600">0 Photos</div>
                  <div className="text-xs text-gray-500 mt-1">{totalDeliveries > 0 ? ((missingPhotosCount / totalDeliveries) * 100).toFixed(1) : 0}%</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-800">{onePhotoCount}</div>
                  <div className="text-sm text-orange-600">1 Photo</div>
                  <div className="text-xs text-gray-500 mt-1">{totalDeliveries > 0 ? ((onePhotoCount / totalDeliveries) * 100).toFixed(1) : 0}%</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-800">{twoPhotosCount}</div>
                  <div className="text-sm text-yellow-600">2 Photos</div>
                  <div className="text-xs text-gray-500 mt-1">{totalDeliveries > 0 ? ((twoPhotosCount / totalDeliveries) * 100).toFixed(1) : 0}%</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-800">{threeOrMorePhotosCount}</div>
                  <div className="text-sm text-green-600">3+ Photos</div>
                  <div className="text-xs text-gray-500 mt-1">{totalDeliveries > 0 ? ((threeOrMorePhotosCount / totalDeliveries) * 100).toFixed(1) : 0}%</div>
                </div>
              </div>
            </div>

            {/* Performance Comparison Toggle */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-gray-600" />
                  Performance Analysis
                </h4>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={!regionalComparisonMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRegionalComparisonMode(false)}
                      data-testid="button-driver-comparison"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Driver Comparison
                    </Button>
                    <Button
                      variant={regionalComparisonMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRegionalComparisonMode(true)}
                      data-testid="button-regional-comparison"
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Regional Comparison
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Driver Performance Comparison */}
            {!regionalComparisonMode && (() => {
              // Calculate driver statistics using the fair comparison system
              const cohortConfig: DriverCohortConfig = {
                ...DEFAULT_COHORT_CONFIG,
                timeWindowWeeks: timeWindowWeeks
              };
              
              const allDriverStats = calculateDriverStats(deliveredConsignments, cohortConfig);
              
              // Apply delivery count filtering based on time window
              // If time window >= 1 week (5 days): only drivers with 10+ deliveries  
              // If time window < 1 week (5 days): all drivers regardless of delivery count
              const minDeliveries = timeWindowWeeks >= 1 ? 10 : 0;
              const qualifiedDrivers = allDriverStats.filter(driver => driver.totalDeliveries >= minDeliveries);
              
              const driverSummary = getCohortSummary(qualifiedDrivers);
              
              if (qualifiedDrivers.length === 0) return null;
              
              return (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <h4 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                      Driver Performance Comparison
                    </h4>
                    
                    {/* Time Window Selector */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-purple-700">Time Window:</label>
                      <select
                        value={timeWindowWeeks}
                        onChange={(e) => setTimeWindowWeeks(Number(e.target.value))}
                        className="px-3 py-1 border border-purple-300 rounded-md text-sm focus:border-purple-500 focus:ring-purple-500/20 focus:outline-none"
                        data-testid="select-time-window"
                      >
                        <option value={1}>1 week</option>
                        <option value={2}>2 weeks</option>
                        <option value={4}>4 weeks</option>
                        <option value={8}>8 weeks</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Driver Summary */}
                  <div className="bg-white/60 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-purple-800">{driverSummary.totalDrivers}</div>
                        <div className="text-xs text-purple-600">Total Drivers</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-800">{driverSummary.averageDeliveries}</div>
                        <div className="text-xs text-purple-600">Avg Deliveries</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-800">{(driverSummary.averageValidPodRate * 100).toFixed(1)}%</div>
                        <div className="text-xs text-purple-600">Avg POD Rate</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-800">{(driverSummary.averageSignatureRate * 100).toFixed(1)}%</div>
                        <div className="text-xs text-purple-600">Avg Signature Rate</div>
                      </div>
                    </div>
                    {timeWindowWeeks >= 1 && (
                      <div className="mt-2 text-xs text-purple-600 text-center">
                        Showing drivers with {minDeliveries}+ deliveries
                      </div>
                    )}
                  </div>
                  
                  {qualifiedDrivers.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top Performers */}
                      <div>
                        <h5 className="text-md font-semibold text-green-800 mb-3 flex items-center gap-2">
                          🏆 Top Performers
                        </h5>
                        <div className="space-y-2">
                          {qualifiedDrivers.slice(0, 5).map((driver, index) => (
                            <div 
                              key={`${driver.driverId}-${driver.driverName}`}
                              className="bg-green-50 border border-green-200 rounded-lg p-3 cursor-pointer hover:bg-green-100 hover:border-green-300 transition-colors duration-200"
                              onClick={() => {
                                setSelectedDriver(driver.driverName);
                                setShowSummary(false);
                                setCurrentPage(1);
                              }}
                              data-testid={`driver-top-${driver.driverName.replace(/\s+/g, '-')}`}
                            >
                              <div className="flex justify-between items-center">
                                <div className="font-medium text-green-900 flex items-center gap-2">
                                  #{index + 1} {driver.driverName}
                                  <Badge variant="outline" className="text-xs bg-green-100 border-green-300">
                                    {driver.totalDeliveries}
                                  </Badge>
                                  <ExternalLink className="h-3 w-3 text-green-600" />
                                </div>
                                <div className="text-green-700 font-bold">
                                  {(driver.compositeScore * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div className="text-xs text-green-600 mt-1 flex items-center gap-4">
                                <span>POD: {(driver.validPodLowerBound * 100).toFixed(1)}%</span>
                                <span>Sig: {(driver.signatureLowerBound * 100).toFixed(1)}%</span>
                                <span>Temp: {(driver.temperatureLowerBound * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Performers */}
                      <div>
                        <h5 className="text-md font-semibold text-red-800 mb-3">📉 Needs Improvement</h5>
                        <div className="space-y-2">
                          {qualifiedDrivers.slice(-5).reverse().map((driver, index) => (
                            <div 
                              key={`${driver.driverId}-${driver.driverName}`}
                              className="bg-red-50 border border-red-200 rounded-lg p-3 cursor-pointer hover:bg-red-100 hover:border-red-300 transition-colors duration-200"
                              onClick={() => {
                                setSelectedDriver(driver.driverName);
                                setShowSummary(false);
                                setCurrentPage(1);
                              }}
                              data-testid={`driver-bottom-${driver.driverName.replace(/\s+/g, '-')}`}
                            >
                              <div className="flex justify-between items-center">
                                <div className="font-medium text-red-900 flex items-center gap-2">
                                  #{qualifiedDrivers.length - index} {driver.driverName}
                                  <Badge variant="outline" className="text-xs bg-red-100 border-red-300">
                                    {driver.totalDeliveries}
                                  </Badge>
                                  <ExternalLink className="h-3 w-3 text-red-600" />
                                </div>
                                <div className="text-red-700 font-bold">
                                  {(driver.compositeScore * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div className="text-xs text-red-600 mt-1 flex items-center gap-4">
                                <span>POD: {(driver.validPodLowerBound * 100).toFixed(1)}%</span>
                                <span>Sig: {(driver.signatureLowerBound * 100).toFixed(1)}%</span>
                                <span>Temp: {(driver.temperatureLowerBound * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No drivers found for the selected time window.
                    </div>
                  )}
                  
                  {/* Statistical Notice */}
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-xs text-blue-700">
                      <Info className="h-4 w-4 inline mr-1" />
                      Rankings use Wilson 95% confidence intervals for statistical fairness. 
                      "N=" shows sample size. Lower bounds prevent small samples from appearing artificially high.
                      {timeWindowWeeks >= 1 && ` Showing drivers with ${minDeliveries}+ deliveries to ensure fair comparisons.`}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Regional Performance Comparison */}
            {regionalComparisonMode && (() => {
              const regionalStats = calculateRegionalStats(deliveredConsignmentsForRegional);
              
              if (regionalStats.length === 0) {
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                    <div className="text-center py-8 text-blue-600">
                      No regional data available for the selected time period.
                    </div>
                  </div>
                );
              }
              
              const totalRegionalDeliveries = regionalStats.reduce((sum, r) => sum + r.totalDeliveries, 0);
              const avgSignatureRate = regionalStats.reduce((sum, r) => sum + r.signatureRate, 0) / regionalStats.length;
              
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <h4 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-600" />
                      Regional Performance Comparison
                    </h4>
                    
                    {/* Time Window Selector */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-blue-700">Time Window:</label>
                      <select
                        value={timeWindowWeeks}
                        onChange={(e) => setTimeWindowWeeks(Number(e.target.value))}
                        className="px-3 py-1 border border-blue-300 rounded-md text-sm focus:border-blue-500 focus:ring-blue-500/20 focus:outline-none"
                        data-testid="select-regional-time-window"
                      >
                        <option value={1}>1 week</option>
                        <option value={2}>2 weeks</option>
                        <option value={4}>4 weeks</option>
                        <option value={8}>8 weeks</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Regional Summary */}
                  <div className="bg-white/60 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-blue-800">{regionalStats.length}</div>
                        <div className="text-xs text-blue-600">Active Regions</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-800">{totalRegionalDeliveries}</div>
                        <div className="text-xs text-blue-600">Total Deliveries</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-800">{(avgSignatureRate * 100).toFixed(1)}%</div>
                        <div className="text-xs text-blue-600">Avg Signature Rate</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-blue-600 text-center">
                      Warehouse filter ignored in regional comparison
                    </div>
                  </div>
                  
                  {/* Regional Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {regionalStats.map((region, index) => (
                      <div 
                        key={region.region}
                        className={`bg-white rounded-lg p-4 border-2 ${
                          region.signatureRate >= 0.9 ? 'border-green-200 bg-green-50' :
                          region.signatureRate >= 0.8 ? 'border-blue-200 bg-blue-50' :
                          region.signatureRate >= 0.7 ? 'border-yellow-200 bg-yellow-50' :
                          'border-red-200 bg-red-50'
                        }`}
                        data-testid={`region-${region.region.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div className="text-center">
                          <h5 className="font-semibold text-gray-900 mb-2">{region.region}</h5>
                          
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Deliveries:</span>
                              <span className="font-medium">{region.totalDeliveries}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Drivers:</span>
                              <span className="font-medium">{region.uniqueDrivers}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Avg/Driver:</span>
                              <span className="font-medium">{region.avgDeliveriesPerDriver.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-gray-600">Signatures:</span>
                              <span className={`font-medium ${
                                region.signatureRate >= 0.9 ? 'text-green-600' :
                                region.signatureRate >= 0.8 ? 'text-blue-600' :
                                region.signatureRate >= 0.7 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {(region.signatureRate * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              region.signatureRate >= 0.9 ? 'bg-green-100 text-green-800' :
                              region.signatureRate >= 0.8 ? 'bg-blue-100 text-blue-800' :
                              region.signatureRate >= 0.7 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {region.signatureRate >= 0.9 ? 'Excellent' :
                               region.signatureRate >= 0.8 ? 'Good' :
                               region.signatureRate >= 0.7 ? 'Fair' : 'Needs Improvement'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Issue Breakdown */}
            {(missingPhotosCount > 0 || missingSignatureCount > 0 || tempIssuesCount > 0) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mt-6">
                <h4 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Action Items
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {missingPhotosCount > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-800">{missingPhotosCount}</div>
                      <div className="text-sm text-orange-600">Missing Photos</div>
                    </div>
                  )}
                  {missingSignatureCount > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-800">{missingSignatureCount}</div>
                      <div className="text-sm text-orange-600">Missing Signatures</div>
                    </div>
                  )}
                  {tempIssuesCount > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-800">{tempIssuesCount}</div>
                      <div className="text-sm text-orange-600">Temperature Issues</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
                variant={selectedFilter === "gold" ? "default" : "outline"}
                onClick={() => setSelectedFilter("gold")}
                size="sm"
                data-testid="button-filter-gold"
              >
                Gold (90-100)
              </Button>
              <Button
                variant={selectedFilter === "silver" ? "default" : "outline"}
                onClick={() => setSelectedFilter("silver")}
                size="sm"
                data-testid="button-filter-silver"
              >
                Silver (75-89)
              </Button>
              <Button
                variant={selectedFilter === "bronze" ? "default" : "outline"}
                onClick={() => setSelectedFilter("bronze")}
                size="sm"
                data-testid="button-filter-bronze"
              >
                Bronze (60-74)
              </Button>
              <Button
                variant={selectedFilter === "non-compliant" ? "default" : "outline"}
                onClick={() => setSelectedFilter("non-compliant")}
                size="sm"
                data-testid="button-filter-non-compliant"
              >
                Non-compliant (0)
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
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAnalysis(analysis);
                            setScoreBreakdownOpen(true);
                          }}
                          className={`${
                            metrics.qualityScore === 0 ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' :
                            metrics.qualityScore >= 90 ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                            metrics.qualityScore >= 75 ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                            metrics.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
                            'bg-red-100 text-red-800 hover:bg-red-200'
                          } border-0 font-medium cursor-pointer text-lg px-4 py-2`}
                          data-testid={`button-score-breakdown-${consignment.id}`}
                        >
                          <Info className="h-4 w-4 mr-2" />
                          {metrics.qualityScore === 0 ? "Non-compliant" :
                           metrics.qualityScore >= 90 ? "Gold" :
                           metrics.qualityScore >= 75 ? "Silver" :
                           metrics.qualityScore >= 60 ? "Bronze" : "Non-compliant"} {metrics.qualityScore}/100
                        </Button>
                        
                        {/* Non-compliance reasons sub-heading */}
                        {metrics.qualityScore === 0 && metrics.scoreBreakdown && (
                          <div className="text-right space-y-1 max-w-xs">
                            {getNonComplianceReasons(metrics.scoreBreakdown).map((reason, index) => (
                              <div key={index} className="text-xs text-gray-600 font-medium">
                                {reason}
                              </div>
                            ))}
                          </div>
                        )}
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
                        <SignatureThumbnail 
                          consignment={consignment}
                          onSignatureLoad={handleSignatureLoad}
                          loadImmediately={index < 10}
                          onSignatureClick={handleSignatureClick}
                        />
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>POD Quality Score Breakdown</DialogTitle>
              <DialogDescription>
                {selectedAnalysis && `Detailed scoring for ${selectedAnalysis.consignment.consignmentNo}`}
              </DialogDescription>
            </DialogHeader>
            
            {selectedAnalysis?.metrics.scoreBreakdown && (
              <div className="space-y-3">
                {/* Overall Score */}
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {selectedAnalysis.metrics.qualityScore}/100
                  </div>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    selectedAnalysis.metrics.qualityScore === 0 ? 'bg-gray-100 text-gray-800' :
                    selectedAnalysis.metrics.qualityScore >= 90 ? 'bg-green-100 text-green-800' :
                    selectedAnalysis.metrics.qualityScore >= 75 ? 'bg-blue-100 text-blue-800' :
                    selectedAnalysis.metrics.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {selectedAnalysis.metrics.qualityScore === 0 ? "Non-compliant" :
                     selectedAnalysis.metrics.qualityScore >= 90 ? "Gold" :
                     selectedAnalysis.metrics.qualityScore >= 75 ? "Silver" :
                     selectedAnalysis.metrics.qualityScore >= 60 ? "Bronze" : "Non-compliant"} Quality
                  </div>
                </div>

                {/* Score Breakdown Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                  {/* Clear Photos with AI Analysis */}
                  <div className={`p-4 rounded-lg border-2 ${
                    (() => {
                      const analysisResult = photoAnalysisResults.get(selectedAnalysis.consignment.id);
                      if (analysisResult) {
                        return analysisResult.points >= 10 ? 'border-green-200 bg-green-50' :
                               analysisResult.points >= 5 ? 'border-yellow-200 bg-yellow-50' :
                               'border-red-200 bg-red-50';
                      }
                      return selectedAnalysis.metrics.scoreBreakdown.clearPhotos.status === 'pending' ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-gray-50';
                    })()
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        <span className="font-semibold">Clear Photos</span>
                      </div>
                      <div className={`font-bold ${
                        (() => {
                          const analysisResult = photoAnalysisResults.get(selectedAnalysis.consignment.id);
                          if (analysisResult) {
                            return analysisResult.points > 0 ? 'text-green-600' : 'text-red-600';
                          }
                          return 'text-gray-500';
                        })()
                      }`}>
                        {(() => {
                          const analysisResult = photoAnalysisResults.get(selectedAnalysis.consignment.id);
                          if (analysisResult) {
                            return `${analysisResult.points > 0 ? '+' : ''}${analysisResult.points} pts`;
                          }
                          return '+0 pts';
                        })()}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      {(() => {
                        const analysisResult = photoAnalysisResults.get(selectedAnalysis.consignment.id);
                        if (analysisResult) {
                          return analysisResult.reason;
                        }
                        return selectedAnalysis.metrics.scoreBreakdown.clearPhotos.reason;
                      })()}
                    </p>
                    {!photoAnalysisResults.get(selectedAnalysis.consignment.id) && (
                      <Button
                        onClick={() => analyzePhotosForConsignment(selectedAnalysis.consignment)}
                        disabled={photoAnalysisLoading === selectedAnalysis.consignment.id}
                        className="w-full"
                        variant="outline"
                        size="sm"
                        data-testid={`button-analyze-photos-${selectedAnalysis.consignment.id}`}
                      >
                        {photoAnalysisLoading === selectedAnalysis.consignment.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            Analyzing Photos...
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Check Photos with AI
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Gated + Bucketed Scoring System</h4>
                  <div className="text-xs text-blue-800 space-y-1">
                    <p className="font-medium mb-1">Gate Requirements (must pass all for scoring):</p>
                    <div className="ml-2 space-y-0.5">
                      <p>• Signature present</p>
                      <p>• Receiver name provided</p>
                      <p>• Temperature compliance met</p>
                      <p>• Minimum 3 photos</p>
                    </div>
                    <p className="font-medium mt-2 mb-1">Point Buckets (100 points total):</p>
                    <div className="ml-2 space-y-0.5">
                      <p>• <strong>Photos (30pts):</strong> 25pts base + 5pts bonus for extras</p>
                      <p>• <strong>Temperature (25pts):</strong> All-or-nothing compliance</p>
                      <p>• <strong>Recipient (15pts):</strong> Signature 8pts + Name 7pts</p>
                      <p>• <strong>Photo OCR (15pts):</strong> Clarity analysis (pending)</p>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">Grades: Gold (90-100), Silver (75-89), Bronze (60-74), Non-compliant (gate failure)</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Signature Photo Modal */}
        <InlinePhotoModal
          photos={selectedSignatures}
          isOpen={signatureModalOpen}
          onClose={() => setSignatureModalOpen(false)}
          initialPhotoIndex={0}
          consignmentNo={selectedSignatureConsignment}
        />
      </div>
    </div>
  );
}