import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serverFileStorage } from '@/lib/services/file-storage-service';
import { SecurityMiddleware } from '@/lib/security/security-middleware';
import { InputValidator } from '@/lib/security/input-validator';

export async function POST(request: NextRequest) {
  try {
    // Apply comprehensive security checks
    const securityResult = await SecurityMiddleware.secure(request, {
      enableRateLimit: true,
      enableVirusScanning: true,
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

    // Parse form data with validation
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as string;
    const projectId = formData.get('projectId') as string;
    const compress = formData.get('compress') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate bucket
    if (!bucket || !['workflow-files', 'generated-projects', 'user-uploads'].includes(bucket)) {
      return NextResponse.json(
        { error: 'Invalid bucket specified' },
        { status: 400 }
      );
    }

    // Secure file upload with virus scanning
    const secureUploadResult = await SecurityMiddleware.secureFileUpload(file, context.userId!);
    
    if (!secureUploadResult.safe) {
      return NextResponse.json(
        { 
          error: secureUploadResult.error,
          quarantined: secureUploadResult.quarantined,
          scanResult: secureUploadResult.scanResult
        },
        { status: 400 }
      );
    }

    // Generate secure file path with user isolation
    const timestamp = Date.now();
    const sanitizedFileName = InputValidator.sanitizeFileName(file.name);
    let filePath: string;

    if (projectId) {
      filePath = `${context.userId}/${projectId}/${timestamp}_${sanitizedFileName}`;
    } else {
      filePath = `${context.userId}/${timestamp}_${sanitizedFileName}`;
    }

    // Compress file if requested and applicable
    let fileToUpload = file;
    if (compress) {
      try {
        fileToUpload = await serverFileStorage.compressFile(file);
      } catch (error) {
        console.warn('File compression failed, using original file:', error);
      }
    }

    // Upload file
    const { data: fileMetadata, error: uploadError } = await serverFileStorage.uploadFile({
      bucket: bucket as any,
      path: filePath,
      file: fileToUpload,
      contentType: file.type,
      upsert: false
    });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError },
        { status: 500 }
      );
    }

    // Update project with file path if projectId provided
    if (projectId && bucket === 'workflow-files') {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          workflow_file_path: filePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', context.userId);

      if (updateError) {
        console.error('Failed to update project with file path:', updateError);
        // Don't fail the upload, just log the error
      }
    }

    // Log successful upload with security context
    if (projectId) {
      await supabase.from('generation_logs').insert({
        project_id: projectId,
        log_level: 'info',
        message: `File "${sanitizedFileName}" uploaded successfully to ${bucket} (Scan: ${secureUploadResult.scanResult?.safe ? 'Clean' : 'Skipped'})`
      });
    }

    // Log security event
    await supabase.from('security_events').insert({
      user_id: context.userId,
      event_type: 'file_upload_success',
      ip_address: context.ipAddress,
      user_agent: context.userAgent,
      details: {
        fileName: sanitizedFileName,
        fileSize: file.size,
        bucket: bucket,
        scanResult: secureUploadResult.scanResult
      },
      severity: 'low'
    });

    const response = NextResponse.json({
      success: true,
      file: fileMetadata,
      scanResult: secureUploadResult.scanResult,
      message: 'File uploaded successfully'
    });

    // Apply security headers
    Object.entries(context.securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('File upload API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle file upload progress (for chunked uploads)
export async function PATCH(request: NextRequest) {
  try {
    // Apply security checks for chunked uploads
    const securityResult = await SecurityMiddleware.secure(request, {
      enableRateLimit: true,
      enableVirusScanning: false, // Will scan complete file later
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

    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket');
    const path = searchParams.get('path');
    const chunkIndex = parseInt(searchParams.get('chunkIndex') || '0');
    const totalChunks = parseInt(searchParams.get('totalChunks') || '1');

    if (!bucket || !path) {
      return NextResponse.json(
        { error: 'Missing bucket or path parameters' },
        { status: 400 }
      );
    }

    // Verify user owns this file path
    if (!path.startsWith(context.userId!)) {
      return NextResponse.json(
        { error: 'Unauthorized file access' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;

    if (!chunk) {
      return NextResponse.json(
        { error: 'No chunk provided' },
        { status: 400 }
      );
    }

    // For now, we'll handle this as a simple upload
    // In a production system, you might implement proper resumable uploads
    const chunkPath = `${path}.chunk.${chunkIndex}`;
    
    const { error: uploadError } = await serverFileStorage.uploadFile({
      bucket: bucket as any,
      path: chunkPath,
      file: chunk,
      upsert: true
    });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      chunkIndex,
      totalChunks,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`
    });

    // Apply security headers
    Object.entries(context.securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Chunk upload API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}