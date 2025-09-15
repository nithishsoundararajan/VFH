/**
 * End-to-End Tests - Complete User Workflow
 * Tests the complete user journey from registration to project download
 */

import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_CONFIGURATIONS, PERFORMANCE_THRESHOLDS } from './fixtures/test-data';

test.describe('Complete User Workflow', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test.afterEach(async () => {
    // Clean up test data after each test
    await helpers.cleanup();
  });

  test('should complete full workflow from registration to download', async ({ page }) => {
    // Step 1: User Registration
    const user = await helpers.registerUser('primary');
    expect(user.email).toBeTruthy();

    // Step 2: Login
    await helpers.loginUser('primary');
    await expect(page).toHaveURL('/dashboard');

    // Step 3: Upload Workflow
    const workflow = await helpers.uploadWorkflow('simple');
    expect(workflow.name).toBe('Simple HTTP Workflow');

    // Step 4: Configure Project
    await helpers.configureProject(TEST_CONFIGURATIONS.basic);

    // Step 5: Start Code Generation
    await helpers.startCodeGeneration();

    // Step 6: Monitor Real-time Progress
    await helpers.verifyRealTimeUpdates();

    // Step 7: Wait for Generation Complete
    await helpers.waitForGenerationComplete();

    // Step 8: Download Project
    const download = await helpers.downloadProject();
    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    // Step 9: Verify Project in Dashboard
    await helpers.navigateToProject(workflow.name);
    await expect(page.locator('[data-testid="project-status"]')).toHaveText('Completed');
  });

  test('should handle complex multi-node workflows', async ({ page }) => {
    // Register and login
    await helpers.registerUser('primary');
    await helpers.loginUser('primary');

    // Upload complex workflow
    const workflow = await helpers.uploadWorkflow('complex');
    expect(workflow.nodes).toHaveLength(4);

    // Configure with advanced settings
    await helpers.configureProject(TEST_CONFIGURATIONS.advanced);

    // Generate and verify
    await helpers.startCodeGeneration();
    await helpers.waitForGenerationComplete();

    // Verify all nodes were processed
    await expect(page.locator('[data-testid="processed-nodes-count"]')).toHaveText('4');
  });

  test('should meet performance requirements', async ({ page }) => {
    await helpers.registerUser('primary');
    await helpers.loginUser('primary');

    // Test page load performance
    const pageLoadTime = await helpers.measurePerformance(async () => {
      await page.goto('/dashboard');
    });
    expect(pageLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);

    // Test workflow upload performance
    const uploadTime = await helpers.measurePerformance(async () => {
      await helpers.uploadWorkflow('simple');
    });
    expect(uploadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.workflowUpload);

    // Test code generation performance
    await helpers.configureProject(TEST_CONFIGURATIONS.basic);
    
    const generationTime = await helpers.measurePerformance(async () => {
      await helpers.startCodeGeneration();
      await helpers.waitForGenerationComplete();
    });
    expect(generationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.codeGeneration);
  });

  test('should track analytics correctly', async ({ page }) => {
    await helpers.registerUser('primary');
    await helpers.loginUser('primary');

    // Perform workflow conversion
    await helpers.uploadWorkflow('simple');
    await helpers.configureProject(TEST_CONFIGURATIONS.basic);
    await helpers.startCodeGeneration();
    await helpers.waitForGenerationComplete();

    // Verify analytics tracking
    await helpers.verifyAnalyticsTracking();
  });
});
 