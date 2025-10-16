import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Camera, 
  Thermometer, 
  FileSignature, 
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  TrendingUp,
  Users,
  Package,
  ExternalLink,
  Eye,
  Filter,
  X,
  BarChart3,
  ArrowUpDown,
  LogOut,
  Lightbulb,
  TrendingDown,
  Trophy,
  Award,
  Medal,
  Crown,
  Star
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Consignment } from "@shared/schema";
import { calculatePODScore, getQualityTier, getPhotoCount, getActualTemperature, parseRequiredTemperature } from "@/utils/podMetrics";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { getUser, logout } from "@/lib/auth";
import chillLogo from "@assets/Chill Logo CMYK Primary (1)_1760581487204.png";

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: string[];
  signatures: string[];
  consignmentNo: string;
}

interface Filters {
  shipper: string;
  warehouse: string;
  driver: string;
  fromDate: string;
  toDate: string;
  qualityTier: string;
}

function PhotoModal({ isOpen, onClose, photos, signatures, consignmentNo }: PhotoModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewingSignatures, setViewingSignatures] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  const allImages = viewingSignatures ? signatures : photos;
  const currentImage = allImages[currentIndex];
  
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
    setImageLoading(true);
  };
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
    setImageLoading(true);
  };
  
  useEffect(() => {
    setCurrentIndex(0);
    setImageLoading(true);
  }, [viewingSignatures]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allImages.length]);
  
  if (!isOpen) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>POD Photos - {consignmentNo}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={!viewingSignatures ? "default" : "outline"}
                onClick={() => setViewingSignatures(false)}
              >
                Photos ({photos.length})
              </Button>
              <Button
                size="sm"
                variant={viewingSignatures ? "default" : "outline"}
                onClick={() => setViewingSignatures(true)}
              >
                Signatures ({signatures.length})
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          {allImages.length > 0 ? (
            <>
              <div className="relative bg-gray-100 min-h-[400px] flex items-center justify-center">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                )}
                <img
                  src={`/api/image?src=${encodeURIComponent(currentImage)}&w=900&q=90`}
                  alt={`${viewingSignatures ? 'Signature' : 'Photo'} ${currentIndex + 1}`}
                  className="max-w-full h-auto max-h-[600px] object-contain"
                  onLoad={() => setImageLoading(false)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    // Fallback to original URL if image proxy fails
                    target.src = currentImage;
                    setImageLoading(false);
                  }}
                />
              </div>
              
              {allImages.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                    onClick={handleNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded">
                    {currentIndex + 1} / {allImages.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Camera className="h-12 w-12 mb-2 text-gray-300" />
              <p>No {viewingSignatures ? 'signatures' : 'photos'} available</p>
              <p className="text-sm mt-2">Photos may still be processing, please try again in a moment</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DeliveryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  consignment: ConsignmentWithPhotoCount | null;
  photos: string[];
  signatures: string[];
}

function DeliveryDetailsModal({ isOpen, onClose, consignment, photos, signatures }: DeliveryDetailsModalProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [viewingSignatures, setViewingSignatures] = useState(false);
  
  if (!consignment) return null;
  
  const metrics = calculatePODScore(consignment);
  const qualityTier = getQualityTier(metrics.qualityScore);
  const photoCount = getPhotoCount(consignment);
  const actualTemp = getActualTemperature(consignment);
  const requiredTemp = parseRequiredTemperature(consignment.documentNote || '');
  
  const allImages = viewingSignatures ? signatures : photos;
  const currentImage = allImages[currentPhotoIndex];
  
  const handlePrevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };
  
  const handleNextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };
  
  const tierColor = qualityTier.tier === 'Excellent' ? 'bg-green-100 text-green-800' :
                    qualityTier.tier === 'Good' ? 'bg-blue-100 text-blue-800' :
                    qualityTier.tier === 'Fair' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  
  const formatDriverName = (name: string | null) => {
    if (!name) return 'Unknown';
    const parts = name.split(',').map(p => p.trim());
    return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">Delivery Details</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">Consignment {consignment.consignmentNo}</p>
            </div>
            <Badge className={`${tierColor} text-lg px-4 py-2`}>
              {metrics.qualityScore} - {qualityTier.tier}
            </Badge>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Score Breakdown Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Score Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Temperature */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Thermometer className={`h-5 w-5 ${metrics.scoreBreakdown.temperature.status === 'pass' ? 'text-green-600' : 'text-red-600'}`} />
                  <div>
                    <div className="font-medium">Temperature Compliance</div>
                    <div className="text-sm text-gray-600">{metrics.scoreBreakdown.temperature.reason}</div>
                  </div>
                </div>
                <div className="text-xl font-bold">{metrics.scoreBreakdown.temperature.points}/40</div>
              </div>
              
              {/* Photos */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Camera className={`h-5 w-5 ${metrics.scoreBreakdown.photos.status === 'pass' ? 'text-green-600' : 'text-red-600'}`} />
                  <div>
                    <div className="font-medium">Photo Compliance</div>
                    <div className="text-sm text-gray-600">{metrics.scoreBreakdown.photos.reason}</div>
                  </div>
                </div>
                <div className="text-xl font-bold">{metrics.scoreBreakdown.photos.points}/25</div>
              </div>
              
              {/* Receiver Name */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className={`h-5 w-5 ${metrics.scoreBreakdown.receiverName.status === 'pass' ? 'text-green-600' : 'text-red-600'}`} />
                  <div>
                    <div className="font-medium">Receiver Name</div>
                    <div className="text-sm text-gray-600">
                      {consignment.deliverySignatureName || 'Missing'}
                    </div>
                  </div>
                </div>
                <div className="text-xl font-bold">{metrics.scoreBreakdown.receiverName.points}/20</div>
              </div>
              
              {/* Signature */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSignature className={`h-5 w-5 ${metrics.scoreBreakdown.signature.status === 'pass' ? 'text-green-600' : 'text-red-600'}`} />
                  <div>
                    <div className="font-medium">Signature</div>
                    <div className="text-sm text-gray-600">{metrics.scoreBreakdown.signature.reason}</div>
                  </div>
                </div>
                <div className="text-xl font-bold">{metrics.scoreBreakdown.signature.points}/15</div>
              </div>
              
              {/* Total */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                <div className="font-bold text-lg">Total Quality Score</div>
                <div className="text-3xl font-bold text-blue-600">{metrics.qualityScore}/100</div>
              </div>
            </CardContent>
          </Card>
          
          {/* Delivery Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">Driver:</span>
                <span className="ml-2">{formatDriverName(consignment.driverName)}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Warehouse:</span>
                <span className="ml-2">{consignment.shipFromCity || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Customer:</span>
                <span className="ml-2">{consignment.shipToCompanyName || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Delivery Address:</span>
                <span className="ml-2">{consignment.shipToAddress}, {consignment.shipToCity}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Delivery Date:</span>
                <span className="ml-2">{consignment.delivery_OutcomeDateTime || 'N/A'}</span>
              </div>
              {requiredTemp && (
                <div>
                  <span className="font-medium text-gray-600">Required Temperature:</span>
                  <span className="ml-2">{requiredTemp.min}°C to {requiredTemp.max}°C</span>
                </div>
              )}
              {actualTemp && (
                <div>
                  <span className="font-medium text-gray-600">Actual Temperature:</span>
                  <span className="ml-2 font-mono">{actualTemp}°C</span>
                </div>
              )}
              
              {/* Tracking Links */}
              {(consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink) && (
                <div className="pt-3 border-t">
                  <span className="font-medium text-gray-600 block mb-2">Tracking:</span>
                  <div className="flex flex-wrap gap-2">
                    {consignment.deliveryLiveTrackLink && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => window.open(consignment.deliveryLiveTrackLink!, '_blank')}
                        className="text-xs"
                        data-testid="button-delivery-tracking"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Delivery Tracking
                      </Button>
                    )}
                    {consignment.pickupLiveTrackLink && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => window.open(consignment.pickupLiveTrackLink!, '_blank')}
                        className="text-xs"
                        data-testid="button-pickup-tracking"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Pickup Tracking
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Photo Gallery */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photo Gallery
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={!viewingSignatures ? "default" : "outline"}
                  onClick={() => { setViewingSignatures(false); setCurrentPhotoIndex(0); }}
                  data-testid="button-view-photos"
                >
                  Photos ({photos.length})
                </Button>
                <Button
                  size="sm"
                  variant={viewingSignatures ? "default" : "outline"}
                  onClick={() => { setViewingSignatures(true); setCurrentPhotoIndex(0); }}
                  data-testid="button-view-signatures"
                >
                  Signatures ({signatures.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {allImages.length > 0 ? (
              <div className="relative">
                <div className="relative bg-gray-100 min-h-[300px] flex items-center justify-center rounded-lg">
                  <img
                    src={`/api/image?src=${encodeURIComponent(currentImage)}&w=800&q=90`}
                    alt={`${viewingSignatures ? 'Signature' : 'Photo'} ${currentPhotoIndex + 1}`}
                    className="max-w-full h-auto max-h-[400px] object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = currentImage;
                    }}
                  />
                </div>
                
                {allImages.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                      onClick={handlePrevPhoto}
                      data-testid="button-prev-photo"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                      onClick={handleNextPhoto}
                      data-testid="button-next-photo"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded">
                      {currentPhotoIndex + 1} / {allImages.length}
                    </div>
                  </>
                )}
                
                {/* Thumbnail strip */}
                {allImages.length > 1 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPhotoIndex(idx)}
                        className={`flex-shrink-0 w-20 h-20 rounded border-2 overflow-hidden transition-all ${
                          idx === currentPhotoIndex ? 'border-blue-500 scale-105' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid={`button-thumbnail-${idx}`}
                      >
                        <img
                          src={`/api/image?src=${encodeURIComponent(img)}&w=100&q=70`}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                <Camera className="h-12 w-12 mb-2 text-gray-300" />
                <p>No {viewingSignatures ? 'signatures' : 'photos'} available</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" data-testid="button-download-report">
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
          <Button variant="outline" className="flex-1" data-testid="button-flag-review">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Flag for Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ConsignmentWithPhotoCount = Consignment & { actualPhotoCount?: number };

export default function PODQualityDashboard() {
  const user = getUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  
  const [filters, setFilters] = useState<Filters>({
    shipper: "all",
    warehouse: "all",
    driver: "all",
    fromDate: "",
    toDate: "",
    qualityTier: "all"
  });
  
  const [dataLoaded, setDataLoaded] = useState(false); // Track if user triggered load
  const [insightsExpanded, setInsightsExpanded] = useState(true); // Track insights section expansion
  
  const [photoModal, setPhotoModal] = useState<{
    isOpen: boolean;
    photos: string[];
    signatures: string[];
    consignmentNo: string;
  }>({ isOpen: false, photos: [], signatures: [], consignmentNo: "" });
  const [loadingPhotos, setLoadingPhotos] = useState<number | null>(null);
  const [photoLoadRetries, setPhotoLoadRetries] = useState<Map<number, number>>(new Map());
  const [photoThumbnails, setPhotoThumbnails] = useState<Map<number, string[]>>(new Map());
  const [loadedThumbnails, setLoadedThumbnails] = useState<Set<number>>(new Set()); // Track which thumbnails we've already tried to load
  const { toast } = useToast();
  
  // Check if filters are applied (require at least date filter)
  const hasFiltersApplied = !!(filters.fromDate || filters.toDate);
  
  // Fetch consignments
  const { data: consignmentsData, isLoading, refetch } = useQuery<{
    consignments: ConsignmentWithPhotoCount[];
    totalCount: number;
  }>({
    queryKey: ["/api/consignments/stats"],
    enabled: dataLoaded && hasFiltersApplied,  // Only fetch when user clicks load button AND filters are applied
    refetchInterval: dataLoaded && hasFiltersApplied ? 60000 : false, // Refresh every minute only when enabled
  });
  
  const consignments = consignmentsData?.consignments || [];
  
  // Helper function to format driver name from "Last, First" to "First Last"
  const formatDriverName = (driverName: string | null | undefined): string => {
    if (!driverName) return "";
    // Check if name is in "Last, First" format
    if (driverName.includes(",")) {
      const parts = driverName.split(",").map(p => p.trim());
      if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`; // "First Last"
      }
    }
    return driverName;
  };
  
  // Get unique shippers, warehouses, and drivers for filter dropdowns
  const uniqueShippers = Array.from(new Set(consignments.map((c: Consignment) => (c as any).shipperCompanyName).filter((name): name is string => Boolean(name)))).sort();
  const uniqueWarehouses = Array.from(new Set(consignments.map((c: Consignment) => c.warehouseCompanyName).filter((name): name is string => Boolean(name)))).sort();
  
  // Group drivers by warehouse
  const driversByWarehouse = consignments.reduce((acc: Record<string, Set<string>>, c: Consignment) => {
    const warehouse = c.warehouseCompanyName || "Unknown Warehouse";
    const driver = c.driverName;
    if (driver) {
      if (!acc[warehouse]) {
        acc[warehouse] = new Set();
      }
      acc[warehouse].add(driver);
    }
    return acc;
  }, {});
  
  // Sort warehouses and drivers
  const sortedWarehouses = Object.keys(driversByWarehouse).sort();
  const driversGrouped = sortedWarehouses.map(warehouse => ({
    warehouse,
    drivers: Array.from(driversByWarehouse[warehouse]).sort()
  }));
  
  // Filter consignments based on search and filters
  const filteredConsignments = consignments.filter((c: Consignment) => {
    // Only show Positive delivery outcomes
    if ((c as any).delivery_OutcomeEnum !== 'Positive') {
      return false;
    }
    
    // Exclude internal depot transfers where CUSTOMER is a Chill depot/location
    // Legitimate deliveries have real customers delivered TO Chill depots (warehouse)
    const customerName = (c.shipToCompanyName || '').toLowerCase().trim();
    
    // Filter out if customer is a Chill internal location (depot transfer)
    const isInternalChillLocation = 
      customerName.includes('chill') && (
        customerName.includes('depot') ||
        customerName.match(/^chill\s+(vic|qld|wa|nsw|sa)$/i) ||
        customerName.match(/^\*?chill\s+(vic|qld|wa|nsw|sa)$/i)
      );
    
    if (isInternalChillLocation) {
      return false;
    }
    
    // Search filter
    const search = searchTerm.toLowerCase();
    const formattedDriverName = formatDriverName(c.driverName);
    const matchesSearch = !searchTerm || (
      c.consignmentNo?.toLowerCase().includes(search) ||
      c.orderNumberRef?.toLowerCase().includes(search) ||
      c.driverName?.toLowerCase().includes(search) ||
      formattedDriverName?.toLowerCase().includes(search) ||
      c.shipToCompanyName?.toLowerCase().includes(search) ||
      c.shipToCity?.toLowerCase().includes(search)
    );
    
    if (!matchesSearch) return false;
    
    // Shipper filter
    const matchesShipper = filters.shipper === "all" || (c as any).shipperCompanyName === filters.shipper;
    
    // Warehouse filter
    const matchesWarehouse = filters.warehouse === "all" || c.warehouseCompanyName === filters.warehouse;
    
    // Driver filter
    const matchesDriver = filters.driver === "all" || c.driverName === filters.driver;
    
    // Date filtering logic - convert to AEST timezone (same as dashboard)
    const matchesDateRange = (() => {
      if (!filters.fromDate && !filters.toDate) return true;
      
      // Check multiple ETA fields as suggested
      const consignmentDate = (c as any).delivery_PlannedETA || 
                              (c as any).delivery_ETA || 
                              (c as any).delivery_FirstCalculatedETA ||
                              (c as any).pickUp_PlannedETA ||
                              (c as any).pickUp_ETA ||
                              (c as any).pickUp_FirstCalculatedETA ||
                              c.departureDateTime;
      if (!consignmentDate) return true; // Show consignments without dates
      
      // Convert UTC date to AEST (UTC+10) for comparison
      const utcDate = new Date(consignmentDate);
      const aestDate = new Date(utcDate.getTime() + (10 * 60 * 60 * 1000)); // Add 10 hours for AEST
      const dateString = aestDate.toISOString().split('T')[0];
      
      if (filters.fromDate && filters.toDate) {
        return dateString >= filters.fromDate && dateString <= filters.toDate;
      } else if (filters.fromDate) {
        return dateString >= filters.fromDate;
      } else if (filters.toDate) {
        return dateString <= filters.toDate;
      }
      return true;
    })();
    
    // Quality tier filter
    const matchesQualityTier = (() => {
      if (filters.qualityTier === "all") return true;
      const metrics = calculatePODScore(c, (c as ConsignmentWithPhotoCount).actualPhotoCount);
      const tier = getQualityTier(metrics.qualityScore);
      return tier.tier === filters.qualityTier;
    })();
    
    return matchesSearch && matchesShipper && matchesWarehouse && matchesDriver && matchesDateRange && matchesQualityTier;
  });
  
  // Sort by syncedAt descending (most recent first)
  const sortedConsignments = [...filteredConsignments].sort((a, b) => {
    if (!a.syncedAt && !b.syncedAt) return 0;
    if (!a.syncedAt) return 1;
    if (!b.syncedAt) return -1;
    return new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime();
  });
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);
  
  // Pagination calculations
  const totalPages = Math.ceil(sortedConsignments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedConsignments = sortedConsignments.slice(startIndex, endIndex);
  
  // Load photo thumbnails for current page
  useEffect(() => {
    const loadThumbnails = async () => {
      for (const consignment of paginatedConsignments) {
        if (photoThumbnails.has(consignment.id)) continue;
        
        const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
        if (!trackingLink) continue;
        
        try {
          const res = await apiRequest(
            'GET',
            `/api/consignments/${consignment.id}/photos`
          );
          const data = await res.json() as { photos: string[]; signatures: string[] };
          if (data.photos && data.photos.length > 0) {
            setPhotoThumbnails(prev => new Map(prev).set(consignment.id, data.photos));
          }
        } catch (error) {
          // Silently fail for thumbnails
        }
      }
    };
    
    loadThumbnails();
  }, [paginatedConsignments]);
  
  // Calculate overall statistics
  const stats = {
    total: filteredConsignments.length,
    avgScore: 0,
    outstandingCount: 0,
    goldCount: 0,
    silverCount: 0,
    bronzeCount: 0,
    needsImprovementCount: 0,
    avgPhotoCount: 0,
    signatureRate: 0,
    tempComplianceRate: 0,
  };
  
  if (filteredConsignments.length > 0) {
    let totalScore = 0;
    let totalPhotos = 0;
    let signaturesCount = 0;
    let tempCompliantCount = 0;
    
    filteredConsignments.forEach((c: ConsignmentWithPhotoCount) => {
      const metrics = calculatePODScore(c, c.actualPhotoCount);
      totalScore += metrics.qualityScore;
      totalPhotos += metrics.photoCount;
      
      if (metrics.hasSignature) signaturesCount++;
      if (metrics.temperatureCompliant) tempCompliantCount++;
      
      const tier = getQualityTier(metrics.qualityScore);
      if (tier.tier === "Outstanding") stats.outstandingCount++;
      else if (tier.tier === "Excellent") stats.goldCount++;
      else if (tier.tier === "Good") stats.silverCount++;
      else if (tier.tier === "Fair") stats.bronzeCount++;
      else stats.needsImprovementCount++;
    });
    
    stats.avgScore = Math.round(totalScore / filteredConsignments.length);
    stats.avgPhotoCount = Math.round((totalPhotos / filteredConsignments.length) * 10) / 10;
    stats.signatureRate = Math.round((signaturesCount / filteredConsignments.length) * 100);
    stats.tempComplianceRate = Math.round((tempCompliantCount / filteredConsignments.length) * 100);
  }
  
  // Calculate warehouse comparison data
  const warehouseComparison = useMemo(() => {
    const warehouseMap = new Map<string, {
      warehouse: string;
      deliveryCount: number;
      totalScore: number;
      totalPhotos: number;
      signaturesCount: number;
      tempCompliantCount: number;
      receiverNameCount: number;
    }>();
    
    filteredConsignments.forEach((c: ConsignmentWithPhotoCount) => {
      const warehouse = c.warehouseCompanyName || "Unknown Warehouse";
      const metrics = calculatePODScore(c, c.actualPhotoCount);
      
      if (!warehouseMap.has(warehouse)) {
        warehouseMap.set(warehouse, {
          warehouse,
          deliveryCount: 0,
          totalScore: 0,
          totalPhotos: 0,
          signaturesCount: 0,
          tempCompliantCount: 0,
          receiverNameCount: 0
        });
      }
      
      const data = warehouseMap.get(warehouse)!;
      data.deliveryCount++;
      data.totalScore += metrics.qualityScore;
      data.totalPhotos += metrics.photoCount;
      if (metrics.hasSignature) data.signaturesCount++;
      if (metrics.temperatureCompliant) data.tempCompliantCount++;
      if (metrics.hasReceiverName) data.receiverNameCount++;
    });
    
    return Array.from(warehouseMap.values()).map(w => ({
      warehouse: w.warehouse,
      deliveryCount: w.deliveryCount,
      avgScore: Math.round(w.totalScore / w.deliveryCount),
      photoRate: Math.round((w.totalPhotos / w.deliveryCount) * 10) / 10,
      signatureRate: Math.round((w.signaturesCount / w.deliveryCount) * 100),
      tempComplianceRate: Math.round((w.tempCompliantCount / w.deliveryCount) * 100),
      receiverNameRate: Math.round((w.receiverNameCount / w.deliveryCount) * 100)
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredConsignments]);
  
  // Calculate driver performance data
  const driverPerformance = useMemo(() => {
    const driverMap = new Map<string, {
      driver: string;
      deliveryCount: number;
      totalScore: number;
      totalPhotos: number;
      receiverNameCount: number;
      tempCompliantCount: number;
    }>();
    
    filteredConsignments.forEach((c: ConsignmentWithPhotoCount) => {
      const driverRaw = c.driverName || "Unknown Driver";
      const driver = formatDriverName(driverRaw) || "Unknown Driver";
      const metrics = calculatePODScore(c, c.actualPhotoCount);
      
      if (!driverMap.has(driver)) {
        driverMap.set(driver, {
          driver,
          deliveryCount: 0,
          totalScore: 0,
          totalPhotos: 0,
          receiverNameCount: 0,
          tempCompliantCount: 0
        });
      }
      
      const data = driverMap.get(driver)!;
      data.deliveryCount++;
      data.totalScore += metrics.qualityScore;
      data.totalPhotos += metrics.photoCount;
      if (metrics.hasReceiverName) data.receiverNameCount++;
      if (metrics.temperatureCompliant) data.tempCompliantCount++;
    });
    
    return Array.from(driverMap.values()).map(d => ({
      driver: d.driver,
      deliveryCount: d.deliveryCount,
      avgScore: Math.round(d.totalScore / d.deliveryCount),
      photoRate: Math.round((d.totalPhotos / d.deliveryCount) * 10) / 10,
      receiverNameRate: Math.round((d.receiverNameCount / d.deliveryCount) * 100),
      tempComplianceRate: Math.round((d.tempCompliantCount / d.deliveryCount) * 100)
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredConsignments]);
  
  // Generate warehouse-specific insights
  const warehouseInsights = useMemo(() => {
    return warehouseComparison.map(w => {
      const issues: string[] = [];
      
      if (w.photoRate < 2) {
        issues.push(`Low photo coverage (${w.photoRate} avg photos/delivery)`);
      }
      if (w.receiverNameRate < 80) {
        issues.push(`Receiver names missing in ${100 - w.receiverNameRate}% of deliveries`);
      }
      if (w.tempComplianceRate < 85) {
        issues.push(`Temperature compliance at ${w.tempComplianceRate}%`);
      }
      
      return {
        warehouse: w.warehouse,
        avgScore: w.avgScore,
        issues: issues.length > 0 ? issues : ['All metrics performing well']
      };
    });
  }, [warehouseComparison]);
  
  // Load thumbnails for a consignment (for display in table)
  const loadThumbnails = async (consignment: Consignment, retryCount = 0) => {
    const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
    if (!trackingLink) {
      // Mark as loaded since there's nothing to load
      setLoadedThumbnails(prev => new Set(prev).add(consignment.id));
      return;
    }
    
    try {
      // Use priority=low for background thumbnail loading
      const response = await apiRequest('GET', `/api/consignments/${consignment.id}/photos?priority=low`);
      const data = await response.json();
      
      if (data.success && data.photos && data.photos.length > 0) {
        // Success - save thumbnails and mark as loaded
        setPhotoThumbnails(prev => new Map(prev).set(consignment.id, data.photos.slice(0, 4))); // Show max 4 thumbnails
        setLoadedThumbnails(prev => new Set(prev).add(consignment.id));
      } else if (data.status === 'preparing' && retryCount < 3) {
        // Photos are being prepared, retry with exponential backoff
        const delay = Math.min(2000 * Math.pow(1.5, retryCount), 8000);
        setTimeout(() => {
          loadThumbnails(consignment, retryCount + 1);
        }, delay);
      } else {
        // Either max retries reached or another error - mark as loaded to prevent infinite retries
        setLoadedThumbnails(prev => new Set(prev).add(consignment.id));
        // Only log unexpected errors (not "no tracking link" or "no photos found")
        if (data.error && !data.error.includes?.('tracking link') && !data.error.includes?.('No photos found')) {
          console.error('Failed to load thumbnails for consignment', consignment.id, data.error);
        }
      }
    } catch (error) {
      // Only log actual network/unexpected errors, not expected API responses
      if (error instanceof Error && !error.message.includes('404')) {
        console.error('Failed to load thumbnails for consignment', consignment.id, error);
      }
      // Mark as loaded to prevent infinite retries on network errors
      setLoadedThumbnails(prev => new Set(prev).add(consignment.id));
    }
  };

  // Load photos for a consignment using thumbnail-first strategy
  const loadPhotos = async (consignment: Consignment) => {
    const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
    if (!trackingLink) {
      toast({
        title: "No tracking link",
        description: "This consignment doesn't have a tracking link for photos",
        variant: "destructive"
      });
      return;
    }
    
    setLoadingPhotos(consignment.id);
    const currentRetries = photoLoadRetries.get(consignment.id) || 0;
    
    try {
      // Step 1: Get thumbnails first (fast)
      const thumbnailResponse = await apiRequest('GET', `/api/consignments/${consignment.id}/photos`);
      const thumbnailData = await thumbnailResponse.json();
      
      if (!thumbnailData.success) {
        toast({
          title: "Failed to load photos",
          description: thumbnailData.error || "An error occurred while loading photos",
          variant: "destructive"
        });
        return;
      }
      
      // Check if thumbnails are being prepared
      if (thumbnailData.status === 'preparing' && currentRetries < 5) {
        setPhotoLoadRetries(new Map(photoLoadRetries.set(consignment.id, currentRetries + 1)));
        
        if (currentRetries === 0) {
          toast({
            title: "Loading photos...",
            description: "Photos are being processed, this may take a moment",
          });
        }
        
        const delay = Math.min(1000 * Math.pow(1.5, currentRetries), 5000);
        setTimeout(() => loadPhotos(consignment), delay);
        return;
      }
      
      // Reset retry count
      setPhotoLoadRetries(new Map(photoLoadRetries.set(consignment.id, 0)));
      
      if ((!thumbnailData.photos || thumbnailData.photos.length === 0) && 
          (!thumbnailData.signatures || thumbnailData.signatures.length === 0)) {
        toast({
          title: "No photos available",
          description: "No photos found for this consignment. They may not have been uploaded yet.",
          variant: "destructive"
        });
        return;
      }
      
      // Show modal with thumbnails immediately
      const currentConsignmentNo = consignment.consignmentNo || consignment.orderNumberRef || "";
      setPhotoModal({
        isOpen: true,
        photos: thumbnailData.photos || [],
        signatures: thumbnailData.signatures || [],
        consignmentNo: currentConsignmentNo
      });
      
      // Step 2: Trigger full-res loading in background
      apiRequest('GET', `/api/consignments/${consignment.id}/photos/full-res`)
        .then(async fullResResponse => {
          const fullResData = await fullResResponse.json();
          if (fullResData.success && (fullResData.photos?.length > 0 || fullResData.signatures?.length > 0)) {
            // Only update if this consignment is still the active modal
            setPhotoModal(prev => {
              // Verify this full-res response matches the currently open modal
              if (prev.consignmentNo === currentConsignmentNo && prev.isOpen) {
                return {
                  ...prev,
                  photos: fullResData.photos || prev.photos,
                  signatures: fullResData.signatures || prev.signatures
                };
              }
              // Stale response, ignore it
              return prev;
            });
          }
        })
        .catch(error => {
          console.log('Full-res loading skipped or failed:', error);
          // Silent fail - thumbnails are already displayed
        });
        
    } catch (error) {
      console.error('Photo loading error:', error);
      toast({
        title: "Error",
        description: "Failed to load photos. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingPhotos(null);
    }
  };
  
  // Sync data mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/axylog/sync', {
        syncFromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        syncToDate: new Date().toISOString().split('T')[0]
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consignments/stats"] });
      toast({
        title: "Sync complete",
        description: "Data has been refreshed from Axylog",
      });
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to sync data from Axylog",
        variant: "destructive"
      });
    }
  });
  
  const resetFilters = () => {
    setFilters({
      shipper: "all",
      warehouse: "all",
      driver: "all",
      fromDate: "",
      toDate: "",
      qualityTier: "all"
    });
    setSearchTerm("");
    setDataLoaded(false); // Reset data load state
  };
  
  // Handler to update filters and reset data loaded state
  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters({...filters, [key]: value});
    setDataLoaded(false); // Reset when filters change
  };
  
  // Automatically load thumbnails for visible consignments
  useEffect(() => {
    if (!paginatedConsignments || paginatedConsignments.length === 0) return;
    
    // Load thumbnails for each visible consignment that hasn't been loaded yet
    paginatedConsignments.forEach(async (consignment) => {
      // Skip if we've already tried to load thumbnails for this consignment
      if (loadedThumbnails.has(consignment.id)) return;
      
      // Skip if no photo count
      const photoCount = (consignment as ConsignmentWithPhotoCount).actualPhotoCount;
      if (!photoCount || photoCount === 0) {
        // Mark as loaded for consignments with no photos
        setLoadedThumbnails(prev => new Set(prev).add(consignment.id));
        return;
      }
      
      // Load thumbnails in the background (loadThumbnails will mark as loaded when complete)
      await loadThumbnails(consignment);
    });
  }, [paginatedConsignments]);
  
  const activeFilterCount = [
    filters.shipper !== "all",
    filters.warehouse !== "all",
    filters.driver !== "all",
    filters.fromDate !== "",
    filters.toDate !== "",
    filters.qualityTier !== "all"
  ].filter(Boolean).length;
  
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 shadow-sm z-10 sticky top-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img 
                src={chillLogo} 
                alt="CHILL" 
                className="h-10"
              />
              <span className="text-gray-600 text-sm font-medium font-montserrat">POD Quality Dashboard</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center text-gray-600 text-sm mr-4 bg-gray-100 px-3 py-1 rounded-full">
                <span className="font-montserrat">{user?.email}</span>
              </div>

              <Button 
                variant="outline"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </header>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm z-10 sticky top-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-4">
            <img 
              src={chillLogo} 
              alt="CHILL" 
              className="h-8 sm:h-10"
            />
            <span className="text-gray-600 text-xs sm:text-sm font-medium font-montserrat hidden sm:block">POD Quality Dashboard</span>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="hidden lg:flex items-center text-gray-600 text-sm mr-4 bg-gray-100 px-3 py-1 rounded-full">
              <span className="font-montserrat">{user?.email}</span>
            </div>

            <Button 
              variant="outline"
              onClick={logout}
              size="sm"
              className="text-xs sm:text-sm"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>
      
      {/* FILTERS SECTION - TOP PRIORITY */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Filter Consignments</h2>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                  {activeFilterCount} active
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              {activeFilterCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetFilters}
                  data-testid="button-reset-filters"
                  className="text-xs sm:text-sm"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Clear All
                </Button>
              )}
              <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} size="sm" variant="outline" className="text-xs sm:text-sm">
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Sync
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                From Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => updateFilter("fromDate", e.target.value)}
                className="w-full"
                data-testid="input-date-from"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                To Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={filters.toDate}
                onChange={(e) => updateFilter("toDate", e.target.value)}
                className="w-full"
                data-testid="input-date-to"
              />
            </div>

            {/* Shipper */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Shipper</label>
              <Select value={filters.shipper} onValueChange={(val) => updateFilter("shipper", val)}>
                <SelectTrigger data-testid="select-shipper">
                  <SelectValue placeholder="All Shippers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shippers</SelectItem>
                  {uniqueShippers.map((shipper) => (
                    <SelectItem key={shipper} value={shipper}>{shipper}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Warehouse</label>
              <Select value={filters.warehouse} onValueChange={(val) => updateFilter("warehouse", val)}>
                <SelectTrigger data-testid="select-warehouse">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {uniqueWarehouses.map((warehouse) => (
                    <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Driver */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Driver</label>
              <Select value={filters.driver} onValueChange={(val) => updateFilter("driver", val)}>
                <SelectTrigger data-testid="select-driver">
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {driversGrouped.map((group) => (
                    <div key={group.warehouse}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                        {group.warehouse}
                      </div>
                      {group.drivers.map((driver: string) => (
                        <SelectItem key={driver} value={driver} className="pl-6">
                          {formatDriverName(driver)}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Quality Filter Badge */}
          {filters.qualityTier !== "all" && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-600">Quality Filter:</span>
              <Badge 
                variant="secondary" 
                className={`cursor-pointer ${
                  filters.qualityTier === "Excellent" ? "bg-green-100 text-green-700 border-green-300" :
                  filters.qualityTier === "Good" ? "bg-blue-100 text-blue-700 border-blue-300" :
                  filters.qualityTier === "Fair" ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                  "bg-red-100 text-red-700 border-red-300"
                }`}
                onClick={() => setFilters({ ...filters, qualityTier: "all" })}
              >
                {filters.qualityTier}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            </div>
          )}

          {/* Search and Load Button */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by consignment, order, driver, customer, city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            <Button
              onClick={() => {
                if (!hasFiltersApplied) {
                  toast({
                    title: "Please select a date range",
                    description: "Select at least a 'From Date' or 'To Date' to load data",
                    variant: "destructive"
                  });
                  return;
                }
                setDataLoaded(true);
              }}
              className="gradient-accent text-white h-10 px-8 font-semibold"
              disabled={!hasFiltersApplied || dataLoaded}
              data-testid="button-load-data"
            >
              {dataLoaded ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Data Loaded
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Load Data
                </>
              )}
            </Button>

            <Button onClick={() => refetch()} variant="outline" disabled={!dataLoaded || !hasFiltersApplied} className="h-10">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Status Message */}
          {!hasFiltersApplied && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Please select at least a date range to load consignments
              </p>
            </div>
          )}
          {hasFiltersApplied && !dataLoaded && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Filters selected. Click "Load Data" to fetch consignments
              </p>
            </div>
          )}
          {dataLoaded && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Showing {sortedConsignments.length} of {consignments.length} deliveries
                {activeFilterCount > 0 && <span className="ml-1">({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)</span>}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Average Score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgScore}</div>
            <p className="text-xs text-gray-500">Avg quality score (100 = perfect)</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photo Coverage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgPhotoCount}</div>
            <p className="text-xs text-gray-500">Avg photos per delivery</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              Receiver Name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.signatureRate}%</div>
            <p className="text-xs text-gray-500">Receiver name recorded</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Temperature
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tempComplianceRate}%</div>
            <p className="text-xs text-gray-500">Compliance rate</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Quality Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Distribution</CardTitle>
          <CardDescription>Breakdown by quality tier (click to filter)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <button
              onClick={() => setFilters({ ...filters, qualityTier: filters.qualityTier === "Excellent" ? "all" : "Excellent" })}
              className={`text-center p-3 sm:p-4 rounded-lg transition-all ${
                filters.qualityTier === "Excellent" 
                  ? "bg-green-100 border-2 border-green-500 shadow-md" 
                  : "bg-green-50 border border-green-200 hover:bg-green-100"
              }`}
              data-testid="filter-excellent"
            >
              <div className="text-2xl sm:text-3xl font-bold text-green-700 mb-1">{stats.goldCount}</div>
              <div className="text-xs sm:text-sm font-medium text-green-800">Excellent</div>
              <div className="text-[10px] sm:text-xs text-green-600">90-100</div>
            </button>
            <button
              onClick={() => setFilters({ ...filters, qualityTier: filters.qualityTier === "Good" ? "all" : "Good" })}
              className={`text-center p-3 sm:p-4 rounded-lg transition-all ${
                filters.qualityTier === "Good" 
                  ? "bg-blue-100 border-2 border-blue-500 shadow-md" 
                  : "bg-blue-50 border border-blue-200 hover:bg-blue-100"
              }`}
              data-testid="filter-good"
            >
              <div className="text-2xl sm:text-3xl font-bold text-blue-700 mb-1">{stats.silverCount}</div>
              <div className="text-xs sm:text-sm font-medium text-blue-800">Good</div>
              <div className="text-[10px] sm:text-xs text-blue-600">75-89</div>
            </button>
            <button
              onClick={() => setFilters({ ...filters, qualityTier: filters.qualityTier === "Fair" ? "all" : "Fair" })}
              className={`text-center p-3 sm:p-4 rounded-lg transition-all ${
                filters.qualityTier === "Fair" 
                  ? "bg-yellow-100 border-2 border-yellow-500 shadow-md" 
                  : "bg-yellow-50 border border-yellow-200 hover:bg-yellow-100"
              }`}
              data-testid="filter-fair"
            >
              <div className="text-2xl sm:text-3xl font-bold text-yellow-700 mb-1">{stats.bronzeCount}</div>
              <div className="text-xs sm:text-sm font-medium text-yellow-800">Fair</div>
              <div className="text-[10px] sm:text-xs text-yellow-600">60-74</div>
            </button>
            <button
              onClick={() => setFilters({ ...filters, qualityTier: filters.qualityTier === "Poor" ? "all" : "Poor" })}
              className={`text-center p-3 sm:p-4 rounded-lg transition-all ${
                filters.qualityTier === "Poor" 
                  ? "bg-red-100 border-2 border-red-500 shadow-md" 
                  : "bg-red-50 border border-red-200 hover:bg-red-100"
              }`}
              data-testid="filter-poor"
            >
              <div className="text-2xl sm:text-3xl font-bold text-red-700 mb-1">{stats.needsImprovementCount}</div>
              <div className="text-xs sm:text-sm font-medium text-red-800">Poor</div>
              <div className="text-[10px] sm:text-xs text-red-600">&lt;60</div>
            </button>
          </div>
        </CardContent>
      </Card>
      
      {/* Warehouse Comparison */}
      {warehouseComparison.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Warehouse Performance Comparison
            </CardTitle>
            <CardDescription>Compare POD quality metrics across warehouses {activeFilterCount > 0 && "(filtered)"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Bar Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={warehouseComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="warehouse" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgScore" fill="#3b82f6" name="Avg Score" />
                    <Bar dataKey="signatureRate" fill="#10b981" name="Receiver Name (%)" />
                    <Bar dataKey="tempComplianceRate" fill="#f59e0b" name="Temp Compliance (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-700">Warehouse</th>
                      <th className="text-center p-3 font-medium text-gray-700">Deliveries</th>
                      <th className="text-center p-3 font-medium text-gray-700">Avg Score</th>
                      <th className="text-center p-3 font-medium text-gray-700">Photos/Delivery</th>
                      <th className="text-center p-3 font-medium text-gray-700">Receiver Name %</th>
                      <th className="text-center p-3 font-medium text-gray-700">Temp Compliance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseComparison.map((w, idx) => (
                      <tr key={w.warehouse} className="border-b hover:bg-gray-50/50">
                        <td className="p-3 font-medium text-gray-900">{w.warehouse}</td>
                        <td className="p-3 text-center text-gray-700">{w.deliveryCount}</td>
                        <td className="p-3 text-center">
                          <span className={`font-semibold ${
                            w.avgScore >= 90 ? 'text-green-600' :
                            w.avgScore >= 75 ? 'text-blue-600' :
                            w.avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {w.avgScore}
                          </span>
                        </td>
                        <td className="p-3 text-center text-gray-700">{w.photoRate}</td>
                        <td className="p-3 text-center text-gray-700">{w.signatureRate}%</td>
                        <td className="p-3 text-center text-gray-700">{w.tempComplianceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Driver Leaderboard */}
      {driverPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Driver Leaderboard
            </CardTitle>
            <CardDescription>Top performing drivers by POD quality score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {driverPerformance.slice(0, 10).map((driver, index) => {
                const isTop3 = index < 3;
                const medalIcon = index === 0 ? <Crown className="h-5 w-5 text-yellow-500" /> :
                                 index === 1 ? <Medal className="h-5 w-5 text-gray-400" /> :
                                 index === 2 ? <Medal className="h-5 w-5 text-amber-600" /> :
                                 <Star className="h-4 w-4 text-gray-400" />;
                
                const bgColor = index === 0 ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200" :
                               index === 1 ? "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300" :
                               index === 2 ? "bg-gradient-to-r from-orange-50 to-amber-50 border-amber-300" :
                               "bg-white border-gray-200";
                
                return (
                  <div 
                    key={driver.driver}
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border-2 transition-all hover:shadow-md ${bgColor}`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 font-bold text-gray-600">
                      {isTop3 ? medalIcon : <span className="text-sm sm:text-base">#{index + 1}</span>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">{driver.driver}</div>
                      <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {driver.deliveryCount} deliveries
                        </span>
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {driver.photoRate} photos/del
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                      <div className={`text-xl sm:text-2xl font-bold ${
                        driver.avgScore >= 90 ? 'text-green-600' :
                        driver.avgScore >= 75 ? 'text-blue-600' :
                        driver.avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {driver.avgScore}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500">score</div>
                    </div>
                    
                    {isTop3 && (
                      <div className="hidden sm:flex flex-col gap-1">
                        {driver.receiverNameRate >= 90 && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                            <Award className="h-3 w-3 mr-1" />
                            Receiver Pro
                          </Badge>
                        )}
                        {driver.tempComplianceRate >= 95 && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                            <Thermometer className="h-3 w-3 mr-1" />
                            Temp Master
                          </Badge>
                        )}
                        {driver.photoRate >= 3 && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                            <Camera className="h-3 w-3 mr-1" />
                            Photo Expert
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Warehouse Leaderboard */}
      {warehouseComparison.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-500" />
              Warehouse Rankings
            </CardTitle>
            <CardDescription>Performance rankings by warehouse/depot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {warehouseComparison.slice(0, 6).map((warehouse, index) => {
                const isTop3 = index < 3;
                const rankColor = index === 0 ? "text-yellow-600" :
                                 index === 1 ? "text-gray-500" :
                                 index === 2 ? "text-amber-600" : "text-gray-400";
                
                const bgGradient = index === 0 ? "from-yellow-50 to-amber-50" :
                                  index === 1 ? "from-gray-50 to-slate-50" :
                                  index === 2 ? "from-orange-50 to-amber-50" : "from-white to-gray-50";
                
                return (
                  <div
                    key={warehouse.warehouse}
                    className={`p-4 rounded-lg border-2 bg-gradient-to-br ${bgGradient} ${
                      isTop3 ? 'border-gray-300' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">{warehouse.warehouse}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{warehouse.deliveryCount} deliveries</div>
                      </div>
                      <div className={`text-2xl font-bold ${rankColor}`}>
                        #{index + 1}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`text-3xl font-bold ${
                        warehouse.avgScore >= 90 ? 'text-green-600' :
                        warehouse.avgScore >= 75 ? 'text-blue-600' :
                        warehouse.avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {warehouse.avgScore}
                      </div>
                      <div className="text-xs text-gray-500">avg score</div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {warehouse.photoRate >= 3 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px]">
                          <Camera className="h-2.5 w-2.5 mr-0.5" />
                          Photos
                        </Badge>
                      )}
                      {warehouse.signatureRate >= 85 && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[10px]">
                          <FileSignature className="h-2.5 w-2.5 mr-0.5" />
                          Names
                        </Badge>
                      )}
                      {warehouse.tempComplianceRate >= 90 && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">
                          <Thermometer className="h-2.5 w-2.5 mr-0.5" />
                          Temp
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Consignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Consignments</CardTitle>
          <CardDescription>
            Detailed POD quality scores for {sortedConsignments.length} deliveries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dataLoaded && (
            <div className="space-y-3">
              {paginatedConsignments.map((consignment: ConsignmentWithPhotoCount) => {
              const metrics = calculatePODScore(consignment, consignment.actualPhotoCount);
              const tier = getQualityTier(metrics.qualityScore);
              const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
              const actualTemp = getActualTemperature(consignment);
              
              // Parse expected temperature from document_note
              const tempRange = parseRequiredTemperature(consignment.documentNote);
              const expectedTemp = tempRange ? `${tempRange.min}°C to ${tempRange.max}°C` : 
                                   (consignment.documentNote?.toLowerCase().includes('dry') ? 'Dry' : null);
              
              const thumbnail = photoThumbnails.get(consignment.id);
              
              return (
                <Card key={consignment.id} className="hover:shadow-md transition-shadow" data-testid={`card-consignment-${consignment.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Main Information */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Package className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold text-gray-900" data-testid={`text-order-${consignment.id}`}>
                                {consignment.orderNumberRef || consignment.consignmentNo || '-'}
                              </span>
                              {consignment.syncedAt && (
                                <span className="text-xs text-gray-400 ml-2" title={new Date(consignment.syncedAt).toLocaleString()}>
                                  synced {(() => {
                                    const now = Date.now();
                                    const synced = new Date(consignment.syncedAt).getTime();
                                    const diffMs = now - synced;
                                    const diffMins = Math.floor(diffMs / 60000);
                                    const diffHours = Math.floor(diffMs / 3600000);
                                    if (diffMins < 1) return 'just now';
                                    if (diffMins < 60) return `${diffMins}m ago`;
                                    if (diffHours < 24) return `${diffHours}h ago`;
                                    return new Date(consignment.syncedAt).toLocaleDateString();
                                  })()}
                                </span>
                              )}
                            </div>
                            {consignment.consignmentNo && consignment.consignmentNo !== consignment.orderNumberRef && (
                              <div className="text-xs text-gray-500 ml-6">{consignment.consignmentNo}</div>
                            )}
                          </div>
                          <div className={`px-3 py-1 rounded-full font-semibold text-lg ${
                            metrics.qualityScore > 100
                              ? "bg-purple-100 text-purple-800"
                              : metrics.qualityScore >= 90 
                              ? "bg-green-100 text-green-800"
                              : metrics.qualityScore >= 75
                              ? "bg-blue-100 text-blue-800"
                              : metrics.qualityScore >= 60
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`} data-testid={`badge-score-${consignment.id}`}>
                            {metrics.qualityScore}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Customer</div>
                            <div className="font-medium text-gray-900">{consignment.shipToCompanyName || '-'}</div>
                            <div className="text-xs text-gray-500">{consignment.shipToCity || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Warehouse / Depot</div>
                            <div className="font-medium text-gray-900">{consignment.warehouseCompanyName || '-'}</div>
                            <div className="text-xs text-gray-500">
                              <Users className="h-3 w-3 inline mr-1" />
                              {formatDriverName(consignment.driverName) || "No driver assigned"}
                            </div>
                          </div>
                        </div>
                        
                        {/* POD Quality Metrics */}
                        <div className="flex items-center gap-4 pt-3 border-t">
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded ${metrics.photoCount >= 3 ? 'bg-green-50' : metrics.photoCount > 0 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                              <Camera className={`h-4 w-4 ${metrics.photoCount >= 3 ? 'text-green-600' : metrics.photoCount > 0 ? 'text-yellow-600' : 'text-red-600'}`} data-testid={`icon-photos-${consignment.id}`} />
                              <span className={`text-sm font-medium ${metrics.photoCount >= 3 ? 'text-green-700' : metrics.photoCount > 0 ? 'text-yellow-700' : 'text-red-700'}`} data-testid={`text-photo-count-${consignment.id}`}>
                                {metrics.photoCount} {metrics.photoCount === 1 ? 'photo' : 'photos'}
                              </span>
                            </div>
                          </div>
                          
                          <div className={`flex items-center gap-1 px-2 py-1 rounded ${metrics.hasReceiverName ? 'bg-green-50' : 'bg-red-50'}`}>
                            <FileSignature className={`h-4 w-4 ${metrics.hasReceiverName ? 'text-green-600' : 'text-red-600'}`} />
                            <span className={`text-sm font-medium ${metrics.hasReceiverName ? 'text-green-700' : 'text-red-700'}`}>
                              {metrics.hasReceiverName ? 'Receiver name ✓' : 'No receiver name'}
                            </span>
                          </div>
                          
                          {(consignment.documentNote || actualTemp) && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded ${metrics.temperatureCompliant ? 'bg-green-50' : 'bg-red-50'}`}>
                              <Thermometer className={`h-4 w-4 ${metrics.temperatureCompliant ? 'text-green-600' : 'text-red-600'}`} />
                              <div className={`text-xs font-medium ${metrics.temperatureCompliant ? 'text-green-700' : 'text-red-700'}`}>
                                <div className="flex items-center gap-1">
                                  <span className="opacity-70">Expected:</span>
                                  <span>{expectedTemp || '-'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="opacity-70">Recorded:</span>
                                  <span>{actualTemp ? `${actualTemp}°C` : '-'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="ml-auto flex gap-2">
                            {trackingLink && (
                              <a
                                href={trackingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button size="sm" variant="outline" data-testid={`link-tracking-${consignment.id}`}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Track
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Photo Thumbnails Section */}
                      {thumbnail && Array.isArray(thumbnail) && thumbnail.length > 0 && (
                        <div className="border-t pt-3">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-2">
                              {thumbnail.map((photo, index) => (
                                <div 
                                  key={index}
                                  className="relative group cursor-pointer"
                                  onClick={() => loadPhotos(consignment)}
                                >
                                  <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-all hover:scale-105">
                                    <img 
                                      src={`/api/image?src=${encodeURIComponent(photo)}&w=128&h=128&q=75&fmt=webp`} 
                                      alt={`Photo ${index + 1}`} 
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        // Fallback to original URL if proxy fails
                                        target.src = photo;
                                      }}
                                    />
                                  </div>
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-opacity flex items-center justify-center">
                                    <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                              ))}
                            </div>
                            {metrics.photoCount > 4 && (
                              <span className="text-sm text-gray-500 ml-2">
                                +{metrics.photoCount - 4} more
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => loadPhotos(consignment)}
                              className="ml-auto text-xs"
                            >
                              View all
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {filteredConsignments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No consignments found matching your filters
              </div>
            )}
          </div>
          )}
          
          {/* Pagination Controls */}
          {dataLoaded && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredConsignments.length)} of {filteredConsignments.length} consignments
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        size="sm"
                        variant={currentPage === pageNum ? "default" : "outline"}
                        onClick={() => setCurrentPage(pageNum)}
                        data-testid={`button-page-${pageNum}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Photo Modal */}
      <PhotoModal
        isOpen={photoModal.isOpen}
        onClose={() => setPhotoModal({ ...photoModal, isOpen: false })}
        photos={photoModal.photos}
        signatures={photoModal.signatures}
        consignmentNo={photoModal.consignmentNo}
      />
      </main>
    </div>
  );
}