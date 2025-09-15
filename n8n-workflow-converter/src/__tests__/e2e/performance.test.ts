/**
 * End-to-End Tests - Performance and Load Testing
 * Tests application performance under various load conditions
 */

import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { TEST_CONFIGURATIONS, PERFORMANCE_THRESHOLDS } from './fixtures/test-data';

test.describe('Performance and Load Testing', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.registerUser('primary');
    await helpers.loginUser('primary');
  });

  test.afterEach(async () => {
    await helpers.cleanup();
  });

  test('should meet page load performance requirements', async ({ page }) => {
    const performanceMetrics = {
      dashboard: 0,
      upload: 0,
      analytics: 0
    };

    // Test dashboard load time
    performanceMetrics.dashboard = await helpers.measurePerformance(async () => {
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
    });

    // Test upload page load time
    performanceMetrics.upload = await helpers.measurePerformance(async () => {
      await page.goto('/upload');
      await expect(page.locator('[data-testid="upload-interface"]')).toBeVisible();
    });

    // Test analytics page load time
    performanceMetrics.analytics = await helpers.measurePerformance(async () => {
      await page.goto('/dashboard/analytics');
      await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
    });

    // Verify all pages meet performance thresholds
    expect(performanceMetrics.dashboard).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);
    expect(performanceMetrics.upload).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);
    expect(performanceMetrics.analytics).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);

    console.log('Page Load Performance:', performanceMetrics);
  });

  test('should handle large workflow files efficiently', async ({ page }) => {
    // Create a large workflow with many nodes
    const largeWorkflow = {
      name: 'Large Performance Test Workflow',
      nodes: Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        name: `Node ${i}`,
        type: 'n8n-nodes-base.set',
        typeVersion: 1,
        position: [100 + (i % 10) * 200, 100 + Math.floor(i / 10) * 150],
        parameters: {
          values: {
            string: [
              {
                name: `field_${i}`,
                value: `value_${i}`
              }
            ]
          }
        }
      })),
      connections: {}
    };

    // Add connections between nodes
    for (let i = 0; i < 99; i++) {
      largeWorkflow.connections[`node-${i}`] = {
        main: [
          [
            {
              node: `node-${i + 1}`,
              type: 'main',
              index: 0
            }
          ]
        ]
      };
    }

    // Test upload performance with large file
    const uploadTime = await helpers.measurePerformance(async () => {
      await page.goto('/upload');
      
      const fileInput = page.locator('[data-testid="workflow-file-input"]');
      await fileInput.setInputFiles({
        name: 'large-workflow.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(largeWorkflow, null, 2))
      });
      
      await expect(page.locator('[data-testid="workflow-preview"]')).toBeVisible();
    });

    expect(uploadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.workflowUpload * 2); // Allow 2x threshold for large files

    // Verify workflow information is displayed correctly
    await expect(page.locator('[data-testid="node-count"]')).toHaveText('100');
  });

  test('should handle concurrent user sessions', async ({ browser }) => {
    const concurrentUsers = 5;
    const userSessions = [];

    // Create multiple concurrent user sessions
    for (let i = 0; i < concurrentUsers; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const userHelpers = new TestHelpers(page);
      
      userSessions.push({
        helpers: userHelpers,
        page,
        context
      });
    }

    try {
      // Register and login all users concurrently
      const registrationPromises = userSessions.map(async (session, index) => {
        const user = {
          email: `concurrent-user-${index}-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          fullName: `Concurrent User ${index}`
        };
        
        await session.page.goto('/auth/register');
        await session.page.fill('[data-testid="email-input"]', user.email);
        await session.page.fill('[data-testid="password-input"]', user.password);
        await session.page.fill('[data-testid="confirm-password-input"]', user.password);
        await session.page.fill('[data-testid="full-name-input"]', user.fullName);
        await session.page.click('[data-testid="register-button"]');
        
        await expect(session.page).toHaveURL('/dashboard');
        return user;
      });

      const users = await Promise.all(registrationPromises);

      // Perform concurrent workflow operations
      const workflowPromises = userSessions.map(async (session, index) => {
        const startTime = Date.now();
        
        await session.helpers.uploadWorkflow('simple');
        await session.helpers.configureProject(TEST_CONFIGURATIONS.basic);
        await session.helpers.startCodeGeneration();
        await session.helpers.waitForGenerationComplete();
        
        const endTime = Date.now();
        return endTime - startTime;
      });

      const operationTimes = await Promise.all(workflowPromises);

      // Verify all operations completed within reasonable time
      operationTimes.forEach((time, index) => {
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.codeGeneration * 1.5); // Allow 50% overhead for concurrency
        console.log(`User ${index} operation time: ${time}ms`);
      });

    } finally {
      // Clean up all sessions
      await Promise.all(userSessions.map(session => session.context.close()));
    }
  });

  test('should handle memory usage efficiently during long sessions', async ({ page }) => {
    // Perform multiple operations to test memory usage
    for (let i = 0; i < 10; i++) {
      await helpers.uploadWorkflow(i % 2 === 0 ? 'simple' : 'complex');
      await helpers.configureProject(TEST_CONFIGURATIONS.basic);
      await helpers.startCodeGeneration();
      await helpers.waitForGenerationComplete();
      
      // Download and clean up
      await helpers.downloadProject();
      
      // Navigate back to dashboard and delete project
      await page.goto('/dashboard');
      await page.click('[data-testid="delete-project-button"]:first-of-type');
      await page.click('[data-testid="confirm-delete-button"]');
      await expect(page.locator('[data-testid="project-deleted"]')).toBeVisible();
    }

    // Verify page is still responsive after multiple operations
    const finalLoadTime = await helpers.measurePerformance(async () => {
      await page.reload();
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
    });

    expect(finalLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);
  });

  test('should handle real-time updates efficiently with multiple projects', async ({ page }) => {
    const projectCount = 5;
    const projects = [];

    // Create multiple projects
    for (let i = 0; i < projectCount; i++) {
      const workflow = await helpers.uploadWorkflow(i % 2 === 0 ? 'simple' : 'complex');
      await helpers.configureProject(TEST_CONFIGURATIONS.basic);
      projects.push(workflow);
      
      // Navigate back to upload for next project
      if (i < projectCount - 1) {
        await page.goto('/upload');
      }
    }

    // Navigate to dashboard and start all generations simultaneously
    await page.goto('/dashboard');
    
    const startTime = Date.now();
    
    // Start all generations
    const projectCards = await page.locator('[data-testid="project-card"]').all();
    for (const card of projectCards) {
      await card.click();
      await page.click('[data-testid="generate-code-button"]');
      await page.goBack();
    }

    // Monitor real-time updates for all projects
    await expect(page.locator('[data-testid="active-generations"]')).toHaveText(projectCount.toString());

    // Wait for all generations to complete
    await expect(page.locator('[data-testid="active-generations"]')).toHaveText('0', { timeout: 120000 });
    
    const totalTime = Date.now() - startTime;
    console.log(`${projectCount} concurrent generations completed in ${totalTime}ms`);

    // Verify all projects completed successfully
    const completedProjects = await page.locator('[data-testid="project-status"][data-status="completed"]').count();
    expect(completedProjects).toBe(projectCount);
  });

  test('should maintain performance with large analytics datasets', async ({ page }) => {
    // Generate analytics data by performing multiple operations
    for (let i = 0; i < 20; i++) {
      await helpers.uploadWorkflow('simple');
      await helpers.configureProject(TEST_CONFIGURATIONS.basic);
      await helpers.startCodeGeneration();
      await helpers.waitForGenerationComplete();
    }

    // Test analytics page performance with large dataset
    const analyticsLoadTime = await helpers.measurePerformance(async () => {
      await page.goto('/dashboard/analytics');
      await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-metrics"]')).toBeVisible();
    });

    expect(analyticsLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad * 2); // Allow 2x for complex analytics

    // Test chart rendering performance
    const chartLoadTime = await helpers.measurePerformance(async () => {
      await page.click('[data-testid="detailed-analytics-tab"]');
      await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
    });

    expect(chartLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);
  });

  test('should handle file download performance under load', async ({ page }) => {
    // Create multiple projects for download testing
    const downloadPromises = [];
    
    for (let i = 0; i < 3; i++) {
      await helpers.uploadWorkflow('complex');
      await helpers.configureProject(TEST_CONFIGURATIONS.basic);
      await helpers.startCodeGeneration();
      await helpers.waitForGenerationComplete();
      
      // Queue download
      downloadPromises.push(
        helpers.measurePerformance(async () => {
          const download = await helpers.downloadProject();
          expect(download.suggestedFilename()).toMatch(/\.zip$/);
        })
      );
      
      // Navigate back for next project
      if (i < 2) {
        await page.goto('/upload');
      }
    }

    // Execute all downloads concurrently
    const downloadTimes = await Promise.all(downloadPromises);
    
    // Verify all downloads completed within threshold
    downloadTimes.forEach((time, index) => {
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.fileDownload);
      console.log(`Download ${index + 1} completed in ${time}ms`);
    });
  });

  test('should maintain responsive UI during heavy operations', async ({ page }) => {
    // Start a heavy operation (complex workflow generation)
    await helpers.uploadWorkflow('complex');
    await helpers.configureProject(TEST_CONFIGURATIONS.advanced);
    await helpers.startCodeGeneration();

    // Test UI responsiveness during generation
    const uiResponseTimes = [];

    // Test navigation responsiveness
    uiResponseTimes.push(await helpers.measurePerformance(async () => {
      await page.click('[data-testid="dashboard-nav-link"]');
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
    }));

    // Test settings page responsiveness
    uiResponseTimes.push(await helpers.measurePerformance(async () => {
      await page.click('[data-testid="settings-nav-link"]');
      await expect(page.locator('[data-testid="settings-content"]')).toBeVisible();
    }));

    // Test analytics page responsiveness
    uiResponseTimes.push(await helpers.measurePerformance(async () => {
      await page.click('[data-testid="analytics-nav-link"]');
      await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
    }));

    // Verify UI remains responsive
    uiResponseTimes.forEach((time, index) => {
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);
      console.log(`UI response time ${index + 1}: ${time}ms`);
    });

    // Verify generation is still running
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="generation-in-progress"]')).toBeVisible();
  });
});