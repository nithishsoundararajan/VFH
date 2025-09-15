#!/usr/bin/env tsx
/**
 * Performance testing script for scaling validation
 */

import { LoadTester, StressTester, PerformanceMonitor } from '../src/lib/scaling/load-testing';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TestConfig {
  baseUrl: string;
  duration: number;
  maxConcurrency: number;
  rampUpTime: number;
  endpoints: string[];
}

class PerformanceTestRunner {
  private config: TestConfig;
  private loadTester: LoadTester;
  private stressTester: StressTester;
  private monitor: PerformanceMonitor;
  private results: any[] = [];

  constructor(config: TestConfig) {
    this.config = config;
    this.loadTester = new LoadTester();
    this.stressTester = new StressTester();
    this.monitor = new PerformanceMonitor();
  }

  async runFullTestSuite(): Promise<void> {
    console.log('🚀 Starting comprehensive performance test suite...');

    try {
      await this.runBasicHealthCheck();
      await this.runLoadTests();
      await this.runStressTests();
      await this.runEndpointTests();
      await this.generateReport();

      console.log('✅ Performance test suite completed!');
    } catch (error) {
      console.error('❌ Performance test suite failed:', error);
      process.exit(1);
    }
  }

  private async runBasicHealthCheck(): Promise<void> {
    console.log('🏥 Running basic health check...');

    try {
      const response = await fetch(`${this.config.baseUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      console.log('✅ Health check passed');
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  }

  private async runLoadTests(): Promise<void> {
    console.log('📊 Running load tests...');

    const testCases = [
      { name: 'Light Load', concurrency: 5, duration: 30 },
      { name: 'Medium Load', concurrency: 25, duration: 60 },
      { name: 'Heavy Load', concurrency: 50, duration: 90 },
    ];

    for (const testCase of testCases) {
      console.log(`  Running ${testCase.name}...`);

      const result = await this.loadTester.runLoadTest({
        targetUrl: `${this.config.baseUrl}/api/health`,
        concurrency: testCase.concurrency,
        duration: testCase.duration,
        rampUpTime: Math.min(testCase.duration / 4, 15),
      });

      this.results.push({
        type: 'load',
        name: testCase.name,
        ...result,
      });

      console.log(`    ✅ ${testCase.name}: ${result.requestsPerSecond.toFixed(2)} req/s, ${result.averageResponseTime.toFixed(2)}ms avg`);
    }
  }

  private async runStressTests(): Promise<void> {
    console.log('💪 Running stress tests...');

    const stressResults = await this.stressTester.runBasicStressTest(this.config.baseUrl);

    Object.entries(stressResults).forEach(([testName, result]) => {
      this.results.push({
        type: 'stress',
        name: testName,
        ...result,
      });

      console.log(`  ✅ ${testName}: ${result.requestsPerSecond.toFixed(2)} req/s, ${result.errorRate.toFixed(2)}% errors`);
    });
  }

  private async runEndpointTests(): Promise<void> {
    console.log('🎯 Running endpoint-specific tests...');

    const endpointResults = await this.stressTester.runEndpointStressTest(
      this.config.baseUrl,
      this.config.endpoints
    );

    Object.entries(endpointResults).forEach(([endpoint, result]) => {
      this.results.push({
        type: 'endpoint',
        name: endpoint,
        ...result,
      });

      console.log(`  ✅ ${endpoint}: ${result.requestsPerSecond.toFixed(2)} req/s, ${result.averageResponseTime.toFixed(2)}ms avg`);
    });
  }

  private async generateReport(): Promise<void> {
    console.log('📝 Generating performance report...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = join(process.cwd(), 'reports');

    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }

    // Generate detailed report
    const report = this.createDetailedReport();
    const reportPath = join(reportDir, `performance-report-${timestamp}.md`);
    writeFileSync(reportPath, report);

    // Generate JSON data
    const jsonPath = join(reportDir, `performance-data-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));

    // Generate summary
    const summary = this.createSummary();
    console.log('\n' + summary);

    console.log(`📄 Detailed report saved to: ${reportPath}`);
    console.log(`📊 Raw data saved to: ${jsonPath}`);
  }

