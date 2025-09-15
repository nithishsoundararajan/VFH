/**
 * E2E Test Helper Functions
 */

import { Page, expect } from '@playwright/test';
import { TEST_USERS, SAMPLE_WORKFLOWS } from '../fixtures/test-data';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Register a new user account
   */
  async registerUser(userType: 'primary' | 'secondary' = 'primary') {
    const user = TEST_USERS[userType];
    
    await this.page.goto('/auth/register');
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    await this.page.fill('[data-testid="confirm-password-input"]', user.password);
    await this.page.fill('[data-testid="full-name-input"]', user.fullName);
    
    await this.page.click('[data-testid="register-button"]');
    
    // Wait for registration success
    await expect(this.page.locator('[data-testid="registration-success"]')).toBeVisible();
    
    return user;
  }

  /**
   * Login with existing user credentials
   */
  async loginUser(userType: 'primary' | 'secondary' = 'primary') {
    const user = TEST_USERS[userType];
    
    await this.page.goto('/auth/login');
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for successful login and redirect to dashboard
    await expect(this.page).toHaveURL('/dashboard');
    
    return user;
  }

  /**
   * Upload a workflow JSON file
   */
  async uploadWorkflow(workflowType: 'simple' | 'complex' | 'malformed' = 'simple') {
    const workflow = SAMPLE_WORKFLOWS[workflowType];
    
    // Navigate to upload page
    await this.page.goto('/upload');
    
    // Create a temporary file with workflow JSON
    const workflowJson = JSON.stringify(workflow, null, 2);
    
    // Use file input to upload workflow
    const fileInput = this.page.locator('[data-testid="workflow-file-input"]');
    await fileInput.setInputFiles({
      name: `${workflow.name.toLowerCase().replace(/\s+/g, '-')}.json`,
      mimeType: 'application/json',
      buffer: Buffer.from(workflowJson)
    });
    
    // Wait for file processing
    await expect(this.page.locator('[data-testid="workflow-preview"]')).toBeVisible();
    
    return workflow;
  }

  /**
   * Configure project settings
   */
  async configureProject(config: {
    outputDirectory?: string;
    environmentVariables?: Record<string, string>;
    aiProvider?: string;
    aiApiKey?: string;
  }) {
    // Navigate to configuration section
    await this.page.click('[data-testid="configure-project-button"]');
    
    if (config.outputDirectory) {
      await this.page.fill('[data-testid="output-directory-input"]', config.outputDirectory);
    }
    
    if (config.environmentVariables) {
      for (const [key, value] of Object.entries(config.environmentVariables)) {
        await this.page.click('[data-testid="add-env-var-button"]');
        await this.page.fill('[data-testid="env-var-key-input"]:last-of-type', key);
        await this.page.fill('[data-testid="env-var-value-input"]:last-of-type', value);
      }
    }
    
    if (config.aiProvider) {
      await this.page.selectOption('[data-testid="ai-provider-select"]', config.aiProvider);
      
      if (config.aiApiKey) {
        await this.page.fill('[data-testid="ai-api-key-input"]', config.aiApiKey);
      }
    }
    
    await this.page.click('[data-testid="save-configuration-button"]');
    
    // Wait for configuration save success
    await expect(this.page.locator('[data-testid="configuration-saved"]')).toBeVisible();
  }

  /**
   * Start code generation process
   */
  async startCodeGeneration() {
    await this.page.click('[data-testid="generate-code-button"]');
    
    // Wait for generation to start
    await expect(this.page.locator('[data-testid="generation-progress"]')).toBeVisible();
  }

  /**
   * Wait for code generation to complete
   */
  async waitForGenerationComplete(timeout = 60000) {
    await expect(this.page.locator('[data-testid="generation-complete"]')).toBeVisible({ timeout });
  }

  /**
   * Download generated project
   */
  async downloadProject() {
    const downloadPromise = this.page.waitForDownload();
    await this.page.click('[data-testid="download-project-button"]');
    const download = await downloadPromise;
    
    return download;
  }

  /**
   * Share project with another user
   */
  async shareProject(shareEmail: string, permissions: 'read' | 'write' = 'read') {
    await this.page.click('[data-testid="share-project-button"]');
    
    await this.page.fill('[data-testid="share-email-input"]', shareEmail);
    await this.page.selectOption('[data-testid="share-permissions-select"]', permissions);
    
    await this.page.click('[data-testid="send-share-invitation-button"]');
    
    // Wait for share success
    await expect(this.page.locator('[data-testid="share-success"]')).toBeVisible();
  }

  /**
   * Navigate to project from dashboard
   */
  async navigateToProject(projectName: string) {
    await this.page.goto('/dashboard');
    
    // Find and click on the project
    await this.page.click(`[data-testid="project-card"][data-project-name="${projectName}"]`);
    
    // Wait for project page to load
    await expect(this.page.locator('[data-testid="project-details"]')).toBeVisible();
  }

  /**
   * Check real-time progress updates
   */
  async verifyRealTimeUpdates() {
    // Verify progress bar updates
    await expect(this.page.locator('[data-testid="progress-bar"]')).toBeVisible();
    
    // Verify live logs are streaming
    await expect(this.page.locator('[data-testid="live-logs"]')).toBeVisible();
    
    // Check for real-time status updates
    const statusIndicator = this.page.locator('[data-testid="status-indicator"]');
    await expect(statusIndicator).toBeVisible();
    
    // Wait for status to change from 'processing' to 'completed'
    await expect(statusIndicator).toHaveAttribute('data-status', 'completed', { timeout: 30000 });
  }

  /**
   * Verify error handling and recovery
   */
  async triggerAndVerifyErrorHandling() {
    // Trigger an error by uploading malformed workflow
    await this.uploadWorkflow('malformed');
    
    // Verify error message is displayed
    await expect(this.page.locator('[data-testid="error-message"]')).toBeVisible();
    
    // Verify retry mechanism
    await this.page.click('[data-testid="retry-button"]');
    
    // Verify error recovery
    await expect(this.page.locator('[data-testid="error-recovered"]')).toBeVisible();
  }

  /**
   * Measure page performance
   */
  async measurePerformance(action: () => Promise<void>) {
    const startTime = Date.now();
    await action();
    const endTime = Date.now();
    
    return endTime - startTime;
  }

  /**
   * Verify analytics tracking
   */
  async verifyAnalyticsTracking() {
    await this.page.goto('/dashboard/analytics');
    
    // Verify analytics dashboard loads
    await expect(this.page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
    
    // Verify user statistics are displayed
    await expect(this.page.locator('[data-testid="user-stats"]')).toBeVisible();
    
    // Verify project metrics are shown
    await expect(this.page.locator('[data-testid="project-metrics"]')).toBeVisible();
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    // Delete test projects
    await this.page.goto('/dashboard');
    
    const deleteButtons = await this.page.locator('[data-testid="delete-project-button"]').all();
    
    for (const button of deleteButtons) {
      await button.click();
      await this.page.click('[data-testid="confirm-delete-button"]');
      await expect(this.page.locator('[data-testid="project-deleted"]')).toBeVisible();
    }
  }
}