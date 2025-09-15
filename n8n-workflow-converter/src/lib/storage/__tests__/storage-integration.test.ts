/**
 * Storage Integration Tests
 * Tests for file upload and storage operations
 */

import { StorageService } from '../storage-service';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockStorage = {
  from: jest.fn(() => ({
    upload: jest.fn(),
    download: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
    createSignedUrl: jest.fn(),
    getPublicUrl: jest.fn(),
    move: jest.fn(),
    copy: jest.fn()
  }))
};

const mockSupabase = {
  storage: mockStorage
} as any;

describe('Storage Integration Tests', () => {
  let storageService: StorageService;
  let mockBucket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    storageService = new StorageService(mockSupabase);
    mockBucket = mockStorage.from();
  });

  describe('File Upload Operations', () => {
    it('should upload workflow file successfully', async () => {
      const fileContent = JSON.stringify({
        name: 'Test Workflow',
        nodes: [],
        connections: {}
      });

      mockBucket.upload.mockResolvedValue({
        data: {
          path: 'user-123/project-456/workflow.json',
          id: 'file-id-123',
          fullPath: 'workflow-files/user-123/project-456/workflow.json'
        },
        error: null
      });

      const result = await storageService.uploadWorkflowFile(
        'user-123',
        'project-456',
        'workflow.json',
        fileContent
      );

      expect(result.success).toBe(true);
      expect(result.data.path).toBe('user-123/project-456/workflow.json');
      expect(mockStorage.from).toHaveBeenCalledWith('workflow-files');
      expect(mockBucket.upload).toHaveBeenCalledWith(
        'user-123/project-456/workflow.json',
        fileContent,
        {
          contentType: 'application/json',
          upsert: true,
          metadata: {
            userId: 'user-123',
            projectId: 'project-456',
            uploadedAt: expect.any(String)
          }
        }
      );
    });

    it('should upload generated project files', async () => {
      const projectFiles = [
        { path: 'package.json', content: '{"name": "test"}' },
        { path: 'src/main.js', content: 'console.log("hello");' },
        { path: 'README.md', content: '# Test Project' }
      ];

      mockBucket.upload.mockResolvedValue({
        data: { path: 'user-123/project-456/generated.zip' },
        error: null
      });

      const result = await storageService.uploadGeneratedProject(
        'user-123',
        'project-456',
        projectFiles
      );

      expect(result.success).toBe(true);
      expect(mockStorage.from).toHaveBeenCalledWith('generated-projects');
      expect(mockBucket.upload).toHaveBeenCalledWith(
        'user-123/project-456/generated.zip',
        expect.any(Blob),
        expect.objectContaining({
          contentType: 'application/zip'
        })
      );
    });

    it('should handle file upload errors', async () => {
      mockBucket.upload.mockResolvedValue({
        data: null,
        error: { message: 'Storage quota exceeded' }
      });

      const result = await storageService.uploadWorkflowFile(
        'user-123',
        'project-456',
        'workflow.json',
        '{}'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage quota exceeded');
    });

    it('should validate file size limits', async () => {
      const largeContent = 'x'.repeat(50 * 1024 * 1024); // 50MB

      const result = await storageService.uploadWorkflowFile(
        'user-123',
        'project-456',
        'large-workflow.json',
        largeContent
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File size exceeds limit');
    });

    it('should validate file types', async () => {
      const result = await storageService.uploadWorkflowFile(
        'user-123',
        'project-456',
        'malicious.exe',
        'binary content'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should handle concurrent uploads', async () => {
      const uploads = Array.from({ length: 5 }, (_, i) =>
        storageService.uploadWorkflowFile(
          'user-123',
          'project-456',
          `workflow-${i}.json`,
          `{"name": "Workflow ${i}"}`
        )
      );

      mockBucket.upload.mockResolvedValue({
        data: { path: 'test-path' },
        error: null
      });

      const results = await Promise.all(uploads);

      expect(results.every(r => r.success)).toBe(true);
      expect(mockBucket.upload).toHaveBeenCalledTimes(5);
    });
  });

  describe('File Download Operations', () => {
    it('should download workflow file successfully', async () => {
      const mockBlob = new Blob(['{"name": "Test Workflow"}'], { type: 'application/json' });
      
      mockBucket.download.mockResolvedValue({
        data: mockBlob,
        error: null
      });

      const result = await storageService.downloadWorkflowFile(
        'user-123/project-456/workflow.json'
      );

      expect(result.success).toBe(true);
      expect(result.data.blob).toBe(mockBlob);
      expect(result.data.content).toBe('{"name": "Test Workflow"}');
      expect(mockBucket.download).toHaveBeenCalledWith('user-123/project-456/workflow.json');
    });

    it('should download generated project as ZIP', async () => {
      const mockZipBlob = new Blob(['zip content'], { type: 'application/zip' });
      
      mockBucket.download.mockResolvedValue({
        data: mockZipBlob,
        error: null
      });

      const result = await storageService.downloadGeneratedProject(
        'user-123/project-456/generated.zip'
      );

      expect(result.success).toBe(true);
      expect(result.data.blob).toBe(mockZipBlob);
      expect(result.data.filename).toBe('generated.zip');
      expect(mockStorage.from).toHaveBeenCalledWith('generated-projects');
    });

    it('should handle file not found errors', async () => {
      mockBucket.download.mockResolvedValue({
        data: null,
        error: { message: 'Object not found' }
      });

      const result = await storageService.downloadWorkflowFile('nonexistent/file.json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Object not found');
    });

    it('should enforce access permissions', async () => {
      mockBucket.download.mockResolvedValue({
        data: null,
        error: { message: 'Access denied' }
      });

      const result = await storageService.downloadWorkflowFile(
        'other-user/project-456/workflow.json'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
    });
  });

  describe('File Listing Operations', () => {
    it('should list user files successfully', async () => {
      const mockFiles = [
        {
          name: 'workflow.json',
          id: 'file-1',
          updated_at: '2023-12-01T10:00:00Z',
          created_at: '2023-12-01T09:00:00Z',
          last_accessed_at: '2023-12-01T11:00:00Z',
          metadata: {
            size: 1024,
            mimetype: 'application/json'
          }
        },
        {
          name: 'generated.zip',
          id: 'file-2',
          updated_at: '2023-12-01T10:30:00Z',
          created_at: '2023-12-01T10:30:00Z',
          last_accessed_at: null,
          metadata: {
            size: 50000,
            mimetype: 'application/zip'
          }
        }
      ];

      mockBucket.list.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      const result = await storageService.listUserFiles('user-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('workflow.json');
      expect(result.data[0].size).toBe(1024);
      expect(mockBucket.list).toHaveBeenCalledWith('user-123', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    });

    it('should filter files by type', async () => {
      const result = await storageService.listUserFiles('user-123', {
        fileType: 'json'
      });

      expect(mockBucket.list).toHaveBeenCalledWith('user-123', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    });

    it('should paginate file listings', async () => {
      const result = await storageService.listUserFiles('user-123', {
        limit: 20,
        offset: 40
      });

      expect(mockBucket.list).toHaveBeenCalledWith('user-123', {
        limit: 20,
        offset: 40,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    });

    it('should search files by name', async () => {
      const result = await storageService.listUserFiles('user-123', {
        search: 'workflow'
      });

      expect(mockBucket.list).toHaveBeenCalledWith('user-123', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
        search: 'workflow'
      });
    });
  });

  describe('File Management Operations', () => {
    it('should delete file successfully', async () => {
      mockBucket.remove.mockResolvedValue({
        data: [{ name: 'workflow.json' }],
        error: null
      });

      const result = await storageService.deleteFile(
        'workflow-files',
        'user-123/project-456/workflow.json'
      );

      expect(result.success).toBe(true);
      expect(mockBucket.remove).toHaveBeenCalledWith(['user-123/project-456/workflow.json']);
    });

    it('should move file to different location', async () => {
      mockBucket.move.mockResolvedValue({
        data: { message: 'Successfully moved' },
        error: null
      });

      const result = await storageService.moveFile(
        'workflow-files',
        'user-123/project-456/workflow.json',
        'user-123/project-456/archived/workflow.json'
      );

      expect(result.success).toBe(true);
      expect(mockBucket.move).toHaveBeenCalledWith(
        'user-123/project-456/workflow.json',
        'user-123/project-456/archived/workflow.json'
      );
    });

    it('should copy file to new location', async () => {
      mockBucket.copy.mockResolvedValue({
        data: { path: 'user-123/project-456/workflow-copy.json' },
        error: null
      });

      const result = await storageService.copyFile(
        'workflow-files',
        'user-123/project-456/workflow.json',
        'user-123/project-456/workflow-copy.json'
      );

      expect(result.success).toBe(true);
      expect(mockBucket.copy).toHaveBeenCalledWith(
        'user-123/project-456/workflow.json',
        'user-123/project-456/workflow-copy.json'
      );
    });

    it('should create signed URL for secure access', async () => {
      mockBucket.createSignedUrl.mockResolvedValue({
        data: {
          signedUrl: 'https://storage.supabase.co/signed-url-123'
        },
        error: null
      });

      const result = await storageService.createSignedUrl(
        'workflow-files',
        'user-123/project-456/workflow.json',
        3600 // 1 hour
      );

      expect(result.success).toBe(true);
      expect(result.data.url).toBe('https://storage.supabase.co/signed-url-123');
      expect(mockBucket.createSignedUrl).toHaveBeenCalledWith(
        'user-123/project-456/workflow.json',
        3600
      );
    });

    it('should get public URL for public files', async () => {
      mockBucket.getPublicUrl.mockReturnValue({
        data: {
          publicUrl: 'https://storage.supabase.co/public-url-123'
        }
      });

      const result = await storageService.getPublicUrl(
        'public-files',
        'templates/basic-workflow.json'
      );

      expect(result.success).toBe(true);
      expect(result.data.url).toBe('https://storage.supabase.co/public-url-123');
    });
  });

  describe('Batch Operations', () => {
    it('should upload multiple files in batch', async () => {
      const files = [
        { path: 'file1.json', content: '{"name": "File 1"}' },
        { path: 'file2.json', content: '{"name": "File 2"}' },
        { path: 'file3.json', content: '{"name": "File 3"}' }
      ];

      mockBucket.upload.mockResolvedValue({
        data: { path: 'test-path' },
        error: null
      });

      const result = await storageService.batchUpload('user-123', 'project-456', files);

      expect(result.success).toBe(true);
      expect(result.data.uploaded).toBe(3);
      expect(result.data.failed).toBe(0);
      expect(mockBucket.upload).toHaveBeenCalledTimes(3);
    });

    it('should handle partial batch upload failures', async () => {
      const files = [
        { path: 'file1.json', content: '{"name": "File 1"}' },
        { path: 'file2.json', content: '{"name": "File 2"}' }
      ];

      mockBucket.upload
        .mockResolvedValueOnce({
          data: { path: 'file1.json' },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Upload failed' }
        });

      const result = await storageService.batchUpload('user-123', 'project-456', files);

      expect(result.success).toBe(true);
      expect(result.data.uploaded).toBe(1);
      expect(result.data.failed).toBe(1);
      expect(result.data.errors).toHaveLength(1);
    });

    it('should delete multiple files in batch', async () => {
      const filePaths = [
        'user-123/project-456/file1.json',
        'user-123/project-456/file2.json',
        'user-123/project-456/file3.json'
      ];

      mockBucket.remove.mockResolvedValue({
        data: filePaths.map(path => ({ name: path })),
        error: null
      });

      const result = await storageService.batchDelete('workflow-files', filePaths);

      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(3);
      expect(mockBucket.remove).toHaveBeenCalledWith(filePaths);
    });
  });

  describe('Storage Analytics and Monitoring', () => {
    it('should get storage usage statistics', async () => {
      mockBucket.list.mockResolvedValue({
        data: [
          { metadata: { size: 1024 } },
          { metadata: { size: 2048 } },
          { metadata: { size: 512 } }
        ],
        error: null
      });

      const result = await storageService.getStorageUsage('user-123');

      expect(result.success).toBe(true);
      expect(result.data.totalFiles).toBe(3);
      expect(result.data.totalSize).toBe(3584);
      expect(result.data.averageFileSize).toBe(1194.67);
    });

    it('should track file access patterns', async () => {
      const result = await storageService.trackFileAccess(
        'user-123',
        'project-456/workflow.json',
        'download'
      );

      expect(result.success).toBe(true);
      // This would typically update analytics in the database
    });

    it('should generate storage reports', async () => {
      const result = await storageService.generateStorageReport('user-123', {
        startDate: '2023-11-01',
        endDate: '2023-12-01',
        includeDetails: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('fileBreakdown');
      expect(result.data).toHaveProperty('usageTrends');
    });
  });

  describe('Security and Compliance', () => {
    it('should scan uploaded files for security threats', async () => {
      const suspiciousContent = '<script>alert("xss")</script>';

      const result = await storageService.uploadWorkflowFile(
        'user-123',
        'project-456',
        'suspicious.json',
        suspiciousContent
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security threat detected');
    });

    it('should enforce file retention policies', async () => {
      const result = await storageService.enforceRetentionPolicy('user-123', {
        maxAge: 90, // days
        maxFiles: 100
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('filesRemoved');
      expect(result.data).toHaveProperty('spaceFreed');
    });

    it('should audit file operations', async () => {
      const result = await storageService.auditFileOperations('user-123', {
        startDate: '2023-11-01',
        endDate: '2023-12-01',
        operations: ['upload', 'download', 'delete']
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('operations');
      expect(Array.isArray(result.data.operations)).toBe(true);
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large file uploads efficiently', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB

      mockBucket.upload.mockResolvedValue({
        data: { path: 'large-file.json' },
        error: null
      });

      const startTime = Date.now();
      const result = await storageService.uploadWorkflowFile(
        'user-123',
        'project-456',
        'large-workflow.json',
        largeContent
      );
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should use compression for large files', async () => {
      const largeContent = JSON.stringify({
        name: 'Large Workflow',
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `node-${i}`,
          data: 'x'.repeat(1000)
        }))
      });

      mockBucket.upload.mockResolvedValue({
        data: { path: 'compressed-file.json' },
        error: null
      });

      const result = await storageService.uploadWorkflowFile(
        'user-123',
        'project-456',
        'large-workflow.json',
        largeContent,
        { compress: true }
      );

      expect(result.success).toBe(true);
      expect(mockBucket.upload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          contentEncoding: 'gzip'
        })
      );
    });

    it('should cache frequently accessed files', async () => {
      const filePath = 'user-123/project-456/workflow.json';

      // First access
      mockBucket.download.mockResolvedValue({
        data: new Blob(['{"cached": true}'], { type: 'application/json' }),
        error: null
      });

      const result1 = await storageService.downloadWorkflowFile(filePath);
      expect(result1.success).toBe(true);

      // Second access should use cache
      const result2 = await storageService.downloadWorkflowFile(filePath);
      expect(result2.success).toBe(true);

      // Should only call download once due to caching
      expect(mockBucket.download).toHaveBeenCalledTimes(1);
    });
  });
});