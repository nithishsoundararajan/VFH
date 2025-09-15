/**
 * End-to-End Tests - Collaborative Features and Sharing
 * Tests project sharing, collaboration, and multi-user scenarios
 */

import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_USERS, TEST_CONFIGURATIONS } from './fixtures/test-data';

test.describe('Collaborative Features', () => {
  let primaryHelpers: TestHelpers;
  let secondaryHelpers: TestHelpers;

  test.beforeEach(async ({ browser }) => {
    // Create two browser contexts for multi-user testing
    const primaryContext = await browser.newContext();
    const secondaryContext = await browser.newContext();
    
    const primaryPage = await primaryContext.newPage();
    const secondaryPage = await secondaryContext.newPage();
    
    primaryHelpers = new TestHelpers(primaryPage);
    secondaryHelpers = new TestHelpers(secondaryPage);
  });

  test.afterEach(async () => {
    await primaryHelpers.cleanup();
    await secondaryHelpers.cleanup();
  });

  test('should share project with read permissions', async () => {
    // Primary user creates project
    await primaryHelpers.registerUser('primary');
    await primaryHelpers.loginUser('primary');
    
    const workflow = await primaryHelpers.uploadWorkflow('simple');
    await primaryHelpers.configureProject(TEST_CONFIGURATIONS.basic);
    await primaryHelpers.startCodeGeneration();
    await primaryHelpers.waitForGenerationComplete();

    // Share project with secondary user
    const secondaryUser = TEST_USERS.secondary;
    await primaryHelpers.shareProject(secondaryUser.email, 'read');

    // Secondary user registers and logs in
    await secondaryHelpers.registerUser('secondary');
    await secondaryHelpers.loginUser('secondary');

    // Verify secondary user can access shared project
    await secondaryHelpers.navigateToProject(workflow.name);
    
    // Verify read-only access
    await expect(secondaryHelpers.page.locator('[data-testid="edit-project-button"]')).not.toBeVisible();
    await expect(secondaryHelpers.page.locator('[data-testid="delete-project-button"]')).not.toBeVisible();
    
    // Verify can download
    const download = await secondaryHelpers.downloadProject();
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });

  test('should share project with write permissions', async () => {
    // Primary user creates project
    await primaryHelpers.registerUser('primary');
    await primaryHelpers.loginUser('primary');
    
    const workflow = await primaryHelpers.uploadWorkflow('simple');
    await primaryHelpers.configureProject(TEST_CONFIGURATIONS.basic);

    // Share project with write permissions
    const secondaryUser = TEST_USERS.secondary;
    await primaryHelpers.shareProject(secondaryUser.email, 'write');

    // Secondary user accesses shared project
    await secondaryHelpers.registerUser('secondary');
    await secondaryHelpers.loginUser('secondary');
    await secondaryHelpers.navigateToProject(workflow.name);

    // Verify write access - can modify configuration
    await expect(secondaryHelpers.page.locator('[data-testid="edit-project-button"]')).toBeVisible();
    
    // Modify project configuration
    await secondaryHelpers.configureProject({
      outputDirectory: './modified-output',
      environmentVariables: { MODIFIED_BY: 'secondary-user' }
    });

    // Primary user should see the changes
    await primaryHelpers.navigateToProject(workflow.name);
    await expect(primaryHelpers.page.locator('[data-testid="output-directory-input"]')).toHaveValue('./modified-output');
  });

  test('should handle real-time collaboration', async () => {
    // Both users register and login
    await primaryHelpers.registerUser('primary');
    await primaryHelpers.loginUser('primary');
    
    await secondaryHelpers.registerUser('secondary');
    await secondaryHelpers.loginUser('secondary');

    // Primary user creates and shares project
    const workflow = await primaryHelpers.uploadWorkflow('complex');
    await primaryHelpers.shareProject(TEST_USERS.secondary.email, 'write');

    // Both users navigate to the same project
    await primaryHelpers.navigateToProject(workflow.name);
    await secondaryHelpers.navigateToProject(workflow.name);

    // Primary user starts code generation
    await primaryHelpers.startCodeGeneration();

    // Secondary user should see real-time progress updates
    await expect(secondaryHelpers.page.locator('[data-testid="generation-progress"]')).toBeVisible();
    await expect(secondaryHelpers.page.locator('[data-testid="live-logs"]')).toBeVisible();

    // Both users should see completion simultaneously
    await primaryHelpers.waitForGenerationComplete();
    await expect(secondaryHelpers.page.locator('[data-testid="generation-complete"]')).toBeVisible();
  });

  test('should manage project permissions correctly', async () => {
    // Primary user creates project
    await primaryHelpers.registerUser('primary');
    await primaryHelpers.loginUser('primary');
    
    const workflow = await primaryHelpers.uploadWorkflow('simple');
    
    // Share with read permissions initially
    await primaryHelpers.shareProject(TEST_USERS.secondary.email, 'read');

    // Secondary user accesses with read permissions
    await secondaryHelpers.registerUser('secondary');
    await secondaryHelpers.loginUser('secondary');
    await secondaryHelpers.navigateToProject(workflow.name);

    // Verify read-only access
    await expect(secondaryHelpers.page.locator('[data-testid="configure-project-button"]')).not.toBeVisible();

    // Primary user upgrades permissions to write
    await primaryHelpers.page.goto('/dashboard');
    await primaryHelpers.page.click(`[data-testid="manage-sharing-${workflow.name}"]`);
    await primaryHelpers.page.selectOption('[data-testid="permission-select"]', 'write');
    await primaryHelpers.page.click('[data-testid="update-permissions-button"]');

    // Secondary user should now have write access
    await secondaryHelpers.page.reload();
    await expect(secondaryHelpers.page.locator('[data-testid="configure-project-button"]')).toBeVisible();
  });

  test('should handle project sharing revocation', async () => {
    // Setup shared project
    await primaryHelpers.registerUser('primary');
    await primaryHelpers.loginUser('primary');
    
    const workflow = await primaryHelpers.uploadWorkflow('simple');
    await primaryHelpers.shareProject(TEST_USERS.secondary.email, 'read');

    await secondaryHelpers.registerUser('secondary');
    await secondaryHelpers.loginUser('secondary');
    
    // Verify secondary user can access project
    await secondaryHelpers.navigateToProject(workflow.name);
    await expect(secondaryHelpers.page.locator('[data-testid="project-details"]')).toBeVisible();

    // Primary user revokes access
    await primaryHelpers.page.goto('/dashboard');
    await primaryHelpers.page.click(`[data-testid="manage-sharing-${workflow.name}"]`);
    await primaryHelpers.page.click('[data-testid="revoke-access-button"]');
    await primaryHelpers.page.click('[data-testid="confirm-revoke-button"]');

    // Secondary user should lose access
    await secondaryHelpers.page.reload();
    await expect(secondaryHelpers.page.locator('[data-testid="access-denied"]')).toBeVisible();
  });

  test('should support public sharing with tokens', async () => {
    // Primary user creates project
    await primaryHelpers.registerUser('primary');
    await primaryHelpers.loginUser('primary');
    
    const workflow = await primaryHelpers.uploadWorkflow('simple');
    await primaryHelpers.configureProject(TEST_CONFIGURATIONS.basic);
    await primaryHelpers.startCodeGeneration();
    await primaryHelpers.waitForGenerationComplete();

    // Generate public share link
    await primaryHelpers.page.click('[data-testid="generate-public-link-button"]');
    const shareLink = await primaryHelpers.page.locator('[data-testid="public-share-link"]').textContent();
    expect(shareLink).toContain('/shared/');

    // Anonymous user (secondary browser) accesses public link
    await secondaryHelpers.page.goto(shareLink!);
    
    // Verify anonymous access to project
    await expect(secondaryHelpers.page.locator('[data-testid="public-project-view"]')).toBeVisible();
    await expect(secondaryHelpers.page.locator('[data-testid="project-name"]')).toHaveText(workflow.name);
    
    // Verify can download without authentication
    const download = await secondaryHelpers.downloadProject();
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });

  test('should handle concurrent project modifications', async () => {
    // Setup shared project with write access for both users
    await primaryHelpers.registerUser('primary');
    await primaryHelpers.loginUser('primary');
    
    await secondaryHelpers.registerUser('secondary');
    await secondaryHelpers.loginUser('secondary');

    const workflow = await primaryHelpers.uploadWorkflow('simple');
    await primaryHelpers.shareProject(TEST_USERS.secondary.email, 'write');

    // Both users navigate to project
    await primaryHelpers.navigateToProject(workflow.name);
    await secondaryHelpers.navigateToProject(workflow.name);

    // Simulate concurrent modifications
    await Promise.all([
      primaryHelpers.configureProject({
        environmentVariables: { USER: 'primary', TIMESTAMP: Date.now().toString() }
      }),
      secondaryHelpers.configureProject({
        environmentVariables: { USER: 'secondary', TIMESTAMP: (Date.now() + 1000).toString() }
      })
    ]);

    // Verify conflict resolution (last write wins)
    await primaryHelpers.page.reload();
    const envVarUser = await primaryHelpers.page.locator('[data-testid="env-var-USER"]').inputValue();
    expect(['primary', 'secondary']).toContain(envVarUser);
  });
});