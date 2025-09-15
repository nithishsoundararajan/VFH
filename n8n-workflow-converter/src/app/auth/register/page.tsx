import { RegisterForm } from '@/components/auth/register-form';
import { PublicRoute } from '@/components/auth/protected-route';

export default function RegisterPage() {
  return (
    <PublicRoute>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <RegisterForm />
      </div>
    </PublicRoute>
  );
}