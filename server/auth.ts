import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { appUsers } from '../shared/schema';
import { eq } from 'drizzle-orm';

// JWT secret - in production this should be from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    fullName?: string | null;
  };
}

// Generate JWT token
export function generateToken(payload: { userId: string; email: string; fullName?: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT token
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// Compare password
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Authentication middleware
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    // Verify user still exists in database
    const [user] = await db
      .select({
        userId: appUsers.userId,
        email: appUsers.email,
        fullName: appUsers.fullName,
      })
      .from(appUsers)
      .where(eq(appUsers.userId, decoded.userId))
      .limit(1);

    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    req.user = {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return next();
  }

  try {
    const [user] = await db
      .select({
        userId: appUsers.userId,
        email: appUsers.email,
        fullName: appUsers.fullName,
      })
      .from(appUsers)
      .where(eq(appUsers.userId, decoded.userId))
      .limit(1);

    if (user) {
      req.user = {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
      };
    }
  } catch (error) {
    console.error('Optional auth error:', error);
  }

  next();
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  return { valid: true };
}