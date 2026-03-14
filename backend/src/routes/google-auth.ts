import type { FastifyInstance } from 'fastify';
import { getAuthUrl } from '../calendar.js';
import { setConnector, type ConnectorService } from '../store/connectors.js';
import { google } from 'googleapis';
import { config } from '../config.js';

export async function registerGoogleAuthRoutes(fastify: FastifyInstance): Promise<void> {
  const googleConfigured = !!(config.googleClientId && config.googleClientSecret);
  if (!googleConfigured) {
    fastify.log.warn('Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET); /auth/google will return 503.');
  }

  fastify.get<{ Querystring: { token?: string } }>('/auth/google', async (req, reply) => {
    if (!googleConfigured) {
      return reply.status(503).send(
        '<h1>Google OAuth not configured</h1><p>Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend <code>.env</code> (see <code>backend/.env.example</code>), then restart the server.</p>'
      );
    }
    const token = (req.query as { token?: string }).token;
    if (!token) {
      return reply.status(400).send('<h1>Missing token</h1><p>Open Connectors in the extension and click Connect on Google.</p>');
    }
    const state = Buffer.from(JSON.stringify({ token }), 'utf-8').toString('base64url');
    const authUrl = await getAuthUrl(state);
    return reply.redirect(authUrl);
  });

  fastify.get<{ Querystring: { code?: string; state?: string } }>('/auth/google/callback', async (req, reply) => {
    if (!googleConfigured) {
      return reply.status(503).send(
        '<h1>Google OAuth not configured</h1><p>Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend .env, then restart the server.</p>'
      );
    }
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      return reply.status(400).send('<h1>Missing code or state</h1>');
    }
    let token: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8')) as { token?: string };
      token = decoded.token ?? '';
    } catch {
      return reply.status(400).send('<h1>Invalid state</h1>');
    }
    if (!token) return reply.status(400).send('<h1>Invalid state</h1>');
    const redirectUri = config.googleRedirectUri || `${req.protocol}://${req.hostname}:${String(config.port)}/auth/google/callback`;
    const oauth2 = new google.auth.OAuth2(config.googleClientId, config.googleClientSecret, redirectUri);
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      return reply.status(400).send('<h1>No refresh token</h1><p>Try again and ensure you complete the consent screen.</p>');
    }
    let userId: string;
    try {
      const decoded = await fastify.jwt.verify(token) as { userId?: string };
      userId = decoded?.userId ?? '';
    } catch {
      return reply.status(401).send('<h1>Invalid or expired token</h1>');
    }
    if (!userId) return reply.status(401).send('<h1>Invalid token</h1>');
    const credentials = JSON.stringify({ refresh_token: refreshToken });
    await setConnector(userId, 'google' as ConnectorService, credentials);
    return reply.send(
      '<!DOCTYPE html><html><head><title>Connected</title></head><body><h1>Google connected</h1><p>Calendar and Docs are now available. You can close this tab and return to the extension.</p></body></html>'
    );
  });
}
