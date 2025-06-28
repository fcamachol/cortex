#!/usr/bin/env node

/**
 * Cortex Performance Indexes Migration Runner
 * Creates comprehensive indexes across all Cortex schemas for optimal performance
 */

import { createCortexPerformanceIndexes } from './server/cortex-performance-indexes.js';

async function main() {
  console.log('🚀 Starting Cortex Performance Indexes Migration...');
  console.log('===============================================');
  
  try {
    const result = await createCortexPerformanceIndexes();
    
    console.log('\n🎉 PERFORMANCE OPTIMIZATION COMPLETED!');
    console.log('=====================================');
    console.log(`📊 Result: ${result.message}`);
    console.log(`🔍 Total Indexes Created: ${result.totalIndexes}`);
    console.log('\n📋 SCHEMA BREAKDOWN:');
    console.log(`• Foundation Schema: ${result.schemaBreakdown.foundation} indexes`);
    console.log(`• Entities Schema: ${result.schemaBreakdown.entities} indexes`);
    console.log(`• Projects Schema: ${result.schemaBreakdown.projects} indexes`);
    console.log(`• Communication Schema: ${result.schemaBreakdown.communication} indexes`);
    console.log(`• Finance Schema: ${result.schemaBreakdown.finance} indexes`);
    console.log(`• Scheduling Schema: ${result.schemaBreakdown.scheduling} indexes`);
    console.log(`• Knowledge Schema: ${result.schemaBreakdown.knowledge} indexes`);
    console.log(`• Automation Schema: ${result.schemaBreakdown.automation} indexes`);
    console.log(`• Cross-Schema: ${result.schemaBreakdown.crossSchema} indexes`);
    
    console.log('\n⚡ PERFORMANCE OPTIMIZATIONS:');
    console.log('• Entity relationship lookups optimized with composite indexes');
    console.log('• WhatsApp integration queries accelerated with specialized indexes');
    console.log('• Full-text search enabled on notes and documents with GIN indexes');
    console.log('• Time-based queries optimized for scheduling and finance operations');
    console.log('• Cross-schema entity linking optimized with prefix-based indexes');
    console.log('• Automation rule execution optimized with priority-based indexes');
    console.log('• Business intelligence views accelerated with targeted indexes');
    
  } catch (error) {
    console.error('\n❌ PERFORMANCE OPTIMIZATION FAILED!');
    console.error('===================================');
    console.error('Error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the performance optimization
main().catch(console.error);