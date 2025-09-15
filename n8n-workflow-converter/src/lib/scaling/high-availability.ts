/**
 * High availability and disaster recovery utilities
 */

import { createClient } from '@supabase/supabase-js';

// Health check service for monitoring application health
export class HealthCheckService {
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private lastResults: Map<string, { healthy: boolean; timestamp: number; error?: string }> = new Map();
  private checkInterval?: NodeJS.Timeout;

  constructor() {
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    // Database connectivity check
    this.registerCheck('database', async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { error } = await supabase.from('projects').select('id').limit(1);
        return !error;
      } catch {
        return false;
      }
    });

    // Memory usage check
    this.registerCheck('memory', async () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memory = process.memoryUsage();
        const usage = memory.heapUsed / memory.heapTotal;
        return usage < 0.9; // Less than 90% memory usage
      }
      return true;
    });

    // Disk space check (Node.js only)
    this.registerCheck('disk', async () => {
      try {
        if (typeof process !== 'undefined') {
          const fs = await import('fs');
          fs.statSync('.'); // Check if we can access current directory
          // This is a simplified check - in production you'd check actual disk usage
          return true;
        }
        return true;
      } catch {
        return false;
      }
    });

    // External services check
    this.registerCheck('external-services', async () => {
      try {
        // Check if we can reach external APIs
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://httpbin.org/status/200', {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return response.ok;
      } catch {
        return false;
      }
    });
  }

  registerCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.checks.set(name, checkFn);
  }

  async runCheck(name: string): Promise<{ healthy: boolean; error?: string }> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return { healthy: false, error: `Check '${name}' not found` };
    }

    try {
      const healthy = await checkFn();
      const result = { healthy, timestamp: Date.now() };
      this.lastResults.set(name, result);
      return result;
    } catch (error) {
      const result = {
        healthy: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.lastResults.set(name, result);
      return result;
    }
  }

  async runAllChecks(): Promise<Record<string, { healthy: boolean; error?: string }>> {
    const results: Record<string, { healthy: boolean; error?: string }> = {};
    
    const promises = Array.from(this.checks.keys()).map(async (name) => {
      const result = await this.runCheck(name);
      results[name] = result;
    });

    await Promise.allSettled(promises);
    return results;
  }

  getOverallHealth(): { healthy: boolean; checks: Record<string, any> } {
    const checks: Record<string, any> = {};
    let overallHealthy = true;

    for (const [name, result] of this.lastResults) {
      checks[name] = result;
      if (!result.healthy) {
        overallHealthy = false;
      }
    }

    return { healthy: overallHealthy, checks };
  }

  startPeriodicChecks(intervalMs = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.runAllChecks();
    }, intervalMs);
  }

  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }
}

