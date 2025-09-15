/**
 * Webhook Trigger Implementation
 * Handles HTTP webhook endpoints for workflow execution
 */

import { BaseTrigger, TriggerConfig } from './base-trigger';
import { NodeParameters, NodeCredentials } from '../base-node';
import { ExecutionContext } from '../workflow-engine';

export interface WebhookTriggerParameters extends NodeParameters {
  path: string; // Webhook endpoint path
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  authentication?: 'none' | 'basic' | 'header' | 'query';
  authenticationData?: {
    username?: string;
    password?: string;
    headerName?: string;
    headerValue?: string;
    queryParameter?: string;
    queryValue?: string;
  };
  responseMode?: 'onReceived' | 'lastNode' | 'responseNode';
  responseData?: string;
  responseStatusCode?: number;
  responseHeaders?: Record<string, string>;
}

export interface WebhookRequest {
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

export class WebhookTrigger extends BaseTrigger {
  private server: any = null;
  private app: any = null;
  private port: number;
  private webhookPath: string;
  private method: string;
  private authentication: WebhookTriggerParameters['authentication'];
  private authData: WebhookTriggerParameters['authenticationData'];
  private responseConfig: {
    mode: string;
    data?: string;
    statusCode: number;
    headers: Record<string, string>;
  };

  constructor(
    parameters: WebhookTriggerParameters,
    credentials: NodeCredentials = {},
    config: Partial<TriggerConfig> = {}
  ) {
    super(
      'WebhookTrigger',
      'Webhook Trigger',
      'Execute workflow via HTTP webhook endpoints',
      parameters,
      credentials,
      config
    );

    this.webhookPath = parameters.path || '/webhook';
    this.method = parameters.method || 'POST';
    this.authentication = parameters.authentication || 'none';
    this.authData = parameters.authenticationData || {};
    this.port = parseInt(process.env.WEBHOOK_PORT || '3000');
    
    this.responseConfig = {
      mode: parameters.responseMode || 'onReceived',
      data: parameters.responseData || '{"success": true}',
      statusCode: parameters.responseStatusCode || 200,
      headers: parameters.responseHeaders || { 'Content-Type': 'application/json' }
    };

    this.validateWebhookConfig();
  }

  protected validateParameters(): void {
    if (!this.webhookPath) {
      throw new Error('Webhook path is required');
    }

    if (!this.webhookPath.startsWith('/')) {
      throw new Error('Webhook path must start with /');
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (!validMethods.includes(this.method)) {
      throw new Error(`Invalid HTTP method: ${this.method}`);
    }

    if (this.authentication === 'basic' && (!this.authData.username || !this.authData.password)) {
      throw new Error('Basic authentication requires username and password');
    }

    if (this.authentication === 'header' && (!this.authData.headerName || !this.authData.headerValue)) {
      throw new Error('Header authentication requires header name and value');
    }

    if (this.authentication === 'query' && (!this.authData.queryParameter || !this.authData.queryValue)) {
      throw new Error('Query authentication requires parameter name and value');
    }
  }

  protected async startTrigger(): Promise<void> {
    this.validateParameters();

    // Dynamic import of Express to avoid bundling issues
    const express = await this.importExpress();
    
    this.app = express();
    
    // Middleware for parsing request bodies
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

    // Add CORS headers
    this.app.use((req: any, res: any, next: any) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Set up webhook endpoint
    const methodLower = this.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
    
    this.app[methodLower](this.webhookPath, (req: any, res: any) => {
      this.handleWebhookRequest(req, res);
    });

    // Health check endpoint
    this.app.get('/health', (req: any, res: any) => {
      res.json({
        status: 'healthy',
        webhook: {
          path: this.webhookPath,
          method: this.method,
          authentication: this.authentication
        },
        timestamp: new Date().toISOString()
      });
    });

    // Start server
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (error: any) => {
        if (error) {
          reject(error);
        } else {
          this.log('info', `Webhook server started on port ${this.port}`);
          this.log('info', `Webhook endpoint: ${this.method} http://localhost:${this.port}${this.webhookPath}`);
          resolve(undefined);
        }
      });
    });
  }

