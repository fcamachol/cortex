/**
 * CORTEX FOUNDATION STORAGE LAYER
 * 
 * This storage layer provides methods for interacting with the Cortex Foundation schema.
 * It handles all CRUD operations for users, workspaces, spaces, and universal entity relationships.
 */

import { db } from "./db";
import { eq, and, or, desc, asc, sql, like, isNull, inArray } from "drizzle-orm";
import {
  cortexFoundationUsers,
  cortexFoundationWorkspaces,
  cortexFoundationSpaces,
  cortexFoundationEntityRelationships,
  cortexFoundationWorkspaceMembers,
  cortexFoundationSpaceMembers,
  cortexFoundationActivityLog,
  cortexFoundationTags,
  // Types
  type CortexFoundationUser,
  type InsertCortexFoundationUser,
  type CortexFoundationWorkspace,
  type InsertCortexFoundationWorkspace,
  type CortexFoundationSpace,
  type InsertCortexFoundationSpace,
  type CortexFoundationEntityRelationship,
  type InsertCortexFoundationEntityRelationship,
  type CortexFoundationWorkspaceMember,
  type InsertCortexFoundationWorkspaceMember,
  type CortexFoundationSpaceMember,
  type InsertCortexFoundationSpaceMember,
  type CortexFoundationActivityLog,
  type InsertCortexFoundationActivityLog,
  type CortexFoundationTag,
  type InsertCortexFoundationTag,
} from "../shared/cortex-foundation-schema";

export interface ICortexFoundationStorage {
  // User Management
  createUser(user: InsertCortexFoundationUser): Promise<CortexFoundationUser>;
  getUserById(id: string): Promise<CortexFoundationUser | undefined>;
  getUserByEmail(email: string): Promise<CortexFoundationUser | undefined>;
  updateUser(id: string, updates: Partial<InsertCortexFoundationUser>): Promise<CortexFoundationUser>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<CortexFoundationUser[]>;

  // Workspace Management
  createWorkspace(workspace: InsertCortexFoundationWorkspace): Promise<CortexFoundationWorkspace>;
  getWorkspaceById(id: string): Promise<CortexFoundationWorkspace | undefined>;
  getWorkspaceBySlug(slug: string): Promise<CortexFoundationWorkspace | undefined>;
  getWorkspacesByOwner(ownerUserId: string): Promise<CortexFoundationWorkspace[]>;
  getWorkspacesByUser(userId: string): Promise<CortexFoundationWorkspace[]>;
  updateWorkspace(id: string, updates: Partial<InsertCortexFoundationWorkspace>): Promise<CortexFoundationWorkspace>;
  deleteWorkspace(id: string): Promise<void>;

  // Space Management
  createSpace(space: InsertCortexFoundationSpace): Promise<CortexFoundationSpace>;
  getSpaceById(id: string): Promise<CortexFoundationSpace | undefined>;
  getSpacesByWorkspace(workspaceId: string): Promise<CortexFoundationSpace[]>;
  getSpacesByParent(parentSpaceId: string): Promise<CortexFoundationSpace[]>;
  getRootSpaces(workspaceId: string): Promise<CortexFoundationSpace[]>;
  getSpaceHierarchy(spaceId: string): Promise<CortexFoundationSpace[]>;
  updateSpace(id: string, updates: Partial<InsertCortexFoundationSpace>): Promise<CortexFoundationSpace>;
  deleteSpace(id: string): Promise<void>;

  // Member Management
  addWorkspaceMember(member: InsertCortexFoundationWorkspaceMember): Promise<CortexFoundationWorkspaceMember>;
  getWorkspaceMembers(workspaceId: string): Promise<CortexFoundationWorkspaceMember[]>;
  updateWorkspaceMember(workspaceId: string, userId: string, updates: Partial<InsertCortexFoundationWorkspaceMember>): Promise<CortexFoundationWorkspaceMember>;
  removeWorkspaceMember(workspaceId: string, userId: string): Promise<void>;

  addSpaceMember(member: InsertCortexFoundationSpaceMember): Promise<CortexFoundationSpaceMember>;
  getSpaceMembers(spaceId: string): Promise<CortexFoundationSpaceMember[]>;
  updateSpaceMember(spaceId: string, userId: string, updates: Partial<InsertCortexFoundationSpaceMember>): Promise<CortexFoundationSpaceMember>;
  removeSpaceMember(spaceId: string, userId: string): Promise<void>;

