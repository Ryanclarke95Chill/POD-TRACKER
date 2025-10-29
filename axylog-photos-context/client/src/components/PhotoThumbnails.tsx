import { useState, useEffect } from "react";
import { Camera, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PhotoThumbnailsProps {
  trackingLink: string | null;
  photoCount: number;
  consignmentId: number;
}

export function PhotoThumbnails({ trackingLink, photoCount, consignmentId }: PhotoThumbnailsProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    if (!trackingLink || photoCount === 0) return;
    
    const loadPhotos = async () => {
      setLoading(true);
      setError(false);
      
      try {
        const response = await apiRequest('GET', `/api/pod-photos?trackingToken=${encodeURIComponent(trackingLink)}&priority=low`);
        const data = await response.json();
        
        if (data.success && data.photos && data.photos.length > 0) {
          setPhotos(data.photos.slice(0, 3)); // Get first 3 photos for thumbnails
        } else if (data.status === 'preparing') {
          // Photos are being prepared, retry after a delay
          setTimeout(loadPhotos, 3000);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Failed to load photo thumbnails:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    
    loadPhotos();
  }, [trackingLink, photoCount]);
  
  if (photoCount === 0) {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <Camera className="h-4 w-4" />
        <span className="text-sm">0</span>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }
  
  if (error || photos.length === 0) {
    return (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded">
          <Camera className="h-4 w-4" />
          <span className="text-sm font-medium">{photoCount}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-1">
        {photos.slice(0, 3).map((photo, idx) => (
          <img
            key={idx}
            src={`/api/image?src=${encodeURIComponent(photo)}&w=32&h=32&q=60&fmt=webp`}
            alt={`Thumbnail ${idx + 1}`}
            className="w-8 h-8 object-cover rounded border border-gray-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ))}
      </div>
      {photoCount > 3 && (
        <span className="text-xs text-gray-600 ml-1">+{photoCount - 3}</span>
      )}
    </div>
  );
}