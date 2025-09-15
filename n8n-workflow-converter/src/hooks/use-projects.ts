'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';
import { useAuth } from '@/lib/auth/context';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectAnalytics = Database['public']['Tables']['project_analytics']['Row'];

interface UseProjectsReturn {
  projects: Project[];
  analytics: ProjectAnalytics[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createProject: (project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Project | null>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<boolean>;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [analytics, setAnalytics] = useState<ProjectAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = createClient();

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setAnalytics([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching projects for user:', user.id);

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Projects query result:', { projectsData, projectsError });

      if (projectsError) {
        console.error('Projects error details:', projectsError);
        
        // Check if it's a table not found error
        const isTableNotFound = projectsError.message?.includes('relation') && 
                                projectsError.message?.includes('does not exist') ||
                                projectsError.message?.includes('Could not find the table') ||
                                projectsError.code === 'PGRST106';
        
        if (isTableNotFound) {
          throw new Error('Database tables not found. Please set up the database first.');
        }
        
        throw new Error(`Database error: ${projectsError.message} (Code: ${projectsError.code || 'unknown'})`);
      }

      setProjects(projectsData || []);

      // Fetch analytics for projects
      if (projectsData && projectsData.length > 0) {
        const projectIds = projectsData.map(p => p.id);
        const { data: analyticsData, error: analyticsError } = await supabase
          .from('project_analytics')
          .select('*')
          .in('project_id', projectIds);

        if (analyticsError) {
          console.error('Analytics error details:', analyticsError);
          // Don't throw here, just log the error and continue
          console.warn('Failed to fetch analytics, continuing without them');
        } else {
          setAnalytics(analyticsData || []);
        }
      } else {
        setAnalytics([]);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch projects. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  const createProject = useCallback(async (
    projectData: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<Project | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setProjects(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err instanceof Error ? err.message : 'Failed to create project');
      return null;
    }
  }, [user, supabase]);

  const updateProject = useCallback(async (
    id: string, 
    updates: Partial<Project>
  ): Promise<Project | null> => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setProjects(prev => prev.map(p => p.id === id ? data : p));
      return data;
    } catch (err) {
      console.error('Error updating project:', err);
      setError(err instanceof Error ? err.message : 'Failed to update project');
      return null;
    }
  }, [supabase]);

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Delete related records first (due to foreign key constraints)
      await supabase.from('generation_logs').delete().eq('project_id', id);
      await supabase.from('project_analytics').delete().eq('project_id', id);
      await supabase.from('shared_projects').delete().eq('project_id', id);
      
      // Delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== id));
      setAnalytics(prev => prev.filter(a => a.project_id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      return false;
    }
  }, [supabase]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    analytics,
    loading,
    error,
    refetch: fetchProjects,
    createProject,
    updateProject,
    deleteProject
  };
}