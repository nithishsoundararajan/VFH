'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRealtimeProject } from '@/hooks/use-realtime-project';
import { Database } from '@/types/database';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Play,
  Pause
} from 'lucide-react';

type Project = Database['public']['Tables']['projects']['Row'];

interface ProjectProgressProps {
  projectId: string;
  onStatusChange?: (status: Project['status']) => void;
  showLogs?: boolean;
  className?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    label: 'Pending',
    progress: 0
  },
  processing: {
    icon: RefreshCw,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    label: 'Processing',
    progress: 50
  },
  completed: {
    icon: CheckCircle,
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    label: 'Completed',
    progress: 100
  },
  failed: {
    icon: XCircle,
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    label: 'Failed',
    progress: 0
  }
};

export function ProjectProgress({ 
  projectId, 
  onStatusChange, 
  showLogs = true,
  className 
}: ProjectProgressProps) {
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  const {
    project,
    logs,
    isConnected,
    connectionError,
    reconnect
  } = useRealtimeProject({
    projectId,
    onStatusChange: (status) => {
      setLastUpdateTime(new Date());
      onStatusChange?.(status);
    },
    onNewLog: () => {
      setLastUpdateTime(new Date());
    },
    onError: (error) => {
      console.error('Real-time project error:', error);
    }
  });

  const currentStatus = project?.status || 'pending';
  const config = statusConfig[currentStatus];
  const StatusIcon = config.icon;

  // Calculate more detailed progress based on logs
  const calculateDetailedProgress = () => {
    if (!project) return 0;
    
    if (currentStatus === 'completed') return 100;
    if (currentStatus === 'failed') return 0;
    if (currentStatus === 'pending') return 0;
    
    // For processing status, calculate based on logs
    const totalSteps = 10; // Estimated total steps in workflow processing
    const completedSteps = logs.filter(log => 
      log.log_level === 'info' && 
      (log.message.includes('completed') || log.message.includes('finished'))
    ).length;
    
    return Math.min(Math.max((completedSteps / totalSteps) * 100, 10), 90);
  };

  const detailedProgress = calculateDetailedProgress();

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (isAutoScrollEnabled && showLogs) {
      const logContainer = document.getElementById(`log-container-${projectId}`);
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
  }, [logs, isAutoScrollEnabled, showLogs, projectId]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getLogTextColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-700';
      case 'warning':
        return 'text-yellow-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <StatusIcon 
                className={`h-5 w-5 ${config.textColor} ${
                  currentStatus === 'processing' ? 'animate-spin' : ''
                }`} 
              />
              Project Progress
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {/* Connection Status */}
              <div className="flex items-center gap-1">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {/* Status Badge */}
              <Badge 
                variant="secondary" 
                className={`${config.bgColor} ${config.textColor} border-0`}
              >
                {config.label}
              </Badge>
            </div>
          </div>
          
          {lastUpdateTime && (
            <p className="text-xs text-gray-500">
              Last updated: {lastUpdateTime.toLocaleTimeString()}
            </p>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Connection Error Alert */}
          {connectionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{connectionError}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={reconnect}
                  className="ml-2"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reconnect
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(detailedProgress)}%</span>
            </div>
            <Progress 
              value={detailedProgress} 
              className="h-2"
            />
          </div>
          
          {/* Project Details */}
          {project && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Project:</span>
                <p className="text-gray-600 truncate">{project.name}</p>
              </div>
              <div>
                <span className="font-medium">Nodes:</span>
                <p className="text-gray-600">{project.node_count || 0}</p>
              </div>
              <div>
                <span className="font-medium">Created:</span>
                <p className="text-gray-600">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="font-medium">Triggers:</span>
                <p className="text-gray-600">{project.trigger_count || 0}</p>
              </div>
            </div>
          )}
          
          {/* Live Logs */}
          {showLogs && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Live Logs</h4>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
                    className="h-6 px-2 text-xs"
                  >
                    {isAutoScrollEnabled ? (
                      <>
                        <Pause className="h-3 w-3 mr-1" />
                        Pause Scroll
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        Auto Scroll
                      </>
                    )}
                  </Button>
                  <Badge variant="outline" className="text-xs">
                    {logs.length} logs
                  </Badge>
                </div>
              </div>
              
              <div 
                id={`log-container-${projectId}`}
                className="bg-gray-50 rounded-md p-3 h-48 overflow-y-auto text-xs font-mono space-y-1"
              >
                {logs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No logs yet. Logs will appear here in real-time.
                  </p>
                ) : (
                  logs.map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-start gap-2 py-1"
                    >
                      {getLogIcon(log.log_level)}
                      <span className="text-gray-500 min-w-[60px]">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <span className={getLogTextColor(log.log_level)}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}