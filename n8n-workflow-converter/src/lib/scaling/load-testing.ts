/**
 * Load testing and performance monitoring utilities
 */

interface LoadTestConfig {
  targetUrl: string;
  concurrency: number;
  duration: number; // in seconds
  rampUpTime: number; // in seconds
  requestsPerSecond?: number;
  headers?: Record<string, string>;
  body?: any;
  method?: string;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  errors: Array<{ message: string; count: number }>;
  throughput: number; // bytes per second
}

export class LoadTester {
  private results: number[] = [];
  private errors: Map<string, number> = new Map();
  private totalBytes = 0;
  private startTime = 0;
  private endTime = 0;

  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    console.log(`Starting load test: ${config.concurrency} concurrent users for ${config.duration}s`);
    
    this.reset();
    this.startTime = Date.now();

    const promises: Promise<void>[] = [];
    const requestInterval = config.requestsPerSecond 
      ? 1000 / config.requestsPerSecond 
      : 0;

    // Create concurrent workers
    for (let i = 0; i < config.concurrency; i++) {
      const workerPromise = this.createWorker(config, i, requestInterval);
      promises.push(workerPromise);
    }

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, config.duration * 1000));
    
    // Stop all workers (they should check for time limit)
    await Promise.allSettled(promises);
    
    this.endTime = Date.now();
    
    return this.calculateResults();
  }

  private async createWorker(
    config: LoadTestConfig, 
    workerId: number, 
    requestInterval: number
  ): Promise<void> {
    const rampUpDelay = (config.rampUpTime * 1000 * workerId) / config.concurrency;
    
    // Wait for ramp-up
    await new Promise(resolve => setTimeout(resolve, rampUpDelay));
    
    while (Date.now() - this.startTime < config.duration * 1000) {
      try {
        await this.makeRequest(config);
        
        if (requestInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, requestInterval));
        }
      } catch (error) {
        // Continue on error
      }
    }
  }

  private async makeRequest(config: LoadTestConfig): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(config.targetUrl, {
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.results.push(responseTime);
      
      // Track response size
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        this.totalBytes += parseInt(contentLength);
      }
      
      if (!response.ok) {
        this.recordError(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.results.push(responseTime);
      this.recordError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private recordError(message: string): void {
    const count = this.errors.get(message) || 0;
    this.errors.set(message, count + 1);
  }

  private calculateResults(): LoadTestResult {
    const totalRequests = this.results.length;
    const failedRequests = Array.from(this.errors.values()).reduce((sum, count) => sum + count, 0);
    const successfulRequests = totalRequests - failedRequests;
    
    const sortedResults = [...this.results].sort((a, b) => a - b);
    const testDuration = (this.endTime - this.startTime) / 1000;
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: this.results.reduce((sum, time) => sum + time, 0) / totalRequests,
      minResponseTime: sortedResults[0] || 0,
      maxResponseTime: sortedResults[sortedResults.length - 1] || 0,
      p50ResponseTime: sortedResults[Math.floor(sortedResults.length * 0.5)] || 0,
      p95ResponseTime: sortedResults[Math.floor(sortedResults.length * 0.95)] || 0,
      p99ResponseTime: sortedResults[Math.floor(sortedResults.length * 0.99)] || 0,
      requestsPerSecond: totalRequests / testDuration,
      errorRate: (failedRequests / totalRequests) * 100,
      errors: Array.from(this.errors.entries()).map(([message, count]) => ({ message, count })),
      throughput: this.totalBytes / testDuration,
    };
  }

  private reset(): void {
    this.results = [];
    this.errors.clear();
    this.totalBytes = 0;
    this.startTime = 0;
    this.endTime = 0;
  }
}

// Performance monitoring for production
export class PerformanceMonitor {
  private metrics: Array<{
    timestamp: number;
    responseTime: number;
    statusCode: number;
    endpoint: string;
    method: string;
    userAgent?: string;
  }> = [];

  private alerts: Array<{
    timestamp: number;
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }> = [];

  recordRequest(data: {
    responseTime: number;
    statusCode: number;
    endpoint: string;
    method: string;
    userAgent?: string;
  }): void {
    this.metrics.push({
      timestamp: Date.now(),
      ...data,
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    this.checkAlerts(data);
  }

  private checkAlerts(data: {
    responseTime: number;
    statusCode: number;
    endpoint: string;
  }): void {
    // Slow response alert
    if (data.responseTime > 5000) {
      this.addAlert('slow_response', `Slow response: ${data.responseTime}ms for ${data.endpoint}`, 'high');
    } else if (data.responseTime > 2000) {
      this.addAlert('slow_response', `Slow response: ${data.responseTime}ms for ${data.endpoint}`, 'medium');
    }

    // Error status alert
    if (data.statusCode >= 500) {
      this.addAlert('server_error', `Server error: ${data.statusCode} for ${data.endpoint}`, 'high');
    } else if (data.statusCode >= 400) {
      this.addAlert('client_error', `Client error: ${data.statusCode} for ${data.endpoint}`, 'medium');
    }

    // Check error rate
    const recentMetrics = this.metrics.slice(-100); // Last 100 requests
    const errorRate = recentMetrics.filter(m => m.statusCode >= 400).length / recentMetrics.length;
    
    if (errorRate > 0.1) { // 10% error rate
      this.addAlert('high_error_rate', `High error rate: ${(errorRate * 100).toFixed(1)}%`, 'high');
    }
  }

  private addAlert(type: string, message: string, severity: 'low' | 'medium' | 'high'): void {
    // Avoid duplicate alerts within 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentSimilarAlert = this.alerts.find(
      alert => alert.type === type && alert.timestamp > fiveMinutesAgo
    );

    if (!recentSimilarAlert) {
      this.alerts.push({
        timestamp: Date.now(),
        type,
        message,
        severity,
      });

      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts.shift();
      }

      // Log high severity alerts
      if (severity === 'high') {
        console.error(`Performance Alert: ${message}`);
      }
    }
  }

  getMetrics(timeRange?: { start: number; end: number }) {
    let filteredMetrics = this.metrics;
    
    if (timeRange) {
      filteredMetrics = this.metrics.filter(
        m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    if (filteredMetrics.length === 0) {
      return null;
    }

    const responseTimes = filteredMetrics.map(m => m.responseTime);
    const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);
    
    const statusCodes = filteredMetrics.reduce((acc, m) => {
      acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const endpoints = filteredMetrics.reduce((acc, m) => {
      acc[m.endpoint] = (acc[m.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests: filteredMetrics.length,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      minResponseTime: sortedResponseTimes[0],
      maxResponseTime: sortedResponseTimes[sortedResponseTimes.length - 1],
      p50ResponseTime: sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.5)],
      p95ResponseTime: sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)],
      p99ResponseTime: sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.99)],
      statusCodes,
      topEndpoints: Object.entries(endpoints)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count })),
      errorRate: (filteredMetrics.filter(m => m.statusCode >= 400).length / filteredMetrics.length) * 100,
    };
  }

  getAlerts(severity?: 'low' | 'medium' | 'high') {
    let filteredAlerts = this.alerts;
    
    if (severity) {
      filteredAlerts = this.alerts.filter(alert => alert.severity === severity);
    }

    return filteredAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  clearAlerts(): void {
    this.alerts = [];
  }
}

