/**
 * Shared photo filtering logic for POD quality system
 * Used by both the background worker and API routes to ensure consistent filtering
 */

export interface PhotoCandidate {
  src: string;
  width: number;
  height: number;
  alt?: string;
  className?: string;
}

export interface FilteredPhoto {
  url: string;
  kind: 'photo' | 'signature';
  width: number;
  height: number;
  isThumbnail?: boolean; // true if this is a thumbnail-sized image
}

/**
 * Extract thumbnail-sized images for fast initial loading
 * Prioritizes smaller images (200-500px) for quick page display
 */
export function extractThumbnails(images: PhotoCandidate[]): FilteredPhoto[] {
  const filtered: FilteredPhoto[] = [];
  
  for (const img of images) {
    // Basic validation
    if (!img.src || img.width < 50 || img.height < 50) continue;
    
    // Skip obvious UI elements
    if (img.src.includes('ghost.svg') || img.src.includes('loading')) continue;
    if (img.alt?.toLowerCase().includes('logo') || img.className?.includes('logo')) continue;
    
    // Skip Chill logo/branding images - MORE COMPREHENSIVE
    const srcLower = img.src.toLowerCase();
    const altLower = (img.alt || '').toLowerCase();
    const classLower = (img.className || '').toLowerCase();
    
    // Filter out ANY Chill-related image (not just logos)
    if (srcLower.includes('chill') || altLower.includes('chill') || classLower.includes('chill')) continue;
    
    // Skip small square placeholder images (often 150x150 or similar)
    const isSmallSquare = img.width === img.height && img.width <= 200;
    if (isSmallSquare) continue;
    
    const shortSide = Math.min(img.width, img.height);
    const longSide = Math.max(img.width, img.height);
    const pixelArea = img.width * img.height;
    const aspectRatio = img.width / Math.max(img.height, 1);
    
    // Check for signatures - only if explicitly marked or very small height
    const text = ((img.alt || '') + ' ' + (img.className || '')).toLowerCase();
    const isDimensionSignature = 
      img.height <= 200 && 
      aspectRatio >= 3.0 && 
      img.width >= 300 && 
      img.width <= 1200 &&
      pixelArea <= 120000;
    const isTextSignature = text.includes('signature') || text.includes('firma') || text.includes('sign');
    // Only classify as signature if it has signature text OR is extremely thin (height <= 150)
    const isSignature = (isDimensionSignature && isTextSignature) || (isDimensionSignature && img.height <= 150);
    
    if (isSignature) {
      if (shortSide >= 120 && pixelArea <= 120000 && isValidPhotoUrl(img.src)) {
        filtered.push({
          url: img.src,
          kind: 'signature',
          width: img.width,
          height: img.height,
          isThumbnail: true
        });
      }
      continue;
    }
    
    // THUMBNAIL CRITERIA: Accept a wide range of photo sizes
    // - Short side: >= 150px (minimum for quality)
    // - Pixel area: >= 40k (minimum for usable photos)
    // - Aspect ratio: 0.4-2.5 (normal photo ratios)
    // - Long side: >= 200px
    
    if (shortSide >= 150 &&
        pixelArea >= 40000 &&
        aspectRatio >= 0.4 && aspectRatio <= 2.5 &&
        longSide >= 200 &&
        isValidPhotoUrl(img.src)) {
      filtered.push({
        url: img.src,
        kind: 'photo',
        width: img.width,
        height: img.height,
        isThumbnail: true
      });
    }
  }
  
  return filtered;
}

/**
 * Extract full-resolution images for detailed viewing
 * Targets larger images (600px+) for modal display
 */
export function extractFullResolution(images: PhotoCandidate[]): FilteredPhoto[] {
  const filtered: FilteredPhoto[] = [];
  
  for (const img of images) {
    if (!img.src || img.width < 50 || img.height < 50) continue;
    if (img.src.includes('ghost.svg') || img.src.includes('loading')) continue;
    if (img.alt?.toLowerCase().includes('logo') || img.className?.includes('logo')) continue;
    
    const shortSide = Math.min(img.width, img.height);
    const longSide = Math.max(img.width, img.height);
    const pixelArea = img.width * img.height;
    const aspectRatio = img.width / Math.max(img.height, 1);
    
    // Check for signatures
    const text = ((img.alt || '') + ' ' + (img.className || '')).toLowerCase();
    const isDimensionSignature = 
      img.height <= 220 && aspectRatio >= 3.0 && 
      img.width >= 300 && img.width <= 1200 && pixelArea <= 120000;
    const isTextSignature = text.includes('signature') || text.includes('firma') || text.includes('sign');
    const isSignature = (isDimensionSignature && isTextSignature) || (isDimensionSignature && img.height <= 180);
    
    if (isSignature) {
      if (shortSide >= 120 && pixelArea <= 120000 && isValidPhotoUrl(img.src)) {
        filtered.push({
          url: img.src,
          kind: 'signature',
          width: img.width,
          height: img.height,
          isThumbnail: false
        });
      }
      continue;
    }
    
    // FULL-RES CRITERIA: Larger images for quality viewing
    // - Short side >= 350px
    // - Pixel area >= 200k
    // - Long side >= 600px
    // - Normal aspect ratio
    
    if (shortSide >= 350 && pixelArea >= 200000 &&
        aspectRatio >= 0.45 && aspectRatio <= 1.9 &&
        longSide >= 600 &&
        isValidPhotoUrl(img.src)) {
      filtered.push({
        url: img.src,
        kind: 'photo',
        width: img.width,
        height: img.height,
        isThumbnail: false
      });
    }
  }
  
  return filtered;
}

