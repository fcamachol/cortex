import { db } from './db';

/**
 * Sets the current user context for Row Level Security
 * This should be called at the beginning of each request
 */
export async function setRLSContext(userId: string) {
  await db.execute(`SELECT set_current_user_id('${userId}'::UUID)`);
}

/**
 * Clears the current user context
 */
export async function clearRLSContext() {
  await db.execute(`SELECT set_current_user_id('00000000-0000-0000-0000-000000000000'::UUID)`);
}

/**
 * Middleware to set RLS context based on session or request
 */
export function createRLSMiddleware() {
  return async (req: any, res: any, next: any) => {
    try {
      // In a real application, this would come from JWT token or session
      // For now, we'll extract from query params or headers for testing
      const userId = req.headers['x-user-id'] || req.query.userId;
      
      if (userId) {
        await setRLSContext(userId);
      }
      
      next();
    } catch (error) {
      console.error('RLS Context Error:', error);
      next(); // Continue without RLS context in case of error
    }
  };
}