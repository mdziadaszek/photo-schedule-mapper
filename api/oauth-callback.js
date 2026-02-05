/**
 * Serverless function for Asana OAuth token exchange
 * This function securely handles the OAuth callback and exchanges
 * the authorization code for an access token using the client secret.
 *
 * Compatible with Vercel and Netlify serverless functions.
 *
 * Environment Variables Required:
 * - ASANA_CLIENT_SECRET: Your Asana OAuth client secret
 *
 * Deployment:
 * - Vercel: Deploy to /api/oauth-callback
 * - Netlify: Deploy to /.netlify/functions/oauth-callback
 */

// Asana OAuth configuration
const ASANA_CLIENT_ID = '1213130967595709';
const ASANA_TOKEN_URL = 'https://app.asana.com/-/oauth_token';

/**
 * Main handler function
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    });
  }

  try {
    // Parse request body
    const { code, code_verifier, redirect_uri } = req.body;

    // Validate required parameters
    if (!code) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required parameter: code'
      });
    }

    if (!code_verifier) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required parameter: code_verifier'
      });
    }

    if (!redirect_uri) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required parameter: redirect_uri'
      });
    }

    // Get client secret from environment variable
    const clientSecret = "0d3e65078b01aaa96960338bec1d4902";

    if (!clientSecret) {
      console.error('ASANA_CLIENT_SECRET environment variable not set');
      return res.status(500).json({
        error: 'Server Configuration Error',
        message: 'OAuth client secret not configured'
      });
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(ASANA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: ASANA_CLIENT_ID,
        client_secret: clientSecret,
        redirect_uri: redirect_uri,
        code: code,
        code_verifier: code_verifier
      })
    });

    // Check if token exchange was successful
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Asana token exchange failed:', errorData);

      return res.status(tokenResponse.status).json({
        error: 'Token Exchange Failed',
        message: errorData.error_description || errorData.error || 'Failed to exchange authorization code for token',
        details: errorData
      });
    }

    // Parse token response
    const tokenData = await tokenResponse.json();

    // Return the access token to the client
    // Note: Only return necessary fields for security
    return res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type
    });

  } catch (error) {
    console.error('Error in OAuth callback handler:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred during authentication'
    });
  }
}

/**
 * For Netlify Functions (alternative export)
 * If deploying to Netlify, you can also use this format:
 */
export const netlifyHandler = handler;
