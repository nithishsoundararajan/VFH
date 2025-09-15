/**
 * Base Trigger System
 * Abstract base classes for all trigger types with common functionality
 */

import { ExecutionContext } from '../workflow-engine';
import { BaseTriggerNode, NodeParameters, NodeCredentials } from '../base-node';

export interface TriggerEvent {
  id: string;
  timestamp: string;
  type: string;
  data: any;
  source: string;
}

export interface TriggerConfig {
  enabled: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

export interface TriggerStatus {
  id: string;
  type: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  lastTriggered?: string;
  triggerCount: number;
  errorCount: number;
  lastError?: string;
  config: TriggerConfig;
}

export abstract class BaseTrigger extends BaseTriggerNode {
  protected triggerId: string;
  protected triggerConfig: TriggerConfig;
  protected triggerCount: number = 0;
  protected errorCount: number = 0;
  protected lastError?: string;
  protected lastTriggered?: string;
  protected status: TriggerStatus['status'] = 'stopped';
  protected callbacks: Set<(data: any) => void> = new Set();

  constructor(
    nodeType: string,
    displayName: string,
    description: string = '',
    parameters: NodeParameters = {},
    credentials: NodeCredentials = {},
    config: Partial<TriggerConfig> = {}
  ) {
    super(nodeType, displayName, description, parameters, credentials);
    this.triggerId = this.generateTriggerId();
    this.triggerConfig = {
      enabled: true,
      retryOnFailure: true,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...config
    };
  }

