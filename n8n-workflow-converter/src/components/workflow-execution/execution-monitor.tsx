'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Square, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Eye,
  Download
} from 'lucide-react';
import { useSingleExecution } from '@/hooks/use-workflow-execution';
import { ExecutionStatus } from '@/lib/workflow-execution/execution-service';

interface ExecutionMonitorProps {
  executionId: string | null;
  onCancel?: (executionId: string) => void;
  onRestart?: (executionId: string) => void;
  className?: string;
}

export function ExecutionMonitor({ 
  executionId, 
  onCancel, 
  onRestart,
  className 
}: ExecutionMonitorProps) {
  const { execution, logs, loading, error, reload } = useSingleExecution(executionId);

  if (!executionId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Workflow Execution</CardTitle>
          <CardDescription>No execution selected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Select or start a workflow execution to monitor its progress
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading && !execution) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Loading Execution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Execution Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={reload} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!execution) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Execution Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Execution {executionId} not found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ExecutionStatusIcon status={execution.status} />
              Execution {execution.id.slice(-8)}
            </CardTitle>
            <CardDescription>
              Workflow: {execution.workflowId}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ExecutionStatusBadge status={execution.status} />
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Progress</span>
            <span>{execution.progress}%</span>
          </div>
          <Progress value={execution.progress} className="w-full" />
          {execution.currentNode && (
            <div className="text-sm text-muted-foreground">
              Current node: {execution.currentNode}
            </div>
          )}
        </div>

        {/* Timing Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium">Started</div>
            <div className="text-muted-foreground">
              {new Date(execution.startTime).toLocaleString()}
            </div>
          </div>
          {execution.endTime && (
            <div>
              <div className="font-medium">Completed</div>
              <div className="text-muted-foreground">
                {new Date(execution.endTime).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Execution Duration */}
        {execution.endTime && (
          <div className="text-sm">
            <div className="font-medium">Duration</div>
            <div className="text-muted-foreground">
              {formatDuration(execution.startTime, execution.endTime)}
            </div>
          </div>
        )}

        {/* Error Display */}
        {execution.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{execution.error}</AlertDescription>
          </Alert>
        )}

        {/* Results Summary */}
        {execution.result && (
          <div className="space-y-2">
            <div className="font-medium">Results</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Nodes Executed</div>
                <div>{execution.result.summary?.nodesExecuted || 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Success Rate</div>
                <div>
                  {execution.result.summary ? 
                    Math.round((execution.result.summary.nodesSucceeded / execution.result.summary.nodesExecuted) * 100) 
                    : 0}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-4 border-t">
          {execution.status === 'running' && onCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancel(execution.id)}
            >
              <Square className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          
          {(execution.status === 'completed' || execution.status === 'failed') && onRestart && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestart(execution.id)}
            >
              <Play className="h-4 w-4 mr-2" />
              Restart
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {/* Open logs modal */}}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Logs ({logs.length})
          </Button>

          {execution.result && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {/* Download results */}}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Results
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionStatusIcon({ status }: { status: ExecutionStatus['status'] }) {
  switch (status) {
    case 'pending':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case 'running':
      return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'cancelled':
      return <Square className="h-5 w-5 text-gray-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-500" />;
  }
}

function ExecutionStatusBadge({ status }: { status: ExecutionStatus['status'] }) {
  const variants = {
    pending: 'secondary',
    running: 'default',
    completed: 'default',
    failed: 'destructive',
    cancelled: 'secondary'
  } as const;

  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };

  return (
    <Badge variant={variants[status]} className={colors[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}