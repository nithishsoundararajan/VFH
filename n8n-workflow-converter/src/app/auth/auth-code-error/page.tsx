import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Authentication Error</h1>
          <p className="text-gray-600 mt-2">
            There was a problem signing you in
          </p>
        </div>

        <Alert variant="destructive">
          <AlertDescription>
            The authentication code was invalid or has expired. Please try signing in again.
          </AlertDescription>
        </Alert>

        <div className="text-center space-y-4">
          <Link href="/auth/login">
            <Button className="w-full">
              Back to Sign In
            </Button>
          </Link>
          
          <p className="text-sm text-gray-500">
            If you continue to experience issues, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}