import { createClient } from './client';
import type { Database } from '@/types/database';

/**
 * Utility functions to test Row Level Security policies
 * These functions help verify that RLS policies are working correctly
 */

export class RLSTestUtils {
  private supabase = createClient();

  /**
   * Test if user can only access their own profile
   */
  async testProfileAccess(userId: string) {
    try {
      // Should succeed - accessing own profile
      const { data: ownProfile, error: ownError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Should return empty - accessing other profiles
      const { data: otherProfiles, error: otherError } = await this.supabase
        .from('profiles')
        .select('*')
        .neq('id', userId);

      return {
        ownProfile: { data: ownProfile, error: ownError },
        otherProfiles: { data: otherProfiles, error: otherError },
        success: !!ownProfile && (!otherProfiles || otherProfiles.length === 0)
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Test if user can only access their own projects
   */
  async testProjectAccess(userId: string) {
    try {
      // Should succeed - accessing own projects
      const { data: ownProjects, error: ownError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId);

      // Should return empty - accessing other projects
      const { data: otherProjects, error: otherError } = await this.supabase
        .from('projects')
        .select('*')
        .neq('user_id', userId);

      return {
        ownProjects: { data: ownProjects, error: ownError },
        otherProjects: { data: otherProjects, error: otherError },
        success: (!otherProjects || otherProjects.length === 0)
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Test shared project access
   */
  async testSharedProjectAccess(projectId: string, sharedWithUserId: string) {
    try {
      // Create a test share
      const { data: share, error: shareError } = await this.supabase
        .from('shared_projects')
        .insert({
          project_id: projectId,
          shared_by: (await this.supabase.auth.getUser()).data.user?.id!,
          shared_with: sharedWithUserId,
          permissions: 'read'
        })
        .select()
        .single();

      if (shareError) {
        return { success: false, error: shareError };
      }

      // Test if shared project is accessible
      const { data: sharedProjects, error: accessError } = await this.supabase
        .from('shared_projects')
        .select('*')
        .eq('project_id', projectId);

      // Clean up test data
      await this.supabase
        .from('shared_projects')
        .delete()
        .eq('id', share.id);

      return {
        share: { data: share, error: shareError },
        access: { data: sharedProjects, error: accessError },
        success: !!sharedProjects && sharedProjects.length > 0
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Test analytics access for own projects only
   */
  async testAnalyticsAccess(userId: string) {
    try {
      const { data: analytics, error } = await this.supabase
        .from('project_analytics')
        .select(`
          *,
          projects!inner(user_id)
        `);

      // All returned analytics should belong to user's projects
      const allBelongToUser = analytics?.every(
        (analytic: any) => analytic.projects.user_id === userId
      ) ?? true;

      return {
        analytics: { data: analytics, error },
        success: allBelongToUser
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Test generation logs access for own projects only
   */
  async testGenerationLogsAccess(userId: string) {
    try {
      const { data: logs, error } = await this.supabase
        .from('generation_logs')
        .select(`
          *,
          projects!inner(user_id)
        `);

      // All returned logs should belong to user's projects
      const allBelongToUser = logs?.every(
        (log: any) => log.projects.user_id === userId
      ) ?? true;

      return {
        logs: { data: logs, error },
        success: allBelongToUser
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Test public share token access
   */
  async testPublicShareAccess(projectId: string) {
    try {
      const shareToken = `test-token-${Date.now()}`;

      // Create a public share
      const { data: share, error: shareError } = await this.supabase
        .from('shared_projects')
        .insert({
          project_id: projectId,
          shared_by: (await this.supabase.auth.getUser()).data.user?.id!,
          share_token: shareToken,
          permissions: 'read'
        })
        .select()
        .single();

      if (shareError) {
        return { success: false, error: shareError };
      }

      // Test if public share is accessible
      const { data: publicShares, error: accessError } = await this.supabase
        .from('shared_projects')
        .select('*')
        .eq('share_token', shareToken);

      // Clean up test data
      await this.supabase
        .from('shared_projects')
        .delete()
        .eq('id', share.id);

      return {
        share: { data: share, error: shareError },
        access: { data: publicShares, error: accessError },
        success: !!publicShares && publicShares.length > 0
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Run all RLS tests
   */
  async runAllTests(userId: string, testProjectId?: string) {
    const results = {
      profileAccess: await this.testProfileAccess(userId),
      projectAccess: await this.testProjectAccess(userId),
      analyticsAccess: await this.testAnalyticsAccess(userId),
      logsAccess: await this.testGenerationLogsAccess(userId),
    };

    if (testProjectId) {
      results['sharedAccess'] = await this.testSharedProjectAccess(testProjectId, 'test-user-id');
      results['publicAccess'] = await this.testPublicShareAccess(testProjectId);
    }

    const allPassed = Object.values(results).every(result => result.success);

    return {
      results,
      allPassed,
      summary: {
        total: Object.keys(results).length,
        passed: Object.values(results).filter(r => r.success).length,
        failed: Object.values(results).filter(r => !r.success).length
      }
    };
  }
}