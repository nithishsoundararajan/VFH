'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';
import { RealtimeChannel } from '@supabase/supabase-js';

type Project = Database['public']['Tables']['projects']['Row'];
type GenerationLog = Database['public']['Tables']['generation_logs']['Row'];

interface UseRealtimeProjectReturn {
  project: Project | null;
  logs: GenerationLog[];
  isConnected: boolean;
  connectionError: string | null;
  reconnect: () => void;
}

interface UseRealtimeProjectOptions {
  projectId: string;
  onStatusChange?: (status: Project['status']) => void;
  onNewLog?: (log: GenerationLog) => void;
  onError?: (error: string) => void;
}

export function useRealtimeProject({
  projectId,
  onStatusChange,
  onNewLog,
  onError
}: UseRealtimeProjectOptions): UseRealtimeProjectReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // 2 seconds

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw new Error(`Failed to fetch project: ${projectError.message}`);
      }

      setProject(projectData);

      // Fetch logs
      const { data: logsData, error: logsError } = await supabase
        .from('generation_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: true });

      if (logsError) {
        console.warn('Failed to fetch logs:', logsError.message);
        setLogs([]);
      } else {
        setLogs(logsData || []);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch initial data';
      setConnectionError(errorMessage);
      onError?.(errorMessage);
    }
  }, [projectId, supabase, onError]);

  // Setup real-time subscriptions
  const setupRealtimeSubscriptions = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    const channel = supabase.channel(`project-${projectId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: projectId }
      }
    });

    // Subscribe to project updates
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`
      },
      (payload) => {
        console.log('Project update received:', payload);
        const updatedProject = payload.new as Project;
        
        setProject(prev => {
          if (prev && prev.status !== updatedProject.status) {
            onStatusChange?.(updatedProject.status);
          }
          return updatedProject;
        });
      }
    );

    // Subscribe to new generation logs
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
        
        setLogs(prev => [...prev, newLog]);
        onNewLog?.(newLog);
      }
    );

    // Handle connection status
    channel.on('system', {}, (payload) => {
      console.log('Realtime system event:', payload);
      
      if (payload.extension === 'postgres_changes') {
        if (payload.status === 'ok') {
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
        } else if (payload.status === 'error') {
          setIsConnected(false);
          const errorMessage = `Connection error: ${payload.message || 'Unknown error'}`;
          setConnectionError(errorMessage);
          onError?.(errorMessage);
        }
      }
    });

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('Channel subscription status:', status, err);
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false);
        const errorMessage = err?.message || `Connection ${status.toLowerCase()}`;
        setConnectionError(errorMessage);
        onError?.(errorMessage);
        
        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setupRealtimeSubscriptions();
          }, reconnectDelay * reconnectAttemptsRef.current);
        }
      } else if (status === 'CLOSED') {
        setIsConnected(false);
      }
    });

    channelRef.current = channel;
  }, [projectId, supabase, onStatusChange, onNewLog, onError]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    setConnectionError(null);
    reconnectAttemptsRef.current = 0;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setupRealtimeSubscriptions();
  }, [setupRealtimeSubscriptions]);

  // Initialize
  useEffect(() => {
    fetchInitialData();
    setupRealtimeSubscriptions();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchInitialData, setupRealtimeSubscriptions]);

  return {
    project,
    logs,
    isConnected,
    connectionError,
    reconnect
  };
}