/**
 * Local file storage adapter for standalone deployment
 * Provides an alternative to Supabase Storage
 */

import { promises as fs, createReadStream, createWriteStream } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { StandaloneConfig } from '../config/standalone';

export interface StorageFile {
  id: string;
  name: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  hash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  generateThumbnail?: boolean;
  overwrite?: boolean;
}

export interface ListOptions {
  prefix?: string;
  limit?: number;
  offset?: number;
}

export class LocalStorageAdapter {
  private config: StandaloneConfig['storage'];
  private basePath: string;

  constructor(config: StandaloneConfig['storage']) {
    this.config = config;
    
    if (!config.path) {
      throw new Error('Local storage path is required');
    }

    this.basePath = config.path;
    this.ensureDirectoryExists(this.basePath);
  }

  private async ensureDirectoryExists(path: string): Promise<void> {
    try {
      await fs.access(path);
    } catch {
      await fs.mkdir(path, { recursive: true });
    }
  }

  private generateFileId(): string {
    return uuidv4();
  }

  private generateFilePath(bucket: string, fileId: string, originalName: string): string {
    const ext = extname(originalName);
    const fileName = `${fileId}${ext}`;
    return join(this.basePath, bucket, fileName);
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  private validateFile(file: Buffer | string, options: UploadOptions = {}): void {
    // Check file size
    const size = typeof file === 'string' ? Buffer.byteLength(file) : file.length;
    const maxSize = options.maxSize || this.config.options?.maxFileSize || 50 * 1024 * 1024;
    
    if (size > maxSize) {
      throw new Error(`File size ${size} exceeds maximum allowed size ${maxSize}`);
    }

    // Note: MIME type validation would need to be done at the API level
    // since we don't have the MIME type information here
  }

  // Core storage operations
  public async upload(
    bucket: string,
    file: Buffer | string,
    originalName: string,
    mimeType: string,
    options: UploadOptions = {}
  ): Promise<StorageFile> {
    // Validate file
    this.validateFile(file, options);

    // Validate MIME type
    const allowedTypes = options.allowedTypes || this.config.options?.allowedTypes;
    if (allowedTypes && !allowedTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }

    // Ensure bucket directory exists
    const bucketPath = join(this.basePath, bucket);
    await this.ensureDirectoryExists(bucketPath);

    // Generate file ID and path
    const fileId = this.generateFileId();
    const filePath = this.generateFilePath(bucket, fileId, originalName);

    // Check if file exists and handle overwrite
    try {
      await fs.access(filePath);
      if (!options.overwrite) {
        throw new Error(`File already exists: ${basename(filePath)}`);
      }
    } catch {
      // File doesn't exist, which is fine
    }

    // Write file
    if (typeof file === 'string') {
      await fs.writeFile(filePath, file, 'utf8');
    } else {
      await fs.writeFile(filePath, file);
    }

    // Calculate file hash and size
    const stats = await fs.stat(filePath);
    const hash = await this.calculateFileHash(filePath);

    const storageFile: StorageFile = {
      id: fileId,
      name: basename(filePath),
      originalName,
      path: filePath,
      size: stats.size,
      mimeType,
      hash,
      createdAt: stats.birthtime,
      updatedAt: stats.mtime,
    };

    return storageFile;
  }

  public async download(bucket: string, fileName: string): Promise<Buffer> {
    const filePath = join(this.basePath, bucket, fileName);
    
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error(`File not found: ${fileName}`);
    }
  }

  public async downloadStream(bucket: string, fileName: string): Promise<NodeJS.ReadableStream> {
    const filePath = join(this.basePath, bucket, fileName);
    
    try {
      await fs.access(filePath);
      return createReadStream(filePath);
    } catch (error) {
      throw new Error(`File not found: ${fileName}`);
    }
  }

