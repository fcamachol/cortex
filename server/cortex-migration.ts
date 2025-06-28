import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  cortexSchema,
  cortexEntities,
  cortexSpaces,
  cortexSpaceItems,
  cortexSpaceMembers,
  cortexSpaceShareLinks,
  cortexSpaceActivity,
  cortexEntityRelationships,
  cortexEntityLinks,
  cortexTasks,
  cortexNotes,
  cortexDocuments,
  cortexBills,
  cortexActivityLog,
  cortexTags
} from "../shared/cortex-schema.js";
import {
  cortexFoundationSchema,
  cortexFoundationUsers,
  cortexFoundationWorkspaces,
  cortexFoundationEntityRelationships,
  cortexFoundationSpaces,
  cortexFoundationWorkspaceMembers,
  cortexFoundationSpaceMembers,
  cortexFoundationActivityLog,
  cortexFoundationTags
} from "../shared/cortex-foundation-schema.js";
import { nanoid } from "nanoid";

// =====================================================
// CORTEX MIGRATION UTILITY
// Phase 1: Non-destructive schema creation
// =====================================================

export class CortexMigration {
  private db: any;
  
  constructor(dbUrl: string) {
    const sql = postgres(dbUrl);
    this.db = drizzle(sql);
  }

  /**
   * Phase 1: Create Cortex schemas and tables without affecting existing structure
   */
  async createCortexSchema(): Promise<void> {
    console.log("🚀 Starting Cortex schemas creation (Phase 1)...");
    
    try {
      // Create schemas if they don't exist
      await this.db.execute(`CREATE SCHEMA IF NOT EXISTS cortex;`);
      await this.db.execute(`CREATE SCHEMA IF NOT EXISTS cortex_foundation;`);
      console.log("✅ Cortex schemas created");

      // Create entity ID generation function
      await this.createEntityIdFunction();
      console.log("✅ Entity ID generation function created");

      // Create all enums
      await this.createEnums();
      console.log("✅ Cortex enums created");

      // Create foundation enums
      await this.createFoundationEnums();
      console.log("✅ Foundation enums created");

      // Create all tables
      await this.createTables();
      console.log("✅ Cortex tables created");

      // Create foundation tables
      await this.createFoundationTables();
      console.log("✅ Foundation tables created");

      // Create indexes
      await this.createIndexes();
      console.log("✅ Cortex indexes created");

      // Create useful views
      await this.createViews();
      console.log("✅ Cortex views created");

      console.log("🎉 Cortex schemas creation completed successfully!");
      
    } catch (error) {
      console.error("❌ Error creating Cortex schemas:", error);
      throw error;
    }
  }

