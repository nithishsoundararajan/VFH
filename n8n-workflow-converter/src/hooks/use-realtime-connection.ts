'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeConnectionReturn {
  isConnected: boolean;
  connectionError: string | null;
  reconnect: () => void;
  disconnect: () => void;
  getConnectionStatus: () => 'connected' | 'disconnected' | 'connecting' | 'error';
}

interface UseRealtimeConnectionOptions {
  channelName: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export function useRealtimeConnection({
  channelName,
  onConnect,
  onDisconnect,
  onError,
  autoReconnect = true,
  maxReconnectAttempts = 5,
  reconnectDelay = 2000
}: UseRealtimeConnectionOptions): UseRealtimeConnectionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');
  
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManuallyDisconnectedRef = useRef(false);

  // Setup connection
  const connect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    setConnectionStatus('connecting');
    setConnectionError(null);
    isManuallyDisconnectedRef.current = false;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: channelName }
      }
    });

    // Handle connection status changes
    channel.on('system', {}, (payload) => {
      console.log(`Realtime system event for ${channelName}:`, payload);
      
      if (payload.extension === 'postgres_changes') {
        if (payload.status === 'ok') {
          setIsConnected(true);
          setConnectionStatus('connected');
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
          onConnect?.();
        } else if (payload.status === 'error') {
          setIsConnected(false);
          setConnectionStatus('error');
          const errorMessage = `Connection error: ${payload.message || 'Unknown error'}`;
          setConnectionError(errorMessage);
          onError?.(errorMessage);
          
          // Attempt to reconnect if not manually disconnected
          if (autoReconnect && !isManuallyDisconnectedRef.current) {
            scheduleReconnect();
          }
        }
      }
    });

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log(`Channel subscription status for ${channelName}:`, status, err);
      
      switch (status) {
        case 'SUBSCRIBED':
          setIsConnected(true);
          setConnectionStatus('connected');
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
          onConnect?.();
          break;
          
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          setIsConnected(false);
          setConnectionStatus('error');
          const errorMessage = err?.message || `Connection ${status.toLowerCase()}`;
          setConnectionError(errorMessage);
          onError?.(errorMessage);
          
          // Attempt to reconnect if not manually disconnected
          if (autoReconnect && !isManuallyDisconnectedRef.current) {
            scheduleReconnect();
          }
          break;
          
        case 'CLOSED':
          setIsConnected(false);
          setConnectionStatus('disconnected');
          onDisconnect?.();
          break;
          
        default:
          setConnectionStatus('connecting');
          break;
      }
    });

    channelRef.current = channel;
  }, [channelName, supabase, autoReconnect, onConnect, onDisconnect, onError]);

  // Schedule reconnection attempt
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log(`Max reconnection attempts (${maxReconnectAttempts}) reached for ${channelName}`);
      setConnectionStatus('error');
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = reconnectDelay * reconnectAttemptsRef.current;
    
    console.log(`Scheduling reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} for ${channelName} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isManuallyDisconnectedRef.current) {
        connect();
      }
    }, delay);
  }, [channelName, maxReconnectAttempts, reconnectDelay, connect]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    setConnectionError(null);
    reconnectAttemptsRef.current = 0;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    connect();
  }, [connect]);

  // Manual disconnect function
  const disconnect = useCallback(() => {
    isManuallyDisconnectedRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setConnectionError(null);
    onDisconnect?.();
  }, [onDisconnect]);

  // Get current connection status
  const getConnectionStatus = useCallback(() => {
    return connectionStatus;
  }, [connectionStatus]);

  // Initialize connection
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle page visibility changes to manage connections
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, we might want to pause reconnection attempts
        console.log(`Page hidden, pausing reconnection for ${channelName}`);
      } else {
        // Page is visible again, resume connection if needed
        console.log(`Page visible, checking connection for ${channelName}`);
        if (!isConnected && !isManuallyDisconnectedRef.current) {
          reconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [channelName, isConnected, reconnect]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log(`Network online, reconnecting ${channelName}`);
      if (!isConnected && !isManuallyDisconnectedRef.current) {
        reconnect();
      }
    };

    const handleOffline = () => {
      console.log(`Network offline for ${channelName}`);
      setConnectionStatus('error');
      setConnectionError('Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [channelName, isConnected, reconnect]);

  return {
    isConnected,
    connectionError,
    reconnect,
    disconnect,
    getConnectionStatus
  };
}