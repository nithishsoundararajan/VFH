/**
 * Cron Trigger Implementation
 * Handles scheduled workflow execution using cron expressions
 */

import { BaseTrigger, TriggerConfig } from './base-trigger';
import { NodeParameters, NodeCredentials } from '../base-node';
import { ExecutionContext } from '../workflow-engine';

export interface CronTriggerParameters extends NodeParameters {
  rule: string; // Cron expression
  timezone?: string;
  description?: string;
}

export class CronTrigger extends BaseTrigger {
  private cronJob: any = null;
  private cronExpression: string;
  private timezone: string;
  private nextExecution?: Date;

  constructor(
    parameters: CronTriggerParameters,
    credentials: NodeCredentials = {},
    config: Partial<TriggerConfig> = {}
  ) {
    super(
      'CronTrigger',
      'Cron Trigger',
      'Execute workflow on a schedule using cron expressions',
      parameters,
      credentials,
      config
    );

    this.cronExpression = parameters.rule || '0 * * * *'; // Default: every hour
    this.timezone = parameters.timezone || 'UTC';
    
    this.validateCronExpression();
  }

  protected validateParameters(): void {
    if (!this.cronExpression) {
      throw new Error('Cron expression is required');
    }

    if (!this.isValidCronExpression(this.cronExpression)) {
      throw new Error(`Invalid cron expression: ${this.cronExpression}`);
    }
  }

  protected async startTrigger(): Promise<void> {
    this.validateParameters();

    // Dynamic import of node-cron to avoid bundling issues
    const cron = await this.importCron();
    
    this.log('info', `Starting cron trigger with expression: ${this.cronExpression}`);
    this.log('info', `Timezone: ${this.timezone}`);
    
    this.cronJob = cron.schedule(this.cronExpression, () => {
      this.handleCronExecution();
    }, {
      scheduled: false,
      timezone: this.timezone
    });

    this.cronJob.start();
    this.calculateNextExecution();
    
    this.log('info', `Next execution: ${this.nextExecution?.toISOString()}`);
  }