// Backup and recovery service
export class BackupService {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  // Create a backup of user data
  async createUserBackup(userId: string): Promise<{
    projects: any[];
    analytics: any[];
    settings: any[];
    timestamp: string;
  }> {
    try {
      // Backup projects
      const { data: projects, error: projectsError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId);

      if (projectsError) throw projectsError;

      // Backup analytics
      const { data: analytics, error: analyticsError } = await this.supabase
        .from('project_analytics')
        .select(`
          *,
          projects!inner(user_id)
        `)
        .eq('projects.user_id', userId);

      if (analyticsError) throw analyticsError;

      // Backup user settings (if table exists)
      const { data: settings } = await this.supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId);

      return {
        projects: projects || [],
        analytics: analytics || [],
        settings: settings || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  // Restore user data from backup
  async restoreUserBackup(userId: string, backup: {
    projects: any[];
    analytics: any[];
    settings: any[];
  }): Promise<void> {
    try {
      // Start transaction-like operations
      // Note: Supabase doesn't support transactions in the client library
      // In production, this should be done via a stored procedure

      // Clear existing data (be very careful with this!)
      await this.supabase
        .from('projects')
        .delete()
        .eq('user_id', userId);

      // Restore projects
      if (backup.projects.length > 0) {
        const { error: projectsError } = await this.supabase
          .from('projects')
          .insert(backup.projects as any[]);

        if (projectsError) throw projectsError;
      }

      // Restore analytics
      if (backup.analytics.length > 0) {
        const { error: analyticsError } = await this.supabase
          .from('project_analytics')
          .insert(backup.analytics as any[]);

        if (analyticsError) throw analyticsError;
      }

      // Restore settings
      if (backup.settings.length > 0) {
        const { error: settingsError } = await this.supabase
          .from('user_settings')
          .upsert(backup.settings as any[]);

        if (settingsError) throw settingsError;
      }

    } catch (error) {
      console.error('Backup restoration failed:', error);
      throw error;
    }
  }

  // Schedule automatic backups
  async scheduleBackup(userId: string, intervalHours = 24): Promise<void> {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    setInterval(async () => {
      try {
        const backup = await this.createUserBackup(userId);
        
        // Store backup (in production, this would go to external storage)
        const backupKey = `backup_${userId}_${Date.now()}`;
        
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(backupKey, JSON.stringify(backup));
          
          // Clean up old backups (keep only last 7)
          const allKeys = Object.keys(localStorage);
          const userBackups = allKeys
            .filter(key => key.startsWith(`backup_${userId}_`))
            .sort()
            .reverse();

          if (userBackups.length > 7) {
            userBackups.slice(7).forEach(key => {
              localStorage.removeItem(key);
            });
          }
        }

        console.log(`Backup created for user ${userId}`);
      } catch (error) {
        console.error('Scheduled backup failed:', error);
      }
    }, intervalMs);
  }
}

// Failover service for handling service failures
export class FailoverService {
  private primaryEndpoint: string;
  private fallbackEndpoints: string[];
  private currentEndpoint: string;
  private healthChecker: HealthCheckService;

  constructor(
    primaryEndpoint: string,
    fallbackEndpoints: string[] = []
  ) {
    this.primaryEndpoint = primaryEndpoint;
    this.fallbackEndpoints = fallbackEndpoints;
    this.currentEndpoint = primaryEndpoint;
    this.healthChecker = new HealthCheckService();
  }

  async checkEndpointHealth(endpoint: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${endpoint}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  async performFailover(): Promise<string | null> {
    // Check if primary is healthy
    const primaryHealthy = await this.checkEndpointHealth(this.primaryEndpoint);
    
    if (primaryHealthy && this.currentEndpoint !== this.primaryEndpoint) {
      // Failback to primary
      this.currentEndpoint = this.primaryEndpoint;
      console.log('Failed back to primary endpoint');
      return this.currentEndpoint;
    }

    if (!primaryHealthy && this.currentEndpoint === this.primaryEndpoint) {
      // Find healthy fallback
      for (const endpoint of this.fallbackEndpoints) {
        const healthy = await this.checkEndpointHealth(endpoint);
        if (healthy) {
          this.currentEndpoint = endpoint;
          console.log(`Failed over to endpoint: ${endpoint}`);
          return this.currentEndpoint;
        }
      }
      
      console.error('No healthy endpoints available');
      return null;
    }

    return this.currentEndpoint;
  }

  getCurrentEndpoint(): string {
    return this.currentEndpoint;
  }

  async makeRequest(path: string, options?: RequestInit): Promise<Response> {
    const maxRetries = this.fallbackEndpoints.length + 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const endpoint = await this.performFailover();
        if (!endpoint) {
          throw new Error('No healthy endpoints available');
        }

        const response = await fetch(`${endpoint}${path}`, options);
        
        if (response.ok) {
          return response;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries - 1) {
          // Try next endpoint
          continue;
        }
      }
    }

    throw lastError || new Error('All endpoints failed');
  }
}

// Disaster recovery coordinator
export class DisasterRecoveryService {
  private healthChecker: HealthCheckService;
  private backupService: BackupService;
  private failoverService: FailoverService;
  private recoveryPlan: Map<string, () => Promise<void>> = new Map();

