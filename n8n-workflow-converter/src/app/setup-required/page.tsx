import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SetupRequiredPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Setup Required
          </h1>
          <p className="text-gray-600">
            Please configure your environment variables to continue
          </p>
        </div>

        <Alert className="mb-8">
          <AlertDescription>
            <strong>Configuration Missing:</strong> Your Supabase environment variables are not properly configured. 
            Please follow the steps below to set up your project.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Create a Supabase Project</CardTitle>
              <CardDescription>
                If you haven't already, create a new Supabase project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">supabase.com</a></li>
                <li>Sign up or log in to your account</li>
                <li>Click "New Project" and fill in the details</li>
                <li>Wait for your project to be created (this may take a few minutes)</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 2: Get Your Project Credentials</CardTitle>
              <CardDescription>
                Find your project URL and API keys in the Supabase dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>In your Supabase project dashboard, go to <strong>Settings → API</strong></li>
                <li>Copy the <strong>Project URL</strong></li>
                <li>Copy the <strong>anon/public key</strong></li>
                <li>Copy the <strong>service_role key</strong> (keep this secret!)</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 3: Configure Environment Variables</CardTitle>
              <CardDescription>
                Update your .env.local file with your Supabase credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Open the <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file in your project root and replace the placeholder values:
              </p>
              
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                <div className="space-y-1">
                  <div><span className="text-gray-400"># Replace with your actual Supabase project URL</span></div>
                  <div><span className="text-green-400">NEXT_PUBLIC_SUPABASE_URL</span>=https://your-project-id.supabase.co</div>
                  <div className="mt-2"><span className="text-gray-400"># Replace with your actual anon key</span></div>
                  <div><span className="text-green-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>=your_actual_anon_key_here</div>
                  <div className="mt-2"><span className="text-gray-400"># Replace with your actual service role key</span></div>
                  <div><span className="text-green-400">SUPABASE_SERVICE_ROLE_KEY</span>=your_actual_service_role_key_here</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 4: Set Up Database Schema</CardTitle>
              <CardDescription>
                Run the database migrations to create the required tables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>In your Supabase dashboard, go to <strong>SQL Editor</strong></li>
                <li>Run the migration files located in <code className="bg-gray-100 px-2 py-1 rounded">supabase/migrations/</code></li>
                <li>Start with <code className="bg-gray-100 px-2 py-1 rounded">001_initial_schema.sql</code></li>
                <li>Then run <code className="bg-gray-100 px-2 py-1 rounded">002_rls_policies.sql</code></li>
                <li>Finally run <code className="bg-gray-100 px-2 py-1 rounded">003_storage_buckets.sql</code></li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 5: Restart the Development Server</CardTitle>
              <CardDescription>
                After updating your environment variables, restart the server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono">
                <div>npm run dev</div>
              </div>
              <p className="text-sm text-gray-600">
                Once you've completed all steps and restarted the server, you should be able to access the authentication features.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Optional: VirusTotal API Key</CardTitle>
              <CardDescription>
                For enhanced security scanning of uploaded files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to <a href="https://www.virustotal.com/gui/my-apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">VirusTotal API Key page</a></li>
                <li>Sign up or log in to get your free API key</li>
                <li>Add it to your <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file:</li>
              </ol>
              
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono">
                <div><span className="text-green-400">VIRUSTOTAL_API_KEY</span>=your_virustotal_api_key_here</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? Check the <code className="bg-gray-100 px-2 py-1 rounded">README.md</code> file for more detailed instructions.
          </p>
        </div>
      </div>
    </div>
  );
}