  private generateTriggerId(): string {
    return `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the trigger
   */
  async start(callback: (data: any) => void): Promise<void> {
    if (this.status === 'running') {
      this.log('warn', 'Trigger is already running');
      return;
    }

    this.status = 'starting';
    this.callbacks.add(callback);
    
    try {
      this.log('info', `Starting ${this.nodeType} trigger`);
      await this.startTrigger();
      this.status = 'running';
      this.log('info', 'Trigger started successfully');
    } catch (error) {
      this.status = 'error';
      this.lastError = error.message;
      this.errorCount++;
      this.log('error', `Failed to start trigger: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop the trigger
   */
  async stop(): Promise<void> {
    if (this.status === 'stopped') {
      this.log('warn', 'Trigger is already stopped');
      return;
    }

    this.status = 'stopping';
    
    try {
      this.log('info', `Stopping ${this.nodeType} trigger`);
      await this.stopTrigger();
      this.status = 'stopped';
      this.callbacks.clear();
      this.log('info', 'Trigger stopped successfully');
    } catch (error) {
      this.status = 'error';
      this.lastError = error.message;
      this.errorCount++;
      this.log('error', `Failed to stop trigger: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restart the trigger
   */
  async restart(): Promise<void> {
    this.log('info', 'Restarting trigger');
    await this.stop();
    await this.sleep(1000); // Brief pause before restart
    await this.start(Array.from(this.callbacks)[0]); // Restart with first callback
  }

  /**
   * Test the trigger configuration
   */
  async test(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      this.log('info', 'Testing trigger configuration');
      const result = await this.testTrigger();
      this.log('info', 'Trigger test completed successfully');
      return { success: true, message: 'Trigger test successful', data: result };
    } catch (error) {
      this.log('error', `Trigger test failed: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get trigger status
   */
  getStatus(): TriggerStatus {
    return {
      id: this.triggerId,
      type: this.nodeType,
      status: this.status,
      lastTriggered: this.lastTriggered,
      triggerCount: this.triggerCount,
      errorCount: this.errorCount,
      lastError: this.lastError,
      config: this.triggerConfig
    };
  }

  /**
   * Update trigger configuration
   */
  updateConfig(config: Partial<TriggerConfig>): void {
    this.triggerConfig = { ...this.triggerConfig, ...config };
    this.log('info', 'Trigger configuration updated');
  }

  /**
   * Fire the trigger (call all registered callbacks)
   */
  protected async fireTrigger(data: any): Promise<void> {
    if (!this.triggerConfig.enabled || this.status !== 'running') {
      return;
    }

    this.triggerCount++;
    this.lastTriggered = new Date().toISOString();

    this.log('info', `Trigger fired (count: ${this.triggerCount})`);

    // Call all registered callbacks
    const promises = Array.from(this.callbacks).map(async (callback) => {
      try {
        await this.executeWithTimeout(callback, data);
      } catch (error) {
        this.errorCount++;
        this.lastError = error.message;
        this.log('error', `Trigger callback failed: ${error.message}`);
        
        if (this.triggerConfig.retryOnFailure) {
          await this.retryCallback(callback, data);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Execute callback with timeout
   */
  private async executeWithTimeout(callback: (data: any) => void, data: any): Promise<void> {
    return Promise.race([
      Promise.resolve(callback(data)),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Callback timeout')), this.triggerConfig.timeout)
      )
    ]);
  }

  /**
   * Retry failed callback
   */
  private async retryCallback(callback: (data: any) => void, data: any): Promise<void> {
    for (let attempt = 1; attempt <= this.triggerConfig.maxRetries; attempt++) {
      try {
        this.log('debug', `Retrying callback (attempt ${attempt}/${this.triggerConfig.maxRetries})`);
        await this.sleep(this.triggerConfig.retryDelay * attempt);
        await this.executeWithTimeout(callback, data);
        this.log('debug', 'Callback retry successful');
        return;
      } catch (error) {
        if (attempt === this.triggerConfig.maxRetries) {
          this.log('error', `Callback failed after ${this.triggerConfig.maxRetries} retries`);
          throw error;
        }
      }
    }
  }

  /**
   * Generate trigger output data when triggered
   */
  protected generateTriggerOutput(context: ExecutionContext): any {
    return {
      triggerId: this.triggerId,
      triggerType: this.nodeType,
      timestamp: new Date().toISOString(),
      triggerCount: this.triggerCount,
      data: this.getTriggerData()
    };
  }

  /**
   * Get trigger-specific data (override in subclasses)
   */
  protected getTriggerData(): any {
    return {};
  }

  // Abstract methods to be implemented by specific trigger types
  protected abstract startTrigger(): Promise<void>;
  protected abstract stopTrigger(): Promise<void>;
  protected abstract testTrigger(): Promise<any>;
}

/**
 * Trigger Manager
 * Manages multiple triggers and their lifecycle
 */
export class TriggerManager {
  private triggers: Map<string, BaseTrigger> = new Map();
  private globalCallback?: (triggerId: string, data: any) => void;

  /**
   * Register a trigger
   */
  registerTrigger(trigger: BaseTrigger): void {
    const status = trigger.getStatus();
    this.triggers.set(status.id, trigger);
    console.log(`Registered trigger: ${status.id} (${status.type})`);
  }

  /**
   * Unregister a trigger
   */
  async unregisterTrigger(triggerId: string): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (trigger) {
      await trigger.stop();
      this.triggers.delete(triggerId);
      console.log(`Unregistered trigger: ${triggerId}`);
    }
  }

  /**
   * Start all triggers
   */
  async startAll(): Promise<void> {
    console.log(`Starting ${this.triggers.size} triggers`);
    
    const promises = Array.from(this.triggers.values()).map(async (trigger) => {
      try {
        await trigger.start((data) => {
          if (this.globalCallback) {
            this.globalCallback(trigger.getStatus().id, data);
          }
        });
      } catch (error) {
        console.error(`Failed to start trigger ${trigger.getStatus().id}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Stop all triggers
   */
  async stopAll(): Promise<void> {
    console.log(`Stopping ${this.triggers.size} triggers`);
    
    const promises = Array.from(this.triggers.values()).map(async (trigger) => {
      try {
        await trigger.stop();
      } catch (error) {
        console.error(`Failed to stop trigger ${trigger.getStatus().id}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Get status of all triggers
   */
  getAllStatus(): TriggerStatus[] {
    return Array.from(this.triggers.values()).map(trigger => trigger.getStatus());
  }

  /**
   * Get specific trigger
   */
  getTrigger(triggerId: string): BaseTrigger | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Set global callback for all triggers
   */
  setGlobalCallback(callback: (triggerId: string, data: any) => void): void {
    this.globalCallback = callback;
  }

  /**
   * Test all triggers
   */
  async testAll(): Promise<{ [triggerId: string]: { success: boolean; message: string } }> {
    const results: { [triggerId: string]: { success: boolean; message: string } } = {};
    
    const promises = Array.from(this.triggers.entries()).map(async ([id, trigger]) => {
      try {
        const result = await trigger.test();
        results[id] = result;
      } catch (error) {
        results[id] = { success: false, message: error.message };
      }
    });

    await Promise.allSettled(promises);
    return results;
  }
}