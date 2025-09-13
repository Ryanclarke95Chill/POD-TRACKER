import { useState, useEffect, useCallback } from "react";
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
  Clock,
  LogOut,
  Home,
  User,
  Package,
  TrendingUp,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Filter,
  RotateCcw
} from "lucide-react";
import { Link } from "wouter";
import { getUser, logout, getToken, isAuthenticated } from "@/lib/auth";
import { Consignment } from "@shared/schema";

// Quality tier definitions matching analytics page
const QUALITY_TIERS = {
  gold: { min: 90, max: 100, label: 'Gold (90-100)', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  silver: { min: 75, max: 89, label: 'Silver (75-89)', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  bronze: { min: 60, max: 74, label: 'Bronze (60-74)', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  nonCompliant: { min: 0, max: 0, label: 'Non-Compliant', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' }
};

interface PODSummary {
  total: number;
  gold: number;
  silver: number;
  bronze: number;
  nonCompliant: number;
  avgScore: number;
  gatePassRate: number;
}

interface PODMetrics {
  qualityScore: number;
  qualityTier: 'gold' | 'silver' | 'bronze' | 'nonCompliant';
  gatesPassed: boolean;
  missingGates: string[];
  photoCount: number;
  hasSignature: boolean;
  hasReceiverName: boolean;
  temperatureCompliant: boolean;
  photoRequirement: { min: number; max: number; description: string };
}

interface ConsignmentWithAnalysis {
  consignment: Consignment;
  metrics: PODMetrics;
}

interface DriverStats {
  driverName: string;
  totalDeliveries: number;
  validPODs: number;
  successRate: number;
}

// Keep the photo modal components from the original (simplified)
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

// Simplified Photo Modal Component
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

// Simplified Photo Gallery Component
function PhotoGallery({ trackingLink, consignmentNo }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        setLoading(true);
        setError(null);
        
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
          photoCache.set(trackingLink, {photos: regularPhotos, signaturePhotos: data.signaturePhotos || []});
        } else {
          throw new Error(data.message || 'Failed to extract photos');
        }
        
      } catch (err) {
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
    <div className="p-8 bg-gradient-to-br from-gray-50 to-white min-h-[70vh]">
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

// POD Analysis Helper Functions (from analytics page)
const getRequiredPhotoCount = (consignment: Consignment): { min: number; max: number; description: string } => {
  const pallets = Number(consignment.qty2) || 0;
  const cartons = Number(consignment.qty1) || 0;
  
  if (pallets > 0 && cartons > 0) {
    if (pallets === 1) return { min: 2, max: 2, description: '2 photos required for 1 pallet' };
    if (pallets >= 2 && pallets <= 3) return { min: 3, max: 3, description: `3 photos minimum for ${pallets} pallets` };
    if (pallets > 3) return { min: 4, max: 4, description: `4 photos minimum for ${pallets} pallets` };
  }
  
  if (pallets > 0) {
    if (pallets === 1) return { min: 2, max: 2, description: '2 photos required for 1 pallet' };
    if (pallets >= 2 && pallets <= 3) return { min: 3, max: 3, description: `3 photos minimum for ${pallets} pallets` };
    if (pallets > 3) return { min: 4, max: 4, description: `4 photos minimum for ${pallets} pallets` };
  }
  
  if (cartons > 0) {
    if (cartons >= 1 && cartons <= 10) return { min: 1, max: 2, description: `1-2 photos for ${cartons} cartons` };
    if (cartons > 10) return { min: 3, max: 3, description: `3 photos minimum for ${cartons} cartons` };
  }
  
  return { min: 3, max: 3, description: '3 photos minimum (default)' };
};

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
  const receiverName = consignment.deliverySignatureName?.trim();
  return !!(receiverName && receiverName.length >= 2);
};

const checkTemperatureCompliance = (consignment: Consignment): boolean => {
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

const passesGates = (consignment: Consignment): { ok: boolean; missing: string[] } => {
  const missing: string[] = [];
  
  if (!hasSignature(consignment)) missing.push('Signature present');
  if (!hasReceiverName(consignment)) missing.push('Receiver name present');
  if (!checkTemperatureCompliance(consignment)) missing.push('Temperature compliance requirement');
  
  const photoCount = countPhotos(consignment);
  const photoRequirement = getRequiredPhotoCount(consignment);
  if (photoCount < photoRequirement.min) missing.push(`Photos requirement (${photoRequirement.description})`);
  
  return { ok: missing.length === 0, missing };
};

const calculateQualityScore = (consignment: Consignment): number => {
  let score = 0;
  
  // Only score if gates pass
  const gates = passesGates(consignment);
  if (!gates.ok) return 0;
  
  // Photos (30 points)
  const photoCount = countPhotos(consignment);
  const photoRequirement = getRequiredPhotoCount(consignment);
  if (photoCount >= photoRequirement.min) {
    score += 25; // Base photo requirement
    const extraPhotos = Math.max(0, photoCount - photoRequirement.min);
    score += Math.min(5, extraPhotos); // Up to 5 bonus points for extra photos
  }
  
  // Recipient confirmation (15 points)
  if (hasSignature(consignment)) score += 8;
  if (hasReceiverName(consignment)) score += 7;
  
  // Temperature compliance (25 points)
  if (checkTemperatureCompliance(consignment)) {
    score += 25; // Full points for temperature compliance
  }
  
  // Quantity accuracy (15 points) - simplified for now
  if (consignment.qty1 || consignment.qty2) {
    score += 5; // QTY present
    score += 10; // Assume matches evidence for now
  }
  
  return Math.min(100, score);
};

const getQualityTier = (score: number): 'gold' | 'silver' | 'bronze' | 'nonCompliant' => {
  if (score === 0) return 'nonCompliant';
  if (score >= 90) return 'gold';
  if (score >= 75) return 'silver';
  if (score >= 60) return 'bronze';
  return 'nonCompliant';
};

const analyzePODCompliance = (consignment: Consignment): ConsignmentWithAnalysis => {
  const photoCount = countPhotos(consignment);
  const hasSignatureVal = hasSignature(consignment);
  const hasReceiverVal = hasReceiverName(consignment);
  const tempCompliantVal = checkTemperatureCompliance(consignment);
  const photoRequirement = getRequiredPhotoCount(consignment);
  const gates = passesGates(consignment);
  
  const qualityScore = calculateQualityScore(consignment);
  const qualityTier = getQualityTier(qualityScore);
  
  return {
    consignment,
    metrics: {
      qualityScore,
      qualityTier,
      gatesPassed: gates.ok,
      missingGates: gates.missing,
      photoCount,
      hasSignature: hasSignatureVal,
      hasReceiverName: hasReceiverVal,
      temperatureCompliant: tempCompliantVal,
      photoRequirement
    }
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
  
  // New filter states
  const [dateRange, setDateRange] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [deliveryState, setDeliveryState] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<string>("all");

  const user = getUser();

  // Fetch consignments data
  const { data: consignments = [], isLoading } = useQuery({
    queryKey: ['/api/consignments'],
    enabled: !!user,
  });

  // Process consignments for POD analysis
  const podAnalyses = consignments
    .filter(c => c.delivery_StateLabel === 'Delivered' || c.delivery_Outcome)
    .map(analyzePODCompliance);

  // Get unique drivers and delivery states for filters
  const uniqueDrivers = [...new Set(consignments
    .filter(c => c.driverName)
    .map(c => c.driverName!)
  )].sort();

  const uniqueDeliveryStates = [...new Set(consignments
    .filter(c => c.delivery_StateLabel)
    .map(c => c.delivery_StateLabel!)
  )].sort();

  // Calculate summary metrics
  const summary: PODSummary = {
    total: podAnalyses.length,
    gold: podAnalyses.filter(p => p.metrics.qualityTier === 'gold').length,
    silver: podAnalyses.filter(p => p.metrics.qualityTier === 'silver').length,
    bronze: podAnalyses.filter(p => p.metrics.qualityTier === 'bronze').length,
    nonCompliant: podAnalyses.filter(p => p.metrics.qualityTier === 'nonCompliant').length,
    avgScore: podAnalyses.reduce((sum, p) => sum + p.metrics.qualityScore, 0) / podAnalyses.length || 0,
    gatePassRate: podAnalyses.length > 0 ? (podAnalyses.filter(p => p.metrics.gatesPassed).length / podAnalyses.length) * 100 : 0,
  };

  // Filter and search logic
  const filteredAnalyses = podAnalyses
    .filter(analysis => {
      const consignment = analysis.consignment;
      
      // Date range filter
      if (dateRange !== "all") {
        const deliveryDate = consignment.contextPlannedDeliveryDateTime || consignment.departureDateTime;
        switch (dateRange) {
          case "today":
            if (!isToday(deliveryDate)) return false;
            break;
          case "week":
            if (!isThisWeek(deliveryDate)) return false;
            break;
          case "month":
            if (!isThisMonth(deliveryDate)) return false;
            break;
        }
      }
      
      // Custom date range filter
      if (fromDate || toDate) {
        const deliveryDate = new Date(consignment.contextPlannedDeliveryDateTime || consignment.departureDateTime || '');
        if (fromDate && deliveryDate < new Date(fromDate)) return false;
        if (toDate && deliveryDate > new Date(toDate + 'T23:59:59')) return false;
      }
      
      // Driver filter
      if (selectedDriver !== "all" && consignment.driverName !== selectedDriver) {
        return false;
      }
      
      // Delivery state filter
      if (deliveryState !== "all" && consignment.delivery_StateLabel !== deliveryState) {
        return false;
      }
      
      // Quality tier filter
      if (qualityFilter !== "all" && analysis.metrics.qualityTier !== qualityFilter) {
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
      // Issues filter - now means non-compliant or failed gates
      if (showIssuesOnly) {
        return !analysis.metrics.gatesPassed || analysis.metrics.qualityTier === 'nonCompliant';
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by quality tier (non-compliant first, then by score)
      if (a.metrics.qualityTier === 'nonCompliant' && b.metrics.qualityTier !== 'nonCompliant') return -1;
      if (a.metrics.qualityTier !== 'nonCompliant' && b.metrics.qualityTier === 'nonCompliant') return 1;
      return b.metrics.qualityScore - a.metrics.qualityScore;
    });

  // Calculate driver stats with quality scores
  const driverStats: DriverStats[] = consignments
    .filter(c => c.delivery_StateLabel === 'Delivered' || c.delivery_Outcome)
    .filter(c => c.driverName)
    .reduce((acc: { [key: string]: DriverStats }, consignment) => {
      const driverName = consignment.driverName!;
      if (!acc[driverName]) {
        acc[driverName] = {
          driverName,
          totalDeliveries: 0,
          validPODs: 0,
          successRate: 0
        };
      }
      
      acc[driverName].totalDeliveries++;
      const analysis = analyzePODCompliance(consignment);
      if (analysis.metrics.gatesPassed && analysis.metrics.qualityTier !== 'nonCompliant') {
        acc[driverName].validPODs++;
      }
      
      return acc;
    }, {});

  // Convert to array and calculate success rates
  const topDrivers = Object.values(driverStats)
    .filter(driver => driver.totalDeliveries >= 20) // ≥20 deliveries threshold
    .map(driver => ({
      ...driver,
      successRate: Math.round((driver.validPODs / driver.totalDeliveries) * 100)
    }))
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);

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
      {/* Header */}
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
        {/* Simple Summary Banner */}
        <div className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-700" data-testid="text-valid-pods">
                  {summary.validPODs}
                </div>
                <div className="text-sm text-green-600 font-medium">Valid PODs</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <FileSignature className="h-8 w-8 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-700" data-testid="text-missing-signatures">
                  {summary.missingSignatures}
                </div>
                <div className="text-sm text-red-600 font-medium">Missing Signatures</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Camera className="h-8 w-8 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-orange-700" data-testid="text-no-photos">
                  {summary.noPhotos}
                </div>
                <div className="text-sm text-orange-600 font-medium">No Photos</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Thermometer className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="text-2xl font-bold text-yellow-700" data-testid="text-temperature-issues">
                  {summary.temperatureIssues}
                </div>
                <div className="text-sm text-yellow-600 font-medium">Temperature Issues</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <User className="h-8 w-8 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-purple-700" data-testid="text-missing-receiver">
                  {summary.missingReceiver}
                </div>
                <div className="text-sm text-purple-600 font-medium">No Receiver Name</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-700" data-testid="text-total-pods">
                  {summary.total}
                </div>
                <div className="text-sm text-blue-600 font-medium">Total PODs</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Enhanced Filter Controls */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setDateRange("all");
                  setFromDate("");
                  setToDate("");
                  setSelectedDriver("all");
                  setDeliveryState("all");
                  setQualityFilter("all");
                  setShowIssuesOnly(false);
                }}
                className="ml-auto text-sm text-gray-600 hover:text-gray-900"
                data-testid="button-clear-filters"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search consignments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              
              {/* Date Range Filter */}
              <div>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger data-testid="select-date-range">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Driver Filter */}
              <div>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger data-testid="select-driver">
                    <User className="h-4 w-4 mr-2 text-gray-500" />
                    <SelectValue placeholder="All drivers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    {uniqueDrivers.map((driver) => (
                      <SelectItem key={driver} value={driver}>
                        {driver}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Delivery State Filter */}
              <div>
                <Select value={deliveryState} onValueChange={setDeliveryState}>
                  <SelectTrigger data-testid="select-delivery-state">
                    <Package className="h-4 w-4 mr-2 text-gray-500" />
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {uniqueDeliveryStates.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Issues Only Toggle */}
              <div className="flex items-center justify-center gap-2 p-2">
                <Switch
                  id="issues-only"
                  checked={showIssuesOnly}
                  onCheckedChange={setShowIssuesOnly}
                  data-testid="switch-issues-only"
                />
                <label htmlFor="issues-only" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Issues only
                </label>
              </div>
            </div>
            
            {/* Active Filter Summary */}
            {(searchTerm || dateRange !== "all" || fromDate || toDate || qualityFilter !== "all" || selectedDriver !== "all" || deliveryState !== "all" || showIssuesOnly) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-gray-600">Active filters:</span>
                  {searchTerm && (
                    <Badge variant="secondary" className="text-xs">
                      Search: "{searchTerm}"
                    </Badge>
                  )}
                  {dateRange !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Date: {dateRange === "today" ? "Today" : dateRange === "week" ? "This Week" : "This Month"}
                    </Badge>
                  )}
                  {fromDate && (
                    <Badge variant="secondary" className="text-xs">
                      From: {fromDate}
                    </Badge>
                  )}
                  {toDate && (
                    <Badge variant="secondary" className="text-xs">
                      To: {toDate}
                    </Badge>
                  )}
                  {qualityFilter !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Quality: {QUALITY_TIERS[qualityFilter as keyof typeof QUALITY_TIERS].label}
                    </Badge>
                  )}
                  {selectedDriver !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Driver: {selectedDriver}
                    </Badge>
                  )}
                  {deliveryState !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      State: {deliveryState}
                    </Badge>
                  )}
                  {showIssuesOnly && (
                    <Badge variant="destructive" className="text-xs">
                      Issues Only
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Issues-First Consignment List */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Consignments ({filteredAnalyses.length})
                </CardTitle>
                <CardDescription>
                  {showIssuesOnly ? "Showing only consignments with issues" : "All delivered consignments"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                  {filteredAnalyses.map((analysis, index) => {
                    const tier = QUALITY_TIERS[analysis.metrics.qualityTier];
                    return (
                      <div 
                        key={analysis.consignment.id} 
                        className={`p-4 hover:bg-gray-50 transition-colors ${
                          !analysis.metrics.gatesPassed ? 'bg-red-25 border-l-4 border-red-400' : 
                          analysis.metrics.qualityTier === 'gold' ? 'bg-yellow-25 border-l-4 border-yellow-400' :
                          ''
                        }`}
                        data-testid={`consignment-${analysis.consignment.id}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900" data-testid={`text-consignment-${analysis.consignment.id}`}>
                                {analysis.consignment.consignmentNo || `#${analysis.consignment.id}`}
                              </h3>
                              
                              {/* Quality Score and Tier Badge */}
                              <Badge 
                                variant={analysis.metrics.qualityTier === 'nonCompliant' ? 'destructive' : 'secondary'}
                                className={`text-xs font-bold ${tier.color}`}
                                data-testid={`badge-quality-${analysis.consignment.id}`}
                              >
                                {analysis.metrics.qualityScore}/100 {analysis.metrics.qualityTier.charAt(0).toUpperCase() + analysis.metrics.qualityTier.slice(1)}
                              </Badge>
                              
                              {!analysis.metrics.gatesPassed && (
                                <Badge variant="destructive" className="text-xs">
                                  {analysis.metrics.missingGates.length} gate{analysis.metrics.missingGates.length > 1 ? 's' : ''} failed
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600" data-testid={`text-company-${analysis.consignment.id}`}>
                              {analysis.consignment.shipToCompanyName || 'Unknown Company'}
                            </p>
                            <p className="text-sm text-gray-500" data-testid={`text-driver-${analysis.consignment.id}`}>
                              Driver: {analysis.consignment.driverName || 'N/A'}
                            </p>
                          </div>

                          {/* Status Chips */}
                          <div className="flex flex-wrap gap-2">
                            <Badge 
                              variant={analysis.metrics.photoCount >= analysis.metrics.photoRequirement.min ? "default" : analysis.metrics.photoCount > 0 ? "secondary" : "destructive"}
                              className="text-xs"
                              data-testid={`badge-photos-${analysis.consignment.id}`}
                            >
                              <Camera className="h-3 w-3 mr-1" />
                              {analysis.metrics.photoCount} photos (need {analysis.metrics.photoRequirement.min})
                            </Badge>

                            <Badge 
                              variant={analysis.metrics.hasSignature ? "default" : "destructive"}
                              className="text-xs"
                              data-testid={`badge-signature-${analysis.consignment.id}`}
                            >
                              <FileSignature className="h-3 w-3 mr-1" />
                              {analysis.metrics.hasSignature ? "Signed" : "No signature"}
                            </Badge>

                            <Badge 
                              variant={analysis.metrics.temperatureCompliant ? "default" : "destructive"}
                              className="text-xs"
                              data-testid={`badge-temp-${analysis.consignment.id}`}
                            >
                              <Thermometer className="h-3 w-3 mr-1" />
                              {analysis.metrics.temperatureCompliant ? "Temp OK" : "Temp issue"}
                            </Badge>

                            <Badge 
                              variant={analysis.metrics.hasReceiverName ? "default" : "destructive"}
                              className="text-xs"
                              data-testid={`badge-receiver-${analysis.consignment.id}`}
                            >
                              <User className="h-3 w-3 mr-1" />
                              {analysis.metrics.hasReceiverName ? "Named" : "No name"}
                            </Badge>
                          </div>

                          {/* View Photos Button */}
                          <Button
                            onClick={() => {
                              setSelectedConsignment(analysis.consignment);
                              setPhotoModalOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            data-testid={`button-view-photos-${analysis.consignment.id}`}
                            disabled={!analysis.consignment.deliveryLiveTrackLink && !analysis.consignment.pickupLiveTrackLink}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Photos
                          </Button>
                        </div>

                        {/* Failed Gates List */}
                        {!analysis.metrics.gatesPassed && analysis.metrics.missingGates.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-red-100">
                            <div className="flex flex-wrap gap-1">
                              {analysis.metrics.missingGates.map((gate, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {gate}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredAnalyses.length === 0 && (
                    <div className="text-center py-12 text-gray-500" data-testid="text-no-results">
                      <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No consignments found</p>
                      <p className="text-sm">
                        {showIssuesOnly ? "No issues found matching your criteria" : "No consignments match your search"}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Simple Driver Leaderboard */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Drivers
                </CardTitle>
                <CardDescription>
                  Success rate (≥20 deliveries)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topDrivers.map((driver, index) => (
                    <div key={driver.driverName} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate" data-testid={`text-driver-name-${index}`}>
                            {driver.driverName}
                          </p>
                          <p className="text-xs text-gray-500" data-testid={`text-driver-deliveries-${index}`}>
                            {driver.totalDeliveries} deliveries
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${
                          driver.successRate >= 95 ? 'text-green-600' :
                          driver.successRate >= 85 ? 'text-blue-600' :
                          driver.successRate >= 70 ? 'text-yellow-600' :
                          'text-red-600'
                        }`} data-testid={`text-success-rate-${index}`}>
                          {driver.successRate}%
                        </div>
                        <div className="text-xs text-gray-500" data-testid={`text-valid-pods-${index}`}>
                          {driver.validPODs} valid
                        </div>
                      </div>
                    </div>
                  ))}

                  {topDrivers.length === 0 && (
                    <div className="text-center py-6 text-gray-500">
                      <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No drivers with ≥20 deliveries</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Photo Modal */}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}