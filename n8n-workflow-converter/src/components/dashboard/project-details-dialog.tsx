'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Database } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { 
  FileText, 
  Zap, 
  Clock, 
  Download,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { ProjectDownload } from '@/components/file-management/project-download';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectAnalytics = Database['public']['Tables']['project_analytics']['Row'];
type GenerationLog = Database['public']['Tables']['generation_logs']['Row'];

interface ProjectDetailsDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (project: Project) => void;
}

const statusColors = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  failed: 'destructive',
} as const;

const logLevelIcons = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
};

export function ProjectDetailsDialog({
  project,
  open,
  onOpenChange,
  onDownload
}: ProjectDetailsDialogProps) {
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (project && open) {
      fetchProjectDetails();
    }
  }, [project, open]);

  const fetchProjectDetails = async () => {
    if (!project) return;

    setLoading(true);
    try {
      // Fetch analytics
      const { data: analyticsData } = await supabase
        .from('project_analytics')
        .select('*')
        .eq('project_id', project.id)
        .single();

      setAnalytics(analyticsData);

      // Fetch logs
      const { data: logsData } = await supabase
        .from('generation_logs')
        .select('*')
        .eq('project_id', project.id)
        .order('timestamp', { ascending: false })
        .limit(50);

      setLogs(logsData || []);
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {project.name}
            <Badge variant={statusColors[project.status]}>
              {project.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {project.description || 'No description provided'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Project Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Created:</span>
                <p>{new Date(project.created_at).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-gray-500">Last Updated:</span>
                <p>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</p>
              </div>
              <div>
                <span className="text-gray-500">Nodes:</span>
                <p className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {project.node_count || 0}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Triggers:</span>
                <p className="flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  {project.trigger_count || 0}
                </p>
              </div>
              {project.generated_at && (
                <>
                  <div>
                    <span className="text-gray-500">Generated:</span>
                    <p>{new Date(project.generated_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">File Path:</span>
                    <p className="truncate">{project.file_path || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Analytics */}
          {analytics && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Analytics</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Generation Time:</span>
                  <p>{formatDuration(analytics.generation_time_ms)}</p>
                </div>
                <div>
                  <span className="text-gray-500">File Size:</span>
                  <p>{formatFileSize(analytics.file_size_bytes)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Complexity Score:</span>
                  <p>{analytics.complexity_score || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Node Types:</span>
                  <p>{analytics.node_types ? Object.keys(analytics.node_types as object).length : 0}</p>
                </div>
              </div>
              
              {analytics.node_types && (
                <div className="mt-4">
                  <span className="text-gray-500 text-sm">Node Types Used:</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(analytics.node_types as Record<string, number>).map(([type, count]) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type} ({count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Generation Logs */}
          {logs.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Generation Logs</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-sm p-2 rounded bg-gray-50">
                    {logLevelIcons[log.log_level]}
                    <div className="flex-1">
                      <p>{log.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Download Section */}
          <ProjectDownload
            projectId={project.id}
            projectName={project.name}
            projectStatus={project.status}
          />

          {/* Workflow JSON Preview */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Workflow Structure</h3>
            <div className="bg-gray-50 p-3 rounded text-sm">
              <pre className="whitespace-pre-wrap overflow-x-auto max-h-32">
                {JSON.stringify(project.workflow_json, null, 2).substring(0, 500)}
                {JSON.stringify(project.workflow_json, null, 2).length > 500 && '...'}
              </pre>
            </div>
          </Card>
        </div>

        <DialogFooter>
          {project.status === 'completed' && onDownload && (
            <Button onClick={() => onDownload(project)}>
              <Download className="mr-2 h-4 w-4" />
              Download Project
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>

        <DialogClose />
      </DialogContent>
    </Dialog>
  );
}