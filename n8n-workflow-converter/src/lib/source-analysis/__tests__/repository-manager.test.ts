/**
 * Tests for N8nRepositoryManager
 */

import N8nRepositoryManager from '../repository-manager';
import * as fs from 'fs/promises';
import { exec } from 'child_process';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('N8nRepositoryManager', () => {
  let repoManager: N8nRepositoryManager;
  const testRepoPath = './test-n8n-source';

  beforeEach(() => {
    repoManager = new N8nRepositoryManager(testRepoPath);
    jest.clearAllMocks();
  });

  describe('initializeRepository', () => {
    it('should clone repository if it does not exist', async () => {
      // Mock repository doesn't exist
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      
      // Mock successful clone
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'Cloning into...', stderr: '' });
        }
        return {} as any;
      });

      // Mock successful info retrieval
      mockFs.readFile.mockResolvedValue(JSON.stringify({ version: '1.0.0' }));
      mockFs.readdir.mockResolvedValue([]);

      const result = await repoManager.initializeRepository();

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('nodeCount');
    });

    it('should update repository if it exists', async () => {
      // Mock repository exists
      mockFs.access.mockResolvedValue(undefined);
      
      // Mock successful update
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'abc123\ndef456\n', stderr: '' });
        }
        return {} as any;
      });

      // Mock successful info retrieval
      mockFs.readFile.mockResolvedValue(JSON.stringify({ version: '1.0.0' }));
      mockFs.readdir.mockResolvedValue([]);

      const result = await repoManager.initializeRepository();

      expect(result).toHaveProperty('version');
    });
  });

  describe('getNodeSourcePath', () => {
    it('should return correct path for existing node', async () => {
      const nodeType = 'n8n-nodes-base.httpRequest';
      
      // Mock file exists
      mockFs.access.mockResolvedValue(undefined);

      const result = await repoManager.getNodeSourcePath(nodeType);

      expect(result).toContain('HttpRequest');
      expect(result).toContain('.node.ts');
    });

    it('should return null for non-existing node', async () => {
      const nodeType = 'non-existing-node';
      
      // Mock file doesn't exist
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await repoManager.getNodeSourcePath(nodeType);

      expect(result).toBeNull();
    });
  });

  describe('nodeExists', () => {
    it('should return true for existing node', async () => {
      const nodeType = 'n8n-nodes-base.httpRequest';
      
      // Mock file exists
      mockFs.access.mockResolvedValue(undefined);

      const result = await repoManager.nodeExists(nodeType);

      expect(result).toBe(true);
    });

    it('should return false for non-existing node', async () => {
      const nodeType = 'non-existing-node';
      
      // Mock file doesn't exist
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await repoManager.nodeExists(nodeType);

      expect(result).toBe(false);
    });
  });

  describe('listAvailableNodes', () => {
    it('should return list of available nodes', async () => {
      const mockDirents = [
        { name: 'HttpRequest', isDirectory: () => true },
        { name: 'Set', isDirectory: () => true },
        { name: 'If', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ];

      mockFs.readdir.mockResolvedValue(mockDirents as any);

      const result = await repoManager.listAvailableNodes();

      expect(result).toEqual(['HttpRequest', 'If', 'Set']);
      expect(result).toHaveLength(3);
    });

    it('should return empty array on error', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await repoManager.listAvailableNodes();

      expect(result).toEqual([]);
    });
  });

  describe('getRepositoryStats', () => {
    it('should return repository statistics', async () => {
      const mockNodeDirents = [
        { name: 'HttpRequest', isDirectory: () => true },
        { name: 'Set', isDirectory: () => true }
      ];

      const mockCredentialDirents = [
        { name: 'HttpBasicAuth.credentials.ts', isFile: () => true },
        { name: 'ApiKey.credentials.ts', isFile: () => true }
      ];

      mockFs.readdir
        .mockResolvedValueOnce(mockNodeDirents as any)
        .mockResolvedValueOnce(mockCredentialDirents as any);

      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: '150M\t.', stderr: '' });
        }
        return {} as any;
      });

      // Mock repository info
      mockFs.readFile.mockResolvedValue(JSON.stringify({ version: '1.0.0' }));

      const result = await repoManager.getRepositoryStats();

      expect(result.totalNodes).toBe(2);
      expect(result.totalCredentials).toBe(2);
      expect(result.repositorySize).toBe('150M');
    });
  });
});