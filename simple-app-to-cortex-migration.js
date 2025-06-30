/**
 * SIMPLIFIED APP TO CORTEX MIGRATION
 * Only migrates data from app schema to existing cortex_foundation schema
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function simpleAppToCortexMigration() {
  console.log("🚀 Starting App Schema to Cortex Foundation Data Migration...");
  console.log("=" .repeat(60));
  
  try {
    // Step 1: Check existing data
    console.log("📊 Checking existing data...");
    
    const appUserCount = await db.execute(sql`SELECT COUNT(*) FROM app.users;`);
    const appSpaceCount = await db.execute(sql`SELECT COUNT(*) FROM app.spaces;`);
    const cortexUserCount = await db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.users;`);
    const cortexSpaceCount = await db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.spaces;`);
    
    console.log(`App users: ${appUserCount.rows[0].count}`);
    console.log(`App spaces: ${appSpaceCount.rows[0].count}`);
    console.log(`Cortex users: ${cortexUserCount.rows[0].count}`);
    console.log(`Cortex spaces: ${cortexSpaceCount.rows[0].count}`);
    
    // Step 2: Create bridge table for user mapping (without foreign key constraints due to type incompatibility)
    console.log("🌉 Creating bridge tables...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app.user_migration_bridge (
        app_user_id INTEGER PRIMARY KEY,
        cortex_user_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app.space_migration_bridge (
        app_space_id INTEGER PRIMARY KEY,
        cortex_space_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Step 3: Migrate users from app.users to cortex_foundation.users
    console.log("👥 Migrating users...");
    
    const appUsers = await db.execute(sql`
      SELECT * FROM app.users 
      WHERE NOT EXISTS (SELECT 1 FROM app.user_migration_bridge WHERE app_user_id = users.user_id);
    `);
    
    let migratedUsers = 0;
    for (const user of appUsers.rows) {
      // Generate cortex user ID with cu_ prefix
      const cortexUserId = `cu_${user.user_id.toString().padStart(10, '0')}_${Date.now().toString(36)}`;
      
      // Insert into cortex_foundation.users
      await db.execute(sql`
        INSERT INTO cortex_foundation.users (
          id, email, password_hash, full_name, 
          is_active, created_at, updated_at
        ) VALUES (
          ${cortexUserId}, 
          ${user.email}, 
          ${user.password_hash || 'migrated_user'}, 
          ${user.full_name || user.email},
          ${user.is_active !== false},
          ${user.created_at || new Date()},
          ${user.updated_at || new Date()}
        );
      `);
      
      // Record mapping in bridge table
      await db.execute(sql`
        INSERT INTO app.user_migration_bridge (app_user_id, cortex_user_id)
        VALUES (${user.user_id}, ${cortexUserId});
      `);
      
      migratedUsers++;
      console.log(`✅ Migrated user: ${user.email} → ${cortexUserId}`);
    }
    
    // Step 4: Migrate spaces from app.spaces to cortex_foundation.spaces
    console.log("📁 Migrating spaces...");
    
    const appSpaces = await db.execute(sql`
      SELECT s.*, umb.cortex_user_id 
      FROM app.spaces s
      LEFT JOIN app.user_migration_bridge umb ON s.creator_user_id = umb.app_user_id
      WHERE NOT EXISTS (SELECT 1 FROM app.space_migration_bridge WHERE app_space_id = s.space_id);
    `);
    
    let migratedSpaces = 0;
    for (const space of appSpaces.rows) {
      // Generate cortex space ID with cs_ prefix
      const cortexSpaceId = `cs_${space.space_id.toString().padStart(10, '0')}_${Date.now().toString(36)}`;
      
      // Insert into cortex_foundation.spaces using owner_user_id field
      await db.execute(sql`
        INSERT INTO cortex_foundation.spaces (
          id, name, description, owner_user_id, 
          space_type, privacy, is_archived, created_at, updated_at
        ) VALUES (
          ${cortexSpaceId},
          ${space.space_name || 'Migrated Space'},
          ${space.description || 'Migrated from app schema'},
          ${space.cortex_user_id || 'cu_default_admin'},
          'project',
          'private',
          false,
          ${space.created_at || new Date()},
          ${space.updated_at || new Date()}
        );
      `);
      
      // Record mapping in bridge table
      await db.execute(sql`
        INSERT INTO app.space_migration_bridge (app_space_id, cortex_space_id)
        VALUES (${space.space_id}, ${cortexSpaceId});
      `);
      
      migratedSpaces++;
      console.log(`✅ Migrated space: ${space.space_name} → ${cortexSpaceId}`);
    }
    
    // Step 5: Create migration audit record
    console.log("📋 Creating migration audit...");
    await db.execute(sql`
      INSERT INTO app.crm_migration_audit (
        migration_type, 
        source_schema, 
        target_schema, 
        records_migrated, 
        migration_notes,
        created_at
      ) VALUES (
        'app_to_cortex_foundation',
        'app',
        'cortex_foundation',
        ${migratedUsers + migratedSpaces},
        ${JSON.stringify({
          users_migrated: migratedUsers,
          spaces_migrated: migratedSpaces,
          bridge_tables_created: ['user_migration_bridge', 'space_migration_bridge']
        })},
        NOW()
      );
    `);
    
    console.log("\n" + "=" .repeat(60));
    console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("=" .repeat(60));
    
    console.log("\nMigration Summary:");
    console.log("==================");
    console.log(`✅ Users migrated: ${migratedUsers}`);
    console.log(`✅ Spaces migrated: ${migratedSpaces}`);
    console.log("✅ Bridge tables created for data mapping");
    console.log("✅ Migration audit trail created");
    
    console.log("\nNext Steps:");
    console.log("===========");
    console.log("1. Update application code to use Cortex Foundation storage");
    console.log("2. Test application functionality with new schema");
    console.log("3. Gradually migrate other schemas (CRM, WhatsApp, Finance)");
    console.log("4. Update frontend components to use new entity IDs");
    
  } catch (error) {
    console.error("\n❌ MIGRATION FAILED:");
    console.error("===================");
    console.error(error);
    console.error("\nMigration has been halted. Please review the error and try again.");
    process.exit(1);
  }
}

// Execute migration if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simpleAppToCortexMigration()
    .then(() => {
      console.log("\n🔄 Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration failed:", error);
      process.exit(1);
    });
}

export { simpleAppToCortexMigration };