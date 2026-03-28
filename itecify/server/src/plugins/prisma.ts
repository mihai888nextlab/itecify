import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    prisma: PrismaClient;
    user?: {
      id: string;
      email: string;
      name: string;
    };
  }
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const prisma = new PrismaClient();

async function prismaPlugin(fastify: FastifyInstance) {
  fastify.decorate('prisma', prisma);

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const decoded = await request.jwtVerify();
      request.user = {
        id: decoded.id as string,
        email: decoded.email as string,
        name: decoded.name as string,
      };
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

export default fp(prismaPlugin, {
  name: 'prisma',
});
