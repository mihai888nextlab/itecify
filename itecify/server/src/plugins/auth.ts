import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret',
    sign: {
      expiresIn: '15m',
    },
  });

  fastify.decorate('generateTokens', function (payload: { id: string; email: string; name: string }) {
    const accessToken = fastify.jwt.sign(payload);
    const refreshToken = fastify.jwt.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  });

  fastify.decorate('verifyRefresh', async function (token: string) {
    try {
      return await fastify.jwt.verify(token);
    } catch {
      return null;
    }
  });
};

export default fp(authPlugin, {
  name: 'auth',
});
