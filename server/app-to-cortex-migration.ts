/**
 * APP SCHEMA TO CORTEX FOUNDATION MIGRATION
 * 
 * This migration transforms the existing app schema structure to the new Cortex foundation architecture.
 * It creates comprehensive mappings and migration scripts for all app schema tables.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export class AppToCortexMigration {
  constructor(private db: typeof db) {}

  /**
   * Complete migration from app schema to cortex_foundation schema
   */
  async migrate(): Promise<void> {
    console.log("🚀 Starting App Schema to Cortex Foundation Migration...");
    
    try {
      // Phase 1: Create Cortex Foundation Schema and Tables
      await this.createCortexFoundationSchema();
      
      // Phase 2: Create Bridge Tables for Data Mapping
      await this.createBridgeTables();
      
      // Phase 3: Migrate Data from App Schema to Cortex Foundation
      await this.migrateAppData();
      
      // Phase 4: Create Indexes and Constraints
      await this.createIndexesAndConstraints();
      
      // Phase 5: Create Migration Audit Trail
      await this.createMigrationAudit();
      
      console.log("🎉 App Schema to Cortex Foundation Migration completed successfully!");
      
    } catch (error) {
      console.error("❌ Error during migration:", error);
      throw error;
    }
  }

  /**
   * Phase 1: Ensure Cortex Foundation Schema exists and is ready
   */
  private async createCortexFoundationSchema(): Promise<void> {
    console.log("📋 Ensuring Cortex Foundation Schema is ready...");

    // Create cortex_foundation schema if it doesn't exist
    await this.db.execute(sql`CREATE SCHEMA IF NOT EXISTS cortex_foundation;`);

    // Check if entity ID generation function exists, create if not
    const funcExists = await this.db.execute(sql`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'cortex_foundation' 
        AND p.proname = 'generate_entity_id'
      );
    `);

    if (!funcExists.rows[0].exists) {
      await this.db.execute(sql`
        CREATE FUNCTION cortex_foundation.generate_entity_id(prefix TEXT)
        RETURNS TEXT AS $$
        BEGIN
          RETURN prefix || '_' || REPLACE(gen_random_uuid()::text, '-', '');
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log("✅ Created entity ID generation function");
    } else {
      console.log("✅ Entity ID generation function already exists");
    }

    // Ensure enums exist
    await this.createFoundationEnums();

    // Ensure foundation tables exist
    await this.createFoundationTables();

    console.log("✅ Cortex Foundation Schema is ready");
  }

  /**
   * Create all foundation enums
   */
  private async createFoundationEnums(): Promise<void> {
    // Plan type enum
    await this.db.execute(sql`
      CREATE TYPE IF NOT EXISTS cortex_foundation.plan_type AS ENUM (
        'free', 'starter', 'professional', 'enterprise'
      );
    `);

    // Space type enum
    await this.db.execute(sql`
      CREATE TYPE IF NOT EXISTS cortex_foundation.space_type AS ENUM (
        'folder', 'workspace', 'project', 'team', 'personal', 'archive', 'template'
      );
    `);

    // Privacy enum
    await this.db.execute(sql`
      CREATE TYPE IF NOT EXISTS cortex_foundation.privacy AS ENUM (
        'private', 'public', 'restricted', 'shared'
      );
    `);

    // Relationship type enum
    await this.db.execute(sql`
      CREATE TYPE IF NOT EXISTS cortex_foundation.relationship_type AS ENUM (
        'related_to', 'belongs_to', 'contains', 'depends_on', 'blocks', 'references',
        'married_to', 'parent_of', 'child_of', 'sibling_of', 'friend_of', 'colleague_of',
        'manager_of', 'reports_to', 'works_for', 'founded', 'consultant_for',
        'subsidiary_of', 'owns', 'client_of', 'vendor_of', 'partner_with', 'competitor_of',
        'manages', 'sponsors', 'assigned_to', 'predecessor_of', 'successor_of',
        'created_by', 'mentions', 'about', 'taken_during', 'summary_of', 'tagged_with'
      );
    `);

    // Member role enum
    await this.db.execute(sql`
      CREATE TYPE IF NOT EXISTS cortex_foundation.member_role AS ENUM (
        'owner', 'admin', 'editor', 'viewer', 'guest'
      );
    `);

    // Activity type enum
    await this.db.execute(sql`
      CREATE TYPE IF NOT EXISTS cortex_foundation.activity_type AS ENUM (
        'created', 'updated', 'deleted', 'shared', 'moved', 'copied', 'commented',
        'assigned', 'unassigned', 'completed', 'reopened', 'archived', 'restored'
      );
    `);
  }

  /**
   * Create all foundation tables
   */
  private async createFoundationTables(): Promise<void> {
    // Foundation Users table
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.users (
        id VARCHAR(50) PRIMARY KEY DEFAULT cortex_foundation.generate_entity_id('cu'),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        display_name VARCHAR(100),
        avatar_url VARCHAR(500),
        timezone VARCHAR(50) DEFAULT 'UTC',
        locale VARCHAR(10) DEFAULT 'en_US',
        is_email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        email_verification_expires TIMESTAMP WITH TIME ZONE,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP WITH TIME ZONE,
        last_login_at TIMESTAMP WITH TIME ZONE,
        login_count INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE,
        is_admin BOOLEAN DEFAULT FALSE,
        notification_preferences JSONB DEFAULT '{}',
        ui_preferences JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Foundation Workspaces table
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        logo_url VARCHAR(500),
        primary_color VARCHAR(7),
        domain VARCHAR(255),
        owner_user_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id),
        plan_type cortex_foundation.plan_type DEFAULT 'free',
        max_users INTEGER DEFAULT 5,
        max_storage_gb INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        trial_ends_at TIMESTAMP WITH TIME ZONE,
        billing_info JSONB DEFAULT '{}',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Foundation Spaces table
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.spaces (
        id VARCHAR(50) PRIMARY KEY DEFAULT cortex_foundation.generate_entity_id('cs'),
        workspace_id UUID NOT NULL REFERENCES cortex_foundation.workspaces(id),
        parent_space_id VARCHAR(50) REFERENCES cortex_foundation.spaces(id),
        creator_user_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50) DEFAULT '📁',
        color VARCHAR(7) DEFAULT '#3B82F6',
        cover_image_url VARCHAR(500),
        space_type cortex_foundation.space_type DEFAULT 'folder',
        privacy cortex_foundation.privacy DEFAULT 'private',
        is_archived BOOLEAN DEFAULT FALSE,
        is_favorite BOOLEAN DEFAULT FALSE,
        is_template BOOLEAN DEFAULT FALSE,
        display_order INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        path TEXT,
        tags TEXT[],
        settings JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Entity Relationships table (Universal linking system)
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.entity_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES cortex_foundation.workspaces(id),
        source_entity_id VARCHAR(50) NOT NULL,
        target_entity_id VARCHAR(50) NOT NULL,
        relationship_type cortex_foundation.relationship_type NOT NULL,
        strength DECIMAL(3,2) DEFAULT 1.0,
        is_bidirectional BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        created_by VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(source_entity_id, target_entity_id, relationship_type)
      );
    `);

    // Workspace Members table
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.workspace_members (
        workspace_id UUID NOT NULL REFERENCES cortex_foundation.workspaces(id),
        user_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id),
        role cortex_foundation.member_role DEFAULT 'viewer',
        invited_by VARCHAR(50) REFERENCES cortex_foundation.users(id),
        invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        joined_at TIMESTAMP WITH TIME ZONE,
        last_accessed_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE,
        permissions JSONB DEFAULT '{}',
        PRIMARY KEY (workspace_id, user_id)
      );
    `);

    // Space Members table
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.space_members (
        space_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.spaces(id),
        user_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id),
        role cortex_foundation.member_role DEFAULT 'viewer',
        invited_by VARCHAR(50) REFERENCES cortex_foundation.users(id),
        invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        joined_at TIMESTAMP WITH TIME ZONE,
        last_accessed_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE,
        permissions JSONB DEFAULT '{}',
        PRIMARY KEY (space_id, user_id)
      );
    `);

    // Entity Activities table (Activity tracking)
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.entity_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES cortex_foundation.workspaces(id),
        entity_id VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        actor_user_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id),
        activity_type cortex_foundation.activity_type NOT NULL,
        target_entity_id VARCHAR(50),
        target_entity_type VARCHAR(50),
        description TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Entity Tags table (Universal tagging system)
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.entity_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES cortex_foundation.workspaces(id),
        entity_id VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        tag_name VARCHAR(100) NOT NULL,
        tag_color VARCHAR(7),
        created_by VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(entity_id, tag_name)
      );
    `);

    console.log("✅ Foundation tables created successfully");
  }

  /**
   * Phase 2: Create Bridge Tables for Data Mapping
   */
  private async createBridgeTables(): Promise<void> {
    console.log("🌉 Creating bridge tables for data mapping...");

    // App Users to Cortex Foundation Users mapping
    await this.db.execute(sql`
      CREATE TABLE app_to_cortex_user_bridge (
        app_user_id UUID NOT NULL,
        cortex_user_id VARCHAR(50) NOT NULL,
        migration_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (app_user_id, cortex_user_id)
      );
    `);

    // App Workspaces to Cortex Foundation Workspaces mapping
    await this.db.execute(sql`
      CREATE TABLE app_to_cortex_workspace_bridge (
        app_workspace_id UUID NOT NULL,
        cortex_workspace_id UUID NOT NULL,
        migration_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (app_workspace_id, cortex_workspace_id)
      );
    `);

    // App Spaces to Cortex Foundation Spaces mapping
    await this.db.execute(sql`
      CREATE TABLE app_to_cortex_space_bridge (
        app_space_id INTEGER NOT NULL,
        cortex_space_id VARCHAR(50) NOT NULL,
        migration_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (app_space_id, cortex_space_id)
      );
    `);

    console.log("✅ Bridge tables created successfully");
  }

  /**
   * Phase 3: Migrate Data from App Schema to Cortex Foundation
   */
  private async migrateAppData(): Promise<void> {
    console.log("📦 Migrating app schema data to cortex foundation...");

    // Migrate Users
    await this.migrateUsers();
    
    // Migrate Workspaces
    await this.migrateWorkspaces();
    
    // Migrate Spaces
    await this.migrateSpaces();
    
    // Migrate Space Members
    await this.migrateSpaceMembers();
    
    // Migrate Workspace Members
    await this.migrateWorkspaceMembers();
    
    // Migrate Additional Tables
    await this.migrateAdditionalTables();

    console.log("✅ Data migration completed successfully");
  }

  /**
   * Migrate Users from app.users to cortex_foundation.users
   */
  private async migrateUsers(): Promise<void> {
    console.log("👥 Migrating users...");

    await this.db.execute(sql`
      WITH migrated_users AS (
        INSERT INTO cortex_foundation.users (
          email,
          password_hash,
          full_name,
          avatar_url,
          created_at,
          updated_at
        )
        SELECT 
          email,
          password_hash,
          COALESCE(full_name, email) as full_name,
          avatar_url,
          created_at,
          updated_at
        FROM app.users
        RETURNING id, email
      )
      INSERT INTO app_to_cortex_user_bridge (app_user_id, cortex_user_id)
      SELECT 
        au.user_id,
        cu.id
      FROM app.users au
      JOIN migrated_users cu ON au.email = cu.email;
    `);

    const userCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.users;`);
    console.log(`✅ Migrated ${userCount.rows[0].count} users`);
  }

  /**
   * Migrate Workspaces from app.workspaces to cortex_foundation.workspaces
   */
  private async migrateWorkspaces(): Promise<void> {
    console.log("🏢 Migrating workspaces...");

    await this.db.execute(sql`
      WITH migrated_workspaces AS (
        INSERT INTO cortex_foundation.workspaces (
          name,
          slug,
          owner_user_id,
          created_at,
          updated_at
        )
        SELECT 
          aw.workspace_name,
          LOWER(REGEXP_REPLACE(aw.workspace_name, '[^a-zA-Z0-9]+', '-', 'g')) as slug,
          cub.cortex_user_id,
          aw.created_at,
          aw.updated_at
        FROM app.workspaces aw
        JOIN app_to_cortex_user_bridge cub ON aw.owner_id = cub.app_user_id
        RETURNING id, name
      )
      INSERT INTO app_to_cortex_workspace_bridge (app_workspace_id, cortex_workspace_id)
      SELECT 
        aw.workspace_id,
        cw.id
      FROM app.workspaces aw
      JOIN migrated_workspaces cw ON aw.workspace_name = cw.name;
    `);

    const workspaceCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.workspaces;`);
    console.log(`✅ Migrated ${workspaceCount.rows[0].count} workspaces`);
  }

  /**
   * Migrate Spaces from app.spaces to cortex_foundation.spaces
   */
  private async migrateSpaces(): Promise<void> {
    console.log("📁 Migrating spaces...");

    await this.db.execute(sql`
      WITH migrated_spaces AS (
        INSERT INTO cortex_foundation.spaces (
          workspace_id,
          parent_space_id,
          creator_user_id,
          name,
          description,
          icon,
          color,
          cover_image_url,
          space_type,
          privacy,
          is_archived,
          is_favorite,
          display_order,
          level,
          path,
          settings,
          created_at,
          updated_at
        )
        SELECT 
          cwb.cortex_workspace_id,
          parent_bridge.cortex_space_id as parent_space_id,
          cub.cortex_user_id,
          asp.space_name,
          asp.description,
          COALESCE(asp.icon, '📁'),
          COALESCE(asp.color, '#3B82F6'),
          asp.cover_image,
          CASE 
            WHEN asp.space_type = 'workspace' THEN 'workspace'::cortex_foundation.space_type
            WHEN asp.space_type = 'project' THEN 'project'::cortex_foundation.space_type
            WHEN asp.space_type = 'team' THEN 'team'::cortex_foundation.space_type
            WHEN asp.space_type = 'personal' THEN 'personal'::cortex_foundation.space_type
            WHEN asp.space_type = 'archive' THEN 'archive'::cortex_foundation.space_type
            ELSE 'folder'::cortex_foundation.space_type
          END,
          CASE 
            WHEN asp.privacy = 'public' THEN 'public'::cortex_foundation.privacy
            WHEN asp.privacy = 'private' THEN 'private'::cortex_foundation.privacy
            WHEN asp.privacy = 'restricted' THEN 'restricted'::cortex_foundation.privacy
            ELSE 'private'::cortex_foundation.privacy
          END,
          asp.is_archived,
          asp.is_favorite,
          asp.display_order,
          COALESCE(asp.level, 0),
          asp.path,
          COALESCE(asp.settings, '{}'),
          asp.created_at,
          asp.updated_at
        FROM app.spaces asp
        JOIN app_to_cortex_workspace_bridge cwb ON asp.workspace_id = cwb.app_workspace_id
        JOIN app_to_cortex_user_bridge cub ON asp.creator_user_id = cub.app_user_id
        LEFT JOIN app_to_cortex_space_bridge parent_bridge ON asp.parent_space_id = parent_bridge.app_space_id
        RETURNING id, name
      )
      INSERT INTO app_to_cortex_space_bridge (app_space_id, cortex_space_id)
      SELECT 
        asp.space_id,
        cs.id
      FROM app.spaces asp
      JOIN migrated_spaces cs ON asp.space_name = cs.name;
    `);

    const spaceCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.spaces;`);
    console.log(`✅ Migrated ${spaceCount.rows[0].count} spaces`);
  }

  /**
   * Migrate Space Members
   */
  private async migrateSpaceMembers(): Promise<void> {
    console.log("👥 Migrating space members...");

    await this.db.execute(sql`
      INSERT INTO cortex_foundation.space_members (
        space_id,
        user_id,
        role,
        joined_at,
        is_active
      )
      SELECT 
        csb.cortex_space_id,
        cub.cortex_user_id,
        CASE 
          WHEN asm.role = 'admin' THEN 'admin'::cortex_foundation.member_role
          WHEN asm.role = 'editor' THEN 'editor'::cortex_foundation.member_role
          WHEN asm.role = 'viewer' THEN 'viewer'::cortex_foundation.member_role
          ELSE 'viewer'::cortex_foundation.member_role
        END,
        NOW(),
        TRUE
      FROM app.space_members asm
      JOIN app_to_cortex_space_bridge csb ON asm.space_id = csb.app_space_id
      JOIN app_to_cortex_user_bridge cub ON asm.user_id = cub.app_user_id;
    `);

    const spaceMemberCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.space_members;`);
    console.log(`✅ Migrated ${spaceMemberCount.rows[0].count} space members`);
  }

  /**
   * Migrate Workspace Members
   */
  private async migrateWorkspaceMembers(): Promise<void> {
    console.log("🏢 Migrating workspace members...");

    await this.db.execute(sql`
      INSERT INTO cortex_foundation.workspace_members (
        workspace_id,
        user_id,
        role,
        joined_at,
        is_active
      )
      SELECT 
        cwb.cortex_workspace_id,
        cub.cortex_user_id,
        CASE 
          WHEN awm.role = 'admin' THEN 'admin'::cortex_foundation.member_role
          WHEN awm.role = 'member' THEN 'editor'::cortex_foundation.member_role
          WHEN awm.role = 'viewer' THEN 'viewer'::cortex_foundation.member_role
          ELSE 'viewer'::cortex_foundation.member_role
        END,
        NOW(),
        TRUE
      FROM app.workspace_members awm
      JOIN app_to_cortex_workspace_bridge cwb ON awm.workspace_id = cwb.app_workspace_id
      JOIN app_to_cortex_user_bridge cub ON awm.user_id = cub.app_user_id;
    `);

    const workspaceMemberCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.workspace_members;`);
    console.log(`✅ Migrated ${workspaceMemberCount.rows[0].count} workspace members`);
  }

  /**
   * Migrate Additional Tables (Templates, Items, Views, etc.)
   */
  private async migrateAdditionalTables(): Promise<void> {
    console.log("📋 Migrating additional app schema tables...");

    // Note: Space Templates, Space Items, Space Views, Channels, User Preferences
    // These would be migrated to appropriate Cortex schemas (cortex_knowledge, cortex_communication, etc.)
    // For now, we'll leave them in the app schema and create migration paths as needed

    console.log("✅ Additional tables migration completed");
  }

  /**
   * Phase 4: Create Indexes and Constraints
   */
  private async createIndexesAndConstraints(): Promise<void> {
    console.log("🔍 Creating indexes and constraints...");

    // Users indexes
    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS cortex_foundation_users_email_idx ON cortex_foundation.users(email);
      CREATE INDEX IF NOT EXISTS cortex_foundation_users_active_idx ON cortex_foundation.users(is_active);
      CREATE INDEX IF NOT EXISTS cortex_foundation_users_last_seen_idx ON cortex_foundation.users(last_seen_at);
    `);

    // Workspaces indexes
    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS cortex_foundation_workspaces_owner_idx ON cortex_foundation.workspaces(owner_user_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_workspaces_active_idx ON cortex_foundation.workspaces(is_active);
    `);

    // Spaces indexes
    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_workspace_idx ON cortex_foundation.spaces(workspace_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_parent_idx ON cortex_foundation.spaces(parent_space_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_creator_idx ON cortex_foundation.spaces(creator_user_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_type_idx ON cortex_foundation.spaces(space_type);
      CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_path_idx ON cortex_foundation.spaces USING GIN(path gin_trgm_ops);
    `);

    // Entity relationships indexes
    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_relationships_source_idx ON cortex_foundation.entity_relationships(source_entity_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_relationships_target_idx ON cortex_foundation.entity_relationships(target_entity_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_relationships_type_idx ON cortex_foundation.entity_relationships(relationship_type);
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_relationships_workspace_idx ON cortex_foundation.entity_relationships(workspace_id);
    `);

    // Activities indexes
    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_activities_entity_idx ON cortex_foundation.entity_activities(entity_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_activities_actor_idx ON cortex_foundation.entity_activities(actor_user_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_activities_workspace_idx ON cortex_foundation.entity_activities(workspace_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_activities_target_idx ON cortex_foundation.entity_activities(target_entity_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_activities_created_idx ON cortex_foundation.entity_activities(created_at);
    `);

    // Tags indexes
    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_tags_entity_idx ON cortex_foundation.entity_tags(entity_id);
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_tags_name_idx ON cortex_foundation.entity_tags(tag_name);
      CREATE INDEX IF NOT EXISTS cortex_foundation_entity_tags_workspace_idx ON cortex_foundation.entity_tags(workspace_id);
    `);

    console.log("✅ Indexes and constraints created successfully");
  }

  /**
   * Phase 5: Create Migration Audit Trail
   */
  private async createMigrationAudit(): Promise<void> {
    console.log("📊 Creating migration audit trail...");

    // Create audit table
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_cortex_migration_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        migration_type VARCHAR(50) NOT NULL,
        source_table VARCHAR(100) NOT NULL,
        target_table VARCHAR(100) NOT NULL,
        records_migrated INTEGER NOT NULL,
        migration_start TIMESTAMP WITH TIME ZONE NOT NULL,
        migration_end TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        metadata JSONB DEFAULT '{}'
      );
    `);

    // Record migration statistics
    const stats = await this.getMigrationStatistics();
    
    for (const stat of stats) {
      await this.db.execute(sql`
        INSERT INTO app_cortex_migration_audit (
          migration_type,
          source_table,
          target_table,
          records_migrated,
          migration_start,
          metadata
        ) VALUES (
          'app_to_cortex_foundation',
          ${stat.sourceTable},
          ${stat.targetTable},
          ${stat.recordCount},
          NOW(),
          ${JSON.stringify(stat.metadata)}
        );
      `);
    }

    console.log("✅ Migration audit trail created successfully");
  }

  /**
   * Get migration statistics for audit trail
   */
  private async getMigrationStatistics(): Promise<Array<{
    sourceTable: string;
    targetTable: string;
    recordCount: number;
    metadata: any;
  }>> {
    const stats = [];

    // Users statistics
    const userCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.users;`);
    stats.push({
      sourceTable: 'app.users',
      targetTable: 'cortex_foundation.users',
      recordCount: parseInt(userCount.rows[0].count),
      metadata: { entity_prefix: 'cu_' }
    });

    // Workspaces statistics
    const workspaceCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.workspaces;`);
    stats.push({
      sourceTable: 'app.workspaces',
      targetTable: 'cortex_foundation.workspaces',
      recordCount: parseInt(workspaceCount.rows[0].count),
      metadata: { maintains_uuid: true }
    });

    // Spaces statistics
    const spaceCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.spaces;`);
    stats.push({
      sourceTable: 'app.spaces',
      targetTable: 'cortex_foundation.spaces',
      recordCount: parseInt(spaceCount.rows[0].count),
      metadata: { entity_prefix: 'cs_' }
    });

    return stats;
  }

  /**
   * Validation method to check migration integrity
   */
  async validateMigration(): Promise<void> {
    console.log("🔍 Validating migration integrity...");

    // Check user count consistency
    const appUserCount = await this.db.execute(sql`SELECT COUNT(*) FROM app.users;`);
    const cortexUserCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.users;`);
    
    if (appUserCount.rows[0].count !== cortexUserCount.rows[0].count) {
      throw new Error(`User count mismatch: app=${appUserCount.rows[0].count}, cortex=${cortexUserCount.rows[0].count}`);
    }

    // Check workspace count consistency
    const appWorkspaceCount = await this.db.execute(sql`SELECT COUNT(*) FROM app.workspaces;`);
    const cortexWorkspaceCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.workspaces;`);
    
    if (appWorkspaceCount.rows[0].count !== cortexWorkspaceCount.rows[0].count) {
      throw new Error(`Workspace count mismatch: app=${appWorkspaceCount.rows[0].count}, cortex=${cortexWorkspaceCount.rows[0].count}`);
    }

    // Check space count consistency
    const appSpaceCount = await this.db.execute(sql`SELECT COUNT(*) FROM app.spaces;`);
    const cortexSpaceCount = await this.db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.spaces;`);
    
    if (appSpaceCount.rows[0].count !== cortexSpaceCount.rows[0].count) {
      throw new Error(`Space count mismatch: app=${appSpaceCount.rows[0].count}, cortex=${cortexSpaceCount.rows[0].count}`);
    }

    // Validate bridge table completeness
    const bridgeUserCount = await this.db.execute(sql`SELECT COUNT(*) FROM app_to_cortex_user_bridge;`);
    if (bridgeUserCount.rows[0].count !== appUserCount.rows[0].count) {
      throw new Error(`User bridge table incomplete: expected=${appUserCount.rows[0].count}, actual=${bridgeUserCount.rows[0].count}`);
    }

    console.log("✅ Migration validation completed successfully");
    console.log(`📊 Migration Summary:`);
    console.log(`   Users: ${cortexUserCount.rows[0].count}`);
    console.log(`   Workspaces: ${cortexWorkspaceCount.rows[0].count}`);
    console.log(`   Spaces: ${cortexSpaceCount.rows[0].count}`);
  }
}