  protected async stopTrigger(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob.destroy();
      this.cronJob = null;
      this.nextExecution = undefined;
      this.log('info', 'Cron job stopped and destroyed');
    }
  }

  protected async testTrigger(): Promise<any> {
    this.validateParameters();
    
    // Test by parsing the cron expression and calculating next execution
    this.calculateNextExecution();
    
    return {
      cronExpression: this.cronExpression,
      timezone: this.timezone,
      nextExecution: this.nextExecution?.toISOString(),
      isValid: this.isValidCronExpression(this.cronExpression),
      description: this.describeCronExpression(this.cronExpression)
    };
  }

  protected getTriggerData(): any {
    return {
      cronExpression: this.cronExpression,
      timezone: this.timezone,
      nextExecution: this.nextExecution?.toISOString(),
      description: this.describeCronExpression(this.cronExpression)
    };
  }

  private async handleCronExecution(): Promise<void> {
    try {
      this.log('info', 'Cron trigger fired');
      
      const triggerData = {
        ...this.generateTriggerOutput({} as ExecutionContext),
        cronExpression: this.cronExpression,
        timezone: this.timezone,
        scheduledTime: new Date().toISOString()
      };

      await this.fireTrigger(triggerData);
      this.calculateNextExecution();
      
    } catch (error) {
      this.log('error', `Cron execution failed: ${error.message}`);
    }
  }

  private async importCron(): Promise<any> {
    try {
      // Try to import node-cron
      return await import('node-cron');
    } catch (error) {
      // Fallback implementation using setTimeout for basic cron functionality
      this.log('warn', 'node-cron not available, using fallback implementation');
      return this.createFallbackCron();
    }
  }

  private createFallbackCron(): any {
    return {
      schedule: (expression: string, callback: () => void, options: any = {}) => {
        const interval = this.parseCronToInterval(expression);
        let timeoutId: NodeJS.Timeout;
        
        const job = {
          start: () => {
            const executeCallback = () => {
              callback();
              timeoutId = setTimeout(executeCallback, interval);
            };
            timeoutId = setTimeout(executeCallback, interval);
          },
          stop: () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          },
          destroy: () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        };

        return job;
      }
    };
  }

  private parseCronToInterval(expression: string): number {
    // Simple fallback: parse basic cron expressions to intervals
    const parts = expression.split(' ');
    
    if (parts.length !== 5) {
      return 60000; // Default to 1 minute
    }

    const [minute, hour, day, month, weekday] = parts;

    // Handle simple cases
    if (minute === '*' && hour === '*') {
      return 60000; // Every minute
    }
    
    if (minute !== '*' && hour === '*') {
      return 3600000; // Every hour
    }
    
    if (minute !== '*' && hour !== '*') {
      return 86400000; // Every day
    }

    return 3600000; // Default to 1 hour
  }

  private calculateNextExecution(): void {
    try {
      // Simple calculation for next execution (would be more accurate with a proper cron library)
      const now = new Date();
      const parts = this.cronExpression.split(' ');
      
      if (parts.length === 5) {
        const [minute, hour, day, month, weekday] = parts;
        
        // Simple case: every hour at minute X
        if (minute !== '*' && hour === '*') {
          const targetMinute = parseInt(minute);
          const next = new Date(now);
          next.setMinutes(targetMinute);
          next.setSeconds(0);
          next.setMilliseconds(0);
          
          if (next <= now) {
            next.setHours(next.getHours() + 1);
          }
          
          this.nextExecution = next;
          return;
        }
        
        // Simple case: daily at hour:minute
        if (minute !== '*' && hour !== '*') {
          const targetHour = parseInt(hour);
          const targetMinute = parseInt(minute);
          const next = new Date(now);
          next.setHours(targetHour);
          next.setMinutes(targetMinute);
          next.setSeconds(0);
          next.setMilliseconds(0);
          
          if (next <= now) {
            next.setDate(next.getDate() + 1);
          }
          
          this.nextExecution = next;
          return;
        }
      }
      
      // Fallback: next hour
      const next = new Date(now);
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      this.nextExecution = next;
      
    } catch (error) {
      this.log('warn', `Could not calculate next execution: ${error.message}`);
    }
  }

  private isValidCronExpression(expression: string): boolean {
    // Basic validation for cron expression format
    const parts = expression.split(' ');
    
    if (parts.length !== 5) {
      return false;
    }

    const [minute, hour, day, month, weekday] = parts;

    // Validate each part
    if (!this.isValidCronField(minute, 0, 59)) return false;
    if (!this.isValidCronField(hour, 0, 23)) return false;
    if (!this.isValidCronField(day, 1, 31)) return false;
    if (!this.isValidCronField(month, 1, 12)) return false;
    if (!this.isValidCronField(weekday, 0, 7)) return false;

    return true;
  }

  private isValidCronField(field: string, min: number, max: number): boolean {
    if (field === '*') return true;
    
    // Handle ranges (e.g., "1-5")
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return start >= min && end <= max && start <= end;
    }
    
    // Handle lists (e.g., "1,3,5")
    if (field.includes(',')) {
      const values = field.split(',').map(Number);
      return values.every(val => val >= min && val <= max);
    }
    
    // Handle step values (e.g., "*/5")
    if (field.includes('/')) {
      const [base, step] = field.split('/');
      if (base === '*') return true;
      const baseNum = Number(base);
      const stepNum = Number(step);
      return baseNum >= min && baseNum <= max && stepNum > 0;
    }
    
    // Handle single number
    const num = Number(field);
    return !isNaN(num) && num >= min && num <= max;
  }

  private describeCronExpression(expression: string): string {
    const parts = expression.split(' ');
    
    if (parts.length !== 5) {
      return 'Invalid cron expression';
    }

    const [minute, hour, day, month, weekday] = parts;

    // Common patterns
    if (expression === '0 * * * *') return 'Every hour';
    if (expression === '*/5 * * * *') return 'Every 5 minutes';
    if (expression === '0 0 * * *') return 'Daily at midnight';
    if (expression === '0 9 * * 1-5') return 'Weekdays at 9:00 AM';
    if (expression === '0 0 * * 0') return 'Weekly on Sunday at midnight';
    if (expression === '0 0 1 * *') return 'Monthly on the 1st at midnight';

    // Build description
    let description = 'At ';
    
    if (minute === '*') {
      description += 'every minute';
    } else {
      description += `minute ${minute}`;
    }
    
    if (hour !== '*') {
      description += ` of hour ${hour}`;
    }
    
    if (day !== '*') {
      description += ` on day ${day}`;
    }
    
    if (month !== '*') {
      description += ` of month ${month}`;
    }
    
    if (weekday !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (weekday.includes(',')) {
        const dayNumbers = weekday.split(',').map(Number);
        const dayNames = dayNumbers.map(num => days[num]).join(', ');
        description += ` on ${dayNames}`;
      } else {
        description += ` on ${days[Number(weekday)]}`;
      }
    }

    return description;
  }

  /**
   * Get the next few execution times
   */
  getNextExecutions(count: number = 5): Date[] {
    const executions: Date[] = [];
    let current = new Date();

    for (let i = 0; i < count; i++) {
      // This is a simplified calculation
      // In a real implementation, you'd use a proper cron library
      current = new Date(current.getTime() + 3600000); // Add 1 hour
      executions.push(new Date(current));
    }

    return executions;
  }

  /**
   * Update cron expression
   */
  updateCronExpression(expression: string): void {
    if (!this.isValidCronExpression(expression)) {
      throw new Error(`Invalid cron expression: ${expression}`);
    }

    const wasRunning = this.status === 'running';
    
    if (wasRunning) {
      this.stopTrigger();
    }

    this.cronExpression = expression;
    this.parameters.rule = expression;

    if (wasRunning) {
      this.startTrigger();
    }

    this.log('info', `Cron expression updated to: ${expression}`);
  }
}