  /**
   * Create entity ID generation function
   */
  private async createEntityIdFunction(): Promise<void> {
    await this.db.execute(`
      CREATE OR REPLACE FUNCTION generate_entity_id(prefix TEXT)
      RETURNS VARCHAR(50) AS $$
      BEGIN
        RETURN prefix || '_' || REPLACE(gen_random_uuid()::TEXT, '-', '');
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  /**
   * Create all enum types
   */
  private async createEnums(): Promise<void> {
    const enums = [
      `CREATE TYPE cortex.entity_type AS ENUM ('cp', 'cc', 'cg', 'co', 'ca', 'cv', 'cj', 'ce', 'cs');`,
      `CREATE TYPE cortex.content_type AS ENUM ('task', 'note', 'document', 'bill', 'receivable', 'transaction');`,
      `CREATE TYPE cortex.relationship_type AS ENUM (
        'related_to', 'belongs_to', 'contains', 'depends_on', 'blocks',
        'married_to', 'parent_of', 'child_of', 'sibling_of', 'friend_of', 'colleague_of',
        'manager_of', 'reports_to', 'works_for', 'founder_of', 'consultant_for',
        'subsidiary_of', 'owns', 'client_of', 'vendor_of', 'partner_with',
        'manages', 'sponsors', 'assigned_to', 'predecessor_of', 'successor_of',
        'created_by', 'mentions', 'about', 'taken_during', 'references', 'summary_of'
      );`,
      `CREATE TYPE cortex.space_role AS ENUM ('owner', 'editor', 'commenter', 'viewer');`,
      `CREATE TYPE cortex.share_link_type AS ENUM ('view_only', 'comment', 'edit');`
    ];

    for (const enumSql of enums) {
      try {
        await this.db.execute(enumSql);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
  }

  /**
   * Create foundation enums
   */
  private async createFoundationEnums(): Promise<void> {
    // Plan type enum
    await this.db.execute(`
      CREATE TYPE cortex_foundation.plan_type AS ENUM (
        'free', 'starter', 'professional', 'enterprise'
      );
    `);

    // Space type enum
    await this.db.execute(`
      CREATE TYPE cortex_foundation.space_type AS ENUM (
        'folder', 'workspace', 'project', 'team', 'personal', 'archive', 'template'
      );
    `);

    // Privacy enum
    await this.db.execute(`
      CREATE TYPE cortex_foundation.privacy AS ENUM (
        'private', 'public', 'restricted', 'shared'
      );
    `);

    // Relationship type enum
    await this.db.execute(`
      CREATE TYPE cortex_foundation.relationship_type AS ENUM (
        'related_to', 'belongs_to', 'contains', 'depends_on', 'blocks', 'references',
        'married_to', 'parent_of', 'child_of', 'sibling_of', 'friend_of', 'colleague_of',
        'manager_of', 'reports_to', 'works_for', 'founded', 'consultant_for',
        'subsidiary_of', 'owns', 'client_of', 'vendor_of', 'partner_with', 'competitor_of',
        'manages', 'sponsors', 'assigned_to', 'predecessor_of', 'successor_of',
        'created_by', 'mentions', 'about', 'taken_during', 'summary_of', 'tagged_with'
      );
    `);
  }

  /**
   * Create foundation tables
   */
  private async createFoundationTables(): Promise<void> {
    // Foundation Users table
    await this.db.execute(`
      CREATE TABLE cortex_foundation.users (
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
    `);

    // Foundation Workspaces table
    await this.db.execute(`
      CREATE TABLE cortex_foundation.workspaces (
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
        trial_ends_at TIMESTAMP,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Foundation Entity Relationships table
    await this.db.execute(`
      CREATE TABLE cortex_foundation.entity_relationships (
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
    `);

    // Foundation Spaces table
    await this.db.execute(`
      CREATE TABLE cortex_foundation.spaces (
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
    `);

    // Foundation Workspace Members table
    await this.db.execute(`
      CREATE TABLE cortex_foundation.workspace_members (
        workspace_id UUID NOT NULL REFERENCES cortex_foundation.workspaces(id) ON DELETE CASCADE,
        user_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        permissions JSONB DEFAULT '{}',
        invited_by VARCHAR(50),
        invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        joined_at TIMESTAMP,
        last_active_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (workspace_id, user_id)
      );
    `);

    // Foundation Space Members table
    await this.db.execute(`
      CREATE TABLE cortex_foundation.space_members (
        space_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.spaces(id) ON DELETE CASCADE,
        user_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'viewer',
        permissions JSONB DEFAULT '{"canRead": true, "canWrite": false, "canShare": false, "canDelete": false, "canManageMembers": false}',
        invited_by VARCHAR(50),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (space_id, user_id)
      );
    `);

    // Foundation Activity Log table
    await this.db.execute(`
      CREATE TABLE cortex_foundation.activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES cortex_foundation.workspaces(id),
        user_id VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id),
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
    `);

    // Foundation Tags table
    await this.db.execute(`
      CREATE TABLE cortex_foundation.tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        color VARCHAR(7),
        icon VARCHAR(50),
        category VARCHAR(100),
        workspace_id UUID REFERENCES cortex_foundation.workspaces(id),
        created_by VARCHAR(50) NOT NULL REFERENCES cortex_foundation.users(id),
        usage_count INTEGER DEFAULT 0,
        is_system BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE (workspace_id, name)
      );
    `);

    // Create indexes for foundation tables
    await this.createFoundationIndexes();
  }

  /**
   * Create foundation table indexes
   */
  private async createFoundationIndexes(): Promise<void> {
    // Users indexes
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_users_email_idx ON cortex_foundation.users(email);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_users_active_idx ON cortex_foundation.users(is_active);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_users_last_seen_idx ON cortex_foundation.users(last_seen_at);`);

    // Workspaces indexes
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_workspaces_owner_idx ON cortex_foundation.workspaces(owner_user_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_workspaces_active_idx ON cortex_foundation.workspaces(is_active);`);

    // Entity relationships indexes
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_entity_relationships_from_idx ON cortex_foundation.entity_relationships(from_entity_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_entity_relationships_to_idx ON cortex_foundation.entity_relationships(to_entity_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_entity_relationships_content_idx ON cortex_foundation.entity_relationships(content_type, content_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_entity_relationships_type_idx ON cortex_foundation.entity_relationships(relationship_type);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_entity_relationships_active_idx ON cortex_foundation.entity_relationships(is_active);`);

    // Spaces indexes
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_name_idx ON cortex_foundation.spaces(name);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_parent_idx ON cortex_foundation.spaces(parent_space_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_owner_idx ON cortex_foundation.spaces(owner_user_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_type_idx ON cortex_foundation.spaces(space_type);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_category_idx ON cortex_foundation.spaces(category);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_level_idx ON cortex_foundation.spaces(level);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_path_idx ON cortex_foundation.spaces(path);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_spaces_sort_order_idx ON cortex_foundation.spaces(sort_order);`);

    // Workspace members indexes
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_workspace_members_workspace_idx ON cortex_foundation.workspace_members(workspace_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_workspace_members_user_idx ON cortex_foundation.workspace_members(user_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_workspace_members_role_idx ON cortex_foundation.workspace_members(role);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_workspace_members_active_idx ON cortex_foundation.workspace_members(is_active);`);

    // Space members indexes
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_space_members_space_idx ON cortex_foundation.space_members(space_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_space_members_user_idx ON cortex_foundation.space_members(user_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_space_members_role_idx ON cortex_foundation.space_members(role);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_space_members_active_idx ON cortex_foundation.space_members(is_active);`);

    // Activity log indexes
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_activity_log_workspace_idx ON cortex_foundation.activity_log(workspace_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_activity_log_user_idx ON cortex_foundation.activity_log(user_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_activity_log_entity_idx ON cortex_foundation.activity_log(entity_type, entity_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_activity_log_action_idx ON cortex_foundation.activity_log(action);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_activity_log_created_at_idx ON cortex_foundation.activity_log(created_at);`);

    // Tags indexes
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_tags_name_idx ON cortex_foundation.tags(name);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_tags_category_idx ON cortex_foundation.tags(category);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_tags_workspace_idx ON cortex_foundation.tags(workspace_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_tags_created_by_idx ON cortex_foundation.tags(created_by);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_tags_usage_idx ON cortex_foundation.tags(usage_count);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS cortex_foundation_tags_system_idx ON cortex_foundation.tags(is_system);`);
  }

  /**
   * Create all tables
   */
  private async createTables(): Promise<void> {
    // Tables are created automatically by Drizzle when using schema
    // This method is for any custom table creation logic if needed
    console.log("Tables will be created automatically by Drizzle schema");
  }

  /**
   * Create additional indexes for performance
   */
  private async createIndexes(): Promise<void> {
    const indexes = [
      // Full-text search index for notes
      `CREATE INDEX IF NOT EXISTS cortex_notes_content_search_idx ON cortex.notes USING gin(to_tsvector('english', content));`,
      
      // Composite indexes for common queries
      `CREATE INDEX IF NOT EXISTS cortex_entity_links_content_entity_idx ON cortex.entity_links (content_type, content_id, entity_id);`,
      `CREATE INDEX IF NOT EXISTS cortex_entity_relationships_bidirectional_idx ON cortex.entity_relationships (from_entity_id, to_entity_id);`,
      
      // Space hierarchy index
      `CREATE INDEX IF NOT EXISTS cortex_spaces_hierarchy_idx ON cortex.spaces (parent_space_id, level, sort_order);`,
      
      // Activity log performance index
      `CREATE INDEX IF NOT EXISTS cortex_activity_log_entity_time_idx ON cortex.activity_log (entity_id, created_at DESC);`,
      
      // Tags usage index
      `CREATE INDEX IF NOT EXISTS cortex_tags_usage_desc_idx ON cortex.tags (usage_count DESC);`
    ];

    for (const indexSql of indexes) {
      try {
        await this.db.execute(indexSql);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists')) {
          console.warn("Index creation warning:", error.message);
        }
      }
    }
  }

  /**
   * Create useful views for common queries
   */
  private async createViews(): Promise<void> {
    const views = [
      // Entity content summary view
      `CREATE OR REPLACE VIEW cortex.entity_content_summary AS
       SELECT 
         e.id as entity_id,
         e.name as entity_name,
         e.entity_type,
         el.content_type,
         COUNT(el.content_id) as content_count,
         array_agg(DISTINCT el.relationship_type) as relationship_types
       FROM cortex.entities e
       LEFT JOIN cortex.entity_links el ON e.id = el.entity_id
       GROUP BY e.id, e.name, e.entity_type, el.content_type;`,

      // Space contents view
      `CREATE OR REPLACE VIEW cortex.space_contents_summary AS
       SELECT 
         s.id as space_id,
         s.name as space_name,
         s.path,
         si.item_type,
         COUNT(si.item_id) as item_count
       FROM cortex.spaces s
       LEFT JOIN cortex.space_items si ON s.id = si.space_id
       GROUP BY s.id, s.name, s.path, si.item_type;`,

      // Entity relationships graph view
      `CREATE OR REPLACE VIEW cortex.entity_relationships_graph AS
       SELECT 
         er.from_entity_id,
         e1.name as from_entity_name,
         e1.entity_type as from_entity_type,
         er.relationship_type,
         er.to_entity_id,
         e2.name as to_entity_name,
         e2.entity_type as to_entity_type,
         er.strength,
         er.created_at
       FROM cortex.entity_relationships er
       JOIN cortex.entities e1 ON er.from_entity_id = e1.id
       JOIN cortex.entities e2 ON er.to_entity_id = e2.id
       WHERE er.is_active = true;`,

      // Content entity links view
      `CREATE OR REPLACE VIEW cortex.content_entity_links_detailed AS
       SELECT 
         el.content_type,
         el.content_id,
         el.relationship_type,
         e.id as entity_id,
         e.name as entity_name,
         e.entity_type,
         el.strength,
         el.created_at
       FROM cortex.entity_links el
       JOIN cortex.entities e ON el.entity_id = e.id
       WHERE e.is_active = true;`
    ];

    for (const viewSql of views) {
      try {
        await this.db.execute(viewSql);
      } catch (error: any) {
        console.warn("View creation warning:", error.message);
      }
    }
  }

  /**
   * Generate entity IDs with proper prefixes
   */
  static generateEntityId(entityType: string): string {
    const prefix = entityType.toLowerCase();
    const id = nanoid(12);
    return `${prefix}_${id}`;
  }

  /**
   * Validate entity ID format
   */
  static validateEntityId(entityId: string): boolean {
    const validPrefixes = ['cp', 'cc', 'cg', 'co', 'ca', 'cv', 'cj', 'ce', 'cs'];
    const parts = entityId.split('_');
    
    if (parts.length !== 2) return false;
    if (!validPrefixes.includes(parts[0])) return false;
    if (parts[1].length !== 12) return false;
    
    return true;
  }

  /**
   * Get entity type from entity ID
   */
  static getEntityTypeFromId(entityId: string): string | null {
    const parts = entityId.split('_');
    return parts.length === 2 ? parts[0] : null;
  }

  /**
   * Create sample data for testing (optional)
   */
  async createSampleData(): Promise<void> {
    console.log("🌱 Creating sample Cortex data...");
    
    try {
      // Create sample entities
      const personId = CortexMigration.generateEntityId('cp');
      const companyId = CortexMigration.generateEntityId('cc');
      const projectId = CortexMigration.generateEntityId('cj');
      const spaceId = CortexMigration.generateEntityId('cs');

      // Sample entities
      await this.db.insert(cortexEntities).values([
        {
          id: personId,
          entityType: 'cp',
          name: 'John Doe',
          description: 'Software Engineer',
          metadata: { email: 'john@example.com', phone: '+1234567890' },
          tags: ['employee', 'developer'],
          createdBy: 'default-user-id'
        },
        {
          id: companyId,
          entityType: 'cc',
          name: 'Acme Corp',
          description: 'Technology Company',
          metadata: { website: 'https://acme.com', industry: 'Technology' },
          tags: ['client', 'technology'],
          createdBy: 'default-user-id'
        },
        {
          id: projectId,
          entityType: 'cj',
          name: 'Website Redesign',
          description: 'Complete website overhaul project',
          metadata: { budget: 50000, status: 'active' },
          tags: ['web', 'design'],
          createdBy: 'default-user-id'
        }
      ]);

      // Sample space
      await this.db.insert(cortexSpaces).values({
        id: spaceId,
        name: 'Work Projects',
        description: 'Main workspace for project management',
        path: '/work/projects',
        level: 2,
        parentSpaceId: null,
        color: '#3B82F6',
        icon: 'briefcase',
        createdBy: 'default-user-id'
      });

      // Sample relationships
      await this.db.insert(cortexEntityRelationships).values([
        {
          fromEntityId: personId,
          toEntityId: companyId,
          relationshipType: 'works_for',
          strength: 5,
          createdBy: 'default-user-id'
        },
        {
          fromEntityId: personId,
          toEntityId: projectId,
          relationshipType: 'assigned_to',
          strength: 8,
          createdBy: 'default-user-id'
        }
      ]);

      console.log("✅ Sample Cortex data created");
      
    } catch (error) {
      console.error("❌ Error creating sample data:", error);
      throw error;
    }
  }

  /**
   * Check if Cortex schema exists
   */
  async checkSchemaExists(): Promise<boolean> {
    try {
      const result = await this.db.execute(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'cortex';
      `);
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get schema statistics
   */
  async getSchemaStats(): Promise<any> {
    try {
      const result = await this.db.execute(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples
        FROM pg_stat_user_tables 
        WHERE schemaname = 'cortex'
        ORDER BY tablename;
      `);
      
      return result;
    } catch (error) {
      console.error("Error getting schema stats:", error);
      return [];
    }
  }
}

// Export utility functions
export const cortexUtils = {
  generateEntityId: CortexMigration.generateEntityId,
  validateEntityId: CortexMigration.validateEntityId,
  getEntityTypeFromId: CortexMigration.getEntityTypeFromId
};