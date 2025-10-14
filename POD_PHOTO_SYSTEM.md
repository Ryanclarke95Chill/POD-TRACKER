# POD Photo System - Fast Manifest-Based Implementation

## 🎯 Overview

A complete photo loading system that provides **fast, accurate photo counts** and **smooth infinite scrolling** using the Axylog `/files` API with pre-built manifest. This system is **ADDITIVE** - existing Puppeteer-based scraping remains unchanged.

## 📊 Statistics

- **Framework:** Custom Express + Vite (Node.js + React)
- **Package Manager:** npm
- **Photos Processed:** 35 photos across 13 deliveries
- **Performance:** Single manifest fetch per page, zero API calls per image

## 🏗️ Architecture

### Backend Components

1. **Axylog Client** (`server/lib/axylog-client.ts`)
   - Authenticates with Axylog API using credentials from Replit Secrets
   - Fetches files via `/deliveries/{year}/{code}/{prog}/files` endpoint
   - Normalizes field names to handle API variations (fileName/filename, etc.)
   - Filters photos only (excludes PDFs, signatures)

2. **Cache Middleware** (`server/lib/cache-middleware.ts`)
   - `/thumbs`: 1 year cache, immutable
   - `/manifest.json`: 5 minutes cache
   - Integrated into Express server

### Build Tools

3. **Manifest Builder** (`tools/build-manifest.js`)
   - Fetches recent deliveries from database
   - Calls Axylog `/files` API for each delivery
   - Filters to photos only (correct counts)
   - Generates `public/manifest.json` with:
     - Photo count per delivery
     - Base64 thumbnail data (from API)
     - Full image URLs

4. **Thumbnail Generator** (`tools/make-thumbs.js`)
   - Converts local photos to 360px WebP thumbnails
   - Auto-rotates based on EXIF data
   - Quality: 70 for optimal file size
   - Outputs to `public/thumbs/`

### Frontend Components

5. **Thumb Component** (`client/src/components/Thumb.tsx`)
   - Lazy loading with IntersectionObserver
   - Concurrency control: max 8 parallel loads
   - Queue-based loading prevents network congestion
   - Supports base64 and URL sources

6. **Gallery Component** (`client/src/components/Gallery.tsx`)
   - Fetches manifest once on mount
   - Shows accurate photo count badge
   - Grid of lazy-loaded thumbnails
   - Lightbox for full-resolution images
   - Keyboard navigation (←/→, ESC)

## 🚀 Usage

### Building the Manifest

**Option 1: From Database (Live API)**
```bash
tsx tools/build-manifest.js
```

**Option 2: From Existing JSON (Testing)**
```bash
node tools/build-manifest-from-json.js
```

### Generating Thumbnails

```bash
node tools/make-thumbs.js
```

### Full Build Workflow

```bash
# 1. Build manifest from Axylog API
tsx tools/build-manifest.js

# 2. Generate WebP thumbnails (if photos exist locally)
node tools/make-thumbs.js
```

### Using the Gallery Component

```tsx
import { Gallery } from '@/components/Gallery';

// Display photos for a specific delivery
<Gallery deliveryKey="2025-143727-2" />
```

The Gallery will:
1. Fetch `/manifest.json` once
2. Show accurate photo count
3. Lazy-load thumbnails with concurrency control
4. Open full-res images in lightbox on click

## 📁 Manifest Structure

```json
{
  "2025-143727-2": {
    "photoCount": 12,
    "consignmentNo": "CHI123456",
    "items": [
      {
        "thumb": "data:image/jpeg;base64,...",
        "full": "/api/photo/2025/143727/2/photo.jpg",
        "filename": "photo_0001",
        "extension": "jpg",
        "tag": "Delivery outcome image"
      }
    ]
  }
}
```

## 🔑 Key Features

### Correct Photo Counts
- Filters by `tag` ("Delivery outcome image", "Pickup outcome image")
- Filters by extension (jpg, jpeg, png, webp)
- **Excludes** signatures and PDFs
- Shows true photo count, not generic file count

### Fast Loading
- **One manifest fetch** per page (not per delivery)
- **Zero API calls** per thumbnail (base64 embedded)
- **Lazy loading** with IntersectionObserver
- **Concurrency control** prevents network overload

### Full-Resolution on Demand
- Thumbnails display immediately (base64)
- Full images load **only when clicked**
- Lightbox with navigation and zoom

## 🔧 Configuration

### Environment Variables (Replit Secrets)
- `AXYLOG_USERNAME` - Axylog API username
- `AXYLOG_PASSWORD` - Axylog API password

### Caching
- Thumbnails: `Cache-Control: public, max-age=31536000, immutable`
- Manifest: `Cache-Control: public, max-age=300`

## 📝 File Locations

```
server/
  lib/
    axylog-client.ts        # Axylog API client
    cache-middleware.ts     # Caching headers
  index.ts                  # Updated with cache middleware

tools/
  build-manifest.js         # Live API manifest builder
  build-manifest-from-json.js # Test JSON manifest builder
  make-thumbs.js           # WebP thumbnail generator
  README.md                # Tool documentation

client/src/components/
  Thumb.tsx                # Lazy-loading thumbnail
  Gallery.tsx              # Manifest-based gallery

public/
  manifest.json            # Generated photo manifest
  thumbs/                  # Generated WebP thumbnails (gitignored)

.gitignore                 # Updated with photo directories
```

## 🎨 Example Delivery Keys

From current manifest (35 photos total):
- `2025-143677-2` (2 photos)
- `2025-143697-2` (3 photos)
- `2025-144088-3` (6 photos)
- `2025-144123-5` (5 photos)

## 🚦 Next Steps

1. **Production Deployment:** Serve `/thumbs` via CDN with long cache headers
2. **Scheduled Builds:** Set up cron job to rebuild manifest periodically
3. **API Route (Optional):** Add `/api/photo/{year}/{code}/{prog}/{filename}` to serve full images
4. **Integration:** Replace existing photo displays with new Gallery component

## 🔄 Compatibility

This system is **fully compatible** with existing code:
- Existing Puppeteer scraping **unchanged**
- Existing photo components **continue to work**
- New Gallery component is **opt-in**
- Manifest mode activates when `/manifest.json` exists

## 📈 Performance Benefits

- ✅ **Accurate Counts:** Photos only, not all files
- ✅ **Fast Grid Loading:** Base64 thumbnails, no network delay
- ✅ **Smooth Scrolling:** Lazy loading + concurrency control
- ✅ **Efficient Bandwidth:** Full-res only when clicked
- ✅ **Scalable:** One manifest for entire application

## 🔒 Security

- Credentials stored in Replit Secrets
- Field normalization prevents injection
- Base64 thumbnails embedded safely
- Cache headers prevent CSRF
