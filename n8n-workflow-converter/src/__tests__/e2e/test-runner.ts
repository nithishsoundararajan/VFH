/**
 * E2E Test Runner Configuration
 * Provides utilities for running comprehensive end-to-end test suites
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  description: string;
  files: string[];
  timeout: number;
  retries: number;
}

interface TestResults {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
}

export class E2ETestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'complete-workflow',
      description: 'Complete user workflow from registration to download',
      files: ['complete-workflow.test.ts'],
      timeout: 120000,
      retries: 2
    },
    {
      name: 'collaboration',
      description: 'Collaborative features and sharing functionality',
      files: ['collaboration.test.ts'],
      timeout: 180000,
      retries: 1
    },
    {
      name: 'error-handling',
      description: 'Error scenarios and recovery mechanisms',
      files: ['error-handling.test.ts'],
      timeout: 150000,
      retries: 3
    },
    {
      name: 'performance',
      description: 'Performance and load testing',
      files: ['performance.test.ts'],
      timeout: 300000,
      retries: 1
    }
  ];

  /**
   * Run all test suites
   */
  async runAllSuites(): Promise<TestResults[]> {
    console.log('🚀 Starting comprehensive E2E test execution...\n');
    
    const results: TestResults[] = [];
    
    for (const suite of this.testSuites) {
      console.log(`📋 Running test suite: ${suite.name}`);
      console.log(`   Description: ${suite.description}`);
      console.log(`   Timeout: ${suite.timeout}ms, Retries: ${suite.retries}\n`);
      
      const result = await this.runTestSuite(suite);
      results.push(result);
      
      this.printSuiteResults(result);
    }
    
    this.printOverallResults(results);
    return results;
  }

  /**
   * Run a specific test suite
   */
  async runTestSuite(suite: TestSuite): Promise<TestResults> {
    const startTime = Date.now();
    
    try {
      const command = this.buildPlaywrightCommand(suite);
      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: suite.timeout
      });
      
      const duration = Date.now() - startTime;
      return this.parseTestOutput(suite.name, output, duration);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        errors: [error.message || 'Unknown error occurred']
      };
    }
  }

  /**
   * Run tests in different environments
   */
  async runCrossEnvironmentTests(): Promise<void> {
    const environments = [
      { name: 'development', url: 'http://localhost:3000' },
      { name: 'staging', url: process.env.STAGING_URL },
      { name: 'production', url: process.env.PRODUCTION_URL }
    ].filter(env => env.url);

    console.log('🌍 Running cross-environment tests...\n');

    for (const env of environments) {
      console.log(`🔧 Testing environment: ${env.name} (${env.url})`);
      
      // Set environment URL
      process.env.TEST_BASE_URL = env.url;
      
      // Run critical path tests only for non-development environments
      const criticalSuite = this.testSuites.find(s => s.name === 'complete-workflow');
      if (criticalSuite) {
        const result = await this.runTestSuite(criticalSuite);
        this.printSuiteResults(result);
      }
    }
  }

  /**
   * Generate test report
   */
  generateTestReport(results: TestResults[]): void {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000'
      },
      summary: {
        totalSuites: results.length,
        totalPassed: results.reduce((sum, r) => sum + r.passed, 0),
        totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
        totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
      },
      suites: results
    };

    const reportPath = join(process.cwd(), 'test-results', 'e2e-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Test report generated: ${reportPath}`);
  }

  /**
   * Build Playwright command for test suite
   */
  private buildPlaywrightCommand(suite: TestSuite): string {
    const testFiles = suite.files.map(file => `src/__tests__/e2e/${file}`).join(' ');
    
    return [
      'npx playwright test',
      testFiles,
      `--timeout=${suite.timeout}`,
      `--retries=${suite.retries}`,
      '--reporter=json',
      '--output=test-results'
    ].join(' ');
  }

  /**
   * Parse Playwright test output
   */
  private parseTestOutput(suiteName: string, output: string, duration: number): TestResults {
    try {
      const jsonOutput = JSON.parse(output);
      
      return {
        suite: suiteName,
        passed: jsonOutput.stats?.passed || 0,
        failed: jsonOutput.stats?.failed || 0,
        skipped: jsonOutput.stats?.skipped || 0,
        duration,
        errors: jsonOutput.errors || []
      };
    } catch {
      // Fallback parsing for non-JSON output
      const lines = output.split('\n');
      const passedMatch = output.match(/(\d+) passed/);
      const failedMatch = output.match(/(\d+) failed/);
      const skippedMatch = output.match(/(\d+) skipped/);
      
      return {
        suite: suiteName,
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : 0,
        skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
        duration,
        errors: lines.filter(line => line.includes('Error:') || line.includes('Failed:'))
      };
    }
  }

  /**
   * Print results for a test suite
   */
  private printSuiteResults(result: TestResults): void {
    const status = result.failed > 0 ? '❌' : '✅';
    const duration = (result.duration / 1000).toFixed(2);
    
    console.log(`${status} Suite: ${result.suite}`);
    console.log(`   Passed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
    console.log(`   Duration: ${duration}s`);
    
    if (result.errors.length > 0) {
      console.log(`   Errors:`);
      result.errors.forEach(error => console.log(`     - ${error}`));
    }
    console.log('');
  }

  /**
   * Print overall test results
   */
  private printOverallResults(results: TestResults[]): void {
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('📊 Overall Test Results:');
    console.log('========================');
    console.log(`Total Tests: ${totalPassed + totalFailed + totalSkipped}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Skipped: ${totalSkipped}`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
    
    if (totalFailed > 0) {
      console.log('\n❌ Some tests failed. Check the detailed results above.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed successfully!');
    }
  }
}

// CLI execution
if (require.main === module) {
  const runner = new E2ETestRunner();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'all':
      runner.runAllSuites().then(results => {
        runner.generateTestReport(results);
      });
      break;
      
    case 'cross-env':
      runner.runCrossEnvironmentTests();
      break;
      
    default:
      console.log('Usage: npm run test:e2e:runner [all|cross-env]');
      console.log('  all       - Run all test suites');
      console.log('  cross-env - Run tests across different environments');
  }
}