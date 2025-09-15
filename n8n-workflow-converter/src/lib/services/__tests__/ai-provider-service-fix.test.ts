import { AIProviderService } from '../ai-provider-service';

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        limit: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    }))
  })),
  functions: {
    invoke: jest.fn()
  }
};

// Mock the Supabase client creation
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase
}));

describe('AIProviderService - Error Handling Fix', () => {
  let service: AIProviderService;

  beforeEach(() => {
    service = new AIProviderService();
    jest.clearAllMocks();
  });

  describe('getUserSettings with missing schema', () => {
    it('should return system_default when columns do not exist', async () => {
      // Mock error for missing column
      const mockError = {
        code: 'PGRST116',
        message: 'column "ai_provider" does not exist'
      };

      mockSupabase.from().select().eq().limit.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await service.getUserSettings('user123');

      expect(result).toEqual({
        provider: 'system_default',
        isValid: true
      });
    });

    it('should handle schema check gracefully', async () => {
      // Mock successful schema check
      mockSupabase.from().select().eq().limit.mockResolvedValue({
        data: [],
        error: null
      });

      // Mock successful user settings query
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'openai', ai_api_key_valid: true },
        error: null
      });

      const result = await service.getUserSettings('user123');

      expect(result).toEqual({
        provider: 'openai',
        isValid: true
      });
    });
  });

  describe('isAvailable', () => {
    it('should return false when schema is not available', async () => {
      const mockError = {
        code: 'PGRST116',
        message: 'column "ai_provider" does not exist'
      };

      mockSupabase.from().select().eq().limit.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await service.isAvailable();

      expect(result).toBe(false);
    });

    it('should return true when schema is available', async () => {
      mockSupabase.from().select().eq().limit.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await service.isAvailable();

      expect(result).toBe(true);
    });
  });

  describe('updateUserSettings with missing schema', () => {
    it('should throw helpful error when schema is not available', async () => {
      const mockError = {
        code: 'PGRST116',
        message: 'column "ai_provider" does not exist'
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: mockError
      });

      await expect(service.updateUserSettings('user123', 'openai', 'sk-test'))
        .rejects
        .toThrow('AI provider functionality not available');
    });
  });
});