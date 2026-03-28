import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { generateCode } from '../services/groqService.js';

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  prompt: z.string().min(10),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const executeAgentSchema = z.object({
  agentId: z.string().optional(),
  prompt: z.string().optional(),
  projectId: z.string(),
  customPrompt: z.string().optional(),
  files: z.array(z.object({
    name: z.string(),
    content: z.string(),
  })).optional(),
});

const aiRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/agents', async (request) => {
    const agents = await fastify.prisma.customAgent.findMany({
      where: { userId: request.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    return agents;
  });

  fastify.post('/agents', async (request, reply) => {
    const body = createAgentSchema.parse(request.body);

    const agent = await fastify.prisma.customAgent.create({
      data: {
        userId: request.user!.id,
        name: body.name,
        description: body.description,
        prompt: body.prompt,
        color: body.color || '#4C8EFF',
        icon: body.icon || 'Bot',
      },
    });

    return reply.code(201).send(agent);
  });

  fastify.patch('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createAgentSchema.partial().parse(request.body);

    const agent = await fastify.prisma.customAgent.findUnique({
      where: { id },
    });

    if (!agent || agent.userId !== request.user!.id) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    const updated = await fastify.prisma.customAgent.update({
      where: { id },
      data: body,
    });

    return updated;
  });

  fastify.delete('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const agent = await fastify.prisma.customAgent.findUnique({
      where: { id },
    });

    if (!agent || agent.userId !== request.user!.id) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    await fastify.prisma.customAgent.delete({
      where: { id },
    });

    return { message: 'Agent deleted' };
  });

  fastify.post('/agents/execute', async (request, reply) => {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return reply.code(500).send({
        success: false,
        error: 'AI service not configured',
      });
    }

    try {
      const body = executeAgentSchema.parse(request.body);

      let agentPrompt = '';
      let taskDescription = '';

      if (body.agentId) {
        const agent = await fastify.prisma.customAgent.findUnique({
          where: { id: body.agentId },
        });

        if (!agent || agent.userId !== request.user!.id) {
          return reply.code(404).send({ error: 'Agent not found' });
        }

        agentPrompt = agent.prompt;
        taskDescription = body.customPrompt || 'Execute the agent task';
      } else if (body.prompt) {
        agentPrompt = body.prompt;
        taskDescription = body.customPrompt || 'Execute task';
      } else {
        return reply.code(400).send({ error: 'Either agentId or prompt is required' });
      }

      const files = body.files || [];
      const filesContext = files.length > 0
        ? `\n\nProject Files:\n${files.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n')}`
        : '';

      const fullPrompt = `${agentPrompt}

User Task: ${taskDescription}
${filesContext}

Provide your response in this format:
1. Explanation of what you found/changed
2. The file modifications needed (if any)
3. Any code suggestions

If you need to make file changes, use this format:
FILE: filename.ext
\`\`\`
// file content here
\`\`\`

Or for modifications:
MODIFY: filename.ext
\`\`\`
--- original
+++ modified
@@ -1,3 +1,4 @@
 unchanged
-old line
+new line
\`\`\`

If no file changes needed, explain what you found and provide guidance.`;

      const result = await generateCode(
        apiKey,
        fullPrompt,
        'javascript',
        'Analyze and help with the coding task'
      );

      return {
        success: true,
        content: result,
        agent: body.agentId || null,
      };
    } catch (error: any) {
      fastify.log.error('Agent execution error:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Agent execution failed',
      });
    }
  });
};

export default aiRoutes;
