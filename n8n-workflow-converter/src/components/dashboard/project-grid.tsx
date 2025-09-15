'use client';

import { ProjectCard } from './project-card';
import { Database } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Plus, Grid, List, FileText } from 'lucide-react';

type Project = Database['public']['Tables']['projects']['Row'];

interface ProjectGridProps {
  projects: Project[];
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onShareProject: (project: Project) => void;
  onDownloadProject: (project: Project) => void;
  onViewProject: (project: Project) => void;
  loading?: boolean;
}

export function ProjectGrid({
  projects,
  viewMode,
  onViewModeChange,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onShareProject,
  onDownloadProject,
  onViewProject,
  loading = false
}: ProjectGridProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-10 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-10 animate-pulse"></div>
          </div>
        </div>
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
          : "space-y-4"
        }>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No projects yet
        </h3>
        <p className="text-gray-500 mb-6">
          Get started by uploading your first n8n workflow
        </p>
        <Button onClick={onCreateProject}>
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Your Projects ({projects.length})
        </h2>
        
        <div className="flex gap-2">
          <Button onClick={onCreateProject}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
          
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              className="rounded-r-none border-r-0"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className={viewMode === 'grid' 
        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
        : "space-y-4"
      }>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={onEditProject}
            onDelete={onDeleteProject}
            onShare={onShareProject}
            onDownload={onDownloadProject}
            onView={onViewProject}
          />
        ))}
      </div>
    </div>
  );
}