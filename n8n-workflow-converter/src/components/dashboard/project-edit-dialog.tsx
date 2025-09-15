'use client';

import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Database } from '@/types/database';

type Project = Database['public']['Tables']['projects']['Row'];

interface ProjectEditDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: { name: string; description: string | null }) => Promise<void>;
}

export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
  onSave
}: ProjectEditDialogProps) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [saving, setSaving] = useState(false);

  // Update form when project changes
  React.useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
    }
  }, [project]);

  const handleSave = async () => {
    if (!project || !name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update your project details. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter project description (optional)"
              className="mt-1"
              rows={3}
            />
          </div>

          {project && (
            <div className="text-sm text-gray-500 space-y-1">
              <p>Status: <span className="capitalize">{project.status}</span></p>
              <p>Created: {new Date(project.created_at).toLocaleDateString()}</p>
              {project.node_count && (
                <p>Nodes: {project.node_count}</p>
              )}
              {project.trigger_count && (
                <p>Triggers: {project.trigger_count}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>

        <DialogClose />
      </DialogContent>
    </Dialog>
  );
}