import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with proper settings for Neon
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout for new connections
};

export const pool = new Pool(poolConfig);

// Add error handling for connection issues
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't throw here - just log the error to prevent crashes
});

export const db = drizzle({ client: pool, schema });

// Database health check and retry utility
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if this is a connection-related error
      const isConnectionError = error.message?.includes('terminating connection') ||
                               error.message?.includes('connection') ||
                               error.message?.includes('WebSocket closed') ||
                               error.message?.includes('SQL client unable to establish connection') ||
                               error.message?.includes('server closed the connection') ||
                               error.message?.includes('Connection terminated') ||
                               error.message?.includes('network error') ||
                               error.message?.includes('timeout') ||
                               error.code === '57P01' ||  // terminating connection due to admin command
                               error.code === '57P03' ||  // cannot connect now
                               error.code === '08006' ||  // connection failure
                               error.code === '08000' ||  // connection exception
                               error.code === 'ECONNRESET' ||
                               error.code === 'ECONNREFUSED' ||
                               error.code === 'ETIMEDOUT' ||
                               error.code === 'EHOSTUNREACH' ||
                               error.code === 'ENOTFOUND' ||
                               error.code === 'EPIPE';
      
      if (!isConnectionError || attempt === maxRetries) {
        console.error(`Database operation failed after ${attempt} attempts:`, error);
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`Database connection error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Graceful database query wrapper
export async function safeQuery<T>(
  operation: () => Promise<T>,
  fallbackValue?: T
): Promise<T | undefined> {
  try {
    return await executeWithRetry(operation);
  } catch (error: any) {
    console.error('Database query failed permanently:', error);
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    return undefined;
  }
}