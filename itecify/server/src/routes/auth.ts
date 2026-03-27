import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existingUser = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return reply.code(400).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await fastify.prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name,
        provider: 'local',
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

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

    return { user, ...tokens };
  });

  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);

    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
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

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    };
  });

  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('refreshToken', { path: '/' });
    return { message: 'Logged out successfully' };
  });

  fastify.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;

    if (!refreshToken) {
      return reply.code(401).send({ error: 'No refresh token' });
    }

    const decoded = await fastify.verifyRefresh(refreshToken);

    if (!decoded) {
      reply.clearCookie('refreshToken', { path: '/' });
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: decoded.id as string },
    });

    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
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

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    };
  });

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return user;
  });

  fastify.patch('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { name, avatarUrl } = request.body as { name?: string; avatarUrl?: string };

    const user = await fastify.prisma.user.update({
      where: { id: request.user!.id },
      data: {
        ...(name && { name }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    return user;
  });
};

export default authRoutes;
