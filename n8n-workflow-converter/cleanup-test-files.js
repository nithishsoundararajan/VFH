#!/usr/bin/env node

/**
 * Cleanup Test Files
 * Removes temporary test files created during AI provider testing
 */

import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

const testFiles = [
  'test-openrouter-api.js',
  'test-ai-providers.js',
  'generated-hello-world.js',
  'generated-factorial-openrouter.js',
  'generated-factorial-gemini.js',
  'cleanup-test-files.js' // This file will delete itself last
];

async function cleanupTestFiles() {
  console.log('🧹 Cleaning up AI provider test files...\n');

  let deletedCount = 0;
  let skippedCount = 0;

  for (const file of testFiles) {
    try {
      if (existsSync(file)) {
        await unlink(file);
        console.log(`✅ Deleted: ${file}`);
        deletedCount++;
      } else {
        console.log(`⏭️  Skipped: ${file} (not found)`);
        skippedCount++;
      }
    } catch (error) {
      console.log(`❌ Failed to delete ${file}: ${error.message}`);
    }
  }

  console.log(`\n📊 Cleanup Summary:`);
  console.log(`   Deleted: ${deletedCount} files`);
  console.log(`   Skipped: ${skippedCount} files`);
  console.log(`\n🎉 Cleanup completed!`);
  console.log(`\n📝 Keeping: ai-integration-summary.md (test results)`);
}

cleanupTestFiles().catch(error => {
  console.error('💥 Cleanup error:', error);
  process.exit(1);
});