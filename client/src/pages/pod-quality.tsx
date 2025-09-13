import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
  X
} from "lucide-react";
import { Link } from "wouter";
import { getUser, logout, getToken, isAuthenticated } from "@/lib/auth";
import { Consignment } from "@shared/schema";

// Types for our simplified approach
interface PODSummary {
  total: number;
  validPODs: number;
  missingSignatures: number;
  noPhotos: number;
  temperatureIssues: number;
  missingReceiver: number;
}

interface ConsignmentWithIssues {
  consignment: Consignment;
  issues: string[];
  hasIssues: boolean;
  photoCount: number;
  hasSignature: boolean;
  hasReceiver: boolean;
  tempCompliant: boolean;
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

// Helper functions for POD analysis
function countPhotos(consignment: Consignment): number {
  const deliveryFiles = consignment.receivedDeliveryPodFiles;
  if (!deliveryFiles) return 0;
  
  try {
    const files = Array.isArray(deliveryFiles) ? deliveryFiles : JSON.parse(deliveryFiles);
    return files.length;
  } catch {
    return 0;
  }
}

function hasSignature(consignment: Consignment): boolean {
  return !!(consignment.deliverySignatureName || 
           consignment.pickupSignatureName ||
           (consignment as any).receiverName);
}

function hasReceiverName(consignment: Consignment): boolean {
  return !!(consignment.deliverySignatureName || 
           consignment.pickupSignatureName ||
           (consignment as any).receiverName ||
           (consignment as any).delivery_SignatureName);
}

function isTemperatureCompliant(consignment: Consignment): boolean {
  const expectedTemp = consignment.expectedTemperature;
  const actualTemp = consignment.actualTemperature;
  
  if (!expectedTemp || !actualTemp) {
    // If no temp requirements, assume compliant
    return !expectedTemp;
  }
  
  // Simple compliance check - adjust as needed
  if (expectedTemp.toLowerCase().includes('freezer')) {
    return actualTemp <= -15;
  } else if (expectedTemp.toLowerCase().includes('chiller')) {
    return actualTemp >= 0 && actualTemp <= 8;
  }
  
  return true; // Assume compliant for other cases
}

function analyzePODCompliance(consignment: Consignment): ConsignmentWithIssues {
  const issues: string[] = [];
  const photoCount = countPhotos(consignment);
  const hasSignatureVal = hasSignature(consignment);
  const hasReceiverVal = hasReceiverName(consignment);
  const tempCompliantVal = isTemperatureCompliant(consignment);
  
  if (photoCount === 0) {
    issues.push("No photos");
  } else if (photoCount < 3) {
    issues.push("Few photos");
  }
  
  if (!hasSignatureVal) {
    issues.push("Missing signature");
  }
  
  if (!hasReceiverVal) {
    issues.push("No receiver name");
  }
  
  if (!tempCompliantVal) {
    issues.push("Temperature issue");
  }
  
  return {
    consignment,
    issues,
    hasIssues: issues.length > 0,
    photoCount,
    hasSignature: hasSignatureVal,
    hasReceiver: hasReceiverVal,
    tempCompliant: tempCompliantVal
  };
}

// Main POD Quality Component
export default function PODQuality() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

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

  // Calculate summary metrics
  const summary: PODSummary = {
    total: podAnalyses.length,
    validPODs: podAnalyses.filter(p => !p.hasIssues).length,
    missingSignatures: podAnalyses.filter(p => !p.hasSignature).length,
    noPhotos: podAnalyses.filter(p => p.photoCount === 0).length,
    temperatureIssues: podAnalyses.filter(p => !p.tempCompliant).length,
    missingReceiver: podAnalyses.filter(p => !p.hasReceiver).length,
  };

  // Filter and search logic
  const filteredAnalyses = podAnalyses
    .filter(analysis => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const consignment = analysis.consignment;
        return (
          consignment.consignmentNo?.toLowerCase().includes(term) ||
          consignment.driverName?.toLowerCase().includes(term) ||
          consignment.shipToCompanyName?.toLowerCase().includes(term)
        );
      }
      return true;
    })
    .filter(analysis => {
      // Issues filter
      if (showIssuesOnly) {
        return analysis.hasIssues;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort issues first
      if (a.hasIssues && !b.hasIssues) return -1;
      if (!a.hasIssues && b.hasIssues) return 1;
      return 0;
    });

  // Calculate simple driver stats
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
      if (!analysis.hasIssues) {
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

        {/* Minimal Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search consignments or drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="issues-only"
              checked={showIssuesOnly}
              onCheckedChange={setShowIssuesOnly}
              data-testid="switch-issues-only"
            />
            <label htmlFor="issues-only" className="text-sm font-medium text-gray-700">
              Show issues only
            </label>
          </div>
        </div>

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
                  {filteredAnalyses.map((analysis, index) => (
                    <div 
                      key={analysis.consignment.id} 
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        analysis.hasIssues ? 'bg-red-25 border-l-4 border-red-400' : ''
                      }`}
                      data-testid={`consignment-${analysis.consignment.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900" data-testid={`text-consignment-${analysis.consignment.id}`}>
                              {analysis.consignment.consignmentNo || `#${analysis.consignment.id}`}
                            </h3>
                            {analysis.hasIssues && (
                              <Badge variant="destructive" className="text-xs">
                                {analysis.issues.length} issue{analysis.issues.length > 1 ? 's' : ''}
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
                            variant={analysis.photoCount >= 3 ? "default" : analysis.photoCount > 0 ? "secondary" : "destructive"}
                            className="text-xs"
                            data-testid={`badge-photos-${analysis.consignment.id}`}
                          >
                            <Camera className="h-3 w-3 mr-1" />
                            {analysis.photoCount} photos
                          </Badge>

                          <Badge 
                            variant={analysis.hasSignature ? "default" : "destructive"}
                            className="text-xs"
                            data-testid={`badge-signature-${analysis.consignment.id}`}
                          >
                            <FileSignature className="h-3 w-3 mr-1" />
                            {analysis.hasSignature ? "Signed" : "No signature"}
                          </Badge>

                          <Badge 
                            variant={analysis.tempCompliant ? "default" : "destructive"}
                            className="text-xs"
                            data-testid={`badge-temp-${analysis.consignment.id}`}
                          >
                            <Thermometer className="h-3 w-3 mr-1" />
                            {analysis.tempCompliant ? "Temp OK" : "Temp issue"}
                          </Badge>

                          <Badge 
                            variant={analysis.hasReceiver ? "default" : "destructive"}
                            className="text-xs"
                            data-testid={`badge-receiver-${analysis.consignment.id}`}
                          >
                            <User className="h-3 w-3 mr-1" />
                            {analysis.hasReceiver ? "Named" : "No name"}
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

                      {/* Issues List */}
                      {analysis.hasIssues && (
                        <div className="mt-3 pt-3 border-t border-red-100">
                          <div className="flex flex-wrap gap-1">
                            {analysis.issues.map((issue, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {issue}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

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