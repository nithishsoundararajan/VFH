/**
 * Connection pooling and resource management for scaling
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  reapIntervalMs: number;
}

interface PooledConnection {
  client: SupabaseClient;
  createdAt: number;
  lastUsed: number;
  inUse: boolean;
  id: string;
}

export class SupabaseConnectionPool {
  private connections: Map<string, PooledConnection> = new Map();
  private waitingQueue: Array<{
    resolve: (client: SupabaseClient) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  
  private config: PoolConfig;
  private reapTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = {
      maxConnections: config.maxConnections || 20,
      minConnections: config.minConnections || 2,
      acquireTimeoutMs: config.acquireTimeoutMs || 30000,
      idleTimeoutMs: config.idleTimeoutMs || 300000, // 5 minutes
      reapIntervalMs: config.reapIntervalMs || 60000, // 1 minute
      ...config,
    };

    this.startReaper();
    this.initializeMinConnections();
  }

  private async createConnection(): Promise<PooledConnection> {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: {
          schema: 'public',
        },
        auth: {
          autoRefreshToken: true,
          persistSession: false, // Don't persist in pool connections
        },
        realtime: {
          params: {
            eventsPerSecond: 5, // Lower for pool connections
          },
        },
      }
    );

    const connection: PooledConnection = {
      client,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      inUse: false,
      id: Math.random().toString(36).substring(7),
    };

    return connection;
  }

  private async initializeMinConnections(): Promise<void> {
    const promises = Array.from({ length: this.config.minConnections }, () =>
      this.createConnection()
    );

    try {
      const connections = await Promise.all(promises);
      connections.forEach(conn => {
        this.connections.set(conn.id, conn);
      });
    } catch (error) {
      console.error('Failed to initialize minimum connections:', error);
    }
  }

  private startReaper(): void {
    this.reapTimer = setInterval(() => {
      this.reapIdleConnections();
    }, this.config.reapIntervalMs);
  }

  private reapIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, conn] of this.connections) {
      const idleTime = now - conn.lastUsed;
      const shouldReap = 
        !conn.inUse && 
        idleTime > this.config.idleTimeoutMs &&
        this.connections.size > this.config.minConnections;

      if (shouldReap) {
        connectionsToRemove.push(id);
      }
    }

    connectionsToRemove.forEach(id => {
      const conn = this.connections.get(id);
      if (conn) {
        // Clean up the connection
        this.connections.delete(id);
      }
    });

    // Process waiting queue if we have available connections
    this.processWaitingQueue();
  }

  private processWaitingQueue(): void {
    while (this.waitingQueue.length > 0) {
      const availableConn = this.findAvailableConnection();
      if (!availableConn) break;

      const waiter = this.waitingQueue.shift();
      if (waiter) {
        const now = Date.now();
        if (now - waiter.timestamp > this.config.acquireTimeoutMs) {
          waiter.reject(new Error('Connection acquire timeout'));
          continue;
        }

        availableConn.inUse = true;
        availableConn.lastUsed = now;
        waiter.resolve(availableConn.client);
      }
    }
  }

  private findAvailableConnection(): PooledConnection | null {
    for (const conn of this.connections.values()) {
      if (!conn.inUse) {
        return conn;
      }
    }
    return null;
  }

  async acquire(): Promise<SupabaseClient> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    // Try to find an available connection
    const availableConn = this.findAvailableConnection();
    if (availableConn) {
      availableConn.inUse = true;
      availableConn.lastUsed = Date.now();
      return availableConn.client;
    }

    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      try {
        const newConn = await this.createConnection();
        newConn.inUse = true;
        this.connections.set(newConn.id, newConn);
        return newConn.client;
      } catch (error) {
        console.error('Failed to create new connection:', error);
      }
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeoutMs);

      this.waitingQueue.push({
        resolve: (client) => {
          clearTimeout(timeout);
          resolve(client);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  release(client: SupabaseClient): void {
    for (const conn of this.connections.values()) {
      if (conn.client === client) {
        conn.inUse = false;
        conn.lastUsed = Date.now();
        break;
      }
    }

    // Process waiting queue
    this.processWaitingQueue();
  }

  async destroy(): Promise<void> {
    this.isShuttingDown = true;

    // Clear reaper timer
    if (this.reapTimer) {
      clearInterval(this.reapTimer);
    }

    // Reject all waiting requests
    this.waitingQueue.forEach(waiter => {
      waiter.reject(new Error('Connection pool destroyed'));
    });
    this.waitingQueue.length = 0;

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(async (conn) => {
      try {
        // Supabase client doesn't have explicit close method
        // but we can clear any pending operations
        return Promise.resolve();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    });

    await Promise.allSettled(closePromises);
    this.connections.clear();
  }

  getStats() {
    const totalConnections = this.connections.size;
    const inUseConnections = Array.from(this.connections.values()).filter(c => c.inUse).length;
    const availableConnections = totalConnections - inUseConnections;
    const waitingRequests = this.waitingQueue.length;

    return {
      totalConnections,
      inUseConnections,
      availableConnections,
      waitingRequests,
      maxConnections: this.config.maxConnections,
      minConnections: this.config.minConnections,
    };
  }
}

// Singleton pool instance
let globalPool: SupabaseConnectionPool | null = null;

export function getConnectionPool(): SupabaseConnectionPool {
  if (!globalPool) {
    globalPool = new SupabaseConnectionPool({
      maxConnections: parseInt(process.env.SUPABASE_MAX_CONNECTIONS || '20'),
      minConnections: parseInt(process.env.SUPABASE_MIN_CONNECTIONS || '2'),
    });
  }
  return globalPool;
}

// Utility function for using pooled connections
export async function withPooledConnection<T>(
  fn: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const pool = getConnectionPool();
  const client = await pool.acquire();
  
  try {
    return await fn(client);
  } finally {
    pool.release(client);
  }
}

// Resource monitoring
export class ResourceMonitor {
  private static instance: ResourceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private intervalId?: NodeJS.Timeout;

  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, 30000); // Collect every 30 seconds
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private collectMetrics(): void {
    const now = Date.now();

    // Memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      this.addMetric('memory.rss', memory.rss);
      this.addMetric('memory.heapUsed', memory.heapUsed);
      this.addMetric('memory.heapTotal', memory.heapTotal);
    }

    // Connection pool stats
    const pool = getConnectionPool();
    const stats = pool.getStats();
    this.addMetric('pool.totalConnections', stats.totalConnections);
    this.addMetric('pool.inUseConnections', stats.inUseConnections);
    this.addMetric('pool.waitingRequests', stats.waitingRequests);

    // Event loop lag (Node.js only)
    if (typeof process !== 'undefined') {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms
        this.addMetric('eventLoop.lag', lag);
      });
    }
  }

  private addMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }

  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [name, values] of this.metrics) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      result[name] = {
        current: values[values.length - 1],
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        count: values.length,
      };
    }

    return result;
  }

  getAlerts(): string[] {
    const alerts: string[] = [];
    const metrics = this.getMetrics();

    // Memory alerts
    if (metrics['memory.heapUsed'] && metrics['memory.heapTotal']) {
      const usage = metrics['memory.heapUsed'].current / metrics['memory.heapTotal'].current;
      if (usage > 0.9) {
        alerts.push(`High memory usage: ${(usage * 100).toFixed(1)}%`);
      }
    }

    // Connection pool alerts
    if (metrics['pool.waitingRequests'] && metrics['pool.waitingRequests'].current > 0) {
      alerts.push(`${metrics['pool.waitingRequests'].current} requests waiting for connections`);
    }

    // Event loop lag alerts
    if (metrics['eventLoop.lag'] && metrics['eventLoop.lag'].current > 100) {
      alerts.push(`High event loop lag: ${metrics['eventLoop.lag'].current.toFixed(1)}ms`);
    }

    return alerts;
  }
}