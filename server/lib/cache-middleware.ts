import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupCacheHeaders(app: Express) {
  // Cache static assets with long expiry
  app.use('/thumbs', express.static(path.join(__dirname, '../../public/thumbs'), {
    maxAge: '1y', // 1 year
    immutable: true,
    setHeaders: (res: Response) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }));

  // Cache manifest with shorter expiry (5 minutes)
  app.get('/manifest.json', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    next();
  });

  console.log('✅ Cache headers configured:');
  console.log('   - /thumbs: 1 year, immutable');
  console.log('   - /manifest.json: 5 minutes');
}
