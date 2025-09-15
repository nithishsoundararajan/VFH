import { createClient } from './client';

export async function testDatabaseConnection() {
  const supabase = createClient();
  
  try {
    console.log('Testing Supabase connection...');
    
    // Test auth first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth test failed:', authError);
      return {
        success: false,
        error: `Authentication error: ${authError.message}`,
        details: authError,
        needsSetup: false
      };
    }
    
    console.log('Auth test result:', { user: user?.id });
    
    // Test basic connection by trying to access profiles table
    const { data: connectionTest, error: connectionError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      console.error('Connection test failed:', connectionError);
      
      // Check if it's a table not found error (common when migrations haven't run)
      const isTableNotFound = connectionError.message?.includes('relation') && 
                              connectionError.message?.includes('does not exist') ||
                              connectionError.message?.includes('Could not find the table') ||
                              connectionError.code === 'PGRST106';
      
      return {
        success: false,
        error: isTableNotFound 
          ? 'Database tables not found. The database needs to be set up.'
          : `Database error: ${connectionError.message}`,
        details: connectionError,
        needsSetup: isTableNotFound
      };
    }
    
    console.log('Connection test successful');
    
    return {
      success: true,
      user: user,
      message: 'Database connection and auth working',
      needsSetup: false
    };
    
  } catch (error) {
    console.error('Unexpected error during connection test:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error,
      needsSetup: false
    };
  }
}