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
  readAllContainerFiles,
  DOCKER_IMAGES,
  Container
} from '../services/dockerService.js';

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

const terminalRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/images', async () => {
    return {
      images: DOCKER_IMAGES,
    };
  });

  fastify.post('/create', async (request, reply) => {
    try {
      const body = createContainerSchema.parse(request.body);
      
      await stopContainer(body.projectId).catch(() => {});
      await removeContainer(body.projectId).catch(() => {});
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync(`docker rm -f itecify-${body.projectId}`);
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {}
      
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
      
      fastify.log.info(`[Terminal] Execute request for project ${body.projectId}: ${body.command}`);
      
      let container = getProjectContainer(body.projectId);
      
      if (!container) {
        fastify.log.info(`[Terminal] Container not found, creating new one`);
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          await execAsync(`docker rm -f itecify-${body.projectId}`).catch(() => {});
          await new Promise(r => setTimeout(r, 500));
          
          container = await createContainer({
            projectId: body.projectId,
            image: 'node:20',
            name: `itecify-${body.projectId}`,
          });
        } catch (e) {
          fastify.log.error(`[Terminal] Failed to create container:`, e);
          return reply.code(500).send({
            success: false,
            error: 'Failed to create container: ' + (e as Error).message,
          });
        }
      }
      
      if (container.status !== 'running') {
        fastify.log.info(`[Terminal] Container not running, starting it`);
        try {
          await startContainer(body.projectId);
          container = getProjectContainer(body.projectId);
        } catch (e) {
          fastify.log.error(`[Terminal] Failed to start container:`, e);
          return reply.code(500).send({
            success: false,
            error: 'Failed to start container: ' + (e as Error).message,
          });
        }
      }
      
      // Sync files to container before executing command
      if (body.files && body.files.length > 0) {
        fastify.log.info(`[Terminal] Syncing ${body.files.length} files to container`);
        await copyFilesToContainer(body.projectId, body.files);
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

  fastify.post('/sync-from-container', async (request, reply) => {
    try {
      const body = request.body as { projectId: string };
      
      fastify.log.info(`[Terminal] Syncing files from container for project ${body.projectId}`);
      
      const container = getProjectContainer(body.projectId);
      
      if (!container) {
        fastify.log.error('[Terminal] Container not found during sync');
        return reply.code(400).send({
          success: false,
          error: 'Container not found',
        });
      }
      
      fastify.log.info(`[Terminal] Container status: ${container.status}, name: ${container.name}`);
      
      if (container.status !== 'running') {
        fastify.log.info('[Terminal] Container not running, starting it');
        await startContainer(body.projectId);
      }
      
      const files = await readAllContainerFiles(body.projectId);
      
      fastify.log.info(`[Terminal] Read ${files.length} files from container`);
      files.forEach(f => fastify.log.info(`  - ${f.name} (${f.content.length} bytes)`));
      
      return {
        success: true,
        files,
      };
    } catch (error: any) {
      fastify.log.error('Sync from container error:', error);
      return reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get('/debug/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      
      const container = getProjectContainer(projectId);
      
      if (!container) {
        return { exists: false, error: 'Container not in memory' };
      }
      
      // Run ls directly in container to see what's there
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const workDir = `/workspace/${projectId}`;
      
      const { stdout: dockerLs } = await execAsync(
        `docker exec ${container.name} ls -la "${workDir}" 2>&1`
      );
      
      const { stdout: dockerLsRoot } = await execAsync(
        `docker exec ${container.name} ls -la /workspace 2>&1`
      );
      
      return {
        exists: true,
        containerName: container.name,
        containerStatus: container.status,
        hostPort: container.hostPort,
        serverUrl: container.hostPort ? `http://localhost:${container.hostPort}` : null,
        workDirContents: dockerLs,
        workspaceContents: dockerLsRoot,
      };
    } catch (error: any) {
      return { error: error.message };
    }
  });

  fastify.post('/stop-deployment', async (request, reply) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const body = request.body as { projectId: string };
      const container = getProjectContainer(body.projectId);
      
      if (!container) {
        return { success: false, error: 'Container not found' };
      }

      // Kill any running node processes in the container
      await execAsync(`docker exec ${container.name} pkill -f "node" 2>/dev/null || true`);
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
};

export default terminalRoutes;
