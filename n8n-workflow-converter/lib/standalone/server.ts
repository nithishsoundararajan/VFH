/**
 * Standalone Express server for n8n Workflow Converter
 * Provides a complete backend without Supabase dependency
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import multer from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import { loadStandaloneConfig, validateStandaloneConfig } from '../config/standalone';
import { SQLiteAdapter } from '../database/sqlite-adapter';
import { LocalStorageAdapter } from '../storage/local-storage';
import { SimpleAuthAdapter } from '../auth/simple-auth';

import type { StandaloneConfig } from '../config/standalone';

export class StandaloneServer {
  private app: express.Application;
  private config: StandaloneConfig;
  private db: SQLiteAdapter;
  private storage: LocalStorageAdapter;
  private auth: SimpleAuthAdapter;

  constructor() {
    this.config = loadStandaloneConfig();
    this.validateConfig();
    
    this.app = express();
    this.initializeDatabase();
    this.initializeStorage();
    this.initializeAuth();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private validateConfig(): void {
    const errors = validateStandaloneConfig(this.config);
    if (errors.length > 0) {
      throw new Error(`Configuration errors:\n${errors.join('\n')}`);
    }
  }

  private initializeDatabase(): void {
    this.db = new SQLiteAdapter(this.config.database);
    console.log('✅ Database initialized');
  }

  private initializeStorage(): void {
    this.storage = new LocalStorageAdapter(this.config.storage);
    console.log('✅ Storage initialized');
  }

  private initializeAuth(): void {
    this.auth = new SimpleAuthAdapter(this.db, this.config.auth);
    console.log('✅ Authentication initialized');
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(cors(this.config.server.cors));

    // Compression
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Session middleware (for simple auth)
    this.app.use(session({
      secret: this.config.auth.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: this.config.auth.options?.sessionTimeout || 24 * 60 * 60 * 1000,
      },
    }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', this.handleHealthCheck.bind(this));

    // Authentication routes
    this.app.post('/api/auth/register', this.handleRegister.bind(this));
    this.app.post('/api/auth/login', this.handleLogin.bind(this));
    this.app.post('/api/auth/logout', this.requireAuth.bind(this), this.handleLogout.bind(this));
    this.app.post('/api/auth/refresh', this.handleRefreshToken.bind(this));
    this.app.get('/api/auth/me', this.requireAuth.bind(this), this.handleGetCurrentUser.bind(this));

    // User management routes
    this.app.get('/api/users', this.requireAuth.bind(this), this.handleListUsers.bind(this));
    this.app.get('/api/users/:id', this.requireAuth.bind(this), this.handleGetUser.bind(this));
    this.app.put('/api/users/:id', this.requireAuth.bind(this), this.handleUpdateUser.bind(this));
    this.app.delete('/api/users/:id', this.requireAuth.bind(this), this.handleDeleteUser.bind(this));

    // Project routes
    this.app.get('/api/projects', this.requireAuth.bind(this), this.handleListProjects.bind(this));
    this.app.post('/api/projects', this.requireAuth.bind(this), this.handleCreateProject.bind(this));
    this.app.get('/api/projects/:id', this.requireAuth.bind(this), this.handleGetProject.bind(this));
    this.app.put('/api/projects/:id', this.requireAuth.bind(this), this.handleUpdateProject.bind(this));
    this.app.delete('/api/projects/:id', this.requireAuth.bind(this), this.handleDeleteProject.bind(this));

    // File upload routes
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: this.config.storage.options?.maxFileSize || 50 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = this.config.storage.options?.allowedTypes || ['application/json'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} not allowed`));
        }
      },
    });

    this.app.post('/api/files/upload', this.requireAuth.bind(this), upload.single('file'), this.handleFileUpload.bind(this));
    this.app.get('/api/files/:bucket/:filename', this.requireAuth.bind(this), this.handleFileDownload.bind(this));
    this.app.delete('/api/files/:bucket/:filename', this.requireAuth.bind(this), this.handleFileDelete.bind(this));

    // Analytics routes
    if (this.config.features.analytics) {
      this.app.get('/api/analytics/stats', this.requireAuth.bind(this), this.handleAnalyticsStats.bind(this));
    }

    // Admin routes
    this.app.get('/api/admin/stats', this.requireAuth.bind(this), this.handleAdminStats.bind(this));

    // Catch-all for unknown routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    // Error handling middleware
    this.app.use(this.handleError.bind(this));
  }

  // Middleware
  private async requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authorization token required' });
        return;
      }

      const token = authHeader.substring(7);
      const user = await this.auth.verifyAccessToken(token);
      
      if (!user) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      (req as any).user = user;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }

  // Route handlers
  private async handleHealthCheck(req: express.Request, res: express.Response): Promise<void> {
    try {
      const dbHealth = this.db.healthCheck();
      const storageHealth = await this.storage.healthCheck();
      const authHealth = await this.auth.healthCheck();

      const health = {
        status: dbHealth && storageHealth && authHealth ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth ? 'healthy' : 'unhealthy',
          storage: storageHealth ? 'healthy' : 'unhealthy',
          auth: authHealth ? 'healthy' : 'unhealthy',
        },
        version: process.env.npm_package_version || '1.0.0',
      };

      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async handleRegister(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email, password, fullName } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const result = await this.auth.register({ email, password, fullName });
      
      res.status(201).json({
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  private async handleLogin(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const result = await this.auth.login({ email, password });
      
      res.json({
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      res.status(401).json({ error: (error as Error).message });
    }
  }

  private async handleLogout(req: express.Request, res: express.Response): Promise<void> {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId) {
        await this.auth.logout(sessionId);
      }
      
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  private async handleRefreshToken(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const tokens = await this.auth.refreshToken(refreshToken);
      
      res.json({ tokens });
    } catch (error) {
      res.status(401).json({ error: (error as Error).message });
    }
  }

  private async handleGetCurrentUser(req: express.Request, res: express.Response): Promise<void> {
    res.json({ user: (req as any).user });
  }

  private async handleListUsers(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      
      const result = await this.auth.listUsers({
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        search: search as string,
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list users' });
    }
  }

  private async handleGetUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.auth.getUserById(id);
      
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      res.json({ user });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user' });
    }
  }

  private async handleUpdateUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = (req as any).user;
      
      // Users can only update their own profile (unless admin)
      if (currentUser.id !== id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      
      const user = await this.auth.updateUser(id, req.body);
      res.json({ user });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  private async handleDeleteUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = (req as any).user;
      
      // Users can only delete their own account (unless admin)
      if (currentUser.id !== id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      
      await this.auth.deleteUser(id);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  private async handleListProjects(req: express.Request, res: express.Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { limit = 50, offset = 0 } = req.query;
      
      const projects = this.db.findMany('projects', 
        { user_id: user.id },
        {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          orderBy: 'created_at',
          orderDirection: 'DESC',
        }
      );
      
      res.json({ projects });
    } catch (error) {
      res.status(500).json({ error: 'Failed to list projects' });
    }
  }

  private async handleCreateProject(req: express.Request, res: express.Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { name, description, workflowJson } = req.body;
      
      if (!name || !workflowJson) {
        res.status(400).json({ error: 'Name and workflow JSON are required' });
        return;
      }
      
      const projectId = require('uuid').v4();
      
      this.db.insert('projects', {
        id: projectId,
        user_id: user.id,
        name,
        description: description || null,
        workflow_json: JSON.stringify(workflowJson),
        status: 'pending',
      });
      
      const project = this.db.findById('projects', projectId);
      res.status(201).json({ project });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create project' });
    }
  }

  private async handleGetProject(req: express.Request, res: express.Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      
      const project = this.db.queryOne(
        'SELECT * FROM projects WHERE id = ? AND user_id = ?',
        [id, user.id]
      );
      
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      
      res.json({ project });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get project' });
    }
  }

  private async handleUpdateProject(req: express.Request, res: express.Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      
      const updated = this.db.update('projects', req.body, { id, user_id: user.id });
      
      if (updated === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      
      const project = this.db.findById('projects', id);
      res.json({ project });
    } catch (error) {
      res.status(400).json({ error: 'Failed to update project' });
    }
  }

  private async handleDeleteProject(req: express.Request, res: express.Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      
      const deleted = this.db.delete('projects', { id, user_id: user.id });
      
      if (deleted === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      
      res.json({ message: 'Project deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete project' });
    }
  }

  private async handleFileUpload(req: express.Request, res: express.Response): Promise<void> {
    try {
      const user = (req as any).user;
      const file = req.file;
      
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      
      const bucket = req.body.bucket || 'uploads';
      
      const storageFile = await this.storage.upload(
        bucket,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      
      // Record file upload in database
      this.db.insert('file_uploads', {
        id: storageFile.id,
        user_id: user.id,
        filename: storageFile.name,
        original_name: storageFile.originalName,
        mime_type: storageFile.mimeType,
        size: storageFile.size,
        path: storageFile.path,
      });
      
      res.status(201).json({ file: storageFile });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  private async handleFileDownload(req: express.Request, res: express.Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { bucket, filename } = req.params;
      
      // Check if user has access to this file
      const fileRecord = this.db.queryOne(
        'SELECT * FROM file_uploads WHERE filename = ? AND user_id = ?',
        [filename, user.id]
      );
      
      if (!fileRecord) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      const stream = await this.storage.downloadStream(bucket, filename);
      
      res.setHeader('Content-Type', fileRecord.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.original_name}"`);
      
      stream.pipe(res);
    } catch (error) {
      res.status(404).json({ error: 'File not found' });
    }
  }

  private async handleFileDelete(req: express.Request, res: express.Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { bucket, filename } = req.params;
      
      // Check if user has access to this file
      const fileRecord = this.db.queryOne(
        'SELECT * FROM file_uploads WHERE filename = ? AND user_id = ?',
        [filename, user.id]
      );
      
      if (!fileRecord) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      await this.storage.delete(bucket, filename);
      this.db.delete('file_uploads', { filename, user_id: user.id });
      
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }

  private async handleAnalyticsStats(req: express.Request, res: express.Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      const stats = {
        totalProjects: this.db.count('projects', { user_id: user.id }),
        completedProjects: this.db.count('projects', { user_id: user.id, status: 'completed' }),
        totalFiles: this.db.count('file_uploads', { user_id: user.id }),
        storageUsed: await this.storage.getStorageUsage(),
      };
      
      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get analytics stats' });
    }
  }

  private async handleAdminStats(req: express.Request, res: express.Response): Promise<void> {
    try {
      const userStats = await this.auth.getUserStats();
      const storageUsage = await this.storage.getStorageUsage();
      
      const stats = {
        ...userStats,
        totalProjects: this.db.count('projects'),
        totalFiles: this.db.count('file_uploads'),
        storageUsage,
      };
      
      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get admin stats' });
    }
  }

  private handleError(error: Error, req: express.Request, res: express.Response, next: express.NextFunction): void {
    console.error('Server error:', error);
    
    if (res.headersSent) {
      return next(error);
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }

  // Server lifecycle
  public async start(): Promise<void> {
    const { host, port } = this.config.server;
    
    return new Promise((resolve) => {
      this.app.listen(port, host, () => {
        console.log(`🚀 Standalone server running on http://${host}:${port}`);
        console.log(`📊 Health check: http://${host}:${port}/api/health`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    // Cleanup resources
    this.db.close();
    console.log('🛑 Server stopped');
  }

  public getApp(): express.Application {
    return this.app;
  }
}