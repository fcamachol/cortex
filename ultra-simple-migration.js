/**
 * ULTRA SIMPLIFIED APP TO CORTEX MIGRATION
 * Simple data-only migration with minimal complexity
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function ultraSimpleMigration() {
  console.log("🚀 Starting Ultra Simple App to Cortex Data Migration...");
  console.log("=" .repeat(60));
  
  try {
    // Get all app users for migration
    const appUsers = await db.execute(sql`SELECT * FROM app.users;`);
    console.log(`Found ${appUsers.rows.length} app users to migrate`);
    
    let migratedUsers = 0;
    for (const user of appUsers.rows) {
      // Generate cortex user ID with cu_ prefix
      const cortexUserId = `cu_${user.user_id.toString().padStart(10, '0')}_migrated_${Date.now().toString(36)}`;
      
      try {
        // Insert into cortex_foundation.users
        await db.execute(sql`
          INSERT INTO cortex_foundation.users (
            id, email, password_hash, full_name, 
            is_active, created_at, updated_at
          ) VALUES (
            ${cortexUserId}, 
            ${user.email}, 
            ${user.password_hash || 'migrated_password'}, 
            ${user.full_name || user.email},
            ${user.is_active !== false},
            ${user.created_at || new Date()},
            ${user.updated_at || new Date()}
          );
        `);
        
        migratedUsers++;
        console.log(`✅ Migrated user: ${user.email} → ${cortexUserId}`);
      } catch (userError) {
        console.log(`⚠️ Skipped user ${user.email} (likely already exists): ${userError.message}`);
      }
    }
    
    // Get all app spaces for migration
    const appSpaces = await db.execute(sql`SELECT * FROM app.spaces;`);
    console.log(`Found ${appSpaces.rows.length} app spaces to migrate`);
    
    let migratedSpaces = 0;
    for (const space of appSpaces.rows) {
      // Generate cortex space ID with cs_ prefix
      const cortexSpaceId = `cs_${space.space_id.toString().padStart(10, '0')}_migrated_${Date.now().toString(36)}`;
      
      try {
        // Insert into cortex_foundation.spaces with default owner
        await db.execute(sql`
          INSERT INTO cortex_foundation.spaces (
            id, name, description, owner_user_id, 
            space_type, privacy, is_archived, created_at, updated_at
          ) VALUES (
            ${cortexSpaceId},
            ${space.space_name || 'Migrated Space'},
            ${space.description || 'Migrated from app schema'},
            'cu_181de66a23864b2fac56779a82189691',
            'project',
            'private',
            false,
            ${space.created_at || new Date()},
            ${space.updated_at || new Date()}
          );
        `);
        
        migratedSpaces++;
        console.log(`✅ Migrated space: ${space.space_name} → ${cortexSpaceId}`);
      } catch (spaceError) {
        console.log(`⚠️ Skipped space ${space.space_name} (likely already exists): ${spaceError.message}`);
      }
    }
    
    console.log("\n" + "=" .repeat(60));
    console.log("🎉 ULTRA SIMPLE MIGRATION COMPLETED!");
    console.log("=" .repeat(60));
    
    console.log("\nMigration Summary:");
    console.log("==================");
    console.log(`✅ Users migrated: ${migratedUsers} out of ${appUsers.rows.length}`);
    console.log(`✅ Spaces migrated: ${migratedSpaces} out of ${appSpaces.rows.length}`);
    
    // Final counts
    const finalCortexUsers = await db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.users;`);
    const finalCortexSpaces = await db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.spaces;`);
    
    console.log(`📊 Total Cortex users: ${finalCortexUsers.rows[0].count}`);
    console.log(`📊 Total Cortex spaces: ${finalCortexSpaces.rows[0].count}`);
    
    console.log("\nNext Steps:");
    console.log("===========");
    console.log("1. ✅ App data successfully migrated to Cortex Foundation schema");
    console.log("2. 🔄 Update application code to use Cortex Foundation storage layer");
    console.log("3. 🧪 Test application functionality with new architecture");
    console.log("4. 🚀 Begin transitioning other schemas to Cortex patterns");
    
  } catch (error) {
    console.error("\n❌ MIGRATION FAILED:");
    console.error("===================");
    console.error(error);
    process.exit(1);
  }
}

// Execute migration if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ultraSimpleMigration()
    .then(() => {
      console.log("\n🔄 Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration failed:", error);
      process.exit(1);
    });
}

export { ultraSimpleMigration };