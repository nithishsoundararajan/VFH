import { AIProviderService } from '../ai-provider-service';
import { AIProvider, AIProviderError } from '@/lib/ai-providers';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null }))
    })),
    insert: jest.fn()
  })),
  functions: {
    invoke: jest.fn()
  }
};

// Create a proper mock chain
const createMockChain = () => {
  const mockEq = jest.fn(() => Promise.resolve({ error: null }));
  const mockUpdate = jest.fn(() => ({ eq: mockEq }));
  const mockSingle = jest.fn();
  const mockEqSelect = jest.fn(() => ({ single: mockSingle }));
  const mockSelect = jest.fn(() => ({ eq: mockEqSelect }));
  const mockFrom = jest.fn(() => ({ 
    select: mockSelect,
    update: mockUpdate
  }));
  
  return {
    from: mockFrom,
    functions: { invoke: jest.fn() },
    mockSingle,
    mockUpdate,
    mockEq
  };
};

// Mock the Supabase client creation
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase
}));

describe('AIProviderService', () => {
  let service: AIProviderService;
  let mockChain: ReturnType<typeof createMockChain>;

  beforeEach(() => {
    mockChain = createMockChain();
    (mockSupabase.from as jest.Mock).mockImplementation(mockChain.from);
    (mockSupabase.functions.invoke as jest.Mock).mockImplementation(mockChain.functions.invoke);
    service = new AIProviderService();
    jest.clearAllMocks();
  });

  describe('getUserSettings', () => {
    it('should return user AI provider settings', async () => {
      const mockData = {
        ai_provider: 'openai',
        ai_api_key_valid: true
      };

      mockChain.mockSingle.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await service.getUserSettings('user-123');

      expect(result).toEqual({
        provider: 'openai',
        isValid: true
      });
    });

    it('should return null when no settings exist', async () => {
      mockChain.mockSingle.mockResolvedValue({
        data: { ai_provider: null },
        error: null
      });

      const result = await service.getUserSettings('user-123');

      expect(result).toBeNull();
    });

    it('should throw AIProviderError on database error', async () => {
      mockChain.mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(service.getUserSettings('user-123'))
        .rejects.toThrow(AIProviderError);
    });
  });

  describe('updateUserSettings', () => {
    it('should update provider settings with API key', async () => {
      mockChain.functions.invoke.mockResolvedValue({
        data: { encryptedKey: 'encrypted-key-123' },
        error: null
      });

      mockChain.mockEq.mockResolvedValue({
        error: null
      });

      await service.updateUserSettings('user-123', 'openai', 'sk-test-key');

      expect(mockChain.functions.invoke).toHaveBeenCalledWith('encrypt-api-key', {
        body: { apiKey: 'sk-test-key', userId: 'user-123' }
      });

      expect(mockChain.mockUpdate).toHaveBeenCalled();
    });

    it('should update to system default without API key', async () => {
      mockChain.mockEq.mockResolvedValue({
        error: null
      });

      await service.updateUserSettings('user-123', 'system_default');

      expect(mockChain.functions.invoke).not.toHaveBeenCalled();
      expect(mockChain.mockUpdate).toHaveBeenCalled();
    });

    it('should throw error when encryption fails', async () => {
      mockChain.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Encryption failed' }
      });

      await expect(service.updateUserSettings('user-123', 'openai', 'sk-test-key'))
        .rejects.toThrow(AIProviderError);
    });
  });

  describe('testApiKey', () => {
    // Mock fetch globally
    global.fetch = jest.fn();

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should return true for valid OpenAI key', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        ok: true
      });

      const result = await service.testApiKey('openai', 'sk-valid-key');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-valid-key'
          })
        })
      );
    });

    it('should return true for valid Anthropic key', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        ok: true
      });

      const result = await service.testApiKey('anthropic', 'sk-ant-valid-key');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'sk-ant-valid-key'
          })
        })
      );
    });

    it('should return false for invalid key', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 403,
        ok: false
      });

      const result = await service.testApiKey('openai', 'sk-invalid-key');

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.testApiKey('openai', 'sk-test-key');

      expect(result).toBe(false);
    });

    it('should return true for system_default provider', async () => {
      const result = await service.testApiKey('system_default', '');

      expect(result).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('clearUserSettings', () => {
    it('should clear all AI provider settings', async () => {
      mockChain.mockEq.mockResolvedValue({
        error: null
      });

      await service.clearUserSettings('user-123');

      expect(mockChain.mockUpdate).toHaveBeenCalledWith({
        ai_provider: null,
        ai_api_key_encrypted: null,
        ai_api_key_valid: null,
        updated_at: expect.any(String)
      });
    });

    it('should throw error on database failure', async () => {
      mockChain.mockEq.mockResolvedValue({
        error: { message: 'Database error' }
      });

      await expect(service.clearUserSettings('user-123'))
        .rejects.toThrow(AIProviderError);
    });
  });
});