/**
 * SQLite database adapter for standalone deployment
 * Provides a lightweight alternative to PostgreSQL/Supabase
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import type { StandaloneConfig } from '../config/standalone';

export interface DatabaseRow {
  [key: string]: any;
}

export interface QueryResult {
  rows: DatabaseRow[];
  rowCount: number;
  lastInsertRowid?: number;
}

export class SQLiteAdapter {
  private db: Database.Database;
  private config: StandaloneConfig['database'];

  constructor(config: StandaloneConfig['database']) {
    this.config = config;
    
    if (!config.path) {
      throw new Error('SQLite database path is required');
    }

    // Ensure directory exists
    const dbDir = dirname(config.path);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(config.path, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });

    // Configure database options
    if (config.options?.enableWAL) {
      this.db.pragma('journal_mode = WAL');
    }

    if (config.options?.busyTimeout) {
      this.db.pragma(`busy_timeout = ${config.options.busyTimeout}`);
    }

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Initialize schema
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        workflow_json TEXT NOT NULL,
        status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
        node_count INTEGER,
        trigger_count INTEGER,
        generated_at DATETIME,
        file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Generation logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generation_logs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        log_level TEXT CHECK (log_level IN ('info', 'warning', 'error')) NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      )
    `);

    // Project analytics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_analytics (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        generation_time_ms INTEGER,
        file_size_bytes INTEGER,
        node_types TEXT,
        complexity_score INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      )
    `);

    // Sessions table (for simple auth)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // File uploads table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_uploads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.createIndexes();

    // Create triggers for updated_at
    this.createTriggers();
  }

  private createIndexes(): void {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)',
      'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status)',
      'CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects (created_at)',
      'CREATE INDEX IF NOT EXISTS idx_generation_logs_project_id ON generation_logs (project_id)',
      'CREATE INDEX IF NOT EXISTS idx_generation_logs_timestamp ON generation_logs (timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads (user_id)',
    ];

    indexes.forEach(sql => this.db.exec(sql));
  }

  private createTriggers(): void {
    // Update triggers for updated_at columns
    const triggers = [
      `CREATE TRIGGER IF NOT EXISTS update_users_updated_at
       AFTER UPDATE ON users
       BEGIN
         UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
      
      `CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
       AFTER UPDATE ON projects
       BEGIN
         UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
    ];

    triggers.forEach(sql => this.db.exec(sql));
  }

  // Query methods
  public query(sql: string, params: any[] = []): QueryResult {
    try {
      if (sql.trim().toLowerCase().startsWith('select')) {
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(params) as DatabaseRow[];
        return {
          rows,
          rowCount: rows.length,
        };
      } else {
        const stmt = this.db.prepare(sql);
        const result = stmt.run(params);
        return {
          rows: [],
          rowCount: result.changes,
          lastInsertRowid: result.lastInsertRowid as number,
        };
      }
    } catch (error) {
      console.error('SQLite query error:', error);
      throw error;
    }
  }

  public queryOne(sql: string, params: any[] = []): DatabaseRow | null {
    const result = this.query(sql, params);
    return result.rows[0] || null;
  }

  public queryMany(sql: string, params: any[] = []): DatabaseRow[] {
    const result = this.query(sql, params);
    return result.rows;
  }

  // Transaction support
  public transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  // Prepared statement support
  public prepare(sql: string) {
    return this.db.prepare(sql);
  }

  // Utility methods
  public insert(table: string, data: Record<string, any>): number {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = this.query(sql, values);
    
    return result.lastInsertRowid!;
  }

  public update(table: string, data: Record<string, any>, where: Record<string, any>): number {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(where)];
    
    const result = this.query(sql, params);
    return result.rowCount;
  }

  public delete(table: string, where: Record<string, any>): number {
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    
    const result = this.query(sql, Object.values(where));
    return result.rowCount;
  }

  public findById(table: string, id: string): DatabaseRow | null {
    return this.queryOne(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  }

  public findMany(table: string, where: Record<string, any> = {}, options: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {}): DatabaseRow[] {
    let sql = `SELECT * FROM ${table}`;
    const params: any[] = [];

    if (Object.keys(where).length > 0) {
      const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(where));
    }

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    }

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    return this.queryMany(sql, params);
  }

  public count(table: string, where: Record<string, any> = {}): number {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const params: any[] = [];

    if (Object.keys(where).length > 0) {
      const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(where));
    }

    const result = this.queryOne(sql, params);
    return result?.count || 0;
  }

  // Cleanup methods
  public cleanupExpiredSessions(): number {
    return this.delete('sessions', {});
  }

  public vacuum(): void {
    this.db.exec('VACUUM');
  }

  public analyze(): void {
    this.db.exec('ANALYZE');
  }

  // Close database connection
  public close(): void {
    this.db.close();
  }

  // Health check
  public healthCheck(): boolean {
    try {
      this.queryOne('SELECT 1 as test');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Backup methods
  public backup(backupPath: string): void {
    this.db.backup(backupPath);
  }

  // Migration support
  public getUserVersion(): number {
    const result = this.queryOne('PRAGMA user_version');
    return result?.user_version || 0;
  }

  public setUserVersion(version: number): void {
    this.db.exec(`PRAGMA user_version = ${version}`);
  }

  public runMigration(version: number, sql: string): void {
    this.transaction(() => {
      this.db.exec(sql);
      this.setUserVersion(version);
    });
  }
}