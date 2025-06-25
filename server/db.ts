import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema-working";

// Configure WebSocket for Neon - always use ws in Node.js environment
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Optimized connection settings for Neon
  max: 1, // Single connection to prevent Neon limits
  min: 0,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 3000,
});

export const db = drizzle({ client: pool, schema });

// Connection queue to prevent overwhelming Neon
class ConnectionQueue {
  private queue: Array<{ resolve: Function, reject: Function, operation: Function }> = [];
  private processing = false;

  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, operation });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    while (this.queue.length > 0) {
      const { resolve, reject, operation } = this.queue.shift()!;
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    this.processing = false;
  }
}

export const connectionQueue = new ConnectionQueue();