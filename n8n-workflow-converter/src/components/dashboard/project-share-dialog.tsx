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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { Copy, Check, Trash2, Mail } from 'lucide-react';

type Project = Database['public']['Tables']['projects']['Row'];
type SharedProject = Database['public']['Tables']['shared_projects']['Row'];

interface ProjectShareDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectShareDialog({
  project,
  open,
  onOpenChange
}: ProjectShareDialogProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (project && open) {
      fetchSharedProjects();
    }
  }, [project, open]);

  const fetchSharedProjects = async () => {
    if (!project) return;

    try {
      const { data, error } = await supabase
        .from('shared_projects')
        .select('*')
        .eq('project_id', project.id);

      if (error) throw error;
      setSharedProjects(data || []);
    } catch (error) {
      console.error('Error fetching shared projects:', error);
    }
  };

  const generateShareLink = async () => {
    if (!project) return;

    setLoading(true);
    try {
      const token = crypto.randomUUID();
      
      const { error } = await supabase
        .from('shared_projects')
        .insert({
          project_id: project.id,
          shared_by: project.user_id,
          share_token: token,
          permissions: 'read'
        });

      if (error) throw error;

      setShareToken(token);
      await fetchSharedProjects();
    } catch (error) {
      console.error('Error generating share link:', error);
    } finally {
      setLoading(false);
    }
  };

  const shareWithUser = async () => {
    if (!project || !email.trim()) return;

    setLoading(true);
    try {
      // First, check if user exists
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim())
        .single();

      if (userError || !userData) {
        alert('User not found. Please make sure the email is correct.');
        return;
      }

      const { error } = await supabase
        .from('shared_projects')
        .insert({
          project_id: project.id,
          shared_by: project.user_id,
          shared_with: userData.id,
          permissions: permission
        });

      if (error) throw error;

      setEmail('');
      await fetchSharedProjects();
    } catch (error) {
      console.error('Error sharing project:', error);
      alert('Failed to share project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('shared_projects')
        .delete()
        .eq('id', shareId);

      if (error) throw error;
      await fetchSharedProjects();
    } catch (error) {
      console.error('Error removing share:', error);
    }
  };

  const copyShareLink = async () => {
    if (!shareToken) return;

    const shareUrl = `${window.location.origin}/shared/${shareToken}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const publicShare = sharedProjects.find(sp => sp.share_token);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
          <DialogDescription>
            Share "{project?.name}" with others or generate a public link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Share with specific user */}
          <div>
            <Label>Share with User</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'read' | 'write')}
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
              </Select>
            </div>
            <Button
              onClick={shareWithUser}
              disabled={loading || !email.trim()}
              className="w-full mt-2"
              size="sm"
            >
              <Mail className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>

          {/* Public share link */}
          <div>
            <Label>Public Share Link</Label>
            {publicShare ? (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/shared/${publicShare.share_token}`}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    onClick={copyShareLink}
                    size="sm"
                    variant="outline"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  onClick={() => removeShare(publicShare.id)}
                  size="sm"
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Public Link
                </Button>
              </div>
            ) : (
              <Button
                onClick={generateShareLink}
                disabled={loading}
                className="w-full mt-2"
                size="sm"
                variant="outline"
              >
                Generate Public Link
              </Button>
            )}
          </div>

          {/* Current shares */}
          {sharedProjects.length > 0 && (
            <div>
              <Label>Current Shares</Label>
              <div className="mt-2 space-y-2">
                {sharedProjects.map((share) => (
                  <div key={share.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {share.shared_with ? 'User' : 'Public Link'}
                      </span>
                      <Badge variant={share.permissions === 'write' ? 'default' : 'secondary'}>
                        {share.permissions}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => removeShare(share.id)}
                      size="sm"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>

        <DialogClose />
      </DialogContent>
    </Dialog>
  );
}