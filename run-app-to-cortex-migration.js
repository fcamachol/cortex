/**
 * App Schema to Cortex Foundation Migration Runner
 * Executes the complete migration from app schema to cortex_foundation schema
 */

import { db } from './server/db';
import { AppToCortexMigration } from './server/app-to-cortex-migration';

async function runAppToCortexMigration() {
  console.log("🚀 Starting App Schema to Cortex Foundation Migration...");
  console.log("=" .repeat(60));
  
  const migration = new AppToCortexMigration(db);
  
  try {
    // Execute the complete migration
    await migration.migrate();
    
    console.log("\n" + "=" .repeat(60));
    console.log("🔍 Running migration validation...");
    
    // Validate migration integrity
    await migration.validateMigration();
    
    console.log("\n" + "=" .repeat(60));
    console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("=" .repeat(60));
    
    console.log("\nMigration Summary:");
    console.log("==================");
    console.log("✅ App Schema → Cortex Foundation Schema");
    console.log("✅ Users migrated with cu_ prefixed UUIDs");
    console.log("✅ Workspaces migrated with enhanced metadata");
    console.log("✅ Spaces migrated with cs_ prefixed UUIDs");
    console.log("✅ Member relationships preserved");
    console.log("✅ Bridge tables created for backward compatibility");
    console.log("✅ Indexes and constraints applied");
    console.log("✅ Migration audit trail created");
    
    console.log("\nNext Steps:");
    console.log("===========");
    console.log("1. Update application code to use Cortex Foundation schema");
    console.log("2. Test application functionality with new schema");
    console.log("3. Migrate remaining schemas (CRM, WhatsApp, Finance)");
    console.log("4. Update frontend components to use new entity IDs");
    console.log("5. Remove app schema tables after full validation");
    
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
  runAppToCortexMigration()
    .then(() => {
      console.log("\n🔄 Migration runner completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration runner failed:", error);
      process.exit(1);
    });
}

export { runAppToCortexMigration };