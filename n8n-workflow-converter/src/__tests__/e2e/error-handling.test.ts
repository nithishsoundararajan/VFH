/**
 * End-to-End Tests - Error Scenarios and Recovery Mechanisms
 * Tests error handling, recovery, and resilience features
 */

import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_CONFIGURATIONS } from './fixtures/test-data';

test.describe('Error Handling and Recovery', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.registerUser('primary');
    await helpers.loginUser('primary');
  });

  test.afterEach(async () => {
    await helpers.cleanup();
  });

  test('should handle malformed workflow JSON gracefully', async ({ page }) => {
    // Upload malformed workflow
    await helpers.uploadWorkflow('malformed');

    // Verify error message is displayed
    await expect(page.locator('[data-testid="workflow-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid workflow format');

    // Verify user can retry with valid workflow
    await helpers.uploadWorkflow('simple');
    await expect(page.locator('[data-testid="workflow-preview"]')).toBeVisible();
  });

  test('should handle network failures during upload', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/parse-workflow', route => {
      route.abort('failed');
    });

    // Attempt to upload workflow
    await page.goto('/upload');
    const fileInput = page.locator('[data-testid="workflow-file-input"]');
    await fileInput.setInputFiles({
      name: 'test-workflow.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ name: 'Test', nodes: [] }))
    });

    // Verify network error handling
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-upload-button"]')).toBeVisible();

    // Restore network and retry
    await page.unroute('**/api/parse-workflow');
    await page.click('[data-testid="retry-upload-button"]');

    // Verify successful retry
    await expect(page.locator('[data-testid="workflow-preview"]')).toBeVisible();
  });

  test('should handle code generation failures', async ({ page }) => {
    await helpers.uploadWorkflow('simple');
    await helpers.configureProject(TEST_CONFIGURATIONS.basic);

    // Simulate code generation failure
    await page.route('**/functions/v1/generate-code', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Code generation failed' })
      });
    });

    await helpers.startCodeGeneration();

    // Verify error handling
    await expect(page.locator('[data-testid="generation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-details"]')).toContainText('Code generation failed');
    await expect(page.locator('[data-testid="retry-generation-button"]')).toBeVisible();

    // Restore service and retry
    await page.unroute('**/functions/v1/generate-code');
    await page.click('[data-testid="retry-generation-button"]');

    // Verify successful retry
    await helpers.waitForGenerationComplete();
  });

  test('should handle authentication session expiry', async ({ page }) => {
    await helpers.uploadWorkflow('simple');

    // Simulate session expiry by clearing auth tokens
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Attempt to perform authenticated action
    await page.click('[data-testid="configure-project-button"]');

    // Verify redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();

    // Re-authenticate
    await helpers.loginUser('primary');

    // Verify user can continue where they left off
    await expect(page).toHaveURL('/dashboard');
  });

  test('should handle file storage failures', async ({ page }) => {
    await helpers.uploadWorkflow('simple');
    await helpers.configureProject(TEST_CONFIGURATIONS.basic);
    await helpers.startCodeGeneration();
    await helpers.waitForGenerationComplete();

    // Simulate storage failure during download
    await page.route('**/storage/v1/object/**', route => {
      route.fulfill({
        status: 503,
        body: JSON.stringify({ error: 'Storage service unavailable' })
      });
    });

    // Attempt to download
    await page.click('[data-testid="download-project-button"]');

    // Verify error handling
    await expect(page.locator('[data-testid="download-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-download-button"]')).toBeVisible();

    // Restore storage and retry
    await page.unroute('**/storage/v1/object/**');
    await page.click('[data-testid="retry-download-button"]');

    // Verify successful download
    const downloadPromise = page.waitForDownload();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });

  test('should handle real-time connection failures', async ({ page }) => {
    await helpers.uploadWorkflow('simple');
    await helpers.configureProject(TEST_CONFIGURATIONS.basic);

    // Start generation to establish real-time connection
    await helpers.startCodeGeneration();
    await expect(page.locator('[data-testid="realtime-connected"]')).toBeVisible();

    // Simulate connection loss
    await page.evaluate(() => {
      // Force close WebSocket connections
      window.dispatchEvent(new Event('offline'));
    });

    // Verify connection loss handling
    await expect(page.locator('[data-testid="realtime-disconnected"]')).toBeVisible();
    await expect(page.locator('[data-testid="reconnecting-indicator"]')).toBeVisible();

    // Simulate connection restoration
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Verify reconnection
    await expect(page.locator('[data-testid="realtime-connected"]')).toBeVisible();
    await expect(page.locator('[data-testid="reconnecting-indicator"]')).not.toBeVisible();
  });

  test('should handle concurrent user limit exceeded', async ({ page }) => {
    // Simulate server returning rate limit error
    await page.route('**/api/projects', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 429,
          body: JSON.stringify({ 
            error: 'Rate limit exceeded',
            retryAfter: 60
          })
        });
      } else {
        route.continue();
      }
    });

    await helpers.uploadWorkflow('simple');
    await helpers.configureProject(TEST_CONFIGURATIONS.basic);
    await helpers.startCodeGeneration();

    // Verify rate limit handling
    await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-after-timer"]')).toBeVisible();

    // Verify retry timer countdown
    const retryTimer = page.locator('[data-testid="retry-after-timer"]');
    const initialTime = await retryTimer.textContent();
    
    // Wait a bit and verify timer is counting down
    await page.waitForTimeout(2000);
    const updatedTime = await retryTimer.textContent();
    expect(parseInt(updatedTime!)).toBeLessThan(parseInt(initialTime!));
  });

  test('should handle browser refresh during generation', async ({ page }) => {
    await helpers.uploadWorkflow('simple');
    await helpers.configureProject(TEST_CONFIGURATIONS.basic);
    await helpers.startCodeGeneration();

    // Verify generation is in progress
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible();

    // Refresh the page
    await page.reload();

    // Verify state persistence
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="resume-generation-notice"]')).toBeVisible();

    // Verify generation continues
    await helpers.waitForGenerationComplete();
  });

  test('should handle invalid AI API keys gracefully', async ({ page }) => {
    await helpers.uploadWorkflow('simple');
    
    // Configure with invalid AI API key
    await helpers.configureProject({
      ...TEST_CONFIGURATIONS.advanced,
      aiApiKey: 'invalid-api-key'
    });

    await helpers.startCodeGeneration();

    // Verify AI API error handling
    await expect(page.locator('[data-testid="ai-api-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid API key');

    // Verify fallback to system AI service
    await expect(page.locator('[data-testid="fallback-ai-notice"]')).toBeVisible();

    // Verify generation continues with fallback
    await helpers.waitForGenerationComplete();
  });

  test('should handle database connection failures', async ({ page }) => {
    // Simulate database connection failure
    await page.route('**/rest/v1/**', route => {
      route.fulfill({
        status: 503,
        body: JSON.stringify({ error: 'Database connection failed' })
      });
    });

    // Attempt to access dashboard
    await page.goto('/dashboard');

    // Verify database error handling
    await expect(page.locator('[data-testid="database-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-connection-button"]')).toBeVisible();

    // Restore database connection
    await page.unroute('**/rest/v1/**');
    await page.click('[data-testid="retry-connection-button"]');

    // Verify successful reconnection
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
  });

  test('should handle malware detection in uploaded files', async ({ page }) => {
    // Simulate malware detection response
    await page.route('**/functions/v1/scan-file', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          safe: false,
          threats: ['Trojan.Generic'],
          scanId: 'test-scan-id'
        })
      });
    });

    // Attempt to upload workflow
    await page.goto('/upload');
    const fileInput = page.locator('[data-testid="workflow-file-input"]');
    await fileInput.setInputFiles({
      name: 'malicious-workflow.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ name: 'Test', nodes: [] }))
    });

    // Verify malware detection handling
    await expect(page.locator('[data-testid="malware-detected"]')).toBeVisible();
    await expect(page.locator('[data-testid="security-warning"]')).toContainText('Trojan.Generic');
    await expect(page.locator('[data-testid="file-quarantined"]')).toBeVisible();

    // Verify file is not processed
    await expect(page.locator('[data-testid="workflow-preview"]')).not.toBeVisible();
  });

  test('should handle edge function timeouts', async ({ page }) => {
    await helpers.uploadWorkflow('complex');
    await helpers.configureProject(TEST_CONFIGURATIONS.basic);

    // Simulate edge function timeout
    await page.route('**/functions/v1/generate-code', route => {
      // Don't respond to simulate timeout
      // The request will hang and eventually timeout
    });

    await helpers.startCodeGeneration();

    // Verify timeout handling
    await expect(page.locator('[data-testid="generation-timeout"]')).toBeVisible({ timeout: 35000 });
    await expect(page.locator('[data-testid="timeout-recovery-options"]')).toBeVisible();

    // Verify retry option is available
    await expect(page.locator('[data-testid="retry-generation-button"]')).toBeVisible();
  });
});