  private createDetailedReport(): string {
    const timestamp = new Date().toISOString();

    let report = `# Performance Test Report

**Generated**: ${timestamp}
**Base URL**: ${this.config.baseUrl}
**Test Duration**: ${this.config.duration}s
**Max Concurrency**: ${this.config.maxConcurrency}

## Executive Summary

`;

    // Calculate overall metrics
    const allResults = this.results.filter(r => r.type !== 'endpoint');
    const avgResponseTime = allResults.reduce((sum, r) => sum + r.averageResponseTime, 0) / allResults.length;
    const avgThroughput = allResults.reduce((sum, r) => sum + r.requestsPerSecond, 0) / allResults.length;
    const maxErrorRate = Math.max(...allResults.map(r => r.errorRate));

    report += `- **Average Response Time**: ${avgResponseTime.toFixed(2)}ms
- **Average Throughput**: ${avgThroughput.toFixed(2)} requests/second
- **Maximum Error Rate**: ${maxErrorRate.toFixed(2)}%
- **Total Tests**: ${this.results.length}

## Performance Grades

`;

    // Grade the performance
    const responseGrade = avgResponseTime < 200 ? 'A' : avgResponseTime < 500 ? 'B' : avgResponseTime < 1000 ? 'C' : 'D';
    const throughputGrade = avgThroughput > 100 ? 'A' : avgThroughput > 50 ? 'B' : avgThroughput > 20 ? 'C' : 'D';
    const reliabilityGrade = maxErrorRate < 1 ? 'A' : maxErrorRate < 5 ? 'B' : maxErrorRate < 10 ? 'C' : 'D';

    report += `- **Response Time**: ${responseGrade}
- **Throughput**: ${throughputGrade}
- **Reliability**: ${reliabilityGrade}

## Detailed Results

`;

    // Group results by type
    const groupedResults = this.results.reduce((groups, result) => {
      if (!groups[result.type]) groups[result.type] = [];
      groups[result.type].push(result);
      return groups;
    }, {} as Record<string, any[]>);

    Object.entries(groupedResults).forEach(([type, results]) => {
      report += `### ${type.charAt(0).toUpperCase() + type.slice(1)} Tests

| Test Name | Requests | Success Rate | Avg Response | P95 Response | Throughput | Error Rate |
|-----------|----------|--------------|--------------|--------------|------------|------------|
`;

      results.forEach(result => {
        const successRate = ((result.successfulRequests / result.totalRequests) * 100).toFixed(1);
        report += `| ${result.name} | ${result.totalRequests} | ${successRate}% | ${result.averageResponseTime.toFixed(2)}ms | ${result.p95ResponseTime.toFixed(2)}ms | ${result.requestsPerSecond.toFixed(2)}/s | ${result.errorRate.toFixed(2)}% |
`;
      });

      report += '\n';
    });

    // Add recommendations
    report += `## Recommendations

`;

    if (avgResponseTime > 1000) {
      report += `- ⚠️ **High Response Times**: Average response time of ${avgResponseTime.toFixed(2)}ms is above recommended threshold. Consider:
  - Database query optimization
  - Caching implementation
  - Code optimization
  - Infrastructure scaling

`;
    }

    if (maxErrorRate > 5) {
      report += `- ⚠️ **High Error Rate**: Maximum error rate of ${maxErrorRate.toFixed(2)}% indicates reliability issues. Consider:
  - Error handling improvements
  - Resource allocation increases
  - Load balancing configuration
  - Circuit breaker implementation

`;
    }

    if (avgThroughput < 20) {
      report += `- ⚠️ **Low Throughput**: Average throughput of ${avgThroughput.toFixed(2)} req/s may not meet production demands. Consider:
  - Horizontal scaling
  - Performance optimization
  - Connection pooling
  - CDN implementation

`;
    }

    report += `## Next Steps

1. **Monitor Production**: Implement continuous monitoring with these baseline metrics
2. **Optimize Bottlenecks**: Focus on areas with lowest grades
3. **Scale Infrastructure**: Plan scaling based on expected load patterns
4. **Regular Testing**: Schedule regular performance tests to catch regressions

## Test Configuration

- **Endpoints Tested**: ${this.config.endpoints.join(', ')}
- **Ramp-up Time**: ${this.config.rampUpTime}s
- **Test Environment**: ${process.env.NODE_ENV || 'development'}
`;

    return report;
  }

  private createSummary(): string {
    const allResults = this.results.filter(r => r.type !== 'endpoint');
    const avgResponseTime = allResults.reduce((sum, r) => sum + r.averageResponseTime, 0) / allResults.length;
    const avgThroughput = allResults.reduce((sum, r) => sum + r.requestsPerSecond, 0) / allResults.length;
    const maxErrorRate = Math.max(...allResults.map(r => r.errorRate));

    return `
📊 PERFORMANCE TEST SUMMARY
═══════════════════════════════════════

🎯 Average Response Time: ${avgResponseTime.toFixed(2)}ms
🚀 Average Throughput: ${avgThroughput.toFixed(2)} req/s  
⚠️  Maximum Error Rate: ${maxErrorRate.toFixed(2)}%
📈 Total Tests Completed: ${this.results.length}

${avgResponseTime < 500 && maxErrorRate < 5 && avgThroughput > 20
        ? '✅ PERFORMANCE: EXCELLENT - Ready for production!'
        : avgResponseTime < 1000 && maxErrorRate < 10 && avgThroughput > 10
          ? '⚠️  PERFORMANCE: GOOD - Minor optimizations recommended'
          : '❌ PERFORMANCE: NEEDS IMPROVEMENT - Optimization required'}
`;
  }
}

// CLI interface
async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const duration = parseInt(process.argv[3]) || 60;
  const maxConcurrency = parseInt(process.argv[4]) || 50;

  const config: TestConfig = {
    baseUrl,
    duration,
    maxConcurrency,
    rampUpTime: Math.min(duration / 4, 30),
    endpoints: [
      '/api/health',
      '/api/projects',
      '/api/parse-workflow',
      '/api/analytics',
    ],
  };

  console.log(`🎯 Testing: ${baseUrl}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`👥 Max Concurrency: ${maxConcurrency}`);
  console.log('');

  const runner = new PerformanceTestRunner(config);
  await runner.runFullTestSuite();
}

if (require.main === module) {
  main().catch(console.error);
}

export { PerformanceTestRunner, TestConfig };