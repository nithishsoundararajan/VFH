'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Database } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { 
  MoreVertical, 
  Download, 
  Edit, 
  Share, 
  Trash2, 
  Clock,
  FileText,
  Zap
} from 'lucide-react';

type Project = Database['public']['Tables']['projects']['Row'];

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onShare?: (project: Project) => void;
  onDownload?: (project: Project) => void;
  onView?: (project: Project) => void;
}

const statusColors = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  failed: 'destructive',
} as const;

const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
} as const;

export function ProjectCard({ 
  project, 
  onEdit, 
  onDelete, 
  onShare, 
  onDownload,
  onView 
}: ProjectCardProps) {
  const handleMenuAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    switch (action) {
      case 'edit':
        onEdit?.(project);
        break;
      case 'delete':
        onDelete?.(project);
        break;
      case 'share':
        onShare?.(project);
        break;
      case 'download':
        onDownload?.(project);
        break;
    }
  };

  return (
    <Card 
      className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onView?.(project)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger
            className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => handleMenuAction('edit', e)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleMenuAction('share', e)}>
              <Share className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuItem>
            {project.status === 'completed' && (
              <DropdownMenuItem onClick={(e) => handleMenuAction('download', e)}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => handleMenuAction('delete', e)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <Badge variant={statusColors[project.status]}>
          {statusLabels[project.status]}
        </Badge>
        
        {project.node_count && (
          <div className="flex items-center text-sm text-gray-500">
            <FileText className="mr-1 h-4 w-4" />
            {project.node_count} nodes
          </div>
        )}
        
        {project.trigger_count && (
          <div className="flex items-center text-sm text-gray-500">
            <Zap className="mr-1 h-4 w-4" />
            {project.trigger_count} triggers
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center">
          <Clock className="mr-1 h-4 w-4" />
          {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
        </div>
        
        {project.generated_at && (
          <div className="text-xs text-green-600">
            Generated {formatDistanceToNow(new Date(project.generated_at), { addSuffix: true })}
          </div>
        )}
      </div>
    </Card>
  );
}