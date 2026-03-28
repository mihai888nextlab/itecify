import { FastifyInstance } from 'fastify';
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
declare function prismaPlugin(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof prismaPlugin;
export default _default;
//# sourceMappingURL=prisma.d.ts.map