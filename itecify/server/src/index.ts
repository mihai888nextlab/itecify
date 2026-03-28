import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import oauth from '@fastify/oauth2';

import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import collaborationRoutes from './routes/collaboration.js';
import executionRoutes from './routes/execution.js';
import aiRoutes from './routes/ai.js';
import terminalRoutes from './routes/terminal.js';

async function start() {
  const fastify = Fastify({
    logger: true,
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Plugins
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(projectRoutes, { prefix: '/api/projects' });
  await fastify.register(collaborationRoutes, { prefix: '/api/collaborate' });
  await fastify.register(executionRoutes, { prefix: '/api/execute' });
  await fastify.register(aiRoutes, { prefix: '/api/ai' });
  await fastify.register(terminalRoutes, { prefix: '/api/terminal' });

  // Google OAuth
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    await fastify.register(oauth, {
      name: 'google',
      scope: ['profile', 'email'],
      credentials: {
        client: {
          id: process.env.GOOGLE_CLIENT_ID,
          secret: process.env.GOOGLE_CLIENT_SECRET,
        },
        auth: {
          authorizeHost: 'https://accounts.google.com',
          authorizePath: '/o/oauth2/v2/auth',
          tokenHost: 'https://oauth2.googleapis.com',
          tokenPath: '/token',
        },
      },
      startRedirectPath: '/api/auth/google',
      callbackUri: 'http://localhost:4000/api/auth/google/callback',
    });

    fastify.get('/api/auth/google/callback', async (request, reply) => {
      try {
        const result = await fastify.google.getAccessTokenFromAuthorizationCodeFlow(request);
        const token = result.token.access_token;

        // Get user info from Google
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const googleUser = await response.json();

        console.log('Google user:', googleUser);

        if (!googleUser.email) {
          return reply.redirect(302, 'http://localhost:3000/auth/login?error=email_required');
        }

        // Find or create user
        let user = await fastify.prisma.user.findUnique({
          where: { email: googleUser.email },
        });

        if (!user) {
          user = await fastify.prisma.user.create({
            data: {
              email: googleUser.email,
              name: googleUser.name || googleUser.email.split('@')[0],
              avatarUrl: googleUser.picture,
              provider: 'google',
              providerId: googleUser.id,
            },
          });
        }

        const tokens = fastify.generateTokens({
          id: user.id,
          email: user.email,
          name: user.name,
        });

        reply.setCookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Redirect with token so frontend can store it
        reply.redirect(302, `http://localhost:3000/auth/callback?token=${tokens.accessToken}&name=${encodeURIComponent(user.name)}`);
      } catch (error) {
        fastify.log.error('Google OAuth callback error:', error);
        reply.redirect(302, 'http://localhost:3000/auth/login?error=oauth_failed');
      }
    });
  } else {
    // Placeholder route when OAuth not configured
    fastify.get('/api/auth/github', async (request, reply) => {
      return reply.code(501).send({ 
        error: 'OAuth not configured',
        message: 'GitHub OAuth requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env file'
      });
    });
  }

  // GitHub OAuth
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    await fastify.register(oauth, {
      name: 'github',
      scope: ['user:email'],
      credentials: {
        client: {
          id: process.env.GITHUB_CLIENT_ID,
          secret: process.env.GITHUB_CLIENT_SECRET,
        },
        auth: {
          authorizeHost: 'https://github.com',
          authorizePath: '/login/oauth/authorize',
          tokenHost: 'https://github.com',
          tokenPath: '/login/oauth/access_token',
        },
      },
      startRedirectPath: '/api/auth/github',
      callbackUri: 'http://localhost:4000/api/auth/github/callback',
    });

    fastify.get('/api/auth/github/callback', async (request, reply) => {
      try {
        const result = await fastify.github.getAccessTokenFromAuthorizationCodeFlow(request);
        const token = result.token.access_token;

        // Get user info from GitHub
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'iTECify',
          },
        });
        const githubUser = await response.json();

        // GitHub may not return email, fetch it separately if needed
        let email = githubUser.email;
        if (!email) {
          const emailResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': 'iTECify',
            },
          });
          const emails = await emailResponse.json();
          const primaryEmail = emails.find((e: any) => e.primary && e.verified);
          email = primaryEmail?.email || emails[0]?.email;
        }

        if (!email) {
          return reply.redirect(302, 'http://localhost:3000/auth/login?error=email_required');
        }

        let user = await fastify.prisma.user.findFirst({
          where: { 
            OR: [
              { provider: 'github', providerId: String(githubUser.id) },
              { email: email }
            ]
          },
        });

        if (!user) {
          user = await fastify.prisma.user.create({
            data: {
              email,
              name: githubUser.name || githubUser.login,
              avatarUrl: githubUser.avatar_url,
              provider: 'github',
              providerId: String(githubUser.id),
            },
          });
        }

        const tokens = fastify.generateTokens({
          id: user.id,
          email: user.email,
          name: user.name,
        });

        reply.setCookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Redirect with token so frontend can store it
        reply.redirect(302, `http://localhost:3000/auth/callback?token=${tokens.accessToken}&name=${encodeURIComponent(user.name)}`);
      } catch (error) {
        fastify.log.error('GitHub OAuth callback error:', error);
        reply.redirect(302, 'http://localhost:3000/auth/login?error=oauth_failed');
      }
    });
  }

  const port = Number(process.env.PORT) || 4000;
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