/**
 * Smart photo filtering to exclude UI elements and only keep actual delivery photos
 * 
 * Filters out:
 * - Social media icons (< 350px short side)
 * - Banners and headers (bad aspect ratio outside 0.45-1.9)
 * - Small UI elements (< 200k pixel area)
 * - Invalid or inaccessible URLs
 * 
 * Keeps:
 * - Actual driver photos (typically 768x1024 Azure Blob Storage URLs)
 * - Photos with reasonable dimensions and aspect ratios
 */
export function filterAndClassifyPhotos(images: PhotoCandidate[]): FilteredPhoto[] {
  const filtered: FilteredPhoto[] = [];
  
  for (const img of images) {
    // Basic validation
    if (!img.src || img.width < 50 || img.height < 50) continue;
    
    // Skip obvious UI elements
    if (img.src.includes('ghost.svg') || img.src.includes('loading')) continue;
    if (img.alt?.toLowerCase().includes('logo') || img.className?.includes('logo')) continue;
    
    // Skip Chill logo/branding images - MORE COMPREHENSIVE
    const srcLower = img.src.toLowerCase();
    const altLower = (img.alt || '').toLowerCase();
    const classLower = (img.className || '').toLowerCase();
    
    // Filter out ANY Chill-related image (not just logos)
    if (srcLower.includes('chill') || altLower.includes('chill') || classLower.includes('chill')) continue;
    
    // Skip small square placeholder images (often 150x150 or similar)
    const isSmallSquare = img.width === img.height && img.width <= 200;
    if (isSmallSquare) continue;
    
    // Calculate dimensions for filtering
    const shortSide = Math.min(img.width, img.height);
    const longSide = Math.max(img.width, img.height);
    const pixelArea = img.width * img.height;
    const aspectRatio = img.width / Math.max(img.height, 1);
    
    // Check if it's a signature first (before dimension filtering)
    const text = ((img.alt || '') + ' ' + (img.className || '')).toLowerCase();
    
    // STRICT signature detection to exclude banners/headers:
    // - Height must be ≤220px (actual signatures are thin)
    // - Aspect ratio must be ≥3.0 (very wide and short)
    // - Width must be between 300-1200px (not ultra-wide banners)
    // - Pixel area must be ≤120k (no large marketing images)
    const isDimensionSignature = 
      img.height <= 220 && 
      aspectRatio >= 3.0 && 
      img.width >= 300 && 
      img.width <= 1200 &&
      pixelArea <= 120000;
    
    const isTextSignature = 
      text.includes('signature') || 
      text.includes('firma') || 
      text.includes('sign');
    
    // Only accept as signature if BOTH dimension AND text match, or dimension criteria is very strict
    const isSignature = (isDimensionSignature && isTextSignature) || 
                        (isDimensionSignature && img.height <= 180);
    
    // For signatures, apply strict filtering
    if (isSignature) {
      if (shortSide >= 120 && pixelArea <= 120000 && isValidPhotoUrl(img.src)) {
        filtered.push({
          url: img.src,
          kind: 'signature',
          width: img.width,
          height: img.height
        });
      }
      continue;
    }
    
    // Smart filtering for regular photos
    
    // 1. Exclude small images (social icons, UI elements) - short side must be >= 350px
    if (shortSide < 350) {
      continue;
    }
    
    // 2. Exclude images with insufficient pixel area (< 200k pixels) - drops icons and small UI elements
    if (pixelArea < 200000) {
      continue;
    }
    
    // 3. Aspect ratio must be within reasonable photo range (0.45 to 1.9)
    // This excludes ultra-wide banners (AR > 2.0) and ultra-tall elements (AR < 0.45)
    if (aspectRatio < 0.45 || aspectRatio > 1.9) {
      continue;
    }
    
    // 4. At least one dimension must be >= 600px (ensures actual photos like 768x1024 pass)
    if (longSide < 600) {
      continue;
    }
    
    // 5. Validate URL is accessible
    if (!isValidPhotoUrl(img.src)) {
      continue;
    }
    
    // Passed all filters - this is a valid delivery photo
    filtered.push({
      url: img.src,
      kind: 'photo',
      width: img.width,
      height: img.height
    });
  }
  
  return filtered;
}

/**
 * Check if URL is a valid, accessible photo URL
 */
function isValidPhotoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // Accept data URIs (base64 encoded images)
  if (url.startsWith('data:image/')) return true;
  
  // Must be valid HTTP/HTTPS URL
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }
    
    // Prioritize Azure Blob Storage URLs (these are the real driver photos)
    const isAzureBlob = urlObj.hostname.includes('blob.core.windows.net');
    if (isAzureBlob) return true;
    
    // Also accept Axylog domain URLs
    const isAxylog = urlObj.hostname === 'live.axylog.com' || urlObj.hostname.endsWith('.axylog.com');
    if (isAxylog) return true;
    
    // Reject other domains to avoid external resources
    return false;
    
  } catch {
    return false;
  }
}

/**
 * Additional filtering for already-stored URLs (used by API endpoints)
 * Removes duplicates and ensures only HTTP/HTTPS URLs
 */
export function filterFetchablePhotos(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  
  for (const u of urls) {
    if (!u || typeof u !== 'string') {
      continue;
    }
    
    // Accept data URIs
    if (u.startsWith('data:image/')) {
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
      continue;
    }
    
    // Check if it's a valid HTTP URL
    try {
      const { protocol, hostname } = new URL(u);
      if (protocol !== 'http:' && protocol !== 'https:') {
        continue;
      }
      
      // Deduplicate
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    } catch (e) {
      continue;
    }
  }
  
  return out;
}
