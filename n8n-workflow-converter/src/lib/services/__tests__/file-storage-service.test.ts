import { FileStorageService } from '../file-storage-service';

// Mock Supabase
const mockSupabase = {
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      download: jest.fn(),
      createSignedUrl: jest.fn(),
      remove: jest.fn(),
      list: jest.fn()
    }))
  },
  auth: {
    getUser: jest.fn()
  }
};

// Mock the Supabase client creation
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(mockSupabase)
}));

describe('FileStorageService', () => {
  let fileStorage: FileStorageService;
  let mockFile: File;

  beforeEach(() => {
    fileStorage = new FileStorageService(false);
    mockFile = new File(['test content'], 'test.json', { type: 'application/json' });
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      const mockUploadResponse = {
        data: { path: 'user123/project456/test.json' },
        error: null
      };

      const mockListResponse = {
        data: [{
          id: 'file123',
          name: 'test.json',
          metadata: { size: 12, mimetype: 'application/json' },
          updated_at: '2023-01-01T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z'
        }],
        error: null
      };

      mockSupabase.storage.from().upload.mockResolvedValue(mockUploadResponse);
      mockSupabase.storage.from().list.mockResolvedValue(mockListResponse);

      const result = await fileStorage.uploadFile({
        bucket: 'workflow-files',
        path: 'user123/project456/test.json',
        file: mockFile
      });

      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({
        name: 'test.json',
        size: 12,
        contentType: 'application/json',
        bucket: 'workflow-files',
        path: 'user123/project456/test.json'
      });
    });

    it('should reject files that exceed size limit', async () => {
      const largeFile = new File(['x'.repeat(100 * 1024 * 1024)], 'large.json', { 
        type: 'application/json' 
      });

      const result = await fileStorage.uploadFile({
        bucket: 'workflow-files',
        path: 'user123/large.json',
        file: largeFile
      });

      expect(result.error).toContain('File size exceeds limit');
      expect(result.data).toBeNull();
    });

    it('should reject files with invalid MIME types', async () => {
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-executable' });

      const result = await fileStorage.uploadFile({
        bucket: 'workflow-files',
        path: 'user123/test.exe',
        file: invalidFile
      });

      expect(result.error).toContain('File type application/x-executable is not allowed');
      expect(result.data).toBeNull();
    });

    it('should handle upload errors', async () => {
      const mockError = { message: 'Upload failed' };
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await fileStorage.uploadFile({
        bucket: 'workflow-files',
        path: 'user123/test.json',
        file: mockFile
      });

      expect(result.error).toBe('Upload failed');
      expect(result.data).toBeNull();
    });
  });

  describe('downloadFile', () => {
    it('should download a file successfully', async () => {
      const mockBlob = new Blob(['file content'], { type: 'application/json' });
      mockSupabase.storage.from().download.mockResolvedValue({
        data: mockBlob,
        error: null
      });

      const result = await fileStorage.downloadFile('workflow-files', 'user123/test.json');

      expect(result.error).toBeNull();
      expect(result.data).toBe(mockBlob);
    });

    it('should handle download errors', async () => {
      const mockError = { message: 'File not found' };
      mockSupabase.storage.from().download.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await fileStorage.downloadFile('workflow-files', 'user123/nonexistent.json');

      expect(result.error).toBe('File not found');
      expect(result.data).toBeNull();
    });
  });

  describe('getSignedUrl', () => {
    it('should generate a signed URL successfully', async () => {
      const mockSignedUrl = 'https://example.com/signed-url';
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null
      });

      const result = await fileStorage.getSignedUrl('workflow-files', 'user123/test.json', 3600);

      expect(result.error).toBeNull();
      expect(result.data).toBe(mockSignedUrl);
    });

    it('should handle signed URL generation errors', async () => {
      const mockError = { message: 'Access denied' };
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await fileStorage.getSignedUrl('workflow-files', 'user123/test.json');

      expect(result.error).toBe('Access denied');
      expect(result.data).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      mockSupabase.storage.from().remove.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await fileStorage.deleteFile('workflow-files', 'user123/test.json');

      expect(result.error).toBeNull();
    });

    it('should handle deletion errors', async () => {
      const mockError = { message: 'Deletion failed' };
      mockSupabase.storage.from().remove.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await fileStorage.deleteFile('workflow-files', 'user123/test.json');

      expect(result.error).toBe('Deletion failed');
    });
  });

  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const mockFiles = [
        {
          id: 'file1',
          name: 'test1.json',
          metadata: { size: 100, mimetype: 'application/json' },
          updated_at: '2023-01-01T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z'
        },
        {
          id: 'file2',
          name: 'test2.json',
          metadata: { size: 200, mimetype: 'application/json' },
          updated_at: '2023-01-02T00:00:00Z',
          created_at: '2023-01-02T00:00:00Z'
        }
      ];

      mockSupabase.storage.from().list.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      const result = await fileStorage.listFiles('workflow-files', 'user123');

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
      expect(result.data![0]).toMatchObject({
        name: 'test1.json',
        size: 100,
        contentType: 'application/json'
      });
    });

    it('should handle listing errors', async () => {
      const mockError = { message: 'Access denied' };
      mockSupabase.storage.from().list.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await fileStorage.listFiles('workflow-files', 'user123');

      expect(result.error).toBe('Access denied');
      expect(result.data).toBeNull();
    });
  });

  describe('compressFile', () => {
    it('should compress JSON files by minifying', async () => {
      const jsonContent = JSON.stringify({ key: 'value', nested: { data: 'test' } }, null, 2);
      const jsonFile = new File([jsonContent], 'test.json', { type: 'application/json' });

      const compressed = await fileStorage.compressFile(jsonFile);

      expect(compressed.size).toBeLessThan(jsonFile.size);
      expect(compressed.name).toBe('test.json');
      expect(compressed.type).toBe('application/json');
    });

    it('should return original file for non-JSON files', async () => {
      const textFile = new File(['plain text'], 'test.txt', { type: 'text/plain' });

      const result = await fileStorage.compressFile(textFile);

      expect(result).toBe(textFile);
    });

    it('should return original file if JSON parsing fails', async () => {
      const invalidJsonFile = new File(['invalid json {'], 'test.json', { type: 'application/json' });

      const result = await fileStorage.compressFile(invalidJsonFile);

      expect(result).toBe(invalidJsonFile);
    });
  });

  describe('bucket configuration', () => {
    it('should return correct max file size for different buckets', () => {
      expect(fileStorage['getMaxFileSize']('workflow-files')).toBe(50 * 1024 * 1024);
      expect(fileStorage['getMaxFileSize']('generated-projects')).toBe(100 * 1024 * 1024);
      expect(fileStorage['getMaxFileSize']('user-uploads')).toBe(50 * 1024 * 1024);
      expect(fileStorage['getMaxFileSize']('unknown')).toBe(10 * 1024 * 1024);
    });

    it('should return correct allowed MIME types for different buckets', () => {
      expect(fileStorage['getAllowedMimeTypes']('workflow-files')).toContain('application/json');
      expect(fileStorage['getAllowedMimeTypes']('generated-projects')).toContain('application/zip');
      expect(fileStorage['getAllowedMimeTypes']('user-uploads')).toContain('text/plain');
    });
  });
});