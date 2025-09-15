'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectProgress } from './project-progress';
import { StatusIndicator, StatusTimeline } from './status-indicator';
import { LiveLogs } from './live-logs';
import { RealtimeNotifications } from './realtime-notifications';
import { useRealtimeProject } from '@/hooks/use-realtime-project';
import { useRealtimeLogs } from '@/hooks/use-realtime-logs';
import { useProgressPersistence } from '@/lib/progress-persistence';
import { Database } from '@/types/database';

type ProjectStatus = Database['public']['Tables']['projects']['Row']['status'];

interface ProgressDemoProps {
  projectId: string;
  projectName?: string;
}

export function ProgressDemo({ projectId, projectName = 'Demo Project' }: ProgressDemoProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'logs' | 'timeline'>('overview');
  
  const {
    project,
    logs,
    isConnected,
    connectionError,
    reconnect
  } = useRealtimeProject({
    projectId,
    onStatusChange: (status) => {
      console.log('Status changed to:', status);
    },
    onNewLog: (log) => {
      console.log('New log:', log);
    }
  });

  const {
    addLog
  } = useRealtimeLogs({
    projectId,
    onNewLog: (log) => {
      console.log('Log added:', log);
    }
  });

  const {
    updateStatus,
    updateProgress,
    loadProgress
  } = useProgressPersistence(projectId);

  // Demo functions to simulate status changes
  const simulateStatusChange = async (status: ProjectStatus) => {
    updateStatus(status);
    
    // Add a demo log
    await addLog({
      log_level: status === 'failed' ? 'error' : 'info',
      message: `Project status changed to ${status}`,
      project_id: projectId
    });
  };

  const simulateProgress = async () => {
    const steps = [
      { progress: 10, message: 'Parsing workflow JSON...' },
      { progress: 25, message: 'Mapping nodes to packages...' },
      { progress: 50, message: 'Generating code structure...' },
      { progress: 75, message: 'Creating project files...' },
      { progress: 90, message: 'Finalizing project...' },
      { progress: 100, message: 'Project generation completed!' }
    ];

    for (const step of steps) {
      updateProgress(step.progress);
      await addLog({
        log_level: 'info',
        message: step.message,
        project_id: projectId
      });
      
      // Wait a bit between steps
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    updateStatus('completed');
  };

  const addDemoLogs = async () => {
    const demoLogs = [
      { level: 'info' as const, message: 'Starting workflow analysis...' },
      { level: 'info' as const, message: 'Found 5 nodes in workflow' },
      { level: 'warning' as const, message: 'Node "HTTP Request" uses deprecated parameter' },
      { level: 'info' as const, message: 'Mapping nodes to n8n packages...' },
      { level: 'error' as const, message: 'Failed to map node "CustomNode" - not found in registry' },
      { level: 'info' as const, message: 'Generated 4 out of 5 nodes successfully' }
    ];

    for (const log of demoLogs) {
      await addLog({
        log_level: log.level,
        message: log.message,
        project_id: projectId
      });
      
      // Small delay between logs
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const currentStatus = project?.status || 'pending';
  const persistedProgress = loadProgress();

  return (
    <div className="space-y-6">
      {/* Demo Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Progress Tracking Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant="outline"
              onClick={() => simulateStatusChange('pending')}
            >
              Set Pending
            </Button>
            <Button
              variant="outline"
              onClick={() => simulateStatusChange('processing')}
            >
              Set Processing
            </Button>
            <Button
              variant="outline"
              onClick={() => simulateStatusChange('completed')}
            >
              Set Completed
            </Button>
            <Button
              variant="outline"
              onClick={() => simulateStatusChange('failed')}
            >
              Set Failed
            </Button>
            <Button
              variant="default"
              onClick={simulateProgress}
              disabled={currentStatus === 'processing'}
            >
              Simulate Progress
            </Button>
            <Button
              variant="secondary"
              onClick={addDemoLogs}
            >
              Add Demo Logs
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant={selectedView === 'overview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedView('overview')}
            >
              Overview
            </Button>
            <Button
              variant={selectedView === 'logs' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedView('logs')}
            >
              Logs
            </Button>
            <Button
              variant={selectedView === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedView('timeline')}
            >
              Timeline
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusIndicator 
              status={currentStatus} 
              size="lg"
              animated={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {connectionError && (
                <Button variant="outline" size="sm" onClick={reconnect}>
                  Reconnect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Logs Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <div className="text-sm text-gray-500">Total logs</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProjectProgress 
            projectId={projectId}
            onStatusChange={(status) => console.log('Status changed:', status)}
            showLogs={true}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Persisted Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {persistedProgress ? (
                <div className="space-y-2 text-sm">
                  <div><strong>Status:</strong> {persistedProgress.status}</div>
                  <div><strong>Progress:</strong> {persistedProgress.progress}%</div>
                  <div><strong>Last Update:</strong> {new Date(persistedProgress.lastUpdate).toLocaleString()}</div>
                  <div><strong>Logs:</strong> {persistedProgress.logs.length}</div>
                </div>
              ) : (
                <div className="text-gray-500">No persisted progress found</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'logs' && (
        <LiveLogs 
          projectId={projectId}
          maxHeight="600px"
          showFilters={true}
          showControls={true}
        />
      )}

      {selectedView === 'timeline' && (
        <Card>
          <CardHeader>
            <CardTitle>Status Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline 
              currentStatus={currentStatus}
              timestamps={{
                pending: project?.created_at,
                processing: currentStatus === 'processing' ? new Date().toISOString() : undefined,
                completed: currentStatus === 'completed' ? project?.generated_at || undefined : undefined,
                failed: currentStatus === 'failed' ? project?.updated_at : undefined
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Real-time Notifications */}
      <RealtimeNotifications 
        projectId={projectId}
        position="top-right"
        maxNotifications={5}
      />
    </div>
  );
}