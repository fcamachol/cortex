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
  // Reduced connection limits to prevent overflow
  max: 2,
  min: 0,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle({ client: pool, schema });