  // Entity Relationship Management
  createEntityRelationship(relationship: InsertCortexFoundationEntityRelationship): Promise<CortexFoundationEntityRelationship>;
  getEntityRelationships(entityId: string): Promise<CortexFoundationEntityRelationship[]>;
  getRelationshipsByType(relationshipType: string): Promise<CortexFoundationEntityRelationship[]>;
  deleteEntityRelationship(id: string): Promise<void>;

  // Activity Logging
  logActivity(activity: InsertCortexFoundationActivityLog): Promise<CortexFoundationActivityLog>;
  getActivityByEntity(entityId: string): Promise<CortexFoundationActivityLog[]>;
  getActivityByUser(userId: string): Promise<CortexFoundationActivityLog[]>;
  getActivityByWorkspace(workspaceId: string): Promise<CortexFoundationActivityLog[]>;

  // Tag Management
  createTag(tag: InsertCortexFoundationTag): Promise<CortexFoundationTag>;
  getTagById(id: string): Promise<CortexFoundationTag | undefined>;
  getTagsByWorkspace(workspaceId: string): Promise<CortexFoundationTag[]>;
  updateTag(id: string, updates: Partial<InsertCortexFoundationTag>): Promise<CortexFoundationTag>;
  deleteTag(id: string): Promise<void>;
}

export class CortexFoundationStorage implements ICortexFoundationStorage {
  constructor(private db: typeof db) {}

  // =====================================================
  // USER MANAGEMENT
  // =====================================================

  async createUser(user: InsertCortexFoundationUser): Promise<CortexFoundationUser> {
    const [createdUser] = await this.db
      .insert(cortexFoundationUsers)
      .values(user)
      .returning();
    return createdUser;
  }

