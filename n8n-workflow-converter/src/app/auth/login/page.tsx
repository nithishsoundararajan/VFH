import { LoginForm } from '@/components/auth/login-form';
import { PublicRoute } from '@/components/auth/protected-route';

export default function LoginPage() {
  return (
    <PublicRoute>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <LoginForm />
      </div>
    </PublicRoute>
  );
}