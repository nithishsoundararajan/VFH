/**
 * Real-time Service
 * Handles Supabase real-time subscriptions and messaging
 */

import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeSubscription {
  id: string;
  projectId?: string;
  userId?: string;
  channelName: string;
  status: 'subscribed' | 'error' | 'closed';
  error?: string;
  createdAt: Date;
}

export interface ProjectUpdateEvent {
  type: 'project_update';
  projectId: string;
  data: any;
  previousData?: any;
}

export interface LogEvent {
  type: 'log_entry';
  projectId: string;
  log: {
    id: string;
    project_id: string;
    message: string;
    log_level: string;
    timestamp: string;
  };
}

export interface NotificationEvent {
  type: 'notification';
  userId: string;
  notification: {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    created_at: string;
  };
}

export type RealtimeEvent = ProjectUpdateEvent | LogEvent | NotificationEvent;

export interface SubscriptionOptions {
  filter?: (data: any) => boolean;
  transform?: (data: any) => any;
}

export interface BroadcastResult {
  success: boolean;
  error?: string;
}

export interface UnsubscribeResult {
  success: boolean;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  activeSubscriptions: number;
  channels: string[];
  lastActivity?: Date;
}

export class RealtimeService {
  private subscriptions = new Map<string, RealtimeSubscription>();
  private channels = new Map<string, RealtimeChannel>();
  private reconnectAttempts = new Map<string, number>();
  private readonly maxReconnectAttempts = 3;

  constructor(private supabase: SupabaseClient) {}

  async subscribeToProjectUpdates(
    projectId: string,
    callback: (event: ProjectUpdateEvent) => void,
    options?: SubscriptionOptions
  ): Promise<RealtimeSubscription> {
    const subscriptionId = `project-${projectId}`;
    
    // Check for existing subscription
    if (this.subscriptions.has(subscriptionId)) {
      return {
        id: subscriptionId,
        projectId,
        channelName: subscriptionId,
        status: 'error',
        error: 'Already subscribed to this project',
        createdAt: new Date()
      };
    }

    try {
      const channel = this.supabase.channel(subscriptionId);

      channel
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'projects',
            filter: `id=eq.${projectId}`
          },
          (payload) => {
            const event: ProjectUpdateEvent = {
              type: 'project_update',
              projectId,
              data: payload.new,
              previousData: payload.old
            };

            // Apply filter if provided
            if (options?.filter && !options.filter(event.data)) {
              return;
            }

            // Apply transformation if provided
            const finalEvent = options?.transform ? options.transform(event) : event;

            callback(finalEvent);
          }
        )
        .on('system', (status) => {
          if (status.status === 'CHANNEL_ERROR') {
            this.handleReconnection(subscriptionId, () =>
              this.subscribeToProjectUpdates(projectId, callback, options)
            );
          }
        });

      const subscribeResult = await channel.subscribe();

      const subscription: RealtimeSubscription = {
        id: subscriptionId,
        projectId,
        channelName: subscriptionId,
        status: subscribeResult.status === 'SUBSCRIBED' ? 'subscribed' : 'error',
        error: subscribeResult.status !== 'SUBSCRIBED' ? subscribeResult.error : undefined,
        createdAt: new Date()
      };

      if (subscription.status === 'subscribed') {
        this.subscriptions.set(subscriptionId, subscription);
        this.channels.set(subscriptionId, channel);
      }

