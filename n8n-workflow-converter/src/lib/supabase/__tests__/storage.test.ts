import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { StorageManager } from '../storage';
import { validateFile, generateFilePath, parseFilePath } from '../storage-config';

// Mock Supabase client
jest.mock('../client', () => ({
  createClient: () => ({
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        download: jest.fn(),
        createSignedUrl: jest.fn(),
        remove: jest.fn(),
        list: jest.fn()
      }))
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          or: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }))
  })
}));

describe('StorageManager', () => {
  let storageManager: StorageManager;
  const mockUserId = 'user-123';
  const mockProjectId = 'project-456';

  beforeEach(() => {
    storageManager = new StorageManager();
  });

  describe('File validation', () => {
    it('should validate JSON files for workflow bucket', () => {
      const jsonFile = new File(['{"test": true}'], 'workflow.json', {
        type: 'application/json'
      });

      const result = validateFile(jsonFile, 'workflowFiles');
      expect(result.valid).toBe(true);
    });

    it('should reject files that are too large', () => {
      // Create a mock file that exceeds the limit
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.json', {
        type: 'application/json'
      });

      const result = validateFile(largeFile, 'workflowFiles');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds limit');
    });

    it('should reject invalid file types', () => {
      const invalidFile = new File(['test'], 'test.exe', {
        type: 'application/x-msdownload'
      });

      const result = validateFile(invalidFile, 'workflowFiles');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should validate ZIP files for generated projects bucket', () => {
      const zipFile = new File(['zip content'], 'project.zip', {
        type: 'application/zip'
      });

      const result = validateFile(zipFile, 'generatedProjects');
      expect(result.valid).toBe(true);
    });
  });

  describe('File path utilities', () => {
    it('should generate correct file paths', () => {
      const workflowPath = generateFilePath('workflowFiles', mockUserId, mockProjectId);
      expect(workflowPath).toBe(`${mockUserId}/${mockProjectId}/workflow.json`);

      const projectPath = generateFilePath('generatedProjects', mockUserId, mockProjectId);
      expect(projectPath).toBe(`${mockUserId}/${mockProjectId}/project.zip`);
    });

    it('should parse file paths correctly', () => {
      const filePath = `${mockUserId}/${mockProjectId}/workflow.json`;
      const parsed = parseFilePath(filePath);

      expect(parsed.valid).toBe(true);
      expect(parsed.userId).toBe(mockUserId);
      expect(parsed.projectId).toBe(mockProjectId);
      expect(parsed.fileName).toBe('workflow.json');
    });

    it('should handle invalid file paths', () => {
      const invalidPath = 'invalid/path';
      const parsed = parseFilePath(invalidPath);

      expect(parsed.valid).toBe(false);
    });
  });

  describe('Upload operations', () => {
    it('should handle successful workflow file upload', async () => {
      const mockFile = new File(['{"test": true}'], 'workflow.json', {
        type: 'application/json'
      });

      // Mock successful upload
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null
      });

      (storageManager as any).supabase.storage.from = jest.fn(() => ({
        upload: mockUpload
      }));

      const result = await storageManager.uploadWorkflowFile(
        mockUserId,
        mockProjectId,
        mockFile
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('test-path');
    });

    it('should handle upload errors', async () => {
      const mockFile = new File(['{"test": true}'], 'workflow.json', {
        type: 'application/json'
      });

      // Mock upload error
      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Upload failed')
      });

      (storageManager as any).supabase.storage.from = jest.fn(() => ({
        upload: mockUpload
      }));

      const result = await storageManager.uploadWorkflowFile(
        mockUserId,
        mockProjectId,
        mockFile
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
    });
  });

  describe('Download operations', () => {
    it('should handle successful file download', async () => {
      const mockBlob = new Blob(['test content']);

      // Mock successful download
      const mockDownload = jest.fn().mockResolvedValue({
        data: mockBlob,
        error: null
      });

      (storageManager as any).supabase.storage.from = jest.fn(() => ({
        download: mockDownload
      }));

      const result = await storageManager.downloadWorkflowFile(
        mockUserId,
        mockProjectId
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockBlob);
    });

    it('should handle download errors', async () => {
      // Mock download error
      const mockDownload = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Download failed')
      });

      (storageManager as any).supabase.storage.from = jest.fn(() => ({
        download: mockDownload
      }));

      const result = await storageManager.downloadWorkflowFile(
        mockUserId,
        mockProjectId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Download failed');
    });
  });

  describe('Access control', () => {
    it('should allow access to own files', async () => {
      const filePath = `${mockUserId}/${mockProjectId}/workflow.json`;

      const result = await storageManager.checkFileAccess(
        'workflow-files',
        filePath,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('owner');
    });

    it('should check shared project access', async () => {
      const otherUserId = 'other-user';
      const filePath = `${otherUserId}/${mockProjectId}/workflow.json`;

      // Mock shared project query
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          or: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { id: 'share-123', permissions: 'read' },
              error: null
            })
          }))
        }))
      }));

      (storageManager as any).supabase.from = jest.fn(() => ({
        select: mockSelect
      }));

      const result = await storageManager.checkFileAccess(
        'workflow-files',
        filePath,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('shared');
    });
  });
});