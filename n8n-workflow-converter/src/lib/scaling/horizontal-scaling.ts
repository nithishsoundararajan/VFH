/**
 * Horizontal scaling utilities and load balancing
 */

import { createClient } from '@supabase/supabase-js';

// Load balancer for distributing requests across multiple instances
export class LoadBalancer {
  private instances: Array<{
    id: string;
    url: string;
    weight: number;
    healthy: boolean;
    lastHealthCheck: number;
    activeConnections: number;
  }> = [];

  private healthCheckInterval?: NodeJS.Timeout;
  private readonly healthCheckIntervalMs = 30000; // 30 seconds

  constructor(instances: Array<{ id: string; url: string; weight?: number }> = []) {
    instances.forEach(instance => {
      this.addInstance(instance.id, instance.url, instance.weight);
    });
    
    this.startHealthChecks();
  }

  addInstance(id: string, url: string, weight = 1): void {
    this.instances.push({
      id,
      url,
      weight,
      healthy: true,
      lastHealthCheck: Date.now(),
      activeConnections: 0,
    });
  }

  removeInstance(id: string): void {
    const index = this.instances.findIndex(instance => instance.id === id);
    if (index !== -1) {
      this.instances.splice(index, 1);
    }
  }

  // Round-robin with weights
  getNextInstance(): string | null {
    const healthyInstances = this.instances.filter(instance => instance.healthy);
    
    if (healthyInstances.length === 0) {
      return null;
    }

    // Weighted round-robin selection
    const totalWeight = healthyInstances.reduce((sum, instance) => sum + instance.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of healthyInstances) {
      random -= instance.weight;
      if (random <= 0) {
        instance.activeConnections++;
        return instance.url;
      }
    }

    // Fallback to first healthy instance
    healthyInstances[0].activeConnections++;
    return healthyInstances[0].url;
  }

  // Least connections algorithm
  getLeastConnectionsInstance(): string | null {
    const healthyInstances = this.instances.filter(instance => instance.healthy);
    
    if (healthyInstances.length === 0) {
      return null;
    }

    const leastConnections = Math.min(...healthyInstances.map(i => i.activeConnections));
    const candidates = healthyInstances.filter(i => i.activeConnections === leastConnections);
    
    // Among instances with least connections, pick the one with highest weight
    const selected = candidates.reduce((best, current) => 
      current.weight > best.weight ? current : best
    );

    selected.activeConnections++;
    return selected.url;
  }

  releaseConnection(url: string): void {
    const instance = this.instances.find(i => i.url === url);
    if (instance && instance.activeConnections > 0) {
      instance.activeConnections--;
    }
  }

  private async checkInstanceHealth(instance: typeof this.instances[0]): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${instance.url}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error(`Health check failed for instance ${instance.id}:`, error);
      return false;
    }
  }

  private async performHealthChecks(): Promise<void> {
    const promises = this.instances.map(async (instance) => {
      const healthy = await this.checkInstanceHealth(instance);
      instance.healthy = healthy;
      instance.lastHealthCheck = Date.now();
      
      if (!healthy) {
        console.warn(`Instance ${instance.id} is unhealthy`);
      }
    });

    await Promise.allSettled(promises);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckIntervalMs);
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  getStats() {
    return {
      totalInstances: this.instances.length,
      healthyInstances: this.instances.filter(i => i.healthy).length,
      totalActiveConnections: this.instances.reduce((sum, i) => sum + i.activeConnections, 0),
      instances: this.instances.map(i => ({
        id: i.id,
        url: i.url,
        healthy: i.healthy,
        activeConnections: i.activeConnections,
        weight: i.weight,
      })),
    };
  }
}

// Auto-scaling manager
export class AutoScaler {
  private metrics: Array<{
    timestamp: number;
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    responseTime: number;
  }> = [];

  private scaleUpThreshold = {
    cpuUsage: 80,
    memoryUsage: 85,
    activeConnections: 100,
    responseTime: 2000,
  };

  private scaleDownThreshold = {
    cpuUsage: 30,
    memoryUsage: 40,
    activeConnections: 20,
    responseTime: 500,
  };

  private minInstances = 1;
  private maxInstances = 10;
  private currentInstances = 1;
  private lastScaleAction = 0;
  private cooldownPeriod = 5 * 60 * 1000; // 5 minutes

