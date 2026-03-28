import { z } from 'zod';
import { createContainer, startContainer, stopContainer, removeContainer, executeInContainer, copyFilesToContainer, getContainerStatus, getProjectContainer, DOCKER_IMAGES } from '../services/dockerService.js';
const executeSchema = z.object({
    projectId: z.string(),
    command: z.string(),
    workdir: z.string().optional(),
    files: z.array(z.object({
        name: z.string(),
        content: z.string(),
    })).optional(),
});
const createContainerSchema = z.object({
    projectId: z.string(),
    image: z.string(),
});
const terminalRoutes = async (fastify) => {
    fastify.get('/images', async () => {
        return {
            images: DOCKER_IMAGES,
        };
    });
    fastify.post('/create', async (request, reply) => {
        try {
            const body = createContainerSchema.parse(request.body);
            await stopContainer(body.projectId).catch(() => { });
            await removeContainer(body.projectId).catch(() => { });
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            try {
                await execAsync(`docker rm -f itecify-${body.projectId}`);
                await new Promise(r => setTimeout(r, 1000));
            }
            catch (e) { }
            const container = await createContainer({
                projectId: body.projectId,
                image: body.image,
                name: `itecify-${body.projectId}`,
            });
            return {
                success: true,
                container,
            };
        }
        catch (error) {
            fastify.log.error('Container creation error:', error);
            return reply.code(500).send({
                success: false,
                error: error.message,
            });
        }
    });
    fastify.post('/start', async (request, reply) => {
        try {
            const body = request.body;
            const container = await startContainer(body.projectId);
            return {
                success: true,
                container,
            };
        }
        catch (error) {
            return reply.code(500).send({
                success: false,
                error: error.message,
            });
        }
    });
    fastify.post('/stop', async (request, reply) => {
        try {
            const body = request.body;
            await stopContainer(body.projectId);
            return {
                success: true,
            };
        }
        catch (error) {
            return reply.code(500).send({
                success: false,
                error: error.message,
            });
        }
    });
    fastify.post('/remove', async (request, reply) => {
        try {
            const body = request.body;
            await removeContainer(body.projectId);
            return {
                success: true,
            };
        }
        catch (error) {
            return reply.code(500).send({
                success: false,
                error: error.message,
            });
        }
    });
    fastify.post('/status', async (request, reply) => {
        try {
            const body = request.body;
            const container = await getContainerStatus(body.projectId);
            return {
                success: true,
                container,
            };
        }
        catch (error) {
            return reply.code(500).send({
                success: false,
                error: error.message,
            });
        }
    });
    fastify.post('/sync-files', async (request, reply) => {
        try {
            const body = request.body;
            const container = getProjectContainer(body.projectId);
            if (!container) {
                return reply.code(400).send({
                    success: false,
                    error: 'Container not found. Create it first.',
                });
            }
            if (container.status !== 'running') {
                await startContainer(body.projectId);
            }
            await copyFilesToContainer(body.projectId, body.files);
            return {
                success: true,
            };
        }
        catch (error) {
            return reply.code(500).send({
                success: false,
                error: error.message,
            });
        }
    });
    fastify.post('/execute', async (request, reply) => {
        try {
            const body = executeSchema.parse(request.body);
            let container = getProjectContainer(body.projectId);
            if (!container) {
                try {
                    const { exec } = await import('child_process');
                    const { promisify } = await import('util');
                    const execAsync = promisify(exec);
                    await execAsync(`docker rm -f itecify-${body.projectId}`).catch(() => { });
                    await new Promise(r => setTimeout(r, 500));
                    container = await createContainer({
                        projectId: body.projectId,
                        image: 'node:20',
                        name: `itecify-${body.projectId}`,
                    });
                }
                catch (e) {
                    return reply.code(500).send({
                        success: false,
                        error: 'Failed to create container: ' + e.message,
                    });
                }
            }
            if (container.status !== 'running') {
                try {
                    await startContainer(body.projectId);
                    container = getProjectContainer(body.projectId);
                }
                catch (e) {
                    return reply.code(500).send({
                        success: false,
                        error: 'Failed to start container: ' + e.message,
                    });
                }
            }
            // Sync files to container before executing command
            if (body.files && body.files.length > 0) {
                await copyFilesToContainer(body.projectId, body.files);
            }
            const result = await executeInContainer(body.projectId, body.command, body.workdir);
            return {
                success: result.exitCode === 0,
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
            };
        }
        catch (error) {
            fastify.log.error('Terminal execution error:', error);
            return reply.code(500).send({
                success: false,
                error: error.message,
            });
        }
    });
};
export default terminalRoutes;
//# sourceMappingURL=terminal.js.map