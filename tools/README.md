# Photo Manifest & Thumbnail Tools

These tools help build a fast photo loading system using the Axylog /files API.

## Commands

### Build Photo Manifest
Fetches photo metadata from Axylog /files API and creates `public/manifest.json`:

```bash
tsx tools/build-manifest.js
```

### Generate WebP Thumbnails
Converts photos to optimized WebP thumbnails (if photos exist locally):

```bash
node tools/make-thumbs.js
```

### Full Build (Manifest + Thumbnails)
Run both commands in sequence:

```bash
tsx tools/build-manifest.js && node tools/make-thumbs.js
```

## How It Works

1. **Manifest Builder** (`build-manifest.js`):
   - Authenticates with Axylog API
   - Fetches recent deliveries from database
   - For each delivery, gets files via `/files` API
   - Filters to photos only (ignores PDFs, signatures)
   - Creates manifest with photo count and thumbnail paths
   - Outputs to `public/manifest.json`

2. **Thumbnail Generator** (`make-thumbs.js`):
   - Scans `public/photos/` directory
   - Generates 360px WebP thumbnails using Sharp
   - Auto-rotates based on EXIF data
   - Quality: 70 for optimal file size
   - Outputs to `public/thumbs/`

## Manifest Structure

```json
{
  "2025-143727-2": {
    "photoCount": 12,
    "consignmentNo": "CHI123456",
    "items": [
      {
        "thumb": "data:image/jpeg;base64,..." or "/thumbs/2025/143727/2/photo.webp",
        "full": "/api/photo/2025/143727/2/photo.jpg",
        "filename": "photo_0001",
        "extension": "jpg",
        "tag": "Delivery outcome image"
      }
    ]
  }
}
```

## Frontend Usage

Use the `Gallery` component to display photos from the manifest:

```tsx
import { Gallery } from '@/components/Gallery';

<Gallery deliveryKey="2025-143727-2" />
```

The Gallery component:
- Fetches manifest once on mount
- Shows accurate photo count
- Lazy-loads thumbnails with concurrency control
- Opens full-res images in lightbox on click
