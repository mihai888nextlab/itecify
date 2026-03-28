import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
const authPlugin = async (fastify) => {
    await fastify.register(fastifyCookie);
    await fastify.register(fastifyJwt, {
        secret: process.env.JWT_SECRET || 'fallback-secret',
        sign: {
            expiresIn: '15m',
        },
    });
    fastify.decorate('generateTokens', function (payload) {
        const accessToken = fastify.jwt.sign(payload);
        const refreshToken = fastify.jwt.sign(payload, { expiresIn: '7d' });
        return { accessToken, refreshToken };
    });
    fastify.decorate('verifyRefresh', async function (token) {
        try {
            return await fastify.jwt.verify(token);
        }
        catch {
            return null;
        }
    });
};
export default fp(authPlugin, {
    name: 'auth',
});
//# sourceMappingURL=auth.js.map