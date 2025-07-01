import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

// Configure WebSocket for Neon - always use ws in Node.js environment
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Optimized connection settings for Neon serverless
  max: 3, // Increase for better concurrency
  min: 0,
  idleTimeoutMillis: 10000, // Keep connections alive longer
  connectionTimeoutMillis: 10000, // Increase timeout for reliability
  maxUses: Infinity,
  allowExitOnIdle: false,
  maxLifetimeSeconds: 0
});

export const db = drizzle({ client: pool });

// Enhanced connection management with retry logic
class DatabaseConnection {
  private retryAttempts = 3;
  private baseDelay = 1000; // Start with 1 second delay

  async executeWithRetry<T>(operation: () => Promise<T>, context = 'database operation'): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        // Add small delay before each attempt (except first)
        if (attempt > 1) {
          const delay = this.baseDelay * Math.pow(2, attempt - 2); // Exponential backoff
          console.log(`🔄 Retry attempt ${attempt}/${this.retryAttempts} for ${context} (delay: ${delay}ms)`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await operation();
        
        // Log successful retry
        if (attempt > 1) {
          console.log(`✅ Database operation succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        const isTimeoutError = error.message?.includes('timeout') || error.message?.includes('connect');
        const isConnectionError = error.code === 'ECONNRESET' || error.code === 'ENOTFOUND';
        
        if (attempt === this.retryAttempts || (!isTimeoutError && !isConnectionError)) {
          console.error(`❌ Database operation failed after ${attempt} attempts:`, error.message);
          break;
        }
        
        console.warn(`⚠️ Database connection issue (attempt ${attempt}/${this.retryAttempts}):`, error.message);
      }
    }

    throw lastError || new Error(`Failed after ${this.retryAttempts} attempts`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.executeWithRetry(async () => {
        const client = await pool.connect();
        try {
          await client.query('SELECT 1');
          return true;
        } finally {
          client.release();
        }
      }, 'health check');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

export const dbConnection = new DatabaseConnection();