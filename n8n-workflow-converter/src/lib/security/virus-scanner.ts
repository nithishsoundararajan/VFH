import crypto from 'crypto';

export interface VirusScanResult {
  safe: boolean;
  scanId?: string;
  permalink?: string;
  positives?: number;
  total?: number;
  message?: string;
  quarantined?: boolean;
}

export interface QuarantineInfo {
  id: string;
  fileName: string;
  userId: string;
  scanResult: VirusScanResult;
  quarantinedAt: Date;
  reason: string;
}

/**
 * VirusTotal integration for file scanning
 */
export class VirusScanner {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.virustotal.com/vtapi/v2';
  private readonly maxFileSize = 32 * 1024 * 1024; // 32MB VirusTotal limit

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.VIRUSTOTAL_API_KEY || '';
  }

  /**
   * Scan file for malware using VirusTotal API
   */
  async scanFile(file: File | Buffer, fileName: string): Promise<VirusScanResult> {
    if (!this.apiKey) {
      console.warn('VirusTotal API key not configured, skipping scan');
      return { safe: true, message: 'Scan skipped - API key not configured' };
    }

    try {
      const fileBuffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
      
      if (fileBuffer.length > this.maxFileSize) {
        return { safe: false, message: 'File too large for scanning' };
      }

      // Calculate file hash for quick lookup
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // First, check if we already have a report for this file
      const existingReport = await this.getReport(fileHash);
      if (existingReport && existingReport.scanId) {
        return existingReport;
      }

      // Submit file for scanning
      const scanResult = await this.submitFile(fileBuffer, fileName);
      
      if (!scanResult.scanId) {
        return { safe: false, message: 'Failed to submit file for scanning' };
      }

      // Wait a moment and try to get the report
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const report = await this.getReport(scanResult.scanId);
      return report || { safe: false, message: 'Scan in progress, please try again later' };

    } catch (error) {
      console.error('VirusTotal scan error:', error);
      return { safe: false, message: 'Scan failed due to technical error' };
    }
  }

  /**
   * Submit file to VirusTotal for scanning
   */
  private async submitFile(fileBuffer: Buffer, fileName: string): Promise<VirusScanResult> {
    const formData = new FormData();
    formData.append('apikey', this.apiKey);
    formData.append('file', new Blob([fileBuffer]), fileName);

    const response = await fetch(`${this.baseUrl}/file/scan`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`VirusTotal API error: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      safe: result.response_code === 1,
      scanId: result.scan_id,
      permalink: result.permalink,
      message: result.verbose_msg
    };
  }

  /**
   * Get scan report from VirusTotal
   */
  private async getReport(resource: string): Promise<VirusScanResult> {
    const response = await fetch(`${this.baseUrl}/file/report?apikey=${this.apiKey}&resource=${resource}`);
    
    if (!response.ok) {
      throw new Error(`VirusTotal API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.response_code === 0) {
      return { safe: false, message: 'File not found in VirusTotal database' };
    }

    if (result.response_code === -2) {
      return { safe: false, message: 'Scan still in progress' };
    }

    const positives = result.positives || 0;
    const total = result.total || 0;
    const safe = positives === 0;

    return {
      safe,
      scanId: result.scan_id,
      permalink: result.permalink,
      positives,
      total,
      message: safe ? 'File is clean' : `${positives}/${total} engines detected threats`
    };
  }

  /**
   * Scan URL for malicious content
   */
  async scanUrl(url: string): Promise<VirusScanResult> {
    if (!this.apiKey) {
      return { safe: true, message: 'URL scan skipped - API key not configured' };
    }

    try {
      const formData = new FormData();
      formData.append('apikey', this.apiKey);
      formData.append('url', url);

      const response = await fetch(`${this.baseUrl}/url/scan`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`VirusTotal API error: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        safe: result.response_code === 1,
        scanId: result.scan_id,
        permalink: result.permalink,
        message: result.verbose_msg
      };

    } catch (error) {
      console.error('VirusTotal URL scan error:', error);
      return { safe: false, message: 'URL scan failed' };
    }
  }
}

/**
 * File quarantine system for suspicious uploads
 */
export class FileQuarantine {
  private quarantinedFiles = new Map<string, QuarantineInfo>();

  /**
   * Quarantine a suspicious file
   */
  async quarantineFile(
    fileId: string,
    fileName: string,
    userId: string,
    scanResult: VirusScanResult,
    reason: string
  ): Promise<void> {
    const quarantineInfo: QuarantineInfo = {
      id: fileId,
      fileName,
      userId,
      scanResult,
      quarantinedAt: new Date(),
      reason
    };

    this.quarantinedFiles.set(fileId, quarantineInfo);
    
    // Log quarantine action
    console.warn(`File quarantined: ${fileName} (User: ${userId}, Reason: ${reason})`);
    
    // In a production system, you would:
    // 1. Move file to quarantine storage
    // 2. Log to security monitoring system
    // 3. Notify administrators
    // 4. Store quarantine info in database
  }

  /**
   * Check if file is quarantined
   */
  isQuarantined(fileId: string): boolean {
    return this.quarantinedFiles.has(fileId);
  }

  /**
   * Get quarantine information
   */
  getQuarantineInfo(fileId: string): QuarantineInfo | undefined {
    return this.quarantinedFiles.get(fileId);
  }

  /**
   * Release file from quarantine (admin action)
   */
  async releaseFromQuarantine(fileId: string, adminUserId: string): Promise<boolean> {
    const quarantineInfo = this.quarantinedFiles.get(fileId);
    if (!quarantineInfo) {
      return false;
    }

    this.quarantinedFiles.delete(fileId);
    
    console.info(`File released from quarantine: ${quarantineInfo.fileName} (Admin: ${adminUserId})`);
    
    return true;
  }

  /**
   * Get all quarantined files for a user
   */
  getUserQuarantinedFiles(userId: string): QuarantineInfo[] {
    return Array.from(this.quarantinedFiles.values())
      .filter(info => info.userId === userId);
  }

  /**
   * Clean up old quarantined files (older than 30 days)
   */
  async cleanupOldQuarantinedFiles(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const [fileId, info] of this.quarantinedFiles.entries()) {
      if (info.quarantinedAt < thirtyDaysAgo) {
        this.quarantinedFiles.delete(fileId);
        console.info(`Cleaned up old quarantined file: ${info.fileName}`);
      }
    }
  }
}

// Singleton instances
export const virusScanner = new VirusScanner();
export const fileQuarantine = new FileQuarantine();