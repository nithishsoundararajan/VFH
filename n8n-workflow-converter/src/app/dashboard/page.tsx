'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { useAuth } from '@/lib/auth/context';
import { useProjects } from '@/hooks/use-projects';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { ProjectFilters } from '@/components/dashboard/project-filters';
import { ProjectGrid } from '@/components/dashboard/project-grid';
import { ProjectEditDialog } from '@/components/dashboard/project-edit-dialog';
import { ProjectShareDialog } from '@/components/dashboard/project-share-dialog';
import { ProjectDetailsDialog } from '@/components/dashboard/project-details-dialog';

import { testDatabaseConnection } from '@/lib/supabase/test-connection';
import { Database } from '@/types/database';
import Link from 'next/link';
import { AlertCircle, Database as DatabaseIcon } from 'lucide-react';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectStatus = Database['public']['Tables']['projects']['Row']['status'];

function DashboardContent() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { projects, analytics, loading, error, refetch, updateProject, deleteProject } = useProjects();
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Dialog state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sharingProject, setSharingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  // Database connection test
  const [dbStatus, setDbStatus] = useState<{
    tested: boolean;
    success: boolean;
    error?: string;
    needsSetup?: boolean;
  }>({ tested: false, success: false });

  useEffect(() => {
    const testConnection = async () => {
      const result = await testDatabaseConnection();
      setDbStatus({
        tested: true,
        success: result.success,
        error: result.error,
        needsSetup: result.needsSetup
      });
    };
    
    testConnection();
  }, []);

  const retryDatabaseConnection = async () => {
    setDbStatus({ tested: false, success: false });
    const result = await testDatabaseConnection();
    setDbStatus({
      tested: true,
      success: result.success,
      error: result.error,
      needsSetup: result.needsSetup
    });
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  // Project actions
  const handleCreateProject = () => {
    router.push('/upload');
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
  };

  const handleSaveProject = async (updates: { name: string; description: string | null }) => {
    if (!editingProject) return;
    
    await updateProject(editingProject.id, updates);
    setEditingProject(null);
  };

  const handleDeleteProject = async (project: Project) => {
    if (confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      const success = await deleteProject(project.id);
      if (success) {
        // Project will be removed from state by the hook
      } else {
        alert('Failed to delete project. Please try again.');
      }
    }
  };

  const handleShareProject = (project: Project) => {
    setSharingProject(project);
  };

  const handleViewProject = (project: Project) => {
    setViewingProject(project);
  };

  const handleDownloadProject = async (project: Project) => {
    try {
      // Check if project has files to download
      if (!project.file_path) {
        alert('Project files are not ready for download yet. Please wait for generation to complete.');
        return;
      }

      // Create download URL
      const downloadUrl = `/api/projects/${project.id}/download?format=zip`;
      
      // Trigger download
      const response = await fetch(downloadUrl);
      const data = await response.json();
      
      if (data.success && data.download?.url) {
        // Open download URL in new tab
        window.open(data.download.url, '_blank');
      } else {
        alert(data.error || 'Failed to generate download link');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download project. Please try again.');
    }
  };

  // Quick action handlers
  const handleUploadWorkflow = () => {
    router.push('/upload');
  };

  const handleViewDocumentation = () => {
    window.open('https://docs.n8n.io/', '_blank');
  };

  const handleDownloadTemplate = () => {
    // TODO: Implement template download
    console.log('Download template');
  };

  const handleOpenSettings = () => {
    router.push('/settings');
  };

  const handleGetHelp = () => {
    // TODO: Navigate to help page
    console.log('Get help');
  };



  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user?.email?.split('@')[0]}
              </p>
            </div>
            <div className="flex gap-4">
              <Link href="/settings">
                <Button variant="outline">Settings</Button>
              </Link>
              <Link href="/profile">
                <Button variant="outline">Profile</Button>
              </Link>
              <Button variant="destructive" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>

          {/* Database Status Alert */}
          {dbStatus.tested && !dbStatus.success && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <DatabaseIcon className="h-4 w-4 text-red-600" />
              <div className="text-red-800">
                <strong>Database Connection Error:</strong> {dbStatus.error}
                <p className="text-sm mt-1">
                  This might indicate that the database tables haven't been created yet or there's a connection issue.
                </p>
              </div>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <div className="text-red-800">
                <strong>Error:</strong> {error}
                {error.includes('Database tables not found') && (
                  <p className="text-sm mt-1">
                    Please set up the database tables first. Check the database setup instructions above.
                  </p>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={refetch}
                  className="ml-4"
                >
                  Retry
                </Button>
              </div>
            </Alert>
          )}

          {/* Dashboard Stats */}
          <DashboardStats projects={projects} analytics={analytics} />

          {/* Quick Actions */}
          <QuickActions
            onUploadWorkflow={handleUploadWorkflow}
            onViewDocumentation={handleViewDocumentation}
            onDownloadTemplate={handleDownloadTemplate}
            onShareProject={() => console.log('Share project from quick actions')}
            onOpenSettings={handleOpenSettings}
            onGetHelp={handleGetHelp}
          />

          {/* Project Filters */}
          <ProjectFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {/* Project Grid */}
          <div className="mt-6">
            <ProjectGrid
              projects={filteredProjects}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onCreateProject={handleCreateProject}
              onEditProject={handleEditProject}
              onDeleteProject={handleDeleteProject}
              onShareProject={handleShareProject}
              onDownloadProject={handleDownloadProject}
              onViewProject={handleViewProject}
              loading={loading}
            />
          </div>

          {/* Dialogs */}
          <ProjectEditDialog
            project={editingProject}
            open={!!editingProject}
            onOpenChange={(open) => !open && setEditingProject(null)}
            onSave={handleSaveProject}
          />

          <ProjectShareDialog
            project={sharingProject}
            open={!!sharingProject}
            onOpenChange={(open) => !open && setSharingProject(null)}
          />

          <ProjectDetailsDialog
            project={viewingProject}
            open={!!viewingProject}
            onOpenChange={(open) => !open && setViewingProject(null)}
            onDownload={handleDownloadProject}
          />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}