import { ProtectedRoute } from '@/components/auth/protected-route';
import { AIProviderSettings } from '@/components/settings/ai-provider-settings';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-2 text-gray-600">
              Manage your account settings and preferences.
            </p>
          </div>
          
          <div className="space-y-6">
            <AIProviderSettings />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}