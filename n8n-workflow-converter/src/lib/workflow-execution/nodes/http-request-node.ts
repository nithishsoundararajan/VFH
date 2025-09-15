/**
 * HTTP Request Node Implementation
 * Handles HTTP requests with proper error handling and retry logic
 */

import { BaseActionNode, NodeInputData } from '../base-node';
import { ExecutionContext } from '../workflow-engine';

export interface HttpRequestParameters {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  bodyType?: 'json' | 'form' | 'raw';
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  ignoreSSLIssues?: boolean;
}

export class HttpRequestNode extends BaseActionNode {
  constructor(parameters: HttpRequestParameters = {} as HttpRequestParameters) {
    super(
      'HttpRequest',
      'HTTP Request',
      'Make HTTP requests to external APIs and services',
      parameters
    );
  }

  protected validateParameters(): void {
    const url = this.getParameter('url');
    if (!url) {
      throw new Error('URL parameter is required');
    }

    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    const method = this.getParameter('method', 'GET');
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid HTTP method: ${method}`);
    }
  }

  async execute(inputData: NodeInputData[], context: ExecutionContext): Promise<any> {
    await this.preExecute(inputData, context);

    const processedData = this.processInputData(inputData);
    const results = [];

    for (const data of processedData) {
      try {
        const result = await this.makeRequest(data, context);
        results.push(result);
      } catch (error) {
        if (!context.config.continueOnFailure) {
          throw error;
        }
        results.push({ error: error.message });
      }
    }

    return this.formatOutput(results, true);
  }

  private async makeRequest(inputData: any, context: ExecutionContext): Promise<any> {
    const url = this.resolveUrl(inputData);
    const method = this.getParameter('method', 'GET');
    const headers = this.buildHeaders(inputData);
    const body = this.buildBody(inputData);
    const timeout = this.getParameter('timeout', 30000);

    this.log('info', `Making ${method} request to ${url}`);

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      requestOptions.body = body;
    }

    try {
      const response = await this.makeHttpRequest(url, requestOptions, timeout);
      
      const result = {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: await this.parseResponseBody(response),
        url: response.url
      };

      this.log('info', `Request completed with status ${response.status}`);
      return result;

    } catch (error) {
      this.log('error', `Request failed: ${error.message}`);
      throw error;
    }
  }

  private resolveUrl(inputData: any): string {
    let url = this.getParameter('url');
    
    // Replace placeholders with input data
    if (inputData && typeof inputData === 'object') {
      Object.entries(inputData).forEach(([key, value]) => {
        url = url.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
      });
    }

    return url;
  }

  private buildHeaders(inputData: any): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'n8n-workflow-converter/1.0.0',
      ...this.getParameter('headers', {})
    };

    const bodyType = this.getParameter('bodyType', 'json');
    if (bodyType === 'json' && this.getParameter('body')) {
      headers['Content-Type'] = 'application/json';
    } else if (bodyType === 'form') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    // Resolve header placeholders
    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === 'string' && inputData && typeof inputData === 'object') {
        Object.entries(inputData).forEach(([dataKey, dataValue]) => {
          headers[key] = value.replace(
            new RegExp(`{{\\s*${dataKey}\\s*}}`, 'g'), 
            String(dataValue)
          );
        });
      }
    });

    return headers;
  }

  private buildBody(inputData: any): string | undefined {
    const body = this.getParameter('body');
    if (!body) return undefined;

    const bodyType = this.getParameter('bodyType', 'json');

    let processedBody = body;

    // Replace placeholders with input data
    if (inputData && typeof inputData === 'object') {
      Object.entries(inputData).forEach(([key, value]) => {
        processedBody = processedBody.replace(
          new RegExp(`{{\\s*${key}\\s*}}`, 'g'), 
          String(value)
        );
      });
    }

    switch (bodyType) {
      case 'json':
        try {
          // Validate JSON
          JSON.parse(processedBody);
          return processedBody;
        } catch (error) {
          throw new Error(`Invalid JSON body: ${error.message}`);
        }

      case 'form':
        // Convert to URL-encoded format if it's an object
        try {
          const data = JSON.parse(processedBody);
          if (typeof data === 'object') {
            return new URLSearchParams(data).toString();
          }
        } catch {
          // If not JSON, assume it's already URL-encoded
        }
        return processedBody;

      case 'raw':
      default:
        return processedBody;
    }
  }

  private async parseResponseBody(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType.includes('text/')) {
        return await response.text();
      } else {
        // For binary data, return as base64
        const buffer = await response.arrayBuffer();
        return {
          type: 'binary',
          data: Buffer.from(buffer).toString('base64'),
          mimeType: contentType
        };
      }
    } catch (error) {
      // If parsing fails, return raw text
      return await response.text();
    }
  }
}