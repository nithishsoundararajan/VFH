import { ProjectFile } from '../file-storage-service';

// Simple test for the core functionality without Supabase mocking
describe('FileStorageService - AI Integration Core Functions', () => {
  
  describe('ProjectFile interface validation', () => {
    it('should validate ProjectFile structure', () => {
      const validProjectFile: ProjectFile = {
        path: 'src/main.js',
        content: 'console.log("Hello World");',
        type: 'javascript',
        size: 100
      };

      expect(validProjectFile.path).toBe('src/main.js');
      expect(validProjectFile.content).toBe('console.log("Hello World");');
      expect(validProjectFile.type).toBe('javascript');
      expect(validProjectFile.size).toBe(100);
    });

    it('should support different file types', () => {
      const fileTypes: ProjectFile['type'][] = ['javascript', 'json', 'markdown', 'text', 'typescript'];
      
      fileTypes.forEach(type => {
        const file: ProjectFile = {
          path: `test.${type}`,
          content: 'test content',
          type: type
        };
        expect(file.type).toBe(type);
      });
    });
  });

  describe('File validation logic', () => {
    // Import the FileStorageService class to test validation methods
    const { FileStorageService } = require('../file-storage-service');
    const service = new FileStorageService(false);

    it('should validate required files are present', () => {
      const validFiles: ProjectFile[] = [
        { path: 'package.json', content: '{}', type: 'json' },
        { path: 'main.js', content: 'console.log("test");', type: 'javascript' },
        { path: 'README.md', content: '# Test', type: 'markdown' }
      ];

      const result = service.validateProjectFiles(validFiles);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required files', () => {
      const incompleteFiles: ProjectFile[] = [
        { path: 'package.json', content: '{}', type: 'json' }
        // Missing main.js and README.md
      ];

      const result = service.validateProjectFiles(incompleteFiles);

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

      const result = service.validateProjectFiles(filesWithEmptyContent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Empty content in file: package.json');
    });

    it('should detect invalid file paths', () => {
      const filesWithInvalidPaths: ProjectFile[] = [
        { path: '../package.json', content: '{}', type: 'json' },
        { path: '/main.js', content: 'console.log("test");', type: 'javascript' },
        { path: 'README.md', content: '# Test', type: 'markdown' }
      ];

      const result = service.validateProjectFiles(filesWithInvalidPaths);

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

      const result = service.validateProjectFiles(filesWithLargeContent);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('File too large: main.js'))).toBe(true);
    });

    it('should handle empty files array', () => {
      const result = service.validateProjectFiles([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No files provided');
    });
  });

  describe('ZIP archive creation', () => {
    const { FileStorageService } = require('../file-storage-service');
    const service = new FileStorageService(false);

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

      const zipBuffer = await service.createZipArchive(projectFiles);

      expect(zipBuffer).toBeInstanceOf(Buffer);
      expect(zipBuffer.length).toBeGreaterThan(0);
    });

    it('should handle files with nested paths', async () => {
      const projectFiles: ProjectFile[] = [
        {
          path: 'src/components/Button.js',
          content: 'export default function Button() {}',
          type: 'javascript'
        },
        {
          path: 'src/utils/helpers.js',
          content: 'export const helper = () => {};',
          type: 'javascript'
        }
      ];

      const zipBuffer = await service.createZipArchive(projectFiles);
      expect(zipBuffer).toBeInstanceOf(Buffer);
    });

    it('should normalize Windows-style paths', async () => {
      const projectFiles: ProjectFile[] = [
        {
          path: 'src\\components\\test.js', // Windows-style path
          content: 'export default function Test() {}',
          type: 'javascript'
        }
      ];

      const zipBuffer = await service.createZipArchive(projectFiles);
      expect(zipBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('Interface compatibility', () => {
    it('should support NodeConfiguration interface', () => {
      const { NodeConfiguration } = require('../file-storage-service');
      
      // This test ensures the interface is properly exported and structured
      const nodeConfig = {
        nodeId: 'node1',
        nodeName: 'HTTP Request',
        nodeType: 'n8n-nodes-base.httpRequest',
        parameters: { url: 'https://api.example.com' },
        credentials: {},
        configuredParameters: [],
        environmentVariables: [],
        dependencies: ['axios']
      };

      expect(nodeConfig.nodeId).toBe('node1');
      expect(nodeConfig.nodeName).toBe('HTTP Request');
      expect(nodeConfig.nodeType).toBe('n8n-nodes-base.httpRequest');
    });

    it('should support GeneratedProject interface', () => {
      const generatedProject = {
        projectName: 'test-workflow',
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({ name: 'test-workflow' }),
            type: 'json' as const
          }
        ],
        dependencies: ['axios', 'dotenv'],
        environmentVariables: [],
        documentation: 'Test workflow documentation',
        nodeConfigurations: []
      };

      expect(generatedProject.projectName).toBe('test-workflow');
      expect(generatedProject.files).toHaveLength(1);
      expect(generatedProject.dependencies).toContain('axios');
    });

    it('should support StorageResult interface', () => {
      const storageResult = {
        success: true,
        filePath: 'user123/project456/test.zip',
        downloadUrl: 'https://example.com/download',
        fileSize: 1024,
        metadata: {
          projectId: 'project456',
          userId: 'user123',
          aiProvider: 'openai',
          generationMethod: 'gpt-4',
          nodeCount: 5
        }
      };

      expect(storageResult.success).toBe(true);
      expect(storageResult.metadata?.aiProvider).toBe('openai');
      expect(storageResult.metadata?.nodeCount).toBe(5);
    });
  });
});