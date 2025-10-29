# Axylog Photo System Context

## Overview
This archive contains all code related to fetching, processing, and displaying photos from the Axylog system for the POD Quality Dashboard.

## Key Components

### 1. Photo Scraping (`server/liveSyncWorker.ts`)
- Uses Puppeteer to scrape photos from Axylog's web interface
- Authenticates with username/password from environment variables
- Fetches photos for individual consignments by token
- Uses a job queue system with priorities (high/low)
- Implements rate limiting and retry logic
- Caches photo data to avoid redundant scraping

### 2. API Endpoints (`server/index.ts`)
- `GET /api/consignments/:id/photos` - Fetches photos for a specific consignment
- Triggers background photo scraping jobs
- Returns cached photos if available

### 3. Photo Display Components
- Client-side components for displaying POD photos
- Photo count indicators in quality metrics
- Photo galleries/viewers

### 4. Data Schema (`shared/schema.ts`)
- Database schema for storing photo metadata
- Photo count fields in consignment records

## Technical Details

### Authentication
- Axylog credentials stored in environment variables:
  - `AXYLOG_USERNAME`: Username for Axylog login
  - `AXYLOG_PASSWORD`: Password for Axylog login

### Photo Sources
Photos are scraped from Axylog's web interface by:
1. Authenticating to Axylog
2. Navigating to consignment detail pages using the consignment token
3. Extracting photo URLs from the page
4. Storing photo metadata

### File Count Fields
- `deliveryReceivedFileCount`: Number of delivery photos
- `pickupReceivedFileCount`: Number of pickup photos
- Note: Axylog includes 1 extra file in count that shouldn't be counted as a photo

### Photo Scoring
- Photos are worth 25 points in the POD quality score
- 0 photos = 0 points
- 1 photo = 13 points
- 2 photos = 19 points
- 3+ photos = 25 points (max)

## API Details

### Axylog API
- Base URL: `https://axylog.net/api`
- Authentication: Basic Auth (username/password)
- Consignment endpoint: `/api/consignments?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`
- Date filter: October 6th, 2025 onwards

### Photo Scraping Flow
1. Client requests photos for a consignment
2. Server checks if photos are cached
3. If not cached, enqueue scraping job
4. Worker processes job using Puppeteer
5. Photos extracted and stored
6. Client receives photo data

## Current Limitations
- Photos are scraped on-demand when requested
- Scraping requires browser automation (Puppeteer)
- Rate limiting to avoid overwhelming Axylog servers
- Some photos may take time to load initially

## Files Included
- Server-side photo scraping logic
- API endpoints for photo retrieval
- Client components for photo display
- Database schema
- POD Quality Scoring Guide
