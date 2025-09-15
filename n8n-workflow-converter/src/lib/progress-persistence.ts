'use client';

import { Database } from '@/types/database';

type Project = Database['public']['Tables']['projects']['Row'];
type GenerationLog = Database['public']['Tables']['generation_logs']['Row'];

interface ProgressState {
  projectId: string;
  status: Project['status'];
  progress: number;
  lastUpdate: string;
  logs: GenerationLog[];
  metadata?: {
    nodeCount?: number;
    triggerCount?: number;
    startTime?: string;
    endTime?: string;
  };
}

interface ProgressPersistenceOptions {
  storageKey?: string;
  maxStoredProjects?: number;
  maxLogsPerProject?: number;
}

class ProgressPersistence {
  private storageKey: string;
  private maxStoredProjects: number;
  private maxLogsPerProject: number;

  constructor(options: ProgressPersistenceOptions = {}) {
    this.storageKey = options.storageKey || 'n8n-converter-progress';
    this.maxStoredProjects = options.maxStoredProjects || 10;
    this.maxLogsPerProject = options.maxLogsPerProject || 100;
  }

  // Save progress state to localStorage
  saveProgress(projectId: string, state: Partial<ProgressState>): void {
    try {
      const existingData = this.getAllProgress();
      const currentState = existingData[projectId] || {
        projectId,
        status: 'pending' as const,
        progress: 0,
        lastUpdate: new Date().toISOString(),
        logs: []
      };

      const updatedState: ProgressState = {
        ...currentState,
        ...state,
        projectId,
        lastUpdate: new Date().toISOString()
      };

      // Limit the number of logs stored
      if (updatedState.logs.length > this.maxLogsPerProject) {
        updatedState.logs = updatedState.logs.slice(-this.maxLogsPerProject);
      }

      existingData[projectId] = updatedState;

      // Limit the number of stored projects
      const projectIds = Object.keys(existingData);
      if (projectIds.length > this.maxStoredProjects) {
        // Remove oldest projects
        const sortedProjects = projectIds
          .map(id => ({ id, lastUpdate: existingData[id].lastUpdate }))
          .sort((a, b) => new Date(a.lastUpdate).getTime() - new Date(b.lastUpdate).getTime());

        const projectsToRemove = sortedProjects.slice(0, projectIds.length - this.maxStoredProjects);
        projectsToRemove.forEach(project => {
          delete existingData[project.id];
        });
      }

      localStorage.setItem(this.storageKey, JSON.stringify(existingData));
    } catch (error) {
      console.error('Failed to save progress to localStorage:', error);
    }
  }

  // Load progress state from localStorage
  loadProgress(projectId: string): ProgressState | null {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;

      const allProgress = JSON.parse(data);
      return allProgress[projectId] || null;
    } catch (error) {
      console.error('Failed to load progress from localStorage:', error);
      return null;
    }
  }

  // Get all stored progress states
  getAllProgress(): Record<string, ProgressState> {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to load all progress from localStorage:', error);
      return {};
    }
  }

  // Update project status
  updateStatus(projectId: string, status: Project['status']): void {
    const progress = this.calculateProgressFromStatus(status);
    this.saveProgress(projectId, { status, progress });
  }

  // Add a new log entry
  addLog(projectId: string, log: GenerationLog): void {
    const currentState = this.loadProgress(projectId);
    const logs = currentState?.logs || [];
    
    // Avoid duplicate logs
    const existingLog = logs.find(l => l.id === log.id);
    if (existingLog) return;

    const updatedLogs = [...logs, log];
    this.saveProgress(projectId, { logs: updatedLogs });
  }

  // Update progress percentage
  updateProgress(projectId: string, progress: number): void {
    this.saveProgress(projectId, { progress: Math.max(0, Math.min(100, progress)) });
  }

  // Update metadata
  updateMetadata(projectId: string, metadata: ProgressState['metadata']): void {
    const currentState = this.loadProgress(projectId);
    const updatedMetadata = { ...currentState?.metadata, ...metadata };
    this.saveProgress(projectId, { metadata: updatedMetadata });
  }

  // Remove progress data for a project
  removeProgress(projectId: string): void {
    try {
      const allProgress = this.getAllProgress();
      delete allProgress[projectId];
      localStorage.setItem(this.storageKey, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Failed to remove progress from localStorage:', error);
    }
  }

  // Clear all progress data
  clearAllProgress(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear progress from localStorage:', error);
    }
  }

  // Get recent projects (sorted by last update)
  getRecentProjects(limit: number = 5): ProgressState[] {
    const allProgress = this.getAllProgress();
    return Object.values(allProgress)
      .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
      .slice(0, limit);
  }

  // Check if a project is currently active (processing)
  isProjectActive(projectId: string): boolean {
    const state = this.loadProgress(projectId);
    return state?.status === 'processing';
  }

  // Get active projects
  getActiveProjects(): ProgressState[] {
    const allProgress = this.getAllProgress();
    return Object.values(allProgress).filter(state => state.status === 'processing');
  }

  // Calculate progress from status
  private calculateProgressFromStatus(status: Project['status']): number {
    switch (status) {
      case 'pending':
        return 0;
      case 'processing':
        return 50;
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  }

  // Cleanup old progress data (older than specified days)
  cleanup(olderThanDays: number = 7): void {
    try {
      const allProgress = this.getAllProgress();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const filteredProgress = Object.fromEntries(
        Object.entries(allProgress).filter(([_, state]) => {
          const lastUpdate = new Date(state.lastUpdate);
          return lastUpdate > cutoffDate;
        })
      );

      localStorage.setItem(this.storageKey, JSON.stringify(filteredProgress));
    } catch (error) {
      console.error('Failed to cleanup old progress data:', error);
    }
  }

  // Export progress data
  exportProgress(): string {
    const allProgress = this.getAllProgress();
    return JSON.stringify(allProgress, null, 2);
  }

  // Import progress data
  importProgress(data: string): boolean {
    try {
      const parsedData = JSON.parse(data);
      localStorage.setItem(this.storageKey, JSON.stringify(parsedData));
      return true;
    } catch (error) {
      console.error('Failed to import progress data:', error);
      return false;
    }
  }
}

// Create a singleton instance
export const progressPersistence = new ProgressPersistence();

// Hook for using progress persistence in React components
export function useProgressPersistence(projectId: string) {
  const saveProgress = (state: Partial<ProgressState>) => {
    progressPersistence.saveProgress(projectId, state);
  };

  const loadProgress = () => {
    return progressPersistence.loadProgress(projectId);
  };

  const updateStatus = (status: Project['status']) => {
    progressPersistence.updateStatus(projectId, status);
  };

  const addLog = (log: GenerationLog) => {
    progressPersistence.addLog(projectId, log);
  };

  const updateProgress = (progress: number) => {
    progressPersistence.updateProgress(projectId, progress);
  };

  const updateMetadata = (metadata: ProgressState['metadata']) => {
    progressPersistence.updateMetadata(projectId, metadata);
  };

  const removeProgress = () => {
    progressPersistence.removeProgress(projectId);
  };

  const isActive = () => {
    return progressPersistence.isProjectActive(projectId);
  };

  return {
    saveProgress,
    loadProgress,
    updateStatus,
    addLog,
    updateProgress,
    updateMetadata,
    removeProgress,
    isActive
  };
}

export type { ProgressState, ProgressPersistenceOptions };