      return subscription;
    } catch (error) {
      return {
        id: subscriptionId,
        projectId,
        channelName: subscriptionId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date()
      };
    }
  }

  async subscribeToGenerationLogs(
    projectId: string,
    callback: (event: LogEvent) => void,
    logLevel?: 'info' | 'warning' | 'error'
  ): Promise<RealtimeSubscription> {
    const subscriptionId = `logs-${projectId}`;

    try {
      const channel = this.supabase.channel(subscriptionId);

      let filter = `project_id=eq.${projectId}`;
      if (logLevel) {
        filter += `.and.log_level=eq.${logLevel}`;
      }

      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'generation_logs',
            filter
          },
          (payload) => {
            const event: LogEvent = {
              type: 'log_entry',
              projectId,
              log: payload.new as LogEvent['log']
            };

            callback(event);
          }
        )
        .on('system', (status) => {
          if (status.status === 'CHANNEL_ERROR') {
            this.handleReconnection(subscriptionId, () =>
              this.subscribeToGenerationLogs(projectId, callback, logLevel)
            );
          }
        });

      const subscribeResult = await channel.subscribe();

      const subscription: RealtimeSubscription = {
        id: subscriptionId,
        projectId,
        channelName: subscriptionId,
        status: subscribeResult.status === 'SUBSCRIBED' ? 'subscribed' : 'error',
        error: subscribeResult.status !== 'SUBSCRIBED' ? subscribeResult.error : undefined,
        createdAt: new Date()
      };

      if (subscription.status === 'subscribed') {
        this.subscriptions.set(subscriptionId, subscription);
        this.channels.set(subscriptionId, channel);
      }

      return subscription;
    } catch (error) {
      return {
        id: subscriptionId,
        projectId,
        channelName: subscriptionId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date()
      };
    }
  }

  async subscribeToUserNotifications(
    userId: string,
    callback: (event: NotificationEvent) => void
  ): Promise<RealtimeSubscription> {
    const subscriptionId = `notifications-${userId}`;

    try {
      const channel = this.supabase.channel(subscriptionId);

      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            const event: NotificationEvent = {
              type: 'notification',
              userId,
              notification: payload.new as NotificationEvent['notification']
            };

            callback(event);
          }
        )
        .on('system', (status) => {
          if (status.status === 'CHANNEL_ERROR') {
            this.handleReconnection(subscriptionId, () =>
              this.subscribeToUserNotifications(userId, callback)
            );
          }
        });

      const subscribeResult = await channel.subscribe();

      const subscription: RealtimeSubscription = {
        id: subscriptionId,
        userId,
        channelName: subscriptionId,
        status: subscribeResult.status === 'SUBSCRIBED' ? 'subscribed' : 'error',
        error: subscribeResult.status !== 'SUBSCRIBED' ? subscribeResult.error : undefined,
        createdAt: new Date()
      };

      if (subscription.status === 'subscribed') {
        this.subscriptions.set(subscriptionId, subscription);
        this.channels.set(subscriptionId, channel);
      }

      return subscription;
    } catch (error) {
      return {
        id: subscriptionId,
        userId,
        channelName: subscriptionId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date()
      };
    }
  }

  async broadcastMessage(channelName: string, message: any): Promise<BroadcastResult> {
    try {
      const channel = this.supabase.channel(channelName);
      
      channel.send({
        type: 'broadcast',
        event: 'message',
        payload: message
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async unsubscribe(subscriptionId: string): Promise<UnsubscribeResult> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        return {
          success: false,
          error: 'Subscription not found'
        };
      }

      const channel = this.channels.get(subscriptionId);
      if (channel) {
        await channel.unsubscribe();
        this.supabase.removeChannel(channel);
      }

      this.subscriptions.delete(subscriptionId);
      this.channels.delete(subscriptionId);
      this.reconnectAttempts.delete(subscriptionId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async unsubscribeAll(): Promise<{ success: boolean; unsubscribedCount: number; error?: string }> {
    try {
      const subscriptionIds = Array.from(this.subscriptions.keys());
      let unsubscribedCount = 0;

      for (const subscriptionId of subscriptionIds) {
        const result = await this.unsubscribe(subscriptionId);
        if (result.success) {
          unsubscribedCount++;
        }
      }

      return {
        success: true,
        unsubscribedCount
      };
    } catch (error) {
      return {
        success: false,
        unsubscribedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  getConnectionStatus(): ConnectionStatus {
    const channels = this.supabase.getChannels();
    
    return {
      connected: channels.length > 0,
      activeSubscriptions: this.subscriptions.size,
      channels: Array.from(this.channels.keys()),
      lastActivity: new Date()
    };
  }

  private async handleReconnection(subscriptionId: string, reconnectFn: () => Promise<RealtimeSubscription>) {
    const attempts = this.reconnectAttempts.get(subscriptionId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.warn(`Max reconnection attempts reached for subscription: ${subscriptionId}`);
      return;
    }

    this.reconnectAttempts.set(subscriptionId, attempts + 1);

    // Exponential backoff
    const delay = Math.pow(2, attempts) * 1000;
    
    setTimeout(async () => {
      try {
        // Clean up existing subscription
        await this.unsubscribe(subscriptionId);
        
        // Attempt to reconnect
        const newSubscription = await reconnectFn();
        
        if (newSubscription.status === 'subscribed') {
          this.reconnectAttempts.delete(subscriptionId);
          console.log(`Successfully reconnected subscription: ${subscriptionId}`);
        }
      } catch (error) {
        console.error(`Reconnection failed for subscription: ${subscriptionId}`, error);
      }
    }, delay);
  }

  // Utility methods
  getActiveSubscriptions(): RealtimeSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  getSubscription(subscriptionId: string): RealtimeSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  isSubscribed(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    return subscription?.status === 'subscribed';
  }

  // Health check methods
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    try {
      const startTime = Date.now();
      const testChannel = this.supabase.channel('connection-test');
      
      const result = await testChannel.subscribe();
      const latency = Date.now() - startTime;
      
      await testChannel.unsubscribe();
      this.supabase.removeChannel(testChannel);

      return {
        success: result.status === 'SUBSCRIBED',
        latency,
        error: result.status !== 'SUBSCRIBED' ? result.error : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Cleanup method for component unmounting
  async cleanup(): Promise<void> {
    await this.unsubscribeAll();
    this.subscriptions.clear();
    this.channels.clear();
    this.reconnectAttempts.clear();
  }
}