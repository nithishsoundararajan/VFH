import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PrivacyControlsService } from '@/lib/compliance/privacy-controls';
import { SecurityMiddleware } from '@/lib/security/security-middleware';
import { AuditLogger } from '@/lib/compliance/audit-logger';

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

    // Get user's privacy settings
    const privacySettings = await PrivacyControlsService.getPrivacySettings(context.userId!);

    if (!privacySettings) {
      return NextResponse.json(
        { error: 'Privacy settings not found' },
        { status: 404 }
      );
    }

    // Get consent history
    const consentHistory = await PrivacyControlsService.getConsentHistory(context.userId!);

    // Get data retention policies
    const retentionPolicies = PrivacyControlsService.getDataRetentionPolicies();

    const response = NextResponse.json({
      success: true,
      privacySettings,
      consentHistory,
      retentionPolicies
    });

    // Apply security headers
    Object.entries(context.securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Privacy settings API error:', error);
    return NextResponse.json(
      { error: 'Failed to get privacy settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const {
      analytics_consent,
      marketing_consent,
      functional_cookies,
      data_sharing_consent,
      email_notifications,
      security_notifications,
      data_retention_period,
      auto_delete_enabled
    } = body;

    // Validate data retention period
    if (data_retention_period !== undefined) {
      if (typeof data_retention_period !== 'number' || data_retention_period < 30 || data_retention_period > 2555) {
        return NextResponse.json(
          { error: 'Data retention period must be between 30 and 2555 days' },
          { status: 400 }
        );
      }
    }

    // Update privacy settings
    const updatedSettings = await PrivacyControlsService.updatePrivacySettings(
      context.userId!,
      {
        analytics_consent,
        marketing_consent,
        functional_cookies,
        data_sharing_consent,
        email_notifications,
        security_notifications,
        data_retention_period,
        auto_delete_enabled
      },
      context.ipAddress,
      context.userAgent
    );

    // Log the privacy settings update
    await AuditLogger.logPrivacyEvent(
      context.userId!,
      'privacy_settings_updated',
      context.ipAddress,
      context.userAgent,
      {
        updatedFields: Object.keys(body),
        newSettings: updatedSettings
      }
    );

    const response = NextResponse.json({
      success: true,
      privacySettings: updatedSettings,
      message: 'Privacy settings updated successfully'
    });

    // Apply security headers
    Object.entries(context.securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Privacy settings update API error:', error);
    return NextResponse.json(
      { error: 'Failed to update privacy settings' },
      { status: 500 }
    );
  }
}

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

    // Parse request body
    const body = await request.json();
    const { action, consentType, consentGiven } = body;

    if (action === 'record_consent') {
      if (!consentType || typeof consentGiven !== 'boolean') {
        return NextResponse.json(
          { error: 'Missing or invalid consent parameters' },
          { status: 400 }
        );
      }

      // Record consent
      const consentRecord = await PrivacyControlsService.recordConsent(
        context.userId!,
        consentType,
        consentGiven,
        context.ipAddress,
        context.userAgent
      );

      // Log the consent action
      await AuditLogger.logPrivacyEvent(
        context.userId!,
        consentGiven ? 'consent_given' : 'consent_withdrawn',
        context.ipAddress,
        context.userAgent,
        {
          consentType,
          consentRecord: consentRecord.id
        }
      );

      const response = NextResponse.json({
        success: true,
        consentRecord,
        message: `Consent ${consentGiven ? 'given' : 'withdrawn'} successfully`
      });

      // Apply security headers
      Object.entries(context.securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    if (action === 'apply_retention') {
      // Apply data retention policies
      const { deletedItems, errors } = await PrivacyControlsService.applyDataRetention(context.userId!);

      // Log the retention action
      await AuditLogger.logPrivacyEvent(
        context.userId!,
        'data_retention_applied',
        context.ipAddress,
        context.userAgent,
        {
          deletedItems,
          errors
        }
      );

      const response = NextResponse.json({
        success: errors.length === 0,
        deletedItems,
        errors,
        message: errors.length === 0 ? 'Data retention policies applied successfully' : 'Data retention completed with some errors'
      });

      // Apply security headers
      Object.entries(context.securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Privacy action API error:', error);
    return NextResponse.json(
      { error: 'Failed to process privacy action' },
      { status: 500 }
    );
  }
}