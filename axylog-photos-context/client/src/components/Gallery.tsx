import { useState, useEffect, useMemo } from 'react';
import { Thumb } from './Thumb';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, X, Camera } from 'lucide-react';

interface PhotoItem {
  thumb: string;
  full: string;
  filename: string;
  extension: string;
  tag?: string;
}

interface ManifestEntry {
  photoCount: number;
  consignmentNo: string;
  items: PhotoItem[];
}

interface Manifest {
  [key: string]: ManifestEntry;
}

interface GalleryProps {
  deliveryKey: string;
  onPhotoClick?: (index: number) => void;
  className?: string;
}

export function Gallery({ deliveryKey, onPhotoClick, className = '' }: GalleryProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [fullImageLoading, setFullImageLoading] = useState(false);

  const deliveryData = useMemo(() => {
    if (!manifest || !deliveryKey) return null;
    return manifest[deliveryKey] || null;
  }, [manifest, deliveryKey]);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        setLoading(true);
        const response = await fetch('/manifest.json');
        
        if (!response.ok) {
          throw new Error('Manifest not found');
        }

        const data = await response.json();
        setManifest(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load manifest:', err);
        setError('Failed to load photo manifest');
      } finally {
        setLoading(false);
      }
    };

    fetchManifest();
  }, []);

  const openLightbox = (index: number) => {
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
    setFullImageLoading(true);
    onPhotoClick?.(index);
  };

  const nextPhoto = () => {
    if (!deliveryData) return;
    setCurrentPhotoIndex((prev) => (prev + 1) % deliveryData.items.length);
    setFullImageLoading(true);
  };

  const prevPhoto = () => {
    if (!deliveryData) return;
    setCurrentPhotoIndex((prev) => 
      (prev - 1 + deliveryData.items.length) % deliveryData.items.length
    );
    setFullImageLoading(true);
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`} data-testid="gallery-loading">
        <Camera className="h-4 w-4 animate-pulse" />
        <span className="text-sm text-gray-500">Loading photos...</span>
      </div>
    );
  }

  if (error || !deliveryData) {
    return (
      <div className={`flex items-center gap-2 text-red-600 ${className}`} data-testid="gallery-error">
        <Camera className="h-4 w-4" />
        <span className="text-sm">{error || 'No photos found'}</span>
      </div>
    );
  }

  const currentPhoto = deliveryData.items[currentPhotoIndex];

  return (
    <>
      <div className={className} data-testid="gallery-container">
        {/* Photo Count Badge */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" data-testid="gallery-photo-count">
            <Camera className="h-3 w-3 mr-1" />
            {deliveryData.photoCount} {deliveryData.photoCount === 1 ? 'Photo' : 'Photos'}
          </Badge>
          <span className="text-sm text-gray-500">{deliveryData.consignmentNo}</span>
        </div>

        {/* Thumbnail Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {deliveryData.items.map((item, index) => (
            <Thumb
              key={`${item.filename}-${index}`}
              thumbSrc={item.thumb}
              alt={`${deliveryData.consignmentNo} photo ${index + 1}`}
              onClick={() => openLightbox(index)}
              className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
            />
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-7xl w-full h-[95vh] p-0 bg-black border-none">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-6">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-white/10 backdrop-blur-sm">
                  Photo {currentPhotoIndex + 1} of {deliveryData.items.length}
                </Badge>
                <Badge variant="secondary" className="bg-white/10 backdrop-blur-sm">
                  {deliveryData.consignmentNo}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLightboxOpen(false)}
                className="text-white hover:bg-white/20"
                data-testid="button-close-lightbox"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Image */}
          <div className="relative w-full h-full flex items-center justify-center p-16">
            {fullImageLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <img
              src={currentPhoto.full}
              alt={`${deliveryData.consignmentNo} photo ${currentPhotoIndex + 1}`}
              className="max-w-full max-h-full object-contain"
              onLoad={() => setFullImageLoading(false)}
              onError={() => setFullImageLoading(false)}
              data-testid="lightbox-image"
            />
          </div>

          {/* Navigation */}
          {deliveryData.items.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={prevPhoto}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                data-testid="button-prev-photo"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextPhoto}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                data-testid="button-next-photo"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white/80 text-sm">
            <div className="flex items-center justify-center gap-4">
              <span>Use ← → keys to navigate</span>
              <span>•</span>
              <span>ESC to close</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