  constructor(
    supabase: ReturnType<typeof createClient>,
    primaryEndpoint: string,
    fallbackEndpoints: string[] = []
  ) {
    this.healthChecker = new HealthCheckService();
    this.backupService = new BackupService(supabase);
    this.failoverService = new FailoverService(primaryEndpoint, fallbackEndpoints);
    
    this.setupRecoveryPlan();
  }

  private setupRecoveryPlan(): void {
    // Database recovery
    this.recoveryPlan.set('database', async () => {
      console.log('Executing database recovery...');
      // Implement database recovery logic
      // This might involve switching to a backup database
    });

    // Service recovery
    this.recoveryPlan.set('service', async () => {
      console.log('Executing service recovery...');
      await this.failoverService.performFailover();
    });

    // Data recovery
    this.recoveryPlan.set('data', async () => {
      console.log('Executing data recovery...');
      // Implement data recovery from backups
    });
  }

  async executeRecoveryPlan(scenario: string): Promise<void> {
    const recoveryAction = this.recoveryPlan.get(scenario);
    if (!recoveryAction) {
      throw new Error(`No recovery plan for scenario: ${scenario}`);
    }

    try {
      await recoveryAction();
      console.log(`Recovery plan '${scenario}' executed successfully`);
    } catch (error) {
      console.error(`Recovery plan '${scenario}' failed:`, error);
      throw error;
    }
  }

  async assessDisasterImpact(): Promise<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedServices: string[];
    recommendedActions: string[];
  }> {
    const health = this.healthChecker.getOverallHealth();
    const failedChecks = Object.entries(health.checks)
      .filter(([, result]) => !result.healthy)
      .map(([name]) => name);

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const recommendedActions: string[] = [];

    if (failedChecks.includes('database')) {
      severity = 'critical';
      recommendedActions.push('Execute database recovery plan');
    } else if (failedChecks.length >= 2) {
      severity = 'high';
      recommendedActions.push('Execute service failover');
    } else if (failedChecks.length === 1) {
      severity = 'medium';
      recommendedActions.push('Monitor and prepare for failover');
    }

    return {
      severity,
      affectedServices: failedChecks,
      recommendedActions,
    };
  }

  startDisasterMonitoring(): void {
    this.healthChecker.startPeriodicChecks(30000); // Check every 30 seconds

    // Monitor for disasters
    setInterval(async () => {
      const impact = await this.assessDisasterImpact();
      
      if (impact.severity === 'critical') {
        console.error('CRITICAL: Disaster detected, executing recovery plans');
        
        for (const action of impact.recommendedActions) {
          if (action.includes('database')) {
            await this.executeRecoveryPlan('database');
          } else if (action.includes('service')) {
            await this.executeRecoveryPlan('service');
          }
        }
      } else if (impact.severity === 'high') {
        console.warn('HIGH: Service degradation detected');
        await this.executeRecoveryPlan('service');
      }
    }, 60000); // Check every minute
  }

  stopDisasterMonitoring(): void {
    this.healthChecker.stopPeriodicChecks();
  }
}

// Global instances
let globalHealthChecker: HealthCheckService | null = null;
let globalDisasterRecovery: DisasterRecoveryService | null = null;

export function getHealthChecker(): HealthCheckService {
  if (!globalHealthChecker) {
    globalHealthChecker = new HealthCheckService();
  }
  return globalHealthChecker;
}

export function getDisasterRecoveryService(
  supabase?: ReturnType<typeof createClient>,
  primaryEndpoint?: string,
  fallbackEndpoints?: string[]
): DisasterRecoveryService | null {
  if (!globalDisasterRecovery && supabase && primaryEndpoint) {
    globalDisasterRecovery = new DisasterRecoveryService(
      supabase,
      primaryEndpoint,
      fallbackEndpoints
    );
  }
  return globalDisasterRecovery;
}