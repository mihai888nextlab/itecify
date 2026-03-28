import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function prismaPlugin(fastify) {
    fastify.decorate('prisma', prisma);
    fastify.decorate('authenticate', async function (request, reply) {
        try {
            const decoded = await request.jwtVerify();
            request.user = {
                id: decoded.id,
                email: decoded.email,
                name: decoded.name,
            };
        }
        catch (err) {
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
//# sourceMappingURL=prisma.js.map