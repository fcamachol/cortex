import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { 
  cortexFoundationUsers, 
  cortexFoundationWorkspaces, 
  cortexFoundationSpaces,
  type CortexFoundationUser,
  type InsertCortexFoundationUser,
  type InsertCortexFoundationWorkspace,
  type InsertCortexFoundationSpace
} from "@shared/cortex-foundation-schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Omit<CortexFoundationUser, 'passwordHash'>;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  firstName: string;
  lastName: string;
  timezone?: string;
  locale?: string;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-super-secret-refresh-key";
  private readonly JWT_EXPIRES_IN = "24h";
  private readonly JWT_REFRESH_EXPIRES_IN = "30d";

  async register(userData: RegisterData): Promise<AuthTokens> {
    // Check if user already exists
    const existingUser = await db.select()
      .from(cortexFoundationUsers)
      .where(eq(cortexFoundationUsers.email, userData.email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    // Generate user ID with cu_ prefix
    const userId = `cu_${nanoid(32)}`;

    // Create user record
    const insertUserData: InsertCortexFoundationUser = {
      id: userId,
      email: userData.email.toLowerCase(),
      passwordHash,
      fullName: userData.fullName,
      firstName: userData.firstName,
      lastName: userData.lastName,
      timezone: userData.timezone || "UTC",
      locale: userData.locale || "en_US",
      isEmailVerified: false,
      isActive: true,
      isAdmin: false,
      loginCount: 0,
      failedLoginAttempts: 0,
      notificationPreferences: {
        email: true,
        push: true,
        whatsapp: true,
        calendar: true
      },
      uiPreferences: {
        theme: "light",
        language: "en",
        sidebar: "expanded"
      }
    };

    const [newUser] = await db.insert(cortexFoundationUsers)
      .values(insertUserData)
      .returning();

    // Create default workspace for the user
    const workspaceData: InsertCortexFoundationWorkspace = {
      name: `${userData.firstName}'s Workspace`,
      slug: `${userData.firstName.toLowerCase()}-workspace-${nanoid(8)}`,
      description: `Personal workspace for ${userData.fullName}`,
      ownerUserId: userId,
      planType: "free",
      maxUsers: 5,
      maxStorageGb: 1,
      isActive: true,
      settings: {
        allowInvites: true,
        defaultSpacePermission: "member",
        whatsappIntegration: true
      }
    };

    const [newWorkspace] = await db.insert(cortexFoundationWorkspaces)
      .values(workspaceData)
      .returning();

    // Create default spaces for the user
    const defaultSpaces: InsertCortexFoundationSpace[] = [
      {
        name: "Personal",
        description: "Personal tasks and notes",
        spaceType: "personal",
        category: "personal",
        privacy: "private",
        ownerUserId: userId,
        color: "#3B82F6",
        icon: "user",
        level: 0,
        sortOrder: 1,
        isStarred: true
      },
      {
        name: "Work",
        description: "Work-related projects and tasks",
        spaceType: "workspace",
        category: "work",
        privacy: "private",
        ownerUserId: userId,
        color: "#10B981",
        icon: "briefcase",
        level: 0,
        sortOrder: 2
      },
      {
        name: "WhatsApp CRM",
        description: "WhatsApp business communications and automation",
        spaceType: "project",
        category: "business",
        privacy: "private",
        ownerUserId: userId,
        color: "#25D366",
        icon: "message-circle",
        level: 0,
        sortOrder: 3
      }
    ];

    await db.insert(cortexFoundationSpaces)
      .values(defaultSpaces);

    // Generate tokens
    const tokens = await this.generateTokens(newUser);

    // Update login count
    await db.update(cortexFoundationUsers)
      .set({ 
        loginCount: 1,
        lastLoginAt: new Date(),
        lastSeenAt: new Date()
      })
      .where(eq(cortexFoundationUsers.id, userId));

    return {
      ...tokens,
      user: this.sanitizeUser(newUser)
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const { email, password } = credentials;

    // Find user by email
    const [user] = await db.select()
      .from(cortexFoundationUsers)
      .where(and(
        eq(cortexFoundationUsers.email, email.toLowerCase()),
        eq(cortexFoundationUsers.isActive, true)
      ))
      .limit(1);

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      throw new Error("Account is temporarily locked. Please try again later.");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      // Increment failed login attempts
      const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
      const shouldLock = newFailedAttempts >= 5;
      
      await db.update(cortexFoundationUsers)
        .set({
          failedLoginAttempts: newFailedAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + 30 * 60 * 1000) : null // 30 minutes
        })
        .where(eq(cortexFoundationUsers.id, user.id));

      throw new Error("Invalid email or password");
    }

    // Reset failed attempts and update login info
    await db.update(cortexFoundationUsers)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        loginCount: (user.loginCount || 0) + 1,
        lastLoginAt: new Date(),
        lastSeenAt: new Date()
      })
      .where(eq(cortexFoundationUsers.id, user.id));

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: this.sanitizeUser(user)
    };
  }

  async verifyToken(token: string): Promise<CortexFoundationUser | null> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as { userId: string };
      
      const [user] = await db.select()
        .from(cortexFoundationUsers)
        .where(and(
          eq(cortexFoundationUsers.id, decoded.userId),
          eq(cortexFoundationUsers.isActive, true)
        ))
        .limit(1);

      if (!user) {
        return null;
      }

      // Update last seen
      await db.update(cortexFoundationUsers)
        .set({ lastSeenAt: new Date() })
        .where(eq(cortexFoundationUsers.id, user.id));

      return user;
    } catch (error) {
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as { userId: string };
      
      const [user] = await db.select()
        .from(cortexFoundationUsers)
        .where(and(
          eq(cortexFoundationUsers.id, decoded.userId),
          eq(cortexFoundationUsers.isActive, true)
        ))
        .limit(1);

      if (!user) {
        throw new Error("Invalid refresh token");
      }

      const tokens = await this.generateTokens(user);

      return {
        ...tokens,
        user: this.sanitizeUser(user)
      };
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  async getUserById(userId: string): Promise<CortexFoundationUser | null> {
    const [user] = await db.select()
      .from(cortexFoundationUsers)
      .where(and(
        eq(cortexFoundationUsers.id, userId),
        eq(cortexFoundationUsers.isActive, true)
      ))
      .limit(1);

    return user || null;
  }

  private async generateTokens(user: CortexFoundationUser): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.JWT_REFRESH_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: CortexFoundationUser): Omit<CortexFoundationUser, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}

export const authService = new AuthService();