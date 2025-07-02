/**
 * Debug script to test Google OAuth configuration
 */
const { GoogleCalendarService } = require('./server/google-calendar-service.ts');

async function testOAuthConfig() {
    console.log('🔐 Testing Google OAuth Configuration...');
    
    // Check environment variables
    console.log('Environment variables:');
    console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');
    console.log('  REPLIT_DOMAINS:', process.env.REPLIT_DOMAINS || 'not set');
    console.log('  REPL_SLUG:', process.env.REPL_SLUG || 'not set');
    console.log('  GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set (length: ' + process.env.GOOGLE_CLIENT_ID.length + ')' : 'Missing');
    console.log('  GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
    
    // Expected redirect URI
    const redirectUri = process.env.NODE_ENV === 'production' 
        ? `https://${process.env.REPL_SLUG}.replit.app/oauth/callback`
        : `https://${process.env.REPLIT_DOMAINS}/oauth/callback`;
    
    console.log('\n🎯 Expected redirect URI:', redirectUri);
    
    try {
        const service = new GoogleCalendarService();
        const authUrl = service.getAuthUrl();
        
        console.log('\n🚀 Generated OAuth URL:');
        console.log(authUrl);
        
        // Parse the URL to extract the redirect_uri parameter
        const url = new URL(authUrl);
        const actualRedirectUri = url.searchParams.get('redirect_uri');
        console.log('\n📍 Actual redirect_uri in OAuth URL:', actualRedirectUri);
        
        // Check if they match
        if (redirectUri === actualRedirectUri) {
            console.log('✅ Redirect URIs match!');
        } else {
            console.log('❌ Redirect URI mismatch:');
            console.log('  Expected:', redirectUri);
            console.log('  Actual:  ', actualRedirectUri);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testOAuthConfig();