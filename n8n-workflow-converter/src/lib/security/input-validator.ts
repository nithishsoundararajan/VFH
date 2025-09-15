import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * Input validation and sanitization utilities
 */
export class InputValidator {
  // File validation schemas
  static readonly fileUploadSchema = z.object({
    name: z.string().min(1).max(255).refine(
      (name) => /^[a-zA-Z0-9._-]+$/.test(name),
      'File name contains invalid characters'
    ),
    size: z.number().min(1).max(50 * 1024 * 1024), // 50MB max
    type: z.string().refine(
      (type) => ['application/json', 'text/plain'].includes(type),
      'Invalid file type'
    )
  });

  // Project validation schemas
  static readonly projectSchema = z.object({
    name: z.string().min(1).max(100).refine(
      (name) => /^[a-zA-Z0-9\s._-]+$/.test(name),
      'Project name contains invalid characters'
    ),
    description: z.string().max(500).optional(),
    workflow_json: z.object({}).passthrough() // Basic object validation
  });

  // User input validation
  static readonly userInputSchema = z.object({
    email: z.string().email(),
    full_name: z.string().min(1).max(100).optional(),
    avatar_url: z.string().url().optional()
  });

  // Configuration validation
  static readonly configSchema = z.object({
    environment_variables: z.record(z.string(), z.string()),
    output_directory: z.string().min(1).max(255),
    compression_enabled: z.boolean().optional()
  });

  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  }

  /**
   * Sanitize and validate file name
   */
  static sanitizeFileName(fileName: string): string {
    // Remove path traversal attempts
    let sanitized = fileName.replace(/[\/\\:*?"<>|]/g, '_');
    
    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
    
    // Limit length
    if (sanitized.length > 255) {
      const ext = sanitized.substring(sanitized.lastIndexOf('.'));
      sanitized = sanitized.substring(0, 255 - ext.length) + ext;
    }
    
    // Ensure it's not empty
    if (!sanitized || sanitized === '.') {
      sanitized = 'unnamed_file';
    }
    
    return sanitized;
  }

  /**
   * Validate and sanitize JSON input
   */
  static validateWorkflowJson(jsonString: string): { valid: boolean; data?: any; error?: string } {
    try {
      // Check for potential JSON bombs (deeply nested objects)
      if (jsonString.length > 10 * 1024 * 1024) { // 10MB limit
        return { valid: false, error: 'JSON file too large' };
      }

      const data = JSON.parse(jsonString);
      
      // Basic structure validation for n8n workflows
      if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid JSON structure' };
      }

      if (!data.nodes || !Array.isArray(data.nodes)) {
        return { valid: false, error: 'Missing or invalid nodes array' };
      }

      if (!data.connections || typeof data.connections !== 'object') {
        return { valid: false, error: 'Missing or invalid connections object' };
      }

      // Validate node structure
      for (const node of data.nodes) {
        if (!node.id || !node.type || !node.typeVersion) {
          return { valid: false, error: 'Invalid node structure' };
        }
        
        // Sanitize node parameters to prevent code injection
        if (node.parameters) {
          node.parameters = this.sanitizeNodeParameters(node.parameters);
        }
      }

      return { valid: true, data };
    } catch (error) {
      return { valid: false, error: 'Invalid JSON format' };
    }
  }

  /**
   * Sanitize node parameters to prevent code injection
   */
  private static sanitizeNodeParameters(params: any): any {
    if (typeof params === 'string') {
      // Remove potential script tags and dangerous patterns
      return params
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    
    if (Array.isArray(params)) {
      return params.map(item => this.sanitizeNodeParameters(item));
    }
    
    if (params && typeof params === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(params)) {
        sanitized[key] = this.sanitizeNodeParameters(value);
      }
      return sanitized;
    }
    
    return params;
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey: string, provider: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    switch (provider.toLowerCase()) {
      case 'openai':
        return /^sk-[a-zA-Z0-9]{48,}$/.test(apiKey);
      case 'anthropic':
        return /^sk-ant-[a-zA-Z0-9-_]{95,}$/.test(apiKey);
      case 'google':
        return /^[a-zA-Z0-9_-]{39}$/.test(apiKey);
      default:
        return apiKey.length >= 20 && apiKey.length <= 200;
    }
  }

  /**
   * Validate URL to prevent SSRF attacks
   */
  static validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      
      // Block private IP ranges
      const hostname = parsed.hostname;
      if (validator.isIP(hostname)) {
        return !this.isPrivateIP(hostname);
      }
      
      // Block localhost and internal domains
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if IP is in private range
   */
  private static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];
    
    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Rate limiting key generation
   */
  static generateRateLimitKey(identifier: string, action: string): string {
    return `rate_limit:${action}:${identifier}`;
  }

  /**
   * Validate environment variable name
   */
  static validateEnvVarName(name: string): boolean {
    return /^[A-Z][A-Z0-9_]*$/.test(name) && name.length <= 100;
  }

  /**
   * Sanitize environment variable value
   */
  static sanitizeEnvVarValue(value: string): string {
    // Remove null bytes and control characters
    return value.replace(/[\x00-\x1f]/g, '');
  }
}