/**
 * Database Integration Tests
 * Tests for Supabase database operations and queries
 */

import { createClient } from '@supabase/supabase-js';
import { DatabaseService } from '../database-service';

// Test configuration
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'https://test.supabase.co';
const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-key';

describe('Database Integration Tests', () => {
  let supabase: any;
  let databaseService: DatabaseService;
  let testUserId: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Create test Supabase client
    supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);
    databaseService = new DatabaseService(supabase);

    // Create test user for integration tests
    const { data: authData } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123'
    });

    testUserId = authData.user?.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testProjectId) {
      await supabase.from('projects').delete().eq('id', testProjectId);
    }
    if (testUserId) {
      await supabase.from('profiles').delete().eq('id', testUserId);
    }
  });

  describe('Project Operations', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Integration test project',
        workflow_json: {
          name: 'Test Workflow',
          nodes: [
            {
              id: 'node-1',
              name: 'HTTP Request',
              type: 'n8n-nodes-base.httpRequest',
              parameters: { url: 'https://api.example.com' }
            }
          ],
          connections: {}
        },
        user_id: testUserId
      };

      const result = await databaseService.createProject(projectData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.name).toBe('Test Project');
      expect(result.data.user_id).toBe(testUserId);

      testProjectId = result.data.id;
    });

    it('should retrieve project by id', async () => {
      const result = await databaseService.getProject(testProjectId, testUserId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id', testProjectId);
      expect(result.data.name).toBe('Test Project');
      expect(result.data.workflow_json).toHaveProperty('nodes');
    });

    it('should update project status', async () => {
      const result = await databaseService.updateProjectStatus(testProjectId, 'processing');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('processing');

      // Verify the update
      const getResult = await databaseService.getProject(testProjectId, testUserId);
      expect(getResult.data.status).toBe('processing');
    });

    it('should list user projects', async () => {
      const result = await databaseService.getUserProjects(testUserId);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some(p => p.id === testProjectId)).toBe(true);
    });

    it('should filter projects by status', async () => {
      const result = await databaseService.getUserProjects(testUserId, { status: 'processing' });

      expect(result.success).toBe(true);
      expect(result.data.every(p => p.status === 'processing')).toBe(true);
    });

    it('should search projects by name', async () => {
      const result = await databaseService.getUserProjects(testUserId, { search: 'Test Project' });

      expect(result.success).toBe(true);
      expect(result.data.some(p => p.name.includes('Test Project'))).toBe(true);
    });

    it('should enforce row level security', async () => {
      // Try to access project with different user
      const { data: otherUser } = await supabase.auth.signUp({
        email: `other-${Date.now()}@example.com`,
        password: 'testpassword123'
      });

      const result = await databaseService.getProject(testProjectId, otherUser.user.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Generation Logs', () => {
    it('should create generation log entries', async () => {
      const logData = {
        project_id: testProjectId,
        log_level: 'info',
        message: 'Starting workflow processing'
      };

      const result = await databaseService.createGenerationLog(logData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.message).toBe('Starting workflow processing');
    });

    it('should retrieve logs for project', async () => {
      // Create multiple log entries
      const logs = [
        { project_id: testProjectId, log_level: 'info', message: 'Log 1' },
        { project_id: testProjectId, log_level: 'warning', message: 'Log 2' },
        { project_id: testProjectId, log_level: 'error', message: 'Log 3' }
      ];

      for (const log of logs) {
        await databaseService.createGenerationLog(log);
      }

      const result = await databaseService.getProjectLogs(testProjectId);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(3);
      expect(result.data.every(log => log.project_id === testProjectId)).toBe(true);
    });

    it('should filter logs by level', async () => {
      const result = await databaseService.getProjectLogs(testProjectId, { level: 'error' });

      expect(result.success).toBe(true);
      expect(result.data.every(log => log.log_level === 'error')).toBe(true);
    });

    it('should paginate log results', async () => {
      const result = await databaseService.getProjectLogs(testProjectId, { 
        limit: 2, 
        offset: 0 
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Analytics Operations', () => {
    it('should create project analytics', async () => {
      const analyticsData = {
        project_id: testProjectId,
        generation_time_ms: 5000,
        file_size_bytes: 1024000,
        node_types: ['HttpRequest', 'Set'],
        complexity_score: 15
      };

      const result = await databaseService.createProjectAnalytics(analyticsData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.generation_time_ms).toBe(5000);
    });

    it('should retrieve user analytics summary', async () => {
      const result = await databaseService.getUserAnalyticsSummary(testUserId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('total_projects');
      expect(result.data).toHaveProperty('avg_generation_time_ms');
      expect(result.data.total_projects).toBeGreaterThan(0);
    });

    it('should track node usage analytics', async () => {
      const nodeUsageData = {
        project_id: testProjectId,
        user_id: testUserId,
        node_type: 'HttpRequest',
        node_count: 3,
        complexity_score: 10
      };

      const result = await databaseService.createNodeUsageAnalytics(nodeUsageData);

      expect(result.success).toBe(true);
      expect(result.data.node_type).toBe('HttpRequest');
    });
  });

  describe('File Storage Integration', () => {
    it('should upload workflow file', async () => {
      const fileContent = JSON.stringify({
        name: 'Test Workflow',
        nodes: [],
        connections: {}
      });

      const result = await databaseService.uploadWorkflowFile(
        testUserId,
        testProjectId,
        'workflow.json',
        fileContent
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('path');
      expect(result.data.path).toContain(testUserId);
      expect(result.data.path).toContain(testProjectId);
    });

    it('should download workflow file', async () => {
      const filePath = `${testUserId}/${testProjectId}/workflow.json`;
      
      const result = await databaseService.downloadFile(filePath);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('data');
      
      const parsedContent = JSON.parse(result.data.data);
      expect(parsedContent.name).toBe('Test Workflow');
    });

    it('should list user files', async () => {
      const result = await databaseService.listUserFiles(testUserId);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.some(file => file.name === 'workflow.json')).toBe(true);
    });

    it('should enforce storage security policies', async () => {
      // Try to access file with different user
      const { data: otherUser } = await supabase.auth.signUp({
        email: `storage-test-${Date.now()}@example.com`,
        password: 'testpassword123'
      });

      const filePath = `${testUserId}/${testProjectId}/workflow.json`;
      
      // Switch to other user context
      await supabase.auth.signInWithPassword({
        email: otherUser.user.email,
        password: 'testpassword123'
      });

      const result = await databaseService.downloadFile(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('access');
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should receive project updates in real-time', (done) => {
      const channel = supabase
        .channel(`test-project-${testProjectId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'projects',
            filter: `id=eq.${testProjectId}`
          },
          (payload) => {
            expect(payload.new.status).toBe('completed');
            channel.unsubscribe();
            done();
          }
        )
        .subscribe();

      // Trigger an update after subscription is established
      setTimeout(async () => {
        await databaseService.updateProjectStatus(testProjectId, 'completed');
      }, 100);
    });

    it('should receive log updates in real-time', (done) => {
      const channel = supabase
        .channel(`test-logs-${testProjectId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'generation_logs',
            filter: `project_id=eq.${testProjectId}`
          },
          (payload) => {
            expect(payload.new.message).toBe('Real-time test log');
            channel.unsubscribe();
            done();
          }
        )
        .subscribe();

      // Trigger a log insert after subscription is established
      setTimeout(async () => {
        await databaseService.createGenerationLog({
          project_id: testProjectId,
          log_level: 'info',
          message: 'Real-time test log'
        });
      }, 100);
    });
  });

  describe('Transaction Handling', () => {
    it('should handle database transactions', async () => {
      const result = await databaseService.executeTransaction(async (client) => {
        // Create project and analytics in a transaction
        const { data: project } = await client
          .from('projects')
          .insert({
            name: 'Transaction Test Project',
            user_id: testUserId,
            workflow_json: { nodes: [], connections: {} }
          })
          .select()
          .single();

        await client
          .from('project_analytics')
          .insert({
            project_id: project.id,
            generation_time_ms: 1000,
            file_size_bytes: 500,
            node_types: ['Test'],
            complexity_score: 5
          });

        return project;
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.name).toBe('Transaction Test Project');

      // Verify both records were created
      const analyticsResult = await supabase
        .from('project_analytics')
        .select('*')
        .eq('project_id', result.data.id);

      expect(analyticsResult.data.length).toBe(1);
    });

    it('should rollback failed transactions', async () => {
      const initialProjectCount = await supabase
        .from('projects')
        .select('id', { count: 'exact' })
        .eq('user_id', testUserId);

      const result = await databaseService.executeTransaction(async (client) => {
        // Create project
        const { data: project } = await client
          .from('projects')
          .insert({
            name: 'Rollback Test Project',
            user_id: testUserId,
            workflow_json: { nodes: [], connections: {} }
          })
          .select()
          .single();

        // Intentionally cause an error
        throw new Error('Transaction should rollback');
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction should rollback');

      // Verify no new project was created
      const finalProjectCount = await supabase
        .from('projects')
        .select('id', { count: 'exact' })
        .eq('user_id', testUserId);

      expect(finalProjectCount.count).toBe(initialProjectCount.count);
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large dataset queries efficiently', async () => {
      // Create multiple projects for performance testing
      const projects = Array.from({ length: 50 }, (_, i) => ({
        name: `Performance Test Project ${i}`,
        user_id: testUserId,
        workflow_json: { nodes: [], connections: {} },
        status: i % 3 === 0 ? 'completed' : 'processing'
      }));

      await supabase.from('projects').insert(projects);

      const startTime = Date.now();
      const result = await databaseService.getUserProjects(testUserId, { 
        limit: 20,
        orderBy: 'created_at',
        orderDirection: 'desc'
      });
      const queryTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(20);
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should use database indexes effectively', async () => {
      // Test query that should use index on user_id and status
      const result = await databaseService.getUserProjects(testUserId, { 
        status: 'completed' 
      });

      expect(result.success).toBe(true);
      expect(result.data.every(p => p.status === 'completed')).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid project IDs', async () => {
      const result = await databaseService.getProject('invalid-uuid', testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle database connection errors gracefully', async () => {
      // Create a client with invalid credentials
      const invalidClient = createClient('https://invalid.supabase.co', 'invalid-key');
      const invalidService = new DatabaseService(invalidClient);

      const result = await invalidService.getUserProjects(testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate required fields', async () => {
      const result = await databaseService.createProject({
        // Missing required fields
        user_id: testUserId
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should handle concurrent updates', async () => {
      // Simulate concurrent updates to the same project
      const updates = Array.from({ length: 5 }, (_, i) =>
        databaseService.updateProjectStatus(testProjectId, i % 2 === 0 ? 'processing' : 'completed')
      );

      const results = await Promise.all(updates);

      // All updates should succeed (last one wins)
      expect(results.every(r => r.success)).toBe(true);

      // Verify final state
      const finalResult = await databaseService.getProject(testProjectId, testUserId);
      expect(['processing', 'completed']).toContain(finalResult.data.status);
    });
  });
});