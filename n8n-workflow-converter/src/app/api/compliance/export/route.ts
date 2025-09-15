import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DataExportService } from '@/lib/compliance/data-export';
import { SecurityMiddleware } from '@/lib/security/security-middleware';
import { AuditLogger } from '@/lib/compliance/audit-logger';

export async function POST(request: NextRequest) {
  try {
    // Apply security checks
    const securityResult = await SecurityMiddleware.secure(request, {
      enableRateLimit: true,
      enableVirusScanning: false,
      enableCSRFProtection: true,
      enableAbuseDetection: true,
      enableInputValidation: true,
      requireAuth: true
    });

    if (!securityResult.allowed) {
      return securityResult.response!;
    }

    const { context } = securityResult;
    const supabase = await createClient();

    // Parse request body
    const body = await request.json();
    const {
      includeProjects = true,
      includeAnalytics = true,
      includeSecurityEvents = false, // Sensitive data, opt-in only
      includeSessions = false, // Sensitive data, opt-in only
      includeFiles = true,
      format = 'json',
      dateRange
    } = body;

    // Validate date range if provided
    let parsedDateRange;
    if (dateRange) {
      parsedDateRange = {
        from: new Date(dateRange.from),
        to: new Date(dateRange.to)
      };

      if (parsedDateRange.from > parsedDateRange.to) {
        return NextResponse.json(
          { error: 'Invalid date range: from date must be before to date' },
          { status: 400 }
        );
      }
    }

    // Create export record
    const { data: exportRecord, error: exportError } = await supabase
      .from('data_exports')
      .insert({
        user_id: context.userId,
        export_type: 'gdpr',
        status: 'processing',
        options: {
          includeProjects,
          includeAnalytics,
          includeSecurityEvents,
          includeSessions,
          includeFiles,
          format,
          dateRange: parsedDateRange
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single();

    if (exportError) {
      throw exportError;
    }

    try {
      // Perform the export
      const { data: exportedData, zipBuffer } = await DataExportService.exportUserData(
        context.userId!,
        {
          includeProjects,
          includeAnalytics,
          includeSecurityEvents,
          includeSessions,
          includeFiles,
          format,
          dateRange: parsedDateRange
        }
      );

      // Store the export file (in a real implementation, you'd store this in Supabase Storage)
      const fileName = `data-export-${context.userId}-${Date.now()}.zip`;
      const filePath = `exports/${context.userId}/${fileName}`;

      if (zipBuffer) {
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('user-exports')
          .upload(filePath, zipBuffer, {
            contentType: 'application/zip',
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }
      }

      // Update export record
      await supabase
        .from('data_exports')
        .update({
          status: 'completed',
          file_path: filePath,
          file_size: zipBuffer?.length || 0,
          completed_at: new Date().toISOString()
        })
        .eq('id', exportRecord.id);

      // Log the export
      await AuditLogger.logPrivacyEvent(
        context.userId!,
        'data_export',
        context.ipAddress,
        context.userAgent,
        {
          exportId: exportRecord.id,
          options: {
            includeProjects,
            includeAnalytics,
            includeSecurityEvents,
            includeSessions,
            includeFiles,
            format
          },
          fileSize: zipBuffer?.length || 0
        }
      );

      const response = NextResponse.json({
        success: true,
        exportId: exportRecord.id,
        message: 'Data export completed successfully',
        downloadUrl: `/api/compliance/export/${exportRecord.id}/download`,
        expiresAt: exportRecord.expires_at,
        fileSize: zipBuffer?.length || 0
      });

      // Apply security headers
      Object.entries(context.securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;

    } catch (exportError) {
      // Update export record as failed
      await supabase
        .from('data_exports')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', exportRecord.id);

      throw exportError;
    }

  } catch (error) {
    console.error('Data export API error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Apply security checks
    const securityResult = await SecurityMiddleware.secure(request, {
      enableRateLimit: true,
      enableVirusScanning: false,
      enableCSRFProtection: false, // GET request
      enableAbuseDetection: true,
      enableInputValidation: false,
      requireAuth: true
    });

    if (!securityResult.allowed) {
      return securityResult.response!;
    }

    const { context } = securityResult;
    const supabase = await createClient();

    // Get user's export history
    const { data: exports, error } = await supabase
      .from('data_exports')
      .select('*')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    const response = NextResponse.json({
      success: true,
      exports: exports || []
    });

    // Apply security headers
    Object.entries(context.securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Export history API error:', error);
    return NextResponse.json(
      { error: 'Failed to get export history' },
      { status: 500 }
    );
  }
}