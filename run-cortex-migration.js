#!/usr/bin/env node

/**
 * Cortex Schema Migration Script
 * Phase 1: Non-destructive schema creation
 * 
 * This script creates the new Cortex schema alongside existing schemas
 * without affecting the current database structure.
 */

import { CortexMigration } from './server/cortex-migration.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runCortexMigration() {
  console.log("🚀 Starting Cortex Schema Migration (Phase 1)");
  console.log("================================================");
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  try {
    const migration = new CortexMigration(dbUrl);
    
    // Check if schema already exists
    const schemaExists = await migration.checkSchemaExists();
    if (schemaExists) {
      console.log("ℹ️  Cortex schema already exists, checking for updates...");
    }

    // Create/update Cortex schema
    await migration.createCortexSchema();
    
    // Optionally create sample data for testing
    const createSamples = process.argv.includes('--samples');
    if (createSamples) {
      console.log("🌱 Creating sample data...");
      await migration.createSampleData();
    }

    // Show schema statistics
    console.log("\n📊 Schema Statistics:");
    console.log("=====================");
    const stats = await migration.getSchemaStats();
    if (stats.length > 0) {
      console.table(stats);
    } else {
      console.log("No statistics available yet (schema is new)");
    }

    console.log("\n🎉 Cortex Schema Migration completed successfully!");
    console.log("\nWhat's been created:");
    console.log("• cortex schema with all tables and enums");
    console.log("• Universal entity system (cp_, cc_, cg_, co_, ca_, cv_, cj_, ce_, cs_)");
    console.log("• Google Drive-like spaces system");
    console.log("• Universal linking system for entity-to-entity and content-to-entity relationships");
    console.log("• Content entities (tasks, notes, documents, bills)");
    console.log("• Activity logging and tagging systems");
    console.log("• Performance-optimized indexes and views");
    
    if (createSamples) {
      console.log("• Sample data for testing");
    }

    console.log("\nNext steps:");
    console.log("• Phase 2: Create bridge tables for data migration");
    console.log("• Phase 3: Implement Cortex API endpoints");
    console.log("• Phase 4: Create migration utilities");
    console.log("• Phase 5: Frontend integration");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
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