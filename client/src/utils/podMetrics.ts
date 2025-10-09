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

// Get driver-recorded temperatures from consignment
export function getDriverTemperatures(consignment: Consignment): number[] {
  const temps: number[] = [];
  
  // Driver temp 1: payment_method field
  if (consignment.paymentMethod && consignment.paymentMethod !== "null") {
    const temp = parseFloat(consignment.paymentMethod);
    if (!isNaN(temp)) {
      temps.push(temp);
    }
  }
  
  // Driver temp 2: amount_collected field
  if (consignment.amountCollected && consignment.amountCollected !== "null") {
    const temp = parseFloat(consignment.amountCollected);
    if (!isNaN(temp)) {
      temps.push(temp);
    }
  }
  
  return temps;
}

// Parse required temperature range from document_note field
export function parseRequiredTemperature(documentNote: string | null): { min: number; max: number } | null {
  if (!documentNote) return null;
  
  const noteUpper = documentNote.toUpperCase();
  
  // Check for standard temperature zones with fixed ranges
  if (noteUpper.includes('FROZEN')) {
    // Frozen: -15°C to -25°C (anywhere in this range is compliant)
    return { min: -25, max: -15 };
  }
  
  if (noteUpper.includes('CHILL')) {
    // Chiller: 0°C to 5°C
    return { min: 0, max: 5 };
  }
  
  // For other temperature types, parse the actual values from the note
  // Match patterns like: "-18C to -20C" or "0C to +4C" or "-18°C to -20°C"
  const rangePattern = /(-?\d+\.?\d*)\s*°?C?\s+to\s+([+-]?\d+\.?\d*)\s*°?C?/i;
  const match = documentNote.match(rangePattern);
  
  if (match) {
    const temp1 = parseFloat(match[1]);
    const temp2 = parseFloat(match[2]);
    
    if (!isNaN(temp1) && !isNaN(temp2)) {
      return {
        min: Math.min(temp1, temp2),
        max: Math.max(temp1, temp2)
      };
    }
  }
  
  // Single temperature pattern: "-18C" or "+4C"
  const singlePattern = /(-?\+?\d+\.?\d*)\s*°?C/i;
  const singleMatch = documentNote.match(singlePattern);
  
  if (singleMatch) {
    const temp = parseFloat(singleMatch[1]);
    if (!isNaN(temp)) {
      // Use ±2°C tolerance for single temp values
      return { min: temp - 2, max: temp + 2 };
    }
  }
  
  return null;
}

// Check if temperature reading is compliant with expected temperature zone
export function checkTemperatureCompliance(consignment: Consignment): boolean {
  // Parse required temperature from document_note
  const requiredTemp = parseRequiredTemperature(consignment.documentNote);
  
  // No temperature requirement = always compliant
  if (!requiredTemp) {
    return true;
  }
  
  // Get driver-recorded temperatures
  const driverTemps = getDriverTemperatures(consignment);
  
  // No temperature readings = not compliant if temperature is required
  if (driverTemps.length === 0) {
    return false;
  }
  
  // PASS if at least ONE driver temp falls within the required range
  const isCompliant = driverTemps.some(temp => 
    temp >= requiredTemp.min && temp <= requiredTemp.max
  );
  
  return isCompliant;
}

// Get actual temperature reading for display (backward compatibility)
export function getActualTemperature(consignment: Consignment): string | null {
  const temps = getDriverTemperatures(consignment);
  if (temps.length > 0) {
    // Return both temps if available
    return temps.join(', ');
  }
  return null;
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
  
  // Photo count (40 base points + up to 10 bonus points for 4-13+ photos)
  const photoCount = actualPhotoCount ?? getPhotoCount(consignment);
  if (photoCount >= 3) {
    // Base 40 points for meeting minimum 3 photos
    // +1 point for each additional photo (4th through 13th), capped at +10
    const bonusPhotos = Math.min(photoCount - 3, 10);
    const totalPoints = 40 + bonusPhotos;
    scoreBreakdown.photos = { 
      points: totalPoints, 
      reason: photoCount === 3 ? "3 photos (minimum met)" : `${photoCount} photos (+${bonusPhotos} bonus)`, 
      status: "pass" 
    };
  } else if (photoCount >= 2) {
    scoreBreakdown.photos = { 
      points: 25, 
      reason: `${photoCount} photos (3 minimum required)`, 
      status: "partial" 
    };
  } else if (photoCount >= 1) {
    scoreBreakdown.photos = { 
      points: 15, 
      reason: `Only ${photoCount} photo (3 minimum required)`, 
      status: "partial" 
    };
  } else {
    scoreBreakdown.photos = { 
      points: 0, 
      reason: "No photos captured", 
      status: "fail" 
    };
  }
  
  // Signature - NOT COUNTED (required field in Axylog, always present)
  const hasSignature = !!(consignment.deliverySignatureName || consignment.pickupSignatureName);
  scoreBreakdown.signature = { 
    points: 0, 
    reason: hasSignature ? "Signature present (required)" : "No signature", 
    status: hasSignature ? "pass" : "fail" 
  };
  
  // Receiver name (25 points)
  const hasReceiverName = !!(consignment.deliverySignatureName || consignment.pickupSignatureName);
  if (hasReceiverName) {
    scoreBreakdown.receiverName = { 
      points: 25, 
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
  
  // Temperature compliance (25 points)
  const tempCompliant = checkTemperatureCompliance(consignment);
  const actualTemp = getActualTemperature(consignment);
  
  if (tempCompliant) {
    if (consignment.expectedTemperature === "Dry") {
      scoreBreakdown.temperature = { 
        points: 25, 
        reason: "No temperature requirement", 
        status: "pass" 
      };
    } else {
      scoreBreakdown.temperature = { 
        points: 25, 
        reason: `Temperature compliant (${actualTemp}°C)`, 
        status: "pass" 
      };
    }
  } else {
    const expectedTemp = consignment.expectedTemperature;
    scoreBreakdown.temperature = { 
      points: 0, 
      reason: `Temperature out of range (${actualTemp || "Not recorded"}, expected ${expectedTemp})`, 
      status: "fail" 
    };
  }
  
  // Clear photos removed - not used
  scoreBreakdown.clearPhotos = {
    points: 0,
    reason: "",
    status: "pending"
  };
  
  // Calculate total score (signature excluded - it's required in Axylog)
  scoreBreakdown.total = 
    scoreBreakdown.photos.points +
    scoreBreakdown.receiverName.points +
    scoreBreakdown.temperature.points;
  
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
  label: string;
} {
  if (score >= 90) {
    return { tier: "Excellent", color: "text-green-700", label: "Excellent" };
  } else if (score >= 75) {
    return { tier: "Good", color: "text-blue-700", label: "Good" };
  } else if (score >= 60) {
    return { tier: "Fair", color: "text-yellow-700", label: "Fair" };
  } else {
    return { tier: "Poor", color: "text-red-700", label: "Poor" };
  }
}