/**
 * Real-time Service Tests
 * Tests for Supabase real-time functionality
 */

import { RealtimeService } from '../realtime-service';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockResolvedValue({ status: 'SUBSCRIBED' }),
  unsubscribe: jest.fn().mockResolvedValue({ status: 'CLOSED' }),
  send: jest.fn()
};

const mockSupabase = {
  channel: jest.fn(() => mockChannel),
  removeChannel: jest.fn(),
  getChannels: jest.fn(() => [])
} as any;

describe('RealtimeService', () => {
  let realtimeService: RealtimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    realtimeService = new RealtimeService(mockSupabase);
  });

  describe('subscribeToProjectUpdates', () => {
    it('should subscribe to project updates successfully', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();

      const subscription = await realtimeService.subscribeToProjectUpdates(projectId, callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith(`project-${projectId}`);
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`
        },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(subscription.projectId).toBe(projectId);
      expect(subscription.status).toBe('subscribed');
    });

    it('should handle subscription errors', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();

      mockChannel.subscribe.mockResolvedValue({ status: 'CHANNEL_ERROR', error: 'Connection failed' });

      const subscription = await realtimeService.subscribeToProjectUpdates(projectId, callback);

      expect(subscription.status).toBe('error');
      expect(subscription.error).toBe('Connection failed');
    });

    it('should call callback when project updates', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();
      let changeHandler: Function;

      mockChannel.on.mockImplementation((event, config, handler) => {
        changeHandler = handler;
        return mockChannel;
      });

      await realtimeService.subscribeToProjectUpdates(projectId, callback);

      const mockUpdate = {
        new: { id: projectId, status: 'completed', updated_at: '2023-12-01T10:00:00Z' },
        old: { id: projectId, status: 'processing', updated_at: '2023-12-01T09:00:00Z' }
      };

      changeHandler!(mockUpdate);

      expect(callback).toHaveBeenCalledWith({
        type: 'project_update',
        projectId,
        data: mockUpdate.new,
        previousData: mockUpdate.old
      });
    });

    it('should prevent duplicate subscriptions', async () => {
      const projectId = 'project-123';
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await realtimeService.subscribeToProjectUpdates(projectId, callback1);
      const subscription2 = await realtimeService.subscribeToProjectUpdates(projectId, callback2);

      expect(subscription2.status).toBe('error');
      expect(subscription2.error).toBe('Already subscribed to this project');
      expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeToGenerationLogs', () => {
    it('should subscribe to generation logs', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();

      const subscription = await realtimeService.subscribeToGenerationLogs(projectId, callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith(`logs-${projectId}`);
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'generation_logs',
          filter: `project_id=eq.${projectId}`
        },
        expect.any(Function)
      );
      expect(subscription.status).toBe('subscribed');
    });

    it('should call callback when new logs arrive', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();
      let changeHandler: Function;

      mockChannel.on.mockImplementation((event, config, handler) => {
        changeHandler = handler;
        return mockChannel;
      });

      await realtimeService.subscribeToGenerationLogs(projectId, callback);

      const mockLog = {
        new: {
          id: 'log-123',
          project_id: projectId,
          message: 'Processing node: HttpRequest',
          log_level: 'info',
          timestamp: '2023-12-01T10:00:00Z'
        }
      };

      changeHandler!(mockLog);

      expect(callback).toHaveBeenCalledWith({
        type: 'log_entry',
        projectId,
        log: mockLog.new
      });
    });

    it('should filter logs by level when specified', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();

      await realtimeService.subscribeToGenerationLogs(projectId, callback, 'error');

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'generation_logs',
          filter: `project_id=eq.${projectId}.and.log_level=eq.error`
        },
        expect.any(Function)
      );
    });
  });

  describe('subscribeToUserNotifications', () => {
    it('should subscribe to user notifications', async () => {
      const userId = 'user-123';
      const callback = jest.fn();

      const subscription = await realtimeService.subscribeToUserNotifications(userId, callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith(`notifications-${userId}`);
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`
        },
        expect.any(Function)
      );
      expect(subscription.status).toBe('subscribed');
    });

    it('should handle notification updates', async () => {
      const userId = 'user-123';
      const callback = jest.fn();
      let changeHandler: Function;

      mockChannel.on.mockImplementation((event, config, handler) => {
        changeHandler = handler;
        return mockChannel;
      });

      await realtimeService.subscribeToUserNotifications(userId, callback);

      const mockNotification = {
        new: {
          id: 'notif-123',
          user_id: userId,
          title: 'Project Generated',
          message: 'Your workflow has been successfully converted',
          type: 'success',
          created_at: '2023-12-01T10:00:00Z'
        }
      };

      changeHandler!(mockNotification);

      expect(callback).toHaveBeenCalledWith({
        type: 'notification',
        userId,
        notification: mockNotification.new
      });
    });
  });

  describe('broadcastMessage', () => {
    it('should broadcast message to channel', async () => {
      const channelName = 'project-123';
      const message = { type: 'status_update', data: { progress: 50 } };

      const result = await realtimeService.broadcastMessage(channelName, message);

      expect(mockSupabase.channel).toHaveBeenCalledWith(channelName);
      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'message',
        payload: message
      });
      expect(result.success).toBe(true);
    });

    it('should handle broadcast errors', async () => {
      const channelName = 'project-123';
      const message = { type: 'test' };

      mockChannel.send.mockImplementation(() => {
        throw new Error('Broadcast failed');
      });

      const result = await realtimeService.broadcastMessage(channelName, message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Broadcast failed');
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from project updates', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();

      const subscription = await realtimeService.subscribeToProjectUpdates(projectId, callback);
      const result = await realtimeService.unsubscribe(subscription.id);

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
      expect(mockSupabase.removeChannel).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle unsubscribe errors', async () => {
      const subscriptionId = 'invalid-id';

      const result = await realtimeService.unsubscribe(subscriptionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
    });

    it('should clean up subscription tracking', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();

      const subscription = await realtimeService.subscribeToProjectUpdates(projectId, callback);
      await realtimeService.unsubscribe(subscription.id);

      // Should be able to subscribe again after unsubscribing
      const newSubscription = await realtimeService.subscribeToProjectUpdates(projectId, callback);
      expect(newSubscription.status).toBe('subscribed');
    });
  });

  describe('unsubscribeAll', () => {
    it('should unsubscribe from all active subscriptions', async () => {
      const callback = jest.fn();

      await realtimeService.subscribeToProjectUpdates('project-1', callback);
      await realtimeService.subscribeToProjectUpdates('project-2', callback);
      await realtimeService.subscribeToGenerationLogs('project-1', callback);

      const result = await realtimeService.unsubscribeAll();

      expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(3);
      expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(result.unsubscribedCount).toBe(3);
    });

    it('should handle no active subscriptions', async () => {
      const result = await realtimeService.unsubscribeAll();

      expect(result.success).toBe(true);
      expect(result.unsubscribedCount).toBe(0);
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connection status', () => {
      const status = realtimeService.getConnectionStatus();

      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('activeSubscriptions');
      expect(status).toHaveProperty('channels');
    });

    it('should track active subscriptions', async () => {
      const callback = jest.fn();

      await realtimeService.subscribeToProjectUpdates('project-1', callback);
      await realtimeService.subscribeToGenerationLogs('project-2', callback);

      const status = realtimeService.getConnectionStatus();

      expect(status.activeSubscriptions).toBe(2);
      expect(status.channels).toHaveLength(2);
    });
  });

  describe('reconnection handling', () => {
    it('should handle connection drops', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();
      let statusHandler: Function;

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (event === 'system') {
          statusHandler = handler;
        }
        return mockChannel;
      });

      await realtimeService.subscribeToProjectUpdates(projectId, callback);

      // Simulate connection drop
      statusHandler!({ status: 'CHANNEL_ERROR' });

      // Should attempt to reconnect
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(2);
    });

    it('should limit reconnection attempts', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();
      let statusHandler: Function;

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (event === 'system') {
          statusHandler = handler;
        }
        return mockChannel;
      });

      mockChannel.subscribe.mockResolvedValue({ status: 'CHANNEL_ERROR' });

      await realtimeService.subscribeToProjectUpdates(projectId, callback);

      // Simulate multiple connection failures
      for (let i = 0; i < 5; i++) {
        statusHandler!({ status: 'CHANNEL_ERROR' });
      }

      // Should stop attempting after max retries
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('message filtering and transformation', () => {
    it('should filter messages by type', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();

      await realtimeService.subscribeToProjectUpdates(projectId, callback, {
        filter: (data) => data.status === 'completed'
      });

      let changeHandler: Function;
      mockChannel.on.mockImplementation((event, config, handler) => {
        changeHandler = handler;
        return mockChannel;
      });

      // Should not call callback for non-matching updates
      changeHandler!({
        new: { id: projectId, status: 'processing' }
      });

      expect(callback).not.toHaveBeenCalled();

      // Should call callback for matching updates
      changeHandler!({
        new: { id: projectId, status: 'completed' }
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should transform messages before callback', async () => {
      const projectId = 'project-123';
      const callback = jest.fn();

      await realtimeService.subscribeToProjectUpdates(projectId, callback, {
        transform: (data) => ({
          ...data,
          transformedAt: new Date().toISOString()
        })
      });

      let changeHandler: Function;
      mockChannel.on.mockImplementation((event, config, handler) => {
        changeHandler = handler;
        return mockChannel;
      });

      changeHandler!({
        new: { id: projectId, status: 'completed' }
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          transformedAt: expect.any(String)
        })
      );
    });
  });
});