  async getUserById(id: string): Promise<CortexFoundationUser | undefined> {
    const [user] = await this.db
      .select()
      .from(cortexFoundationUsers)
      .where(eq(cortexFoundationUsers.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<CortexFoundationUser | undefined> {
    const [user] = await this.db
      .select()
      .from(cortexFoundationUsers)
      .where(eq(cortexFoundationUsers.email, email));
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertCortexFoundationUser>): Promise<CortexFoundationUser> {
    const [updatedUser] = await this.db
      .update(cortexFoundationUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cortexFoundationUsers.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await this.db
      .delete(cortexFoundationUsers)
      .where(eq(cortexFoundationUsers.id, id));
  }

  async getAllUsers(): Promise<CortexFoundationUser[]> {
    return await this.db
      .select()
      .from(cortexFoundationUsers)
      .where(eq(cortexFoundationUsers.isActive, true))
      .orderBy(asc(cortexFoundationUsers.fullName));
  }

  // =====================================================
  // WORKSPACE MANAGEMENT
  // =====================================================

  async createWorkspace(workspace: InsertCortexFoundationWorkspace): Promise<CortexFoundationWorkspace> {
    const [createdWorkspace] = await this.db
      .insert(cortexFoundationWorkspaces)
      .values(workspace)
      .returning();
    return createdWorkspace;
  }

  async getWorkspaceById(id: string): Promise<CortexFoundationWorkspace | undefined> {
    const [workspace] = await this.db
      .select()
      .from(cortexFoundationWorkspaces)
      .where(eq(cortexFoundationWorkspaces.id, id));
    return workspace;
  }

  async getWorkspaceBySlug(slug: string): Promise<CortexFoundationWorkspace | undefined> {
    const [workspace] = await this.db
      .select()
      .from(cortexFoundationWorkspaces)
      .where(eq(cortexFoundationWorkspaces.slug, slug));
    return workspace;
  }

  async getWorkspacesByOwner(ownerUserId: string): Promise<CortexFoundationWorkspace[]> {
    return await this.db
      .select()
      .from(cortexFoundationWorkspaces)
      .where(eq(cortexFoundationWorkspaces.ownerUserId, ownerUserId))
      .orderBy(asc(cortexFoundationWorkspaces.name));
  }

  async getWorkspacesByUser(userId: string): Promise<CortexFoundationWorkspace[]> {
    return await this.db
      .select({
        id: cortexFoundationWorkspaces.id,
        name: cortexFoundationWorkspaces.name,
        slug: cortexFoundationWorkspaces.slug,
        description: cortexFoundationWorkspaces.description,
        logoUrl: cortexFoundationWorkspaces.logoUrl,
        primaryColor: cortexFoundationWorkspaces.primaryColor,
        domain: cortexFoundationWorkspaces.domain,
        ownerUserId: cortexFoundationWorkspaces.ownerUserId,
        planType: cortexFoundationWorkspaces.planType,
        maxUsers: cortexFoundationWorkspaces.maxUsers,
        maxStorageGb: cortexFoundationWorkspaces.maxStorageGb,
        isActive: cortexFoundationWorkspaces.isActive,
        trialEndsAt: cortexFoundationWorkspaces.trialEndsAt,
        billingInfo: cortexFoundationWorkspaces.billingInfo,
        settings: cortexFoundationWorkspaces.settings,
        createdAt: cortexFoundationWorkspaces.createdAt,
        updatedAt: cortexFoundationWorkspaces.updatedAt,
      })
      .from(cortexFoundationWorkspaces)
      .innerJoin(
        cortexFoundationWorkspaceMembers,
        eq(cortexFoundationWorkspaces.id, cortexFoundationWorkspaceMembers.workspaceId)
      )
      .where(
        and(
          eq(cortexFoundationWorkspaceMembers.userId, userId),
          eq(cortexFoundationWorkspaceMembers.isActive, true),
          eq(cortexFoundationWorkspaces.isActive, true)
        )
      )
      .orderBy(asc(cortexFoundationWorkspaces.name));
  }

  async updateWorkspace(id: string, updates: Partial<InsertCortexFoundationWorkspace>): Promise<CortexFoundationWorkspace> {
    const [updatedWorkspace] = await this.db
      .update(cortexFoundationWorkspaces)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cortexFoundationWorkspaces.id, id))
      .returning();
    return updatedWorkspace;
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.db
      .delete(cortexFoundationWorkspaces)
      .where(eq(cortexFoundationWorkspaces.id, id));
  }

  // =====================================================
  // SPACE MANAGEMENT
  // =====================================================

  async createSpace(space: InsertCortexFoundationSpace): Promise<CortexFoundationSpace> {
    const [createdSpace] = await this.db
      .insert(cortexFoundationSpaces)
      .values(space)
      .returning();
    return createdSpace;
  }

  async getSpaceById(id: string): Promise<CortexFoundationSpace | undefined> {
    const [space] = await this.db
      .select()
      .from(cortexFoundationSpaces)
      .where(eq(cortexFoundationSpaces.id, id));
    return space;
  }

  async getSpacesByWorkspace(workspaceId: string): Promise<CortexFoundationSpace[]> {
    return await this.db
      .select()
      .from(cortexFoundationSpaces)
      .where(
        and(
          eq(cortexFoundationSpaces.workspaceId, workspaceId),
          eq(cortexFoundationSpaces.isArchived, false)
        )
      )
      .orderBy(asc(cortexFoundationSpaces.displayOrder), asc(cortexFoundationSpaces.name));
  }

  async getSpacesByParent(parentSpaceId: string): Promise<CortexFoundationSpace[]> {
    return await this.db
      .select()
      .from(cortexFoundationSpaces)
      .where(
        and(
          eq(cortexFoundationSpaces.parentSpaceId, parentSpaceId),
          eq(cortexFoundationSpaces.isArchived, false)
        )
      )
      .orderBy(asc(cortexFoundationSpaces.displayOrder), asc(cortexFoundationSpaces.name));
  }

  async getRootSpaces(workspaceId: string): Promise<CortexFoundationSpace[]> {
    return await this.db
      .select()
      .from(cortexFoundationSpaces)
      .where(
        and(
          eq(cortexFoundationSpaces.workspaceId, workspaceId),
          isNull(cortexFoundationSpaces.parentSpaceId),
          eq(cortexFoundationSpaces.isArchived, false)
        )
      )
      .orderBy(asc(cortexFoundationSpaces.displayOrder), asc(cortexFoundationSpaces.name));
  }

  async getSpaceHierarchy(spaceId: string): Promise<CortexFoundationSpace[]> {
    // Recursive query to get space hierarchy (parents and children)
    const result = await this.db.execute(sql`
      WITH RECURSIVE space_hierarchy AS (
        -- Base case: start with the given space
        SELECT id, workspace_id, parent_space_id, creator_user_id, name, description, 
               icon, color, cover_image_url, space_type, privacy, is_archived, is_favorite,
               is_template, display_order, level, path, tags, settings, metadata,
               created_at, updated_at, last_activity_at, 0 as hierarchy_level
        FROM cortex_foundation.spaces 
        WHERE id = ${spaceId}
        
        UNION ALL
        
        -- Recursive case: get children
        SELECT s.id, s.workspace_id, s.parent_space_id, s.creator_user_id, s.name, s.description,
               s.icon, s.color, s.cover_image_url, s.space_type, s.privacy, s.is_archived, s.is_favorite,
               s.is_template, s.display_order, s.level, s.path, s.tags, s.settings, s.metadata,
               s.created_at, s.updated_at, s.last_activity_at, sh.hierarchy_level + 1
        FROM cortex_foundation.spaces s
        INNER JOIN space_hierarchy sh ON s.parent_space_id = sh.id
        WHERE s.is_archived = false
      )
      SELECT * FROM space_hierarchy
      ORDER BY hierarchy_level, display_order, name;
    `);
    
    return result.rows as CortexFoundationSpace[];
  }

  async updateSpace(id: string, updates: Partial<InsertCortexFoundationSpace>): Promise<CortexFoundationSpace> {
    const [updatedSpace] = await this.db
      .update(cortexFoundationSpaces)
      .set({ ...updates, updatedAt: new Date(), lastActivityAt: new Date() })
      .where(eq(cortexFoundationSpaces.id, id))
      .returning();
    return updatedSpace;
  }

  async deleteSpace(id: string): Promise<void> {
    await this.db
      .delete(cortexFoundationSpaces)
      .where(eq(cortexFoundationSpaces.id, id));
  }

  // =====================================================
  // MEMBER MANAGEMENT
  // =====================================================

  async addWorkspaceMember(member: InsertCortexFoundationWorkspaceMember): Promise<CortexFoundationWorkspaceMember> {
    const [createdMember] = await this.db
      .insert(cortexFoundationWorkspaceMembers)
      .values(member)
      .returning();
    return createdMember;
  }

  async getWorkspaceMembers(workspaceId: string): Promise<CortexFoundationWorkspaceMember[]> {
    return await this.db
      .select()
      .from(cortexFoundationWorkspaceMembers)
      .where(
        and(
          eq(cortexFoundationWorkspaceMembers.workspaceId, workspaceId),
          eq(cortexFoundationWorkspaceMembers.isActive, true)
        )
      );
  }

  async updateWorkspaceMember(
    workspaceId: string, 
    userId: string, 
    updates: Partial<InsertCortexFoundationWorkspaceMember>
  ): Promise<CortexFoundationWorkspaceMember> {
    const [updatedMember] = await this.db
      .update(cortexFoundationWorkspaceMembers)
      .set(updates)
      .where(
        and(
          eq(cortexFoundationWorkspaceMembers.workspaceId, workspaceId),
          eq(cortexFoundationWorkspaceMembers.userId, userId)
        )
      )
      .returning();
    return updatedMember;
  }

  async removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
    await this.db
      .delete(cortexFoundationWorkspaceMembers)
      .where(
        and(
          eq(cortexFoundationWorkspaceMembers.workspaceId, workspaceId),
          eq(cortexFoundationWorkspaceMembers.userId, userId)
        )
      );
  }

  async addSpaceMember(member: InsertCortexFoundationSpaceMember): Promise<CortexFoundationSpaceMember> {
    const [createdMember] = await this.db
      .insert(cortexFoundationSpaceMembers)
      .values(member)
      .returning();
    return createdMember;
  }

  async getSpaceMembers(spaceId: string): Promise<CortexFoundationSpaceMember[]> {
    return await this.db
      .select()
      .from(cortexFoundationSpaceMembers)
      .where(
        and(
          eq(cortexFoundationSpaceMembers.spaceId, spaceId),
          eq(cortexFoundationSpaceMembers.isActive, true)
        )
      );
  }

  async updateSpaceMember(
    spaceId: string, 
    userId: string, 
    updates: Partial<InsertCortexFoundationSpaceMember>
  ): Promise<CortexFoundationSpaceMember> {
    const [updatedMember] = await this.db
      .update(cortexFoundationSpaceMembers)
      .set(updates)
      .where(
        and(
          eq(cortexFoundationSpaceMembers.spaceId, spaceId),
          eq(cortexFoundationSpaceMembers.userId, userId)
        )
      )
      .returning();
    return updatedMember;
  }

  async removeSpaceMember(spaceId: string, userId: string): Promise<void> {
    await this.db
      .delete(cortexFoundationSpaceMembers)
      .where(
        and(
          eq(cortexFoundationSpaceMembers.spaceId, spaceId),
          eq(cortexFoundationSpaceMembers.userId, userId)
        )
      );
  }

  // =====================================================
  // ENTITY RELATIONSHIP MANAGEMENT
  // =====================================================

  async createEntityRelationship(relationship: InsertCortexFoundationEntityRelationship): Promise<CortexFoundationEntityRelationship> {
    const [createdRelationship] = await this.db
      .insert(cortexFoundationEntityRelationships)
      .values(relationship)
      .returning();
    return createdRelationship;
  }

  async getEntityRelationships(entityId: string): Promise<CortexFoundationEntityRelationship[]> {
    return await this.db
      .select()
      .from(cortexFoundationEntityRelationships)
      .where(
        or(
          eq(cortexFoundationEntityRelationships.sourceEntityId, entityId),
          eq(cortexFoundationEntityRelationships.targetEntityId, entityId)
        )
      )
      .orderBy(desc(cortexFoundationEntityRelationships.createdAt));
  }

  async getRelationshipsByType(relationshipType: string): Promise<CortexFoundationEntityRelationship[]> {
    return await this.db
      .select()
      .from(cortexFoundationEntityRelationships)
      .where(eq(cortexFoundationEntityRelationships.relationshipType, relationshipType))
      .orderBy(desc(cortexFoundationEntityRelationships.createdAt));
  }

  async deleteEntityRelationship(id: string): Promise<void> {
    await this.db
      .delete(cortexFoundationEntityRelationships)
      .where(eq(cortexFoundationEntityRelationships.id, id));
  }

  // =====================================================
  // ACTIVITY LOGGING
  // =====================================================

  async logActivity(activity: InsertCortexFoundationActivityLog): Promise<CortexFoundationActivityLog> {
    const [createdActivity] = await this.db
      .insert(cortexFoundationActivityLog)
      .values(activity)
      .returning();
    return createdActivity;
  }

  async getActivityByEntity(entityId: string): Promise<CortexFoundationActivityLog[]> {
    return await this.db
      .select()
      .from(cortexFoundationActivityLog)
      .where(eq(cortexFoundationActivityLog.entityId, entityId))
      .orderBy(desc(cortexFoundationActivityLog.createdAt))
      .limit(100);
  }

  async getActivityByUser(userId: string): Promise<CortexFoundationActivityLog[]> {
    return await this.db
      .select()
      .from(cortexFoundationActivityLog)
      .where(eq(cortexFoundationActivityLog.userId, userId))
      .orderBy(desc(cortexFoundationActivityLog.createdAt))
      .limit(100);
  }

  async getActivityByWorkspace(workspaceId: string): Promise<CortexFoundationActivityLog[]> {
    return await this.db
      .select()
      .from(cortexFoundationActivityLog)
      .where(eq(cortexFoundationActivityLog.workspaceId, workspaceId))
      .orderBy(desc(cortexFoundationActivityLog.createdAt))
      .limit(200);
  }

  // =====================================================
  // TAG MANAGEMENT
  // =====================================================

  async createTag(tag: InsertCortexFoundationTag): Promise<CortexFoundationTag> {
    const [createdTag] = await this.db
      .insert(cortexFoundationTags)
      .values(tag)
      .returning();
    return createdTag;
  }

  async getTagById(id: string): Promise<CortexFoundationTag | undefined> {
    const [tag] = await this.db
      .select()
      .from(cortexFoundationTags)
      .where(eq(cortexFoundationTags.id, id));
    return tag;
  }

  async getTagsByWorkspace(workspaceId: string): Promise<CortexFoundationTag[]> {
    return await this.db
      .select()
      .from(cortexFoundationTags)
      .where(eq(cortexFoundationTags.workspaceId, workspaceId))
      .orderBy(desc(cortexFoundationTags.usageCount), asc(cortexFoundationTags.name));
  }

  async updateTag(id: string, updates: Partial<InsertCortexFoundationTag>): Promise<CortexFoundationTag> {
    const [updatedTag] = await this.db
      .update(cortexFoundationTags)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cortexFoundationTags.id, id))
      .returning();
    return updatedTag;
  }

  async deleteTag(id: string): Promise<void> {
    await this.db
      .delete(cortexFoundationTags)
      .where(eq(cortexFoundationTags.id, id));
  }
}

// Export storage instance
export const cortexFoundationStorage = new CortexFoundationStorage(db);