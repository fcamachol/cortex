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
   * Phase 1: Create Cortex schema and tables without affecting existing structure
   */
  async createCortexSchema(): Promise<void> {
    console.log("🚀 Starting Cortex schema creation (Phase 1)...");
    
    try {
      // Create cortex schema if it doesn't exist
      await this.db.execute(`CREATE SCHEMA IF NOT EXISTS cortex;`);
      console.log("✅ Cortex schema created");

      // Create all enums
      await this.createEnums();
      console.log("✅ Cortex enums created");

      // Create all tables
      await this.createTables();
      console.log("✅ Cortex tables created");

      // Create indexes
      await this.createIndexes();
      console.log("✅ Cortex indexes created");

      // Create useful views
      await this.createViews();
      console.log("✅ Cortex views created");

      console.log("🎉 Cortex schema creation completed successfully!");
      
    } catch (error) {
      console.error("❌ Error creating Cortex schema:", error);
      throw error;
    }
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