  protected async stopTrigger(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.log('info', 'Webhook server stopped');
          this.server = null;
          this.app = null;
          resolve(undefined);
        });
      });
    }
  }

  protected async testTrigger(): Promise<any> {
    this.validateParameters();
    
    // Test by making a request to the webhook endpoint
    const testUrl = `http://localhost:${this.port}${this.webhookPath}`;
    
    try {
      const testData = { test: true, timestamp: new Date().toISOString() };
      const response = await this.makeTestRequest(testUrl, testData);
      
      return {
        webhookUrl: testUrl,
        method: this.method,
        authentication: this.authentication,
        testResponse: response,
        isReachable: true
      };
    } catch (error) {
      return {
        webhookUrl: testUrl,
        method: this.method,
        authentication: this.authentication,
        error: error.message,
        isReachable: false
      };
    }
  }

  protected getTriggerData(): any {
    return {
      webhookUrl: `http://localhost:${this.port}${this.webhookPath}`,
      method: this.method,
      authentication: this.authentication,
      port: this.port,
      path: this.webhookPath
    };
  }

  private async handleWebhookRequest(req: any, res: any): Promise<void> {
    try {
      // Generate request ID
      const requestId = this.generateRequestId();
      
      this.log('info', `Webhook request received: ${req.method} ${req.path} (ID: ${requestId})`);

      // Authenticate request if required
      if (!this.authenticateRequest(req)) {
        this.log('warn', `Authentication failed for request ${requestId}`);
        res.status(401).json({ error: 'Authentication failed' });
        return;
      }

      // Create webhook request object
      const webhookRequest: WebhookRequest = {
        id: requestId,
        method: req.method,
        path: req.path,
        headers: req.headers,
        query: req.query,
        body: req.body,
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      // Send immediate response if configured
      if (this.responseConfig.mode === 'onReceived') {
        this.sendResponse(res, this.responseConfig.data);
      }

      // Fire the trigger
      const triggerData = {
        ...this.generateTriggerOutput({} as ExecutionContext),
        request: webhookRequest,
        webhookUrl: `http://localhost:${this.port}${this.webhookPath}`
      };

      await this.fireTrigger(triggerData);

      // Send response if not already sent
      if (this.responseConfig.mode !== 'onReceived' && !res.headersSent) {
        this.sendResponse(res, this.responseConfig.data);
      }

    } catch (error) {
      this.log('error', `Webhook request handling failed: ${error.message}`);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private authenticateRequest(req: any): boolean {
    switch (this.authentication) {
      case 'none':
        return true;

      case 'basic':
        const authHeader = req.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Basic ')) {
          return false;
        }
        
        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
        const [username, password] = credentials.split(':');
        
        return username === this.authData.username && password === this.authData.password;

      case 'header':
        const headerValue = req.get(this.authData.headerName!);
        return headerValue === this.authData.headerValue;

      case 'query':
        const queryValue = req.query[this.authData.queryParameter!];
        return queryValue === this.authData.queryValue;

      default:
        return false;
    }
  }

  private sendResponse(res: any, data?: string): void {
    // Set response headers
    Object.entries(this.responseConfig.headers).forEach(([key, value]) => {
      res.set(key, value);
    });

    res.status(this.responseConfig.statusCode);

    if (data) {
      try {
        // Try to parse as JSON
        const jsonData = JSON.parse(data);
        res.json(jsonData);
      } catch {
        // Send as text if not valid JSON
        res.send(data);
      }
    } else {
      res.json({ success: true, timestamp: new Date().toISOString() });
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private async importExpress(): Promise<any> {
    try {
      // Try to import Express
      return await import('express');
    } catch (error) {
      // Fallback implementation using Node.js http module
      this.log('warn', 'Express not available, using fallback HTTP server');
      return this.createFallbackExpress();
    }
  }

  private createFallbackExpress(): any {
    const http = require('http');
    const url = require('url');
    const querystring = require('querystring');

    const app = {
      middlewares: [] as any[],
      routes: new Map(),
      
      use: (middleware: any) => {
        app.middlewares.push(middleware);
      },
      
      get: (path: string, handler: any) => {
        app.routes.set(`GET:${path}`, handler);
      },
      
      post: (path: string, handler: any) => {
        app.routes.set(`POST:${path}`, handler);
      },
      
      put: (path: string, handler: any) => {
        app.routes.set(`PUT:${path}`, handler);
      },
      
      delete: (path: string, handler: any) => {
        app.routes.set(`DELETE:${path}`, handler);
      },
      
      patch: (path: string, handler: any) => {
        app.routes.set(`PATCH:${path}`, handler);
      },
      
      listen: (port: number, callback: any) => {
        const server = http.createServer((req: any, res: any) => {
          const parsedUrl = url.parse(req.url, true);
          const routeKey = `${req.method}:${parsedUrl.pathname}`;
          const handler = app.routes.get(routeKey);
          
          if (handler) {
            // Parse body for POST/PUT/PATCH requests
            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
              let body = '';
              req.on('data', (chunk: any) => {
                body += chunk.toString();
              });
              req.on('end', () => {
                try {
                  req.body = JSON.parse(body);
                } catch {
                  req.body = body;
                }
                req.query = parsedUrl.query;
                req.path = parsedUrl.pathname;
                req.get = (header: string) => req.headers[header.toLowerCase()];
                
                // Add response helpers
                res.json = (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                };
                res.send = (data: any) => {
                  res.end(data);
                };
                res.status = (code: number) => {
                  res.statusCode = code;
                  return res;
                };
                res.set = (key: string, value: string) => {
                  res.setHeader(key, value);
                };
                res.header = res.set;
                
                handler(req, res);
              });
            } else {
              req.query = parsedUrl.query;
              req.path = parsedUrl.pathname;
              req.get = (header: string) => req.headers[header.toLowerCase()];
              
              // Add response helpers
              res.json = (data: any) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              };
              res.send = (data: any) => {
                res.end(data);
              };
              res.status = (code: number) => {
                res.statusCode = code;
                return res;
              };
              res.set = (key: string, value: string) => {
                res.setHeader(key, value);
              };
              res.header = res.set;
              
              handler(req, res);
            }
          } else {
            res.statusCode = 404;
            res.end('Not Found');
          }
        });
        
        server.listen(port, callback);
        return server;
      }
    };

    // Add Express-like static methods
    (app as any).json = () => (req: any, res: any, next: any) => next();
    (app as any).urlencoded = () => (req: any, res: any, next: any) => next();
    (app as any).raw = () => (req: any, res: any, next: any) => next();

    return app;
  }

  private async makeTestRequest(url: string, data: any): Promise<any> {
    const options = {
      method: this.method,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: this.method !== 'GET' ? JSON.stringify(data) : undefined
    };

    const response = await fetch(url, options);
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text()
    };
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.authentication === 'basic' && this.authData.username && this.authData.password) {
      const credentials = Buffer.from(`${this.authData.username}:${this.authData.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (this.authentication === 'header' && this.authData.headerName && this.authData.headerValue) {
      headers[this.authData.headerName] = this.authData.headerValue;
    }

    return headers;
  }

  private validateWebhookConfig(): void {
    if (this.port < 1 || this.port > 65535) {
      throw new Error('Invalid port number');
    }
  }

  /**
   * Get webhook URL
   */
  getWebhookUrl(): string {
    return `http://localhost:${this.port}${this.webhookPath}`;
  }

  /**
   * Update webhook configuration
   */
  updateWebhookConfig(config: Partial<WebhookTriggerParameters>): void {
    const wasRunning = this.status === 'running';
    
    if (wasRunning) {
      this.stopTrigger();
    }

    if (config.path) this.webhookPath = config.path;
    if (config.method) this.method = config.method;
    if (config.authentication) this.authentication = config.authentication;
    if (config.authenticationData) this.authData = { ...this.authData, ...config.authenticationData };
    if (config.responseMode) this.responseConfig.mode = config.responseMode;
    if (config.responseData) this.responseConfig.data = config.responseData;
    if (config.responseStatusCode) this.responseConfig.statusCode = config.responseStatusCode;
    if (config.responseHeaders) this.responseConfig.headers = { ...this.responseConfig.headers, ...config.responseHeaders };

    // Update parameters
    Object.assign(this.parameters, config);

    if (wasRunning) {
      this.startTrigger();
    }

    this.log('info', 'Webhook configuration updated');
  }
}