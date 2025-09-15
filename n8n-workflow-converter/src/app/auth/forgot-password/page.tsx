import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { PublicRoute } from '@/components/auth/protected-route';

export default function ForgotPasswordPage() {
  return (
    <PublicRoute>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <ForgotPasswordForm />
      </div>
    </PublicRoute>
  );
}