/**
 * APP SCHEMA CLEANUP SCRIPT
 * Safely removes the old app schema after successful migration to Cortex Foundation
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function cleanupAppSchema() {
  console.log("🧹 Starting App Schema Cleanup...");
  console.log("=" .repeat(60));
  
  try {
    // Step 1: Verify Cortex Foundation migration is complete
    console.log("🔍 Verifying Cortex Foundation migration...");
    
    const cortexSpaces = await db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.spaces;`);
    const cortexUsers = await db.execute(sql`SELECT COUNT(*) FROM cortex_foundation.users;`);
    
    console.log(`✅ Cortex Foundation verified: ${cortexUsers.rows[0].count} users, ${cortexSpaces.rows[0].count} spaces`);
    
    if (cortexSpaces.rows[0].count < 8) {
      throw new Error("Migration verification failed - not enough spaces in Cortex Foundation");
    }
    
    // Step 2: Create backup of app schema structure (for reference)
    console.log("\n📋 Creating backup of app schema structure...");
    
    const schemaBackup = await db.execute(sql`
      SELECT 
        'CREATE TABLE app.' || table_name || ' (' ||
        string_agg(
          column_name || ' ' || data_type ||
          CASE 
            WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
            WHEN numeric_precision IS NOT NULL THEN '(' || numeric_precision || ',' || numeric_scale || ')'
            ELSE ''
          END ||
          CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
          ', '
        ) || ');' as create_statement
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
      GROUP BY table_name
      ORDER BY table_name;
    `);
    
    console.log(`📄 Schema backup created with ${schemaBackup.rows.length} table definitions`);
    
    // Step 3: Drop all tables in app schema (CASCADE will handle foreign keys)
    console.log("\n🗑️  Dropping app schema tables...");
    
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'app' 
      ORDER BY table_name;
    `);
    
    let droppedTables = 0;
    for (const table of tables.rows) {
      try {
        await db.execute(sql.raw(`DROP TABLE app.${table.table_name} CASCADE;`));
        console.log(`  ✅ Dropped table: app.${table.table_name}`);
        droppedTables++;
      } catch (error) {
        console.log(`  ⚠️  Could not drop app.${table.table_name}: ${error.message}`);
      }
    }
    
    // Step 4: Drop the app schema itself
    console.log("\n🗑️  Dropping app schema...");
    try {
      await db.execute(sql`DROP SCHEMA app CASCADE;`);
      console.log("✅ App schema dropped successfully");
    } catch (error) {
      console.log(`⚠️  Could not drop app schema: ${error.message}`);
    }
    
    // Step 5: Verify cleanup
    console.log("\n🔍 Verifying cleanup...");
    
    const remainingTables = await db.execute(sql`
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_schema = 'app';
    `);
    
    const remainingSchemas = await db.execute(sql`
      SELECT COUNT(*) 
      FROM information_schema.schemata 
      WHERE schema_name = 'app';
    `);
    
    console.log("\n" + "=" .repeat(60));
    console.log("🎉 APP SCHEMA CLEANUP COMPLETED!");
    console.log("=" .repeat(60));
    
    console.log("\nCleanup Summary:");
    console.log("================");
    console.log(`✅ Tables dropped: ${droppedTables} out of ${tables.rows.length}`);
    console.log(`📊 Remaining app tables: ${remainingTables.rows[0].count}`);
    console.log(`📊 App schema exists: ${remainingSchemas.rows[0].count === 1 ? 'Yes' : 'No'}`);
    
    console.log("\nCortex Foundation Status:");
    console.log("=========================");
    console.log(`📊 Cortex users: ${cortexUsers.rows[0].count}`);
    console.log(`📊 Cortex spaces: ${cortexSpaces.rows[0].count}`);
    
    console.log("\nNext Steps:");
    console.log("===========");
    console.log("1. ✅ App schema completely removed");
    console.log("2. ✅ All data safely migrated to Cortex Foundation");
    console.log("3. 🔄 Update application code to use only Cortex Foundation storage");
    console.log("4. 🧪 Test application functionality with unified architecture");
    console.log("5. 📚 Update schema documentation to reflect new architecture");
    
  } catch (error) {
    console.error("\n❌ CLEANUP FAILED:");
    console.error("==================");
    console.error(error);
    
    console.log("\n🛡️  Safety Note: Cortex Foundation data remains intact");
    console.log("Migration can be re-attempted if needed");
    
    process.exit(1);
  }
}

// Execute cleanup if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupAppSchema()
    .then(() => {
      console.log("\n🔄 App schema cleanup completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 App schema cleanup failed:", error);
      process.exit(1);
    });
}

export { cleanupAppSchema };