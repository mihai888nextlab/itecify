import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { 
  createContainer, 
  startContainer, 
  stopContainer, 
  removeContainer,
  executeInContainer,
  copyFilesToContainer,
  getContainerStatus,
  getProjectContainer,
  DOCKER_IMAGES,
  Container
} from '../services/dockerService.js';

const executeSchema = z.object({
  projectId: z.string(),
  command: z.string(),
  workdir: z.string().optional(),
});

const createContainerSchema = z.object({
  projectId: z.string(),
  image: z.string(),
});

const terminalRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/images', async () => {
    return {
      images: DOCKER_IMAGES,
    };
  });

  fastify.post('/create', async (request, reply) => {
    try {
      const body = createContainerSchema.parse(request.body);
      
      const existing = getProjectContainer(body.projectId);
      if (existing) {
        await stopContainer(body.projectId);
        await removeContainer(body.projectId);
      }
      
      const container = await createContainer({
        projectId: body.projectId,
        image: body.image,
        name: `itecify-${body.projectId}`,
      });
      
      return {
        success: true,
        container,
      };
    } catch (error: any) {
      fastify.log.error('Container creation error:', error);
      return reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post('/start', async (request, reply) => {
    try {
      const body = request.body as { projectId: string };
      const container = await startContainer(body.projectId);
      
      return {
        success: true,
        container,
      };
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post('/stop', async (request, reply) => {
    try {
      const body = request.body as { projectId: string };
      await stopContainer(body.projectId);
      
      return {
        success: true,
      };
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post('/remove', async (request, reply) => {
    try {
      const body = request.body as { projectId: string };
      await removeContainer(body.projectId);
      
      return {
        success: true,
      };
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post('/status', async (request, reply) => {
    try {
      const body = request.body as { projectId: string };
      const container = await getContainerStatus(body.projectId);
      
      return {
        success: true,
        container,
      };
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post('/sync-files', async (request, reply) => {
    try {
      const body = request.body as {
        projectId: string;
        files: { name: string; content: string }[];
      };
      
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
    } catch (error: any) {
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
        return reply.code(400).send({
          success: false,
          error: 'Container not found. Create a project first.',
        });
      }
      
      if (container.status !== 'running') {
        await startContainer(body.projectId);
      }
      
      const result = await executeInContainer(
        body.projectId,
        body.command,
        body.workdir
      );
      
      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error: any) {
      fastify.log.error('Terminal execution error:', error);
      return reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  });
};

export default terminalRoutes;
