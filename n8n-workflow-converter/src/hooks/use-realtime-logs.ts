'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';
import { RealtimeChannel } from '@supabase/supabase-js';

type GenerationLog = Database['public']['Tables']['generation_logs']['Row'];

interface UseRealtimeLogsReturn {
  logs: GenerationLog[];
  filteredLogs: GenerationLog[];
  isConnected: boolean;
  connectionError: string | null;
  addLog: (log: Omit<GenerationLog, 'id' | 'timestamp'>) => Promise<void>;
  clearLogs: () => void;
  setLogFilter: (filter: LogFilter) => void;
  reconnect: () => void;
}

interface LogFilter {
  level?: GenerationLog['log_level'] | 'all';
  search?: string;
  startTime?: Date;
  endTime?: Date;
}

interface UseRealtimeLogsOptions {
  projectId: string;
  autoScroll?: boolean;
  maxLogs?: number;
  onNewLog?: (log: GenerationLog) => void;
  onError?: (error: string) => void;
}

export function useRealtimeLogs({
  projectId,
  autoScroll = true,
  maxLogs = 1000,
  onNewLog,
  onError
}: UseRealtimeLogsOptions): UseRealtimeLogsReturn {
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<GenerationLog[]>([]);
  const [logFilter, setLogFilterState] = useState<LogFilter>({ level: 'all' });
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000;

  // Fetch initial logs
  const fetchInitialLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('generation_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: true })
        .limit(maxLogs);

      if (error) {
        throw new Error(`Failed to fetch logs: ${error.message}`);
      }

      setLogs(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch logs';
      setConnectionError(errorMessage);
      onError?.(errorMessage);
    }
  }, [projectId, maxLogs, supabase, onError]);

  // Filter logs based on current filter
  const applyLogFilter = useCallback((logsToFilter: GenerationLog[]) => {
    let filtered = [...logsToFilter];

    // Filter by log level
    if (logFilter.level && logFilter.level !== 'all') {
      filtered = filtered.filter(log => log.log_level === logFilter.level);
    }

    // Filter by search term
    if (logFilter.search && logFilter.search.trim()) {
      const searchTerm = logFilter.search.toLowerCase().trim();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by time range
    if (logFilter.startTime) {
      filtered = filtered.filter(log => 
        new Date(log.timestamp) >= logFilter.startTime!
      );
    }

    if (logFilter.endTime) {
      filtered = filtered.filter(log => 
        new Date(log.timestamp) <= logFilter.endTime!
      );
    }

    return filtered;
  }, [logFilter]);

  // Update filtered logs when logs or filter changes
  useEffect(() => {
    setFilteredLogs(applyLogFilter(logs));
  }, [logs, applyLogFilter]);

  // Setup real-time subscription for logs
  const setupRealtimeSubscription = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    const channel = supabase.channel(`logs-${projectId}`, {
      config: {
        broadcast: { self: false }
      }
    });

    // Subscribe to new log insertions
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'generation_logs',
        filter: `project_id=eq.${projectId}`
      },
      (payload) => {
        console.log('New log received:', payload);
        const newLog = payload.new as GenerationLog;
        
        setLogs(prev => {
          const updated = [...prev, newLog];
          // Keep only the most recent logs if we exceed maxLogs
          if (updated.length > maxLogs) {
            return updated.slice(-maxLogs);
          }
          return updated;
        });

        onNewLog?.(newLog);

        // Auto-scroll if enabled
        if (autoScroll) {
          setTimeout(() => {
            const logContainer = document.getElementById('log-container');
            if (logContainer) {
              logContainer.scrollTop = logContainer.scrollHeight;
            }
          }, 100);
        }
      }
    );

    // Handle connection status
    channel.on('system', {}, (payload) => {
      console.log('Logs realtime system event:', payload);
      
      if (payload.extension === 'postgres_changes') {
        if (payload.status === 'ok') {
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
        } else if (payload.status === 'error') {
          setIsConnected(false);
          const errorMessage = `Logs connection error: ${payload.message || 'Unknown error'}`;
          setConnectionError(errorMessage);
          onError?.(errorMessage);
        }
      }
    });

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('Logs channel subscription status:', status, err);
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false);
        const errorMessage = err?.message || `Logs connection ${status.toLowerCase()}`;
        setConnectionError(errorMessage);
        onError?.(errorMessage);
        
        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect logs (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setupRealtimeSubscription();
          }, reconnectDelay * reconnectAttemptsRef.current);
        }
      } else if (status === 'CLOSED') {
        setIsConnected(false);
      }
    });

    channelRef.current = channel;
  }, [projectId, supabase, maxLogs, autoScroll, onNewLog, onError]);

  // Add a new log entry
  const addLog = useCallback(async (logData: Omit<GenerationLog, 'id' | 'timestamp'>) => {
    try {
      const { error } = await supabase
        .from('generation_logs')
        .insert({
          ...logData,
          project_id: projectId
        });

      if (error) {
        throw new Error(`Failed to add log: ${error.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add log';
      console.error('Error adding log:', errorMessage);
      onError?.(errorMessage);
    }
  }, [projectId, supabase, onError]);

  // Clear all logs for the project
  const clearLogs = useCallback(() => {
    setLogs([]);
    setFilteredLogs([]);
  }, []);

  // Set log filter
  const setLogFilter = useCallback((filter: LogFilter) => {
    setLogFilterState(filter);
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    setConnectionError(null);
    reconnectAttemptsRef.current = 0;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setupRealtimeSubscription();
  }, [setupRealtimeSubscription]);

  // Initialize
  useEffect(() => {
    fetchInitialLogs();
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchInitialLogs, setupRealtimeSubscription]);

  return {
    logs,
    filteredLogs,
    isConnected,
    connectionError,
    addLog,
    clearLogs,
    setLogFilter,
    reconnect
  };
}