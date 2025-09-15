'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await resetPassword(email);
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    
    setLoading(false);
  };

  if (success) {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-600">Check Your Email</h1>
          <p className="text-gray-600 mt-2">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Click the link in the email to reset your password.
          </p>
        </div>
        
        <div className="text-center space-y-2">
          <Link href="/auth/login" className="block text-blue-600 hover:underline">
            Back to Sign In
          </Link>
          <button
            onClick={() => {
              setSuccess(false);
              setEmail('');
            }}
            className="block text-sm text-gray-600 hover:underline mx-auto"
          >
            Try a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="text-gray-600 mt-2">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending reset link...' : 'Send Reset Link'}
        </Button>
      </form>

      <div className="text-center">
        <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}