  addMetric(metric: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    responseTime: number;
  }): void {
    this.metrics.push({
      timestamp: Date.now(),
      ...metric,
    });

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }

    this.evaluateScaling();
  }

  private evaluateScaling(): void {
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.lastScaleAction < this.cooldownPeriod) {
      return;
    }

    // Need at least 5 metrics to make a decision
    if (this.metrics.length < 5) {
      return;
    }

    const recentMetrics = this.metrics.slice(-5);
    const avgMetrics = this.calculateAverageMetrics(recentMetrics);

    const shouldScaleUp = this.shouldScaleUp(avgMetrics);
    const shouldScaleDown = this.shouldScaleDown(avgMetrics);

    if (shouldScaleUp && this.currentInstances < this.maxInstances) {
      this.scaleUp();
    } else if (shouldScaleDown && this.currentInstances > this.minInstances) {
      this.scaleDown();
    }
  }

  private calculateAverageMetrics(metrics: typeof this.metrics) {
    const sum = metrics.reduce(
      (acc, metric) => ({
        cpuUsage: acc.cpuUsage + metric.cpuUsage,
        memoryUsage: acc.memoryUsage + metric.memoryUsage,
        activeConnections: acc.activeConnections + metric.activeConnections,
        responseTime: acc.responseTime + metric.responseTime,
      }),
      { cpuUsage: 0, memoryUsage: 0, activeConnections: 0, responseTime: 0 }
    );

    return {
      cpuUsage: sum.cpuUsage / metrics.length,
      memoryUsage: sum.memoryUsage / metrics.length,
      activeConnections: sum.activeConnections / metrics.length,
      responseTime: sum.responseTime / metrics.length,
    };
  }

  private shouldScaleUp(avgMetrics: ReturnType<typeof this.calculateAverageMetrics>): boolean {
    return (
      avgMetrics.cpuUsage > this.scaleUpThreshold.cpuUsage ||
      avgMetrics.memoryUsage > this.scaleUpThreshold.memoryUsage ||
      avgMetrics.activeConnections > this.scaleUpThreshold.activeConnections ||
      avgMetrics.responseTime > this.scaleUpThreshold.responseTime
    );
  }

  private shouldScaleDown(avgMetrics: ReturnType<typeof this.calculateAverageMetrics>): boolean {
    return (
      avgMetrics.cpuUsage < this.scaleDownThreshold.cpuUsage &&
      avgMetrics.memoryUsage < this.scaleDownThreshold.memoryUsage &&
      avgMetrics.activeConnections < this.scaleDownThreshold.activeConnections &&
      avgMetrics.responseTime < this.scaleDownThreshold.responseTime
    );
  }

  private scaleUp(): void {
    this.currentInstances++;
    this.lastScaleAction = Date.now();
    
    console.log(`Scaling up to ${this.currentInstances} instances`);
    
    // Trigger actual scaling (implementation depends on deployment platform)
    this.triggerScaleAction('up');
  }

  private scaleDown(): void {
    this.currentInstances--;
    this.lastScaleAction = Date.now();
    
    console.log(`Scaling down to ${this.currentInstances} instances`);
    
    // Trigger actual scaling (implementation depends on deployment platform)
    this.triggerScaleAction('down');
  }

  private triggerScaleAction(direction: 'up' | 'down'): void {
    // This would integrate with your deployment platform
    // Examples: Kubernetes HPA, Docker Swarm, AWS Auto Scaling, etc.
    
    if (process.env.DEPLOYMENT_PLATFORM === 'kubernetes') {
      this.scaleKubernetes(direction);
    } else if (process.env.DEPLOYMENT_PLATFORM === 'docker-swarm') {
      this.scaleDockerSwarm(direction);
    } else if (process.env.DEPLOYMENT_PLATFORM === 'vercel') {
      // Vercel handles scaling automatically
      console.log('Vercel handles auto-scaling automatically');
    }
  }

  private async scaleKubernetes(direction: 'up' | 'down'): Promise<void> {
    // Example Kubernetes scaling
    try {
      const replicas = direction === 'up' ? this.currentInstances : this.currentInstances;
      
      // This would use kubectl or Kubernetes API
      console.log(`Would scale Kubernetes deployment to ${replicas} replicas`);
      
      // Example command: kubectl scale deployment n8n-converter --replicas=${replicas}
    } catch (error) {
      console.error('Failed to scale Kubernetes deployment:', error);
    }
  }

  private async scaleDockerSwarm(direction: 'up' | 'down'): Promise<void> {
    // Example Docker Swarm scaling
    try {
      const replicas = direction === 'up' ? this.currentInstances : this.currentInstances;
      
      console.log(`Would scale Docker Swarm service to ${replicas} replicas`);
      
      // Example command: docker service scale n8n-converter=${replicas}
    } catch (error) {
      console.error('Failed to scale Docker Swarm service:', error);
    }
  }

  getScalingStats() {
    return {
      currentInstances: this.currentInstances,
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      lastScaleAction: this.lastScaleAction,
      cooldownRemaining: Math.max(0, this.cooldownPeriod - (Date.now() - this.lastScaleAction)),
      recentMetrics: this.metrics.slice(-10),
    };
  }
}

// Circuit breaker for handling failures gracefully
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly monitoringPeriod: number;

  constructor(options: {
    failureThreshold?: number;
    recoveryTimeout?: number;
    monitoringPeriod?: number;
  } = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      
      if (this.state === 'half-open') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
    console.log('Circuit breaker reset to closed state');
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      failureThreshold: this.failureThreshold,
    };
  }
}

// Global instances
let globalLoadBalancer: LoadBalancer | null = null;
let globalAutoScaler: AutoScaler | null = null;

export function getLoadBalancer(): LoadBalancer {
  if (!globalLoadBalancer) {
    const instances = process.env.LOAD_BALANCER_INSTANCES 
      ? JSON.parse(process.env.LOAD_BALANCER_INSTANCES)
      : [];
    
    globalLoadBalancer = new LoadBalancer(instances);
  }
  return globalLoadBalancer;
}

export function getAutoScaler(): AutoScaler {
  if (!globalAutoScaler) {
    globalAutoScaler = new AutoScaler();
  }
  return globalAutoScaler;
}