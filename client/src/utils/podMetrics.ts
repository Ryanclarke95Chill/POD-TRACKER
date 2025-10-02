import { Consignment, ScoreBreakdown } from "@shared/schema";

export interface PODMetrics {
  photoCount: number;
  hasSignature: boolean;
  hasReceiverName: boolean;
  temperatureCompliant: boolean;
  hasTrackingLink: boolean;
  deliveryTime: string | null;
  qualityScore: number;
  scoreBreakdown: ScoreBreakdown;
}

// Check if temperature reading is compliant with expected temperature zone
export function checkTemperatureCompliance(consignment: Consignment): boolean {
  const expectedTemp = consignment.expectedTemperature;
  
  // No temperature requirement = always compliant
  if (!expectedTemp || expectedTemp === "Dry") {
    return true;
  }
  
  // Get actual temperature reading from paymentMethod field
  const actualTemp = consignment.paymentMethod;
  
  // No temperature reading = not compliant if temperature is required
  if (!actualTemp) {
    return false;
  }
  
  // Parse temperature value
  const tempValue = parseFloat(actualTemp);
  if (isNaN(tempValue)) {
    return false;
  }
  
  // Check compliance based on expected zone
  const tempRanges: Record<string, [number, number]> = {
    "Chiller (0–4°C)": [0, 4],
    "Freezer (-20°C)": [-25, -15],
    "Wine (14°C)": [12, 16],
    "Confectionery (15–20°C)": [15, 20],
    "Pharma (2–8°C)": [2, 8],
  };
  
  const range = tempRanges[expectedTemp];
  if (!range) {
    return true; // Unknown zone = assume compliant
  }
  
  return tempValue >= range[0] && tempValue <= range[1];
}

// Get photo count from file count fields
export function getPhotoCount(consignment: Consignment): number {
  const deliveryFileCount = consignment.deliveryReceivedFileCount || 0;
  const pickupFileCount = consignment.pickupReceivedFileCount || 0;
  
  let totalFiles = deliveryFileCount + pickupFileCount;
  
  // Subtract signatures from file count since they're included in the total
  if (consignment.deliverySignatureName && deliveryFileCount > 0) {
    totalFiles = Math.max(0, totalFiles - 1);
  }
  if (consignment.pickupSignatureName && pickupFileCount > 0) {
    totalFiles = Math.max(0, totalFiles - 1);
  }
  
  return totalFiles;
}

// Calculate POD quality score
export function calculatePODScore(consignment: Consignment, actualPhotoCount?: number): PODMetrics {
  const scoreBreakdown: ScoreBreakdown = {
    photos: { points: 0, reason: "", status: "fail" },
    signature: { points: 0, reason: "", status: "fail" },
    receiverName: { points: 0, reason: "", status: "fail" },
    temperature: { points: 0, reason: "", status: "fail" },
    clearPhotos: { points: 0, reason: "", status: "pending" },
    total: 0
  };
  
  // Photo count (30 points)
  const photoCount = actualPhotoCount ?? getPhotoCount(consignment);
  if (photoCount >= 3) {
    scoreBreakdown.photos = { 
      points: 30, 
      reason: `${photoCount} photos captured`, 
      status: "pass" 
    };
  } else if (photoCount >= 2) {
    scoreBreakdown.photos = { 
      points: 20, 
      reason: `${photoCount} photos (3+ recommended)`, 
      status: "partial" 
    };
  } else if (photoCount >= 1) {
    scoreBreakdown.photos = { 
      points: 10, 
      reason: `Only ${photoCount} photo (3+ required)`, 
      status: "partial" 
    };
  } else {
    scoreBreakdown.photos = { 
      points: 0, 
      reason: "No photos captured", 
      status: "fail" 
    };
  }
  
  // Signature (25 points)
  const hasSignature = !!(consignment.deliverySignatureName || consignment.pickupSignatureName);
  if (hasSignature) {
    scoreBreakdown.signature = { 
      points: 25, 
      reason: "Signature captured", 
      status: "pass" 
    };
  } else {
    scoreBreakdown.signature = { 
      points: 0, 
      reason: "No signature captured", 
      status: "fail" 
    };
  }
  
  // Receiver name (15 points)
  const hasReceiverName = !!(consignment.deliverySignatureName || consignment.pickupSignatureName);
  if (hasReceiverName) {
    scoreBreakdown.receiverName = { 
      points: 15, 
      reason: "Receiver name recorded", 
      status: "pass" 
    };
  } else {
    scoreBreakdown.receiverName = { 
      points: 0, 
      reason: "No receiver name", 
      status: "fail" 
    };
  }
  
  // Temperature compliance (20 points)
  const tempCompliant = checkTemperatureCompliance(consignment);
  if (tempCompliant) {
    if (consignment.expectedTemperature === "Dry") {
      scoreBreakdown.temperature = { 
        points: 20, 
        reason: "No temperature requirement", 
        status: "pass" 
      };
    } else {
      const actualTemp = consignment.paymentMethod;
      scoreBreakdown.temperature = { 
        points: 20, 
        reason: `Temperature compliant (${actualTemp}°C)`, 
        status: "pass" 
      };
    }
  } else {
    const actualTemp = consignment.paymentMethod || "Not recorded";
    const expectedTemp = consignment.expectedTemperature;
    scoreBreakdown.temperature = { 
      points: 0, 
      reason: `Temperature out of range (${actualTemp}°C, expected ${expectedTemp})`, 
      status: "fail" 
    };
  }
  
  // Clear photos quality (10 points) - placeholder for now
  scoreBreakdown.clearPhotos = {
    points: 10,
    reason: "Photo quality pending",
    status: "pending"
  };
  
  // Calculate total score
  scoreBreakdown.total = 
    scoreBreakdown.photos.points +
    scoreBreakdown.signature.points +
    scoreBreakdown.receiverName.points +
    scoreBreakdown.temperature.points +
    scoreBreakdown.clearPhotos.points;
  
  return {
    photoCount,
    hasSignature,
    hasReceiverName,
    temperatureCompliant: tempCompliant,
    hasTrackingLink: !!(consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink),
    deliveryTime: consignment.delivery_OutcomeDateTime,
    qualityScore: scoreBreakdown.total,
    scoreBreakdown
  };
}

// Get quality tier based on score
export function getQualityTier(score: number): {
  tier: string;
  color: string;
  icon: string;
} {
  if (score >= 90) {
    return { tier: "Gold", color: "text-yellow-600", icon: "🏆" };
  } else if (score >= 75) {
    return { tier: "Silver", color: "text-gray-600", icon: "🥈" };
  } else if (score >= 60) {
    return { tier: "Bronze", color: "text-orange-600", icon: "🥉" };
  } else {
    return { tier: "Needs Improvement", color: "text-red-600", icon: "⚠️" };
  }
}