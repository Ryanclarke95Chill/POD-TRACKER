import { useState, useEffect, useRef } from 'react';

interface ThumbProps {
  thumbSrc: string;
  alt?: string;
  placeholder?: string;
  onClick?: () => void;
  className?: string;
}

class ImageLoadQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeLoads = 0;
  private readonly maxConcurrency = 8;

  async add(loadFn: () => Promise<void>) {
    return new Promise<void>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await loadFn();
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          this.activeLoads--;
          this.processNext();
        }
      });
      this.processNext();
    });
  }

  private processNext() {
    if (this.activeLoads >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const loadFn = this.queue.shift();
    if (loadFn) {
      this.activeLoads++;
      loadFn();
    }
  }
}

const imageQueue = new ImageLoadQueue();

export function Thumb({ thumbSrc, alt = '', placeholder, onClick, className = '' }: ThumbProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.01,
      }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!shouldLoad || thumbSrc.startsWith('data:')) {
      if (thumbSrc.startsWith('data:')) {
        setLoaded(true);
      }
      return;
    }

    const loadImage = async () => {
      await imageQueue.add(async () => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            setLoaded(true);
            resolve();
          };
          img.onerror = () => {
            setError(true);
            reject(new Error('Failed to load image'));
          };
          img.src = thumbSrc;
        });
      });
    };

    loadImage().catch(() => {
      setError(true);
    });
  }, [shouldLoad, thumbSrc]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 dark:bg-gray-800 ${className}`}
        data-testid="thumb-error"
      >
        <span className="text-gray-400 text-xs">Failed to load</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} ref={imgRef}>
      {!loaded && (
        <div
          className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse"
          data-testid="thumb-loading"
        />
      )}
      {(shouldLoad || thumbSrc.startsWith('data:')) && (
        <img
          src={thumbSrc}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
          onClick={onClick}
          data-testid="thumb-image"
        />
      )}
    </div>
  );
}
