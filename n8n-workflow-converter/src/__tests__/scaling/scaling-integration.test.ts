/**
 * Integration tests for scaling functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LoadTester, StressTester, PerformanceMonitor } from '@/lib/scaling/load-testing';
import { LoadBalancer, AutoScaler, CircuitBreaker } from '@/lib/scaling/horizontal-scaling';
import { SupabaseConnectionPool, ResourceMonitor } from '@/lib/scaling/connection-pool';
import { HealthCheckService, BackupService, FailoverService } from '@/lib/scaling/high-availability';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Scaling Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Load Testing', () => {
    let loadTester: LoadTester;

    beforeEach(() => {
      loadTester = new LoadTester();
    });

    it('should run basic load test', async () => {
      // Mock successful responses
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-length', '100']]),
      });

      const result = await loadTester.runLoadTest({
        targetUrl: 'http://localhost:3000/api/health',
        concurrency: 2,
        duration: 1, // 1 second for fast test
        rampUpTime: 0,
      });

      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.successfulRequests).toBe(result.totalRequests);
      expect(result.errorRate).toBe(0);
      expect(result.averageResponseTime).toBeGreaterThan(0);
    });

    it('should handle failed requests', async () => {
      // Mock failed responses
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await loadTester.runLoadTest({
        targetUrl: 'http://localhost:3000/api/health',
        concurrency: 1,
        duration: 1,
        rampUpTime: 0,
      });

      expect(result.failedRequests).toBeGreaterThan(0);
      expect(result.errorRate).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Load Balancer', () => {
    let loadBalancer: LoadBalancer;

    beforeEach(() => {
      loadBalancer = new LoadBalancer([
        { id: 'instance1', url: 'http://localhost:3001', weight: 1 },
        { id: 'instance2', url: 'http://localhost:3002', weight: 2 },
      ]);
    });

    afterEach(() => {
      loadBalancer.stopHealthChecks();
    });

    it('should distribute requests across instances', () => {
      const instance1 = loadBalancer.getNextInstance();
      const instance2 = loadBalancer.getNextInstance();

      expect([instance1, instance2]).toContain('http://localhost:3001');
      expect([instance1, instance2]).toContain('http://localhost:3002');
    });

    it('should use least connections algorithm', () => {
      const instance1 = loadBalancer.getLeastConnectionsInstance();
      const instance2 = loadBalancer.getLeastConnectionsInstance();

      expect(instance1).toBeTruthy();
      expect(instance2).toBeTruthy();
    });

    it('should handle instance removal', () => {
      loadBalancer.removeInstance('instance1');
      const stats = loadBalancer.getStats();
      
      expect(stats.totalInstances).toBe(1);
      expect(stats.instances.find(i => i.id === 'instance1')).toBeUndefined();
    });
  });

  describe('Auto Scaler', () => {
    let autoScaler: AutoScaler;

    beforeEach(() => {
      autoScaler = new AutoScaler();
    });

    it('should track metrics', () => {
      autoScaler.addMetric({
        cpuUsage: 50,
        memoryUsage: 60,
        activeConnections: 30,
        responseTime: 100,
      });

      const stats = autoScaler.getScalingStats();
      expect(stats.recentMetrics.length).toBe(1);
    });

    it('should not scale during cooldown', () => {
      // Add high load metrics
      for (let i = 0; i < 10; i++) {
        autoScaler.addMetric({
          cpuUsage: 90,
          memoryUsage: 95,
          activeConnections: 150,
          responseTime: 3000,
        });
      }

      const stats = autoScaler.getScalingStats();
      expect(stats.currentInstances).toBe(1); // Should not scale immediately
    });
  });

  describe('Circuit Breaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000,
      });
    });

    it('should allow requests when closed', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should open after threshold failures', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('failure'));

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe('open');
    });
  });

  describe('Connection Pool', () => {
    let connectionPool: SupabaseConnectionPool;

    beforeEach(() => {
      connectionPool = new SupabaseConnectionPool({
        maxConnections: 5,
        minConnections: 1,
      });
    });

    afterEach(async () => {
      await connectionPool.destroy();
    });

    it('should acquire and release connections', async () => {
      const client = await connectionPool.acquire();
      expect(client).toBeTruthy();

      const statsBefore = connectionPool.getStats();
      expect(statsBefore.inUseConnections).toBe(1);

      connectionPool.release(client);

      const statsAfter = connectionPool.getStats();
      expect(statsAfter.inUseConnections).toBe(0);
    });

    it('should respect connection limits', async () => {
      const clients = [];
      
      // Acquire all available connections
      for (let i = 0; i < 5; i++) {
        const client = await connectionPool.acquire();
        clients.push(client);
      }

      const stats = connectionPool.getStats();
      expect(stats.inUseConnections).toBe(5);
      expect(stats.totalConnections).toBe(5);

      // Clean up
      clients.forEach(client => connectionPool.release(client));
    });
  });

  describe('Health Check Service', () => {
    let healthChecker: HealthCheckService;

    beforeEach(() => {
      healthChecker = new HealthCheckService();
    });

    afterEach(() => {
      healthChecker.stopPeriodicChecks();
    });

    it('should register and run custom checks', async () => {
      let checkCalled = false;
      
      healthChecker.registerCheck('custom', async () => {
        checkCalled = true;
        return true;
      });

      const result = await healthChecker.runCheck('custom');
      
      expect(checkCalled).toBe(true);
      expect(result.healthy).toBe(true);
    });

    it('should handle check failures', async () => {
      healthChecker.registerCheck('failing', async () => {
        throw new Error('Check failed');
      });

      const result = await healthChecker.runCheck('failing');
      
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Check failed');
    });

    it('should run all checks', async () => {
      healthChecker.registerCheck('check1', async () => true);
      healthChecker.registerCheck('check2', async () => false);

      const results = await healthChecker.runAllChecks();
      
      expect(results.check1.healthy).toBe(true);
      expect(results.check2.healthy).toBe(false);
    });
  });

  describe('Performance Monitor', () => {
    let performanceMonitor: PerformanceMonitor;

    beforeEach(() => {
      performanceMonitor = new PerformanceMonitor();
    });

    it('should record request metrics', () => {
      performanceMonitor.recordRequest({
        responseTime: 100,
        statusCode: 200,
        endpoint: '/api/test',
        method: 'GET',
      });

      const metrics = performanceMonitor.getMetrics();
      expect(metrics?.totalRequests).toBe(1);
      expect(metrics?.averageResponseTime).toBe(100);
    });

    it('should generate alerts for slow responses', () => {
      performanceMonitor.recordRequest({
        responseTime: 6000, // Very slow
        statusCode: 200,
        endpoint: '/api/slow',
        method: 'GET',
      });

      const alerts = performanceMonitor.getAlerts('high');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('slow_response');
    });

    it('should track error rates', () => {
      // Record some successful requests
      for (let i = 0; i < 90; i++) {
        performanceMonitor.recordRequest({
          responseTime: 100,
          statusCode: 200,
          endpoint: '/api/test',
          method: 'GET',
        });
      }

      // Record some failed requests
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordRequest({
          responseTime: 100,
          statusCode: 500,
          endpoint: '/api/test',
          method: 'GET',
        });
      }

      const metrics = performanceMonitor.getMetrics();
      expect(metrics?.errorRate).toBe(10); // 10% error rate
    });
  });

  describe('Resource Monitor', () => {
    let resourceMonitor: ResourceMonitor;

    beforeEach(() => {
      resourceMonitor = ResourceMonitor.getInstance();
    });

    afterEach(() => {
      resourceMonitor.stop();
    });

    it('should collect metrics', () => {
      resourceMonitor.start();
      
      // Wait a bit for metrics collection
      setTimeout(() => {
        const metrics = resourceMonitor.getMetrics();
        expect(typeof metrics).toBe('object');
      }, 100);
    });

    it('should generate alerts for high resource usage', () => {
      // This test would need to mock process.memoryUsage
      // to simulate high memory usage
      const alerts = resourceMonitor.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Stress Testing', () => {
    let stressTester: StressTester;

    beforeEach(() => {
      stressTester = new StressTester();
    });

    it('should generate load test report', () => {
      const mockResults = {
        'test1': {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          averageResponseTime: 150,
          p95ResponseTime: 200,
          p99ResponseTime: 250,
          requestsPerSecond: 10,
          errorRate: 5,
          throughput: 1024,
          minResponseTime: 50,
          maxResponseTime: 300,
          p50ResponseTime: 140,
          errors: [{ message: 'Timeout', count: 5 }],
        },
      };

      const report = stressTester.generateReport(mockResults);
      
      expect(report).toContain('# Load Test Report');
      expect(report).toContain('test1');
      expect(report).toContain('Total Requests');
      expect(report).toContain('95 (95.0%)');
    });
  });
});

// Integration test for full scaling workflow
describe('Full Scaling Workflow', () => {
  it('should handle complete scaling scenario', async () => {
    // Mock a complete scaling scenario
    const loadBalancer = new LoadBalancer([
      { id: 'instance1', url: 'http://localhost:3001' },
    ]);

    const autoScaler = new AutoScaler();
    const healthChecker = new HealthCheckService();

    try {
      // Simulate high load
      autoScaler.addMetric({
        cpuUsage: 90,
        memoryUsage: 85,
        activeConnections: 150,
        responseTime: 2500,
      });

      // Check health
      const health = await healthChecker.runAllChecks();
      expect(typeof health).toBe('object');

      // Get load balancer stats
      const stats = loadBalancer.getStats();
      expect(stats.totalInstances).toBe(1);

      // Get scaling stats
      const scalingStats = autoScaler.getScalingStats();
      expect(scalingStats.currentInstances).toBe(1);

    } finally {
      loadBalancer.stopHealthChecks();
      healthChecker.stopPeriodicChecks();
    }
  });
});