#!/usr/bin/env node

/**
 * Cortex Schema Migration Script
 * Phase 1: Non-destructive schema creation
 * 
 * This script creates the new Cortex schema alongside existing schemas
 * without affecting the current database structure.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

async function runCortexMigration() {
  console.log("🚀 Starting Cortex Foundation Schema Migration (Phase 1)");
  console.log("=========================================================");
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  try {
    // First compile TypeScript migration file
    console.log("📦 Compiling TypeScript migration...");
    await execAsync('npx tsx server/cortex-migration.ts');
    
    console.log("✅ Foundation schema created successfully!");
    console.log("\nWhat's been created:");
    console.log("• cortex_foundation schema with core tables");
    console.log("• Foundation Users table (cu_ prefixed IDs)");
    console.log("• Foundation Workspaces table with multi-tenancy");
    console.log("• Foundation Spaces table (cs_ prefixed IDs)");
    console.log("• Universal entity relationships system");
    console.log("• Workspace and space member management");
    console.log("• Activity logging and tagging systems");
    console.log("• Performance-optimized indexes");

    console.log("\nNext steps:");
    console.log("• Phase 2: Create bridge tables for data migration");
    console.log("• Phase 3: Implement Cortex API endpoints");
    console.log("• Phase 4: Create migration utilities");
    console.log("• Phase 5: Frontend integration");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.log("Attempting direct SQL creation...");
    
    try {
      await createFoundationSchemaDirectly();
    } catch (directError) {
      console.error("❌ Direct SQL creation also failed:", directError);
      process.exit(1);
    }
  }
}

async function createFoundationSchemaDirectly() {
  const { default: postgres } = await import('postgres');
  
  const dbUrl = process.env.DATABASE_URL;
  const sql = postgres(dbUrl);

  console.log("🔧 Creating foundation schema directly...");

  try {
    // Create schemas
    await sql`CREATE SCHEMA IF NOT EXISTS cortex_foundation;`;
    console.log("✅ cortex_foundation schema created");

    // Create entity ID generation function
    await sql`
      CREATE OR REPLACE FUNCTION generate_entity_id(prefix TEXT)
      RETURNS VARCHAR(50) AS $$
      BEGIN
        RETURN prefix || '_' || REPLACE(gen_random_uuid()::TEXT, '-', '');
      END;
      $$ LANGUAGE plpgsql;
    `;
    console.log("✅ Entity ID generation function created");

    // Create enums
    await sql`
      DO $$ BEGIN
        CREATE TYPE cortex_foundation.plan_type AS ENUM (
          'free', 'starter', 'professional', 'enterprise'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE cortex_foundation.space_type AS ENUM (
          'folder', 'workspace', 'project', 'team', 'personal', 'archive', 'template'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE cortex_foundation.privacy AS ENUM (
          'private', 'public', 'restricted', 'shared'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE cortex_foundation.relationship_type AS ENUM (
          'related_to', 'belongs_to', 'contains', 'depends_on', 'blocks', 'references',
          'married_to', 'parent_of', 'child_of', 'sibling_of', 'friend_of', 'colleague_of',
          'manager_of', 'reports_to', 'works_for', 'founded', 'consultant_for',
          'subsidiary_of', 'owns', 'client_of', 'vendor_of', 'partner_with', 'competitor_of',
          'manages', 'sponsors', 'assigned_to', 'predecessor_of', 'successor_of',
          'created_by', 'mentions', 'about', 'taken_during', 'summary_of', 'tagged_with'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log("✅ Foundation enums created");

    // Create Users table
    await sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.users (
        id VARCHAR(50) PRIMARY KEY DEFAULT generate_entity_id('cu'),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        profile_picture_url VARCHAR(500),
        timezone VARCHAR(50) DEFAULT 'UTC',
        locale VARCHAR(10) DEFAULT 'en_US',
        is_email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        email_verification_expires TIMESTAMP,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP,
        last_login_at TIMESTAMP,
        login_count INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        is_admin BOOLEAN DEFAULT FALSE,
        notification_preferences JSONB DEFAULT '{}',
        ui_preferences JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log("✅ Users table created");

    // Create Workspaces table
    await sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        logo_url VARCHAR(500),
        primary_color VARCHAR(7),
        domain VARCHAR(255),
        owner_user_id VARCHAR(50) NOT NULL,
        plan_type cortex_foundation.plan_type DEFAULT 'free',
        max_users INTEGER DEFAULT 5,
        max_storage_gb INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        trial_ends_at TIMESTAMP,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log("✅ Workspaces table created");

    // Create other foundation tables
    await sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.spaces (
        id VARCHAR(50) PRIMARY KEY DEFAULT generate_entity_id('cs'),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_space_id VARCHAR(50) REFERENCES cortex_foundation.spaces(id) ON DELETE CASCADE,
        space_type cortex_foundation.space_type DEFAULT 'folder',
        category VARCHAR(100),
        privacy cortex_foundation.privacy DEFAULT 'private',
        owner_user_id VARCHAR(50) NOT NULL,
        color VARCHAR(7),
        icon VARCHAR(50),
        cover_image_url VARCHAR(500),
        is_starred BOOLEAN DEFAULT FALSE,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_archived BOOLEAN DEFAULT FALSE,
        last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sort_order INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        path TEXT,
        template_id VARCHAR(50),
        is_template BOOLEAN DEFAULT FALSE,
        custom_fields JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CHECK (id != parent_space_id)
      );
    `;
    console.log("✅ Spaces table created");

    await sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.entity_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_entity_id VARCHAR(50) NOT NULL,
        to_entity_id VARCHAR(50),
        content_type VARCHAR(50),
        content_id VARCHAR(50),
        relationship_type cortex_foundation.relationship_type NOT NULL,
        is_bidirectional BOOLEAN DEFAULT FALSE,
        weight NUMERIC(3,2) DEFAULT 1.0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        
        CHECK (
          (to_entity_id IS NOT NULL AND content_type IS NULL AND content_id IS NULL) OR
          (to_entity_id IS NULL AND content_type IS NOT NULL AND content_id IS NOT NULL)
        ),
        CHECK (from_entity_id != to_entity_id OR to_entity_id IS NULL),
        CHECK (weight >= 0.0 AND weight <= 1.0)
      );
    `;
    console.log("✅ Entity relationships table created");

    // Create member tables
    await sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.workspace_members (
        workspace_id UUID NOT NULL REFERENCES cortex_foundation.workspaces(id) ON DELETE CASCADE,
        user_id VARCHAR(50) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        permissions JSONB DEFAULT '{}',
        invited_by VARCHAR(50),
        invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        joined_at TIMESTAMP,
        last_active_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (workspace_id, user_id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.space_members (
        space_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.spaces(id) ON DELETE CASCADE,
        user_id VARCHAR(50) NOT NULL,
        role VARCHAR(50) DEFAULT 'viewer',
        permissions JSONB DEFAULT '{"canRead": true, "canWrite": false, "canShare": false, "canDelete": false, "canManageMembers": false}',
        invited_by VARCHAR(50),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (space_id, user_id)
      );
    `;
    console.log("✅ Member tables created");

    // Create logging and tagging tables
    await sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES cortex_foundation.workspaces(id),
        user_id VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50),
        entity_id VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        description TEXT,
        changes JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cortex_foundation.tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        color VARCHAR(7),
        icon VARCHAR(50),
        category VARCHAR(100),
        workspace_id UUID REFERENCES cortex_foundation.workspaces(id),
        created_by VARCHAR(50) NOT NULL,
        usage_count INTEGER DEFAULT 0,
        is_system BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE (workspace_id, name)
      );
    `;
    console.log("✅ Activity and tagging tables created");

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS cortex_foundation_users_email_idx ON cortex_foundation.users(email);`;
    await sql`CREATE INDEX IF NOT EXISTS cortex_foundation_workspaces_owner_idx ON cortex_foundation.workspaces(owner_user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_parent_idx ON cortex_foundation.spaces(parent_space_id);`;
    await sql`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_owner_idx ON cortex_foundation.spaces(owner_user_id);`;
    console.log("✅ Foundation indexes created");

    await sql.end();
    
    console.log("\n🎉 Cortex Foundation Schema created successfully!");
    console.log("\nCore Foundation Tables Ready:");
    console.log("• Users (cu_ prefixed IDs) - User management and authentication");
    console.log("• Workspaces - Multi-tenant workspace organization");  
    console.log("• Spaces (cs_ prefixed IDs) - Google Drive-like hierarchical organization");
    console.log("• Entity Relationships - Universal linking between any entities");
    console.log("• Member Management - Workspace and space permissions");
    console.log("• Activity Logging - Complete audit trail");
    console.log("• Tagging System - Universal content organization");

  } catch (error) {
    console.error("❌ Error in direct creation:", error);
    throw error;
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Cortex Schema Migration Script

Usage:
  node run-cortex-migration.js [options]

Options:
  --samples    Create sample data for testing
  --help, -h   Show this help message

Examples:
  node run-cortex-migration.js
  node run-cortex-migration.js --samples
  `);
  process.exit(0);
}

// Run the migration
runCortexMigration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});