// Stress testing scenarios
export class StressTester {
  private loadTester = new LoadTester();

  async runBasicStressTest(baseUrl: string): Promise<{
    light: LoadTestResult;
    moderate: LoadTestResult;
    heavy: LoadTestResult;
  }> {
    console.log('Running basic stress test suite...');

    // Light load
    const light = await this.loadTester.runLoadTest({
      targetUrl: `${baseUrl}/api/health`,
      concurrency: 10,
      duration: 30,
      rampUpTime: 5,
    });

    // Moderate load
    const moderate = await this.loadTester.runLoadTest({
      targetUrl: `${baseUrl}/api/projects`,
      concurrency: 50,
      duration: 60,
      rampUpTime: 10,
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });

    // Heavy load
    const heavy = await this.loadTester.runLoadTest({
      targetUrl: `${baseUrl}/api/parse-workflow`,
      concurrency: 100,
      duration: 120,
      rampUpTime: 20,
      method: 'POST',
      body: { workflow: 'test-workflow-data' },
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });

    return { light, moderate, heavy };
  }

  async runEndpointStressTest(baseUrl: string, endpoints: string[]): Promise<Record<string, LoadTestResult>> {
    const results: Record<string, LoadTestResult> = {};

    for (const endpoint of endpoints) {
      console.log(`Testing endpoint: ${endpoint}`);
      
      const result = await this.loadTester.runLoadTest({
        targetUrl: `${baseUrl}${endpoint}`,
        concurrency: 25,
        duration: 60,
        rampUpTime: 10,
      });

      results[endpoint] = result;
    }

    return results;
  }

  generateReport(results: Record<string, LoadTestResult>): string {
    let report = '# Load Test Report\n\n';
    
    for (const [testName, result] of Object.entries(results)) {
      report += `## ${testName}\n\n`;
      report += `- **Total Requests**: ${result.totalRequests}\n`;
      report += `- **Successful**: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%)\n`;
      report += `- **Failed**: ${result.failedRequests} (${result.errorRate.toFixed(1)}%)\n`;
      report += `- **Requests/sec**: ${result.requestsPerSecond.toFixed(2)}\n`;
      report += `- **Avg Response Time**: ${result.averageResponseTime.toFixed(2)}ms\n`;
      report += `- **P95 Response Time**: ${result.p95ResponseTime.toFixed(2)}ms\n`;
      report += `- **P99 Response Time**: ${result.p99ResponseTime.toFixed(2)}ms\n`;
      report += `- **Throughput**: ${(result.throughput / 1024).toFixed(2)} KB/s\n\n`;
      
      if (result.errors.length > 0) {
        report += '### Errors:\n';
        result.errors.forEach(error => {
          report += `- ${error.message}: ${error.count} occurrences\n`;
        });
        report += '\n';
      }
    }

    return report;
  }
}

// Global instances
let globalPerformanceMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor();
  }
  return globalPerformanceMonitor;
}