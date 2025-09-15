// Mock the Supabase imports
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn(),
      createSignedUrl: jest.fn(),
      list: jest.fn(),
      remove: jest.fn()
    }
  })
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn(),
      createSignedUrl: jest.fn(),
      list: jest.fn(),
      remove: jest.fn()
    }
  })
}));

import { FileStorageService, ProjectFile, GeneratedProject, NodeConfiguration } from '../file-storage-service';

describe('FileStorageService - AI Integration', () => {
  let fileStorageService: FileStorageService;
  let mockSupabaseClient: any;
  
  beforeEach(() => {
    mockSupabaseClient = {
      storage: {
        from: jest.fn().mockReturnThis(),
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
        list: jest.fn(),
        remove: jest.fn()
      }
    };
    
    fileStorageService = new FileStorageService(true); // Server-side
    jest.clearAllMocks();
  });

  describe('createZipArchive', () => {
    it('should create a ZIP archive from project files', async () => {
      const projectFiles: ProjectFile[] = [
        {
          path: 'package.json',
          content: JSON.stringify({ name: 'test-project', version: '1.0.0' }),
          type: 'json'
        },
        {
          path: 'main.js',
          content: 'console.log("Hello World");',
          type: 'javascript'
        },
        {
          path: 'README.md',
          content: '# Test Project\n\nThis is a test project.',
          type: 'markdown'
        }
      ];

      const zipBuffer = await fileStorageService.createZipArchive(projectFiles);

      expect(zipBuffer).toBeInstanceOf(Buffer);
      expect(zipBuffer.length).toBeGreaterThan(0);
    });

    it('should handle empty files array', async () => {
      await expect(fileStorageService.createZipArchive([])).rejects.toThrow();
    });

    it('should normalize file paths', async () => {
      const projectFiles: ProjectFile[] = [
        {
          path: 'src\\components\\test.js', // Windows-style path
          content: 'export default function Test() {}',
          type: 'javascript'
        }
      ];

      const zipBuffer = await fileStorageService.createZipArchive(projectFiles);
      expect(zipBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('uploadToSupabase', () => {
    it('should upload ZIP buffer to Supabase Storage successfully', async () => {
      const mockUploadResponse = {
        data: { path: 'user123/project456/test-project-2024-01-01.zip' },
        error: null
      };
      
      const mockSignedUrlResponse = {
        data: { signedUrl: 'https://supabase.co/storage/signed-url' },
        error: null
      };

      mockSupabaseClient.storage.upload.mockResolvedValue(mockUploadResponse);
      mockSupabaseClient.storage.createSignedUrl.mockResolvedValue(mockSignedUrlResponse);

      const zipBuffer = Buffer.from('test zip content');
      const result = await fileStorageService.uploadToSupabase(
        'project456',
        'user123',
        zipBuffer,
        'test-project'
      );

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('user123/project456/test-project-2024-01-01.zip');
      expect(result.downloadUrl).toBe('https://supabase.co/storage/signed-url');
      expect(result.fileSize).toBe(zipBuffer.length);
    });

    it('should handle upload errors', async () => {
      const mockUploadResponse = {
        data: null,
        error: { message: 'Upload failed' }
      };

      mockSupabaseClient.storage.upload.mockResolvedValue(mockUploadResponse);

      const zipBuffer = Buffer.from('test zip content');
      const result = await fileStorageService.uploadToSupabase(
        'project456',
        'user123',
        zipBuffer,
        'test-project'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
    });

    it('should reject files that exceed size limit', async () => {
      // Create a buffer larger than the limit (100MB)
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024);
      
      const result = await fileStorageService.uploadToSupabase(
        'project456',
        'user123',
        largeBuffer,
        'test-project'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds limit');
    });
  });

  describe('storeProjectFiles', () => {
    it('should store complete generated project successfully', async () => {
      const nodeConfig: NodeConfiguration = {
        nodeId: 'node1',
        nodeName: 'HTTP Request',
        nodeType: 'n8n-nodes-base.httpRequest',
        parameters: { url: 'https://api.example.com' },
        credentials: {},
        configuredParameters: [],
        environmentVariables: [],
        dependencies: ['axios']
      };

      const generatedProject: GeneratedProject = {
        projectName: 'test-workflow',
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({ name: 'test-workflow' }),
            type: 'json'
          },
          {
            path: 'main.js',
            content: 'console.log("Workflow started");',
            type: 'javascript'
          },
          {
            path: 'README.md',
            content: '# Test Workflow',
            type: 'markdown'
          }
        ],
        dependencies: ['axios', 'dotenv'],
        environmentVariables: [],
        documentation: 'Test workflow documentation',
        nodeConfigurations: [nodeConfig]
      };

      // Mock successful upload
      mockSupabaseClient.storage.upload.mockResolvedValue({
        data: { path: 'user123/project456/test-workflow-2024-01-01.zip' },
        error: null
      });
      
      mockSupabaseClient.storage.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://supabase.co/storage/signed-url' },
        error: null
      });

      const progressCalls: any[] = [];
      const result = await fileStorageService.storeProjectFiles(
        'project456',
        'user123',
        generatedProject,
        {
          aiProvider: 'openai',
          generationMethod: 'gpt-4',
          onProgress: (progress) => progressCalls.push(progress)
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.aiProvider).toBe('openai');
      expect(result.metadata?.generationMethod).toBe('gpt-4');
      expect(result.metadata?.nodeCount).toBe(1);
      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1].stage).toBe('complete');
    });

    it('should handle validation errors', async () => {
      const generatedProject: GeneratedProject = {
        projectName: 'test-workflow',
        files: [], // Empty files array
        dependencies: [],
        environmentVariables: [],
        documentation: '',
        nodeConfigurations: []
      };

      const result = await fileStorageService.storeProjectFiles(
        'project456',
        'user123',
        generatedProject
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No project files to store');
    });

    it('should cleanup on failure', async () => {
      const generatedProject: GeneratedProject = {
        projectName: 'test-workflow',
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({ name: 'test-workflow' }),
            type: 'json'
          }
        ],
        dependencies: [],
        environmentVariables: [],
        documentation: '',
        nodeConfigurations: []
      };

      // Mock upload failure
      mockSupabaseClient.storage.upload.mockResolvedValue({
        data: null,
        error: { message: 'Storage quota exceeded' }
      });

      // Mock cleanup success
      mockSupabaseClient.storage.list.mockResolvedValue({
        data: [{ name: 'test-file.zip' }],
        error: null
      });
      
      mockSupabaseClient.storage.remove.mockResolvedValue({
        error: null
      });

      const result = await fileStorageService.storeProjectFiles(
        'project456',
        'user123',
        generatedProject
      );

      expect(result.success).toBe(false);
      expect(mockSupabaseClient.storage.remove).toHaveBeenCalled();
    });
  });

  describe('getProjectDownloadUrl', () => {
    it('should get download URL for existing project', async () => {
      const mockFiles = [
        {
          name: 'test-project-2024-01-01.zip',
          created_at: '2024-01-01T12:00:00Z'
        },
        {
          name: 'test-project-2024-01-02.zip',
          created_at: '2024-01-02T12:00:00Z'
        }
      ];

      mockSupabaseClient.storage.list.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      mockSupabaseClient.storage.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://supabase.co/storage/signed-url' },
        error: null
      });

      const result = await fileStorageService.getProjectDownloadUrl('project456', 'user123');

      expect(result.data).toBe('https://supabase.co/storage/signed-url');
      expect(result.error).toBeNull();
      
      // Should use the most recent file
      expect(mockSupabaseClient.storage.createSignedUrl).toHaveBeenCalledWith(
        'user123/project456/test-project-2024-01-02.zip',
        3600
      );
    });

    it('should handle missing project files', async () => {
      mockSupabaseClient.storage.list.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await fileStorageService.getProjectDownloadUrl('project456', 'user123');

      expect(result.data).toBeNull();
      expect(result.error).toBe('No project files found');
    });
  });

  describe('cleanupFailedUpload', () => {
    it('should clean up all files in project directory', async () => {
      const mockFiles = [
        { name: 'file1.zip' },
        { name: 'file2.zip' }
      ];

      mockSupabaseClient.storage.list.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      mockSupabaseClient.storage.remove.mockResolvedValue({
        error: null
      });

      const result = await fileStorageService.cleanupFailedUpload('project456', 'user123');

      expect(result.error).toBeNull();
      expect(mockSupabaseClient.storage.remove).toHaveBeenCalledWith([
        'user123/project456/file1.zip',
        'user123/project456/file2.zip'
      ]);
    });

    it('should handle cleanup when no files exist', async () => {
      mockSupabaseClient.storage.list.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await fileStorageService.cleanupFailedUpload('project456', 'user123');

      expect(result.error).toBeNull();
      expect(mockSupabaseClient.storage.remove).not.toHaveBeenCalled();
    });
  });

  describe('validateProjectFiles', () => {
    it('should validate required files are present', () => {
      const validFiles: ProjectFile[] = [
        { path: 'package.json', content: '{}', type: 'json' },
        { path: 'main.js', content: 'console.log("test");', type: 'javascript' },
        { path: 'README.md', content: '# Test', type: 'markdown' }
      ];

      const result = fileStorageService.validateProjectFiles(validFiles);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required files', () => {
      const incompleteFiles: ProjectFile[] = [
        { path: 'package.json', content: '{}', type: 'json' }
        // Missing main.js and README.md
      ];

      const result = fileStorageService.validateProjectFiles(incompleteFiles);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required file: main.js');
      expect(result.errors).toContain('Missing required file: README.md');
    });

    it('should detect empty file content', () => {
      const filesWithEmptyContent: ProjectFile[] = [
        { path: 'package.json', content: '', type: 'json' },
        { path: 'main.js', content: 'console.log("test");', type: 'javascript' },
        { path: 'README.md', content: '# Test', type: 'markdown' }
      ];

      const result = fileStorageService.validateProjectFiles(filesWithEmptyContent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Empty content in file: package.json');
    });

    it('should detect invalid file paths', () => {
      const filesWithInvalidPaths: ProjectFile[] = [
        { path: '../package.json', content: '{}', type: 'json' },
        { path: '/main.js', content: 'console.log("test");', type: 'javascript' },
        { path: 'README.md', content: '# Test', type: 'markdown' }
      ];

      const result = fileStorageService.validateProjectFiles(filesWithInvalidPaths);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid file path: ../package.json');
      expect(result.errors).toContain('Invalid file path: /main.js');
    });

    it('should detect files that are too large', () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const filesWithLargeContent: ProjectFile[] = [
        { path: 'package.json', content: '{}', type: 'json' },
        { path: 'main.js', content: largeContent, type: 'javascript' },
        { path: 'README.md', content: '# Test', type: 'markdown' }
      ];

      const result = fileStorageService.validateProjectFiles(filesWithLargeContent);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('File too large: main.js'))).toBe(true);
    });
  });
});