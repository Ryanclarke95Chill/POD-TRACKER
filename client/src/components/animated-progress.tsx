import { useEffect, useState } from "react";
import { Consignment } from "@shared/schema";

interface AnimatedProgressProps {
  consignment: Consignment;
  className?: string;
}

export default function AnimatedProgress({ consignment, className = "" }: AnimatedProgressProps) {
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Calculate progress based on status
  const getProgressPercentage = (status: string): number => {
    switch (status) {
      case "Awaiting Pickup":
        return 0;
      case "In Transit":
        return 65;
      case "Out for Delivery":
        return 90;
      case "Delivered":
        return 100;
      default:
        return 0;
    }
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case "Awaiting Pickup":
        return "#f59e0b"; // amber
      case "In Transit":
        return "#3b82f6"; // blue
      case "Out for Delivery":
        return "#8b5cf6"; // purple
      case "Delivered":
        return "#10b981"; // green
      default:
        return "#6b7280"; // gray
    }
  };

  // Animate progress on mount and status change
  useEffect(() => {
    setIsAnimating(true);
    const targetProgress = getProgressPercentage(consignment.status);
    
    const timer = setTimeout(() => {
      setProgress(targetProgress);
    }, 100);

    const endAnimationTimer = setTimeout(() => {
      setIsAnimating(false);
    }, 1500);

    return () => {
      clearTimeout(timer);
      clearTimeout(endAnimationTimer);
    };
  }, [consignment.status]);

  const statusColor = getStatusColor(consignment.status);

  return (
    <div className={`relative ${className}`}>
      {/* Progress Track */}
      <div className="relative h-3 bg-neutral-200 rounded-full overflow-hidden">
        {/* Animated Progress Bar */}
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
          style={{
            width: `${progress}%`,
            backgroundColor: statusColor,
          }}
        >
          {/* Shimmer Effect */}
          {isAnimating && progress > 0 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          )}
          
          {/* Pulse Effect for Active Status */}
          {(consignment.status === "In Transit" || consignment.status === "Out for Delivery") && (
            <div 
              className="absolute inset-0 animate-pulse"
              style={{ backgroundColor: statusColor }}
            />
          )}
        </div>

        {/* Progress Markers */}
        <div className="absolute inset-0 flex justify-between items-center px-1">
          {/* Pickup Marker */}
          <div className={`w-4 h-4 rounded-full border-2 bg-white transition-all duration-500 ${
            progress >= 0 ? 'border-current scale-110' : 'border-neutral-300'
          }`} style={{ borderColor: progress >= 0 ? statusColor : undefined }}>
            <div className="w-full h-full rounded-full" style={{ 
              backgroundColor: progress >= 0 ? statusColor : 'transparent' 
            }} />
          </div>

          {/* Transit Marker */}
          <div className={`w-4 h-4 rounded-full border-2 bg-white transition-all duration-700 ${
            progress >= 65 ? 'border-current scale-110' : 'border-neutral-300'
          }`} style={{ borderColor: progress >= 65 ? statusColor : undefined }}>
            {progress >= 65 && (
              <div className="w-full h-full rounded-full" style={{ backgroundColor: statusColor }} />
            )}
          </div>

          {/* Delivery Marker */}
          <div className={`w-4 h-4 rounded-full border-2 bg-white transition-all duration-1000 ${
            progress >= 100 ? 'border-current scale-110' : 'border-neutral-300'
          }`} style={{ borderColor: progress >= 100 ? statusColor : undefined }}>
            {progress >= 100 && (
              <div className="w-full h-full rounded-full flex items-center justify-center" style={{ backgroundColor: statusColor }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Labels */}
      <div className="flex justify-between mt-2 text-xs">
        <span className={`font-medium transition-colors duration-500 ${
          progress >= 0 ? 'text-neutral-800' : 'text-neutral-400'
        }`}>
          Pickup
        </span>
        <span className={`font-medium transition-colors duration-700 ${
          progress >= 65 ? 'text-neutral-800' : 'text-neutral-400'
        }`}>
          Transit
        </span>
        <span className={`font-medium transition-colors duration-1000 ${
          progress >= 100 ? 'text-neutral-800' : 'text-neutral-400'
        }`}>
          Delivered
        </span>
      </div>

      {/* Current Location Indicator */}
      {progress > 0 && progress < 100 && (
        <div className="mt-3 flex items-center">
          <div 
            className="w-2 h-2 rounded-full animate-pulse mr-2"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-xs text-neutral-600 font-medium">
            Current: {consignment.lastKnownLocation}
          </span>
        </div>
      )}
    </div>
  );
}