  public async delete(bucket: string, fileName: string): Promise<void> {
    const filePath = join(this.basePath, bucket, fileName);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      throw new Error(`Failed to delete file: ${fileName}`);
    }
  }

  public async exists(bucket: string, fileName: string): Promise<boolean> {
    const filePath = join(this.basePath, bucket, fileName);
    
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async getFileInfo(bucket: string, fileName: string): Promise<StorageFile | null> {
    const filePath = join(this.basePath, bucket, fileName);
    
    try {
      const stats = await fs.stat(filePath);
      const hash = await this.calculateFileHash(filePath);
      
      return {
        id: basename(fileName, extname(fileName)),
        name: fileName,
        originalName: fileName,
        path: filePath,
        size: stats.size,
        mimeType: 'application/octet-stream', // Default, should be stored separately
        hash,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  public async list(bucket: string, options: ListOptions = {}): Promise<StorageFile[]> {
    const bucketPath = join(this.basePath, bucket);
    
    try {
      const files = await fs.readdir(bucketPath);
      let filteredFiles = files;

      // Apply prefix filter
      if (options.prefix) {
        filteredFiles = files.filter(file => file.startsWith(options.prefix!));
      }

      // Apply pagination
      if (options.offset) {
        filteredFiles = filteredFiles.slice(options.offset);
      }

      if (options.limit) {
        filteredFiles = filteredFiles.slice(0, options.limit);
      }

      // Get file info for each file
      const fileInfoPromises = filteredFiles.map(async (fileName) => {
        return await this.getFileInfo(bucket, fileName);
      });

      const fileInfos = await Promise.all(fileInfoPromises);
      return fileInfos.filter((info): info is StorageFile => info !== null);
    } catch {
      return [];
    }
  }

  public async copy(
    sourceBucket: string,
    sourceFileName: string,
    destBucket: string,
    destFileName: string
  ): Promise<void> {
    const sourcePath = join(this.basePath, sourceBucket, sourceFileName);
    const destPath = join(this.basePath, destBucket, destFileName);

    // Ensure destination bucket exists
    await this.ensureDirectoryExists(join(this.basePath, destBucket));

    try {
      await fs.copyFile(sourcePath, destPath);
    } catch (error) {
      throw new Error(`Failed to copy file from ${sourceFileName} to ${destFileName}`);
    }
  }

  public async move(
    sourceBucket: string,
    sourceFileName: string,
    destBucket: string,
    destFileName: string
  ): Promise<void> {
    await this.copy(sourceBucket, sourceFileName, destBucket, destFileName);
    await this.delete(sourceBucket, sourceFileName);
  }

  // Bucket operations
  public async createBucket(bucketName: string): Promise<void> {
    const bucketPath = join(this.basePath, bucketName);
    await this.ensureDirectoryExists(bucketPath);
  }

  public async deleteBucket(bucketName: string, force: boolean = false): Promise<void> {
    const bucketPath = join(this.basePath, bucketName);
    
    if (!force) {
      // Check if bucket is empty
      const files = await fs.readdir(bucketPath);
      if (files.length > 0) {
        throw new Error(`Bucket ${bucketName} is not empty. Use force=true to delete.`);
      }
    }

    await fs.rmdir(bucketPath, { recursive: force });
  }

  public async listBuckets(): Promise<string[]> {
    try {
      const items = await fs.readdir(this.basePath, { withFileTypes: true });
      return items
        .filter(item => item.isDirectory())
        .map(item => item.name);
    } catch {
      return [];
    }
  }

  // Utility methods
  public async getStorageUsage(bucket?: string): Promise<{ files: number; size: number }> {
    const targetPath = bucket ? join(this.basePath, bucket) : this.basePath;
    
    let totalFiles = 0;
    let totalSize = 0;

    const calculateSize = async (dirPath: string): Promise<void> => {
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = join(dirPath, item.name);
          
          if (item.isDirectory()) {
            await calculateSize(itemPath);
          } else {
            const stats = await fs.stat(itemPath);
            totalFiles++;
            totalSize += stats.size;
          }
        }
      } catch {
        // Ignore errors for inaccessible directories
      }
    };

    await calculateSize(targetPath);

    return { files: totalFiles, size: totalSize };
  }

  public async cleanup(bucket: string, olderThanDays: number): Promise<number> {
    const bucketPath = join(this.basePath, bucket);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;

    try {
      const files = await fs.readdir(bucketPath);
      
      for (const fileName of files) {
        const filePath = join(bucketPath, fileName);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
    } catch {
      // Ignore errors
    }

    return deletedCount;
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      await fs.access(this.basePath);
      
      // Try to write a test file
      const testFile = join(this.basePath, '.health-check');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      return true;
    } catch {
      return false;
    }
  }

  // Backup methods
  public async backup(backupPath: string, bucket?: string): Promise<void> {
    const sourcePath = bucket ? join(this.basePath, bucket) : this.basePath;
    const destPath = join(backupPath, bucket || 'storage');

    await this.ensureDirectoryExists(dirname(destPath));

    // Use system cp command for efficient copying
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      await execAsync(`cp -r "${sourcePath}" "${destPath}"`);
    } catch (error) {
      throw new Error(`Backup failed: ${error}`);
    }
  }

  public async restore(backupPath: string, bucket?: string): Promise<void> {
    const sourcePath = join(backupPath, bucket || 'storage');
    const destPath = bucket ? join(this.basePath, bucket) : this.basePath;

    // Ensure destination directory exists
    await this.ensureDirectoryExists(dirname(destPath));

    // Use system cp command for efficient copying
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      await execAsync(`cp -r "${sourcePath}" "${destPath}"`);
    } catch (error) {
      throw new Error(`Restore failed: ${error}`);
    }
  }
}