import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { generateCode } from '../services/groqService.js';
import { 
  ensureContainer, 
  terminalRead, 
  terminalWrite, 
  terminalDelete, 
  terminalList,
  getProjectContainer 
} from '../services/dockerService.js';

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

interface FileCommand {
  type: 'READ' | 'CREATE' | 'MODIFY' | 'DELETE';
  path: string;
  content?: string;
  language?: string;
}

const langMap: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
  php: 'php', swift: 'swift', kt: 'kotlin', scala: 'scala',
  html: 'html', css: 'css', scss: 'scss', sass: 'scss',
  json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', sql: 'sql', sh: 'bash', bash: 'bash',
};

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return langMap[ext] || 'plaintext';
}

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
    const agent = await fastify.prisma.customAgent.findUnique({ where: { id } });
    if (!agent || agent.userId !== request.user!.id) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    const updated = await fastify.prisma.customAgent.update({ where: { id }, data: body });
    return updated;
  });

  fastify.delete('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = await fastify.prisma.customAgent.findUnique({ where: { id } });
    if (!agent || agent.userId !== request.user!.id) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    await fastify.prisma.customAgent.delete({ where: { id } });
    return { message: 'Agent deleted' };
  });

  async function getProjectFileTree(projectId: string): Promise<any[]> {
    const files = await fastify.prisma.projectFile.findMany({
      where: { projectId },
      orderBy: [{ isFolder: 'desc' }, { name: 'asc' }],
    });

    const buildTree = (parentId: string | null): any[] => {
      return files
        .filter(f => f.parentId === parentId)
        .map(file => ({
          id: file.id,
          name: file.name,
          type: file.isFolder ? 'folder' : 'file',
          language: file.language,
          children: file.isFolder ? buildTree(file.id) : undefined,
        }))
        .sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
    };

    return buildTree(null);
  }

  async function findFileByPath(projectId: string, filePath: string): Promise<any | null> {
    const parts = filePath.split('/').filter(p => p);
    let currentParentId: string | null = null;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const folder = await fastify.prisma.projectFile.findFirst({
        where: { projectId, parentId: currentParentId, name: parts[i], isFolder: true },
      });
      currentParentId = folder?.id || null;
    }
    
    const fileName = parts[parts.length - 1];
    return fastify.prisma.projectFile.findFirst({
      where: { projectId, parentId: currentParentId, name: fileName },
    });
  }

  async function getParentForPath(projectId: string, filePath: string): Promise<{ parentId: string | null }> {
    const parts = filePath.split('/').filter(p => p);
    if (parts.length <= 1) return { parentId: null };
    
    let currentParentId: string | null = null;
    
    for (let i = 0; i < parts.length - 1; i++) {
      let folder = await fastify.prisma.projectFile.findFirst({
        where: { projectId, parentId: currentParentId, name: parts[i], isFolder: true },
      });
      
      if (!folder) {
        folder = await fastify.prisma.projectFile.create({
          data: { projectId, parentId: currentParentId, name: parts[i], isFolder: true, language: 'folder' },
        });
      }
      currentParentId = folder.id;
    }
    
    return { parentId: currentParentId };
  }

  function parseFileCommands(response: string): { commands: FileCommand[]; explanation: string } {
    const commands: FileCommand[] = [];
    let explanation = response;
    
    const readRegex = /READ:\s*([^\n]+)/gi;
    const createRegex = /CREATE:\s*([^\n]+)\n```(\w+)?\n([\s\S]*?)```/gi;
    const modifyRegex = /MODIFY:\s*([^\n]+)\n```(?:diff)?\n([\s\S]*?)```/gi;
    const deleteRegex = /DELETE:\s*([^\n]+)/gi;
    const jsonRegex = /\[\s*\{[\s\S]*?\}\s*\]/g;
    
    let match;
    while ((match = readRegex.exec(response)) !== null) {
      commands.push({ type: 'READ', path: match[1].trim() });
    }
    while ((match = createRegex.exec(response)) !== null) {
      commands.push({ type: 'CREATE', path: match[1].trim(), language: match[2] || detectLanguage(match[1]), content: match[3] });
    }
    while ((match = modifyRegex.exec(response)) !== null) {
      commands.push({ type: 'MODIFY', path: match[1].trim(), content: match[2] });
    }
    while ((match = deleteRegex.exec(response)) !== null) {
      commands.push({ type: 'DELETE', path: match[1].trim() });
    }
    
    const jsonMatches = response.match(jsonRegex);
    if (jsonMatches) {
      try {
        const parsed = JSON.parse(jsonMatches[0]);
        if (Array.isArray(parsed)) {
          for (const cmd of parsed) {
            if (cmd.type && cmd.path) {
              commands.push({ type: cmd.type.toUpperCase(), path: cmd.path, content: cmd.content, language: cmd.language || detectLanguage(cmd.path) });
            }
          }
        }
      } catch (e) {}
    }
    
    explanation = explanation
      .replace(/READ:\s*[^\n]+\n?/gi, '')
      .replace(/CREATE:\s*[^\n]+\n```[\s\S]*?```\n?/gi, '')
      .replace(/MODIFY:\s*[^\n]+\n```[\s\S]*?```\n?/gi, '')
      .replace(/DELETE:\s*[^\n]+\n?/gi, '')
      .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, '')
      .trim();
    
    return { commands, explanation };
  }

  async function executeFileCommand(projectId: string, command: FileCommand): Promise<{ 
    success: boolean; 
    message: string; 
    fileId?: string;
    originalContent?: string;
    originalFileId?: string;
    fileData?: { name: string; content: string; language: string; parentId: string | null };
  }> {
    try {
      switch (command.type) {
        case 'READ': {
          const result = await terminalRead(projectId, command.path);
          if (!result.success) {
            return { success: false, message: `Error reading ${command.path}: ${result.error}` };
          }
          const lang = command.language || detectLanguage(command.path);
          return { success: true, message: `READ ${command.path}:\n\`\`\`${lang}\n${result.content}\n\`\`\`` };
        }
        
        case 'CREATE': {
          const result = await terminalWrite(projectId, command.path, command.content || '');
          if (!result.success) {
            return { success: false, message: `Error creating ${command.path}: ${result.error}` };
          }
          return { success: true, message: `Created: ${command.path}` };
        }
        
        case 'MODIFY': {
          const readResult = await terminalRead(projectId, command.path);
          const originalContent = readResult.success ? readResult.content : '';
          
          let newContent = command.content || '';
          if (newContent.includes('---') && newContent.includes('+++')) {
            const lines = newContent.split('\n');
            let result: string[] = [];
            
            for (const line of lines) {
              if (line.startsWith('@@')) continue;
              else if (line.startsWith('+')) result.push(line.substring(1));
              else if (!line.startsWith('-') && !line.startsWith('\\')) result.push(line);
            }
            newContent = result.join('\n');
          }
          
          const writeResult = await terminalWrite(projectId, command.path, newContent);
          if (!writeResult.success) {
            return { success: false, message: `Error modifying ${command.path}: ${writeResult.error}` };
          }
          
          return { success: true, message: `Modified: ${command.path}`, originalContent };
        }
        
        case 'DELETE': {
          const readResult = await terminalRead(projectId, command.path);
          const fileData = readResult.success ? { 
            name: command.path.split('/').pop() || command.path, 
            content: readResult.content || '', 
            language: detectLanguage(command.path), 
            parentId: null 
          } : undefined;
          
          const result = await terminalDelete(projectId, command.path);
          if (!result.success) {
            return { success: false, message: `Error deleting ${command.path}: ${result.error}` };
          }
          
          return { success: true, message: `Deleted: ${command.path}`, fileData };
        }
        
        case 'LIST': {
          const result = await terminalList(projectId, command.path);
          if (!result.success) {
            return { success: false, message: `Error listing ${command.path}: ${result.error}` };
          }
          return { success: true, message: `Files in ${command.path || '/workspace'}:\n${result.files?.join('\n') || '(empty)'}` };
        }
        
        default:
          return { success: false, message: `Unknown command: ${command.type}` };
      }
    } catch (error: any) {
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  fastify.post('/agents/execute', async (request, reply) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return reply.code(500).send({ success: false, error: 'AI service not configured' });

    try {
      const body = executeAgentSchema.parse(request.body);
      const { projectId } = body;

      const project = await fastify.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return reply.code(404).send({ error: 'Project not found' });

      let agentPrompt = '';
      let taskDescription = '';

      if (body.agentId) {
        const agent = await fastify.prisma.customAgent.findUnique({ where: { id: body.agentId } });
        if (!agent || agent.userId !== request.user!.id) return reply.code(404).send({ error: 'Agent not found' });
        agentPrompt = agent.prompt;
        taskDescription = body.customPrompt || 'Execute the agent task';
      } else if (body.prompt) {
        agentPrompt = body.prompt;
        taskDescription = body.customPrompt || 'Execute task';
      } else {
        return reply.code(400).send({ error: 'Either agentId or prompt is required' });
      }

      await ensureContainer(projectId);

      const listResult = await terminalList(projectId);
      const filesInfo = listResult.files?.join(', ') || 'No files found';

      const fullPrompt = `${agentPrompt}

## USER TASK
${taskDescription}

## PROJECT FILES
${filesInfo}

## TERMINAL-BASED FILE OPERATIONS

You work in a Docker container. All file operations use terminal commands:

LIST: src/
LIST: (lists workspace root)

READ: src/utils/helper.ts

CREATE: src/components/NewComponent.tsx
\`\`\`typescript
export function NewComponent() { return <div>Hello</div>; }
\`\`\`

MODIFY: src/index.js
\`\`\`javascript
console.log('Hello World');
\`\`\`

Or diff format:
MODIFY: src/index.js
\`\`\`diff
--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 console.log(x);
\`\`\`

DELETE: src/old-file.js

JSON format:
[
  { "type": "LIST", "path": "src/" },
  { "type": "READ", "path": "src/main.js" },
  { "type": "CREATE", "path": "src/utils/helper.ts", "content": "..." },
  { "type": "MODIFY", "path": "src/index.js", "content": "..." },
  { "type": "DELETE", "path": "src/old.js" }
]

Start by exploring the project with LIST command.
`;

      const result = await generateCode(apiKey, fullPrompt, 'javascript', 'Analyze and help with the coding task');

      const { commands, explanation } = parseFileCommands(result);
      
      const fileOperations: Array<{ type: string; path: string; success: boolean; message: string; fileId?: string }> = [];
      
      for (const cmd of commands) {
        const opResult = await executeFileCommand(projectId, cmd);
        fileOperations.push({ type: cmd.type, path: cmd.path, success: opResult.success, message: opResult.message, fileId: opResult.fileId });
      }

      let finalResponse = explanation;
      if (fileOperations.length > 0) {
        const successOps = fileOperations.filter(op => op.success);
        const failedOps = fileOperations.filter(op => !op.success);
        
        let summary = '\n\n---\n## FILE OPERATIONS\n';
        if (successOps.length > 0) {
          summary += '\n**Completed:**\n';
          for (const op of successOps) summary += `- ✅ ${op.type} ${op.path}: ${op.message}\n`;
        }
        if (failedOps.length > 0) {
          summary += '\n**Failed:**\n';
          for (const op of failedOps) summary += `- ❌ ${op.type} ${op.path}: ${op.message}\n`;
        }
        finalResponse += summary;
      }

      const rollbackData = successOps
        .filter(op => op.type === 'MODIFY' || op.type === 'DELETE' || op.type === 'CREATE')
        .map(op => ({
          type: op.type,
          path: op.path,
          fileId: op.fileId,
          originalContent: op.originalContent,
          fileData: op.fileData,
        }));

      return {
        success: true,
        content: finalResponse,
        agent: body.agentId || null,
        fileOperations,
        hasChanges: successOps.length > 0,
        rollbackData,
      };
    } catch (error: any) {
      fastify.log.error('Agent execution error:', error);
      return reply.code(500).send({ success: false, error: error.message || 'Agent execution failed' });
    }
  });

  fastify.post('/agents/execute/rollback', async (request, reply) => {
    const rollbackSchema = z.object({
      projectId: z.string(),
      rollbackData: z.array(z.object({
        type: z.enum(['CREATE', 'MODIFY', 'DELETE']),
        path: z.string(),
        fileId: z.string().optional(),
        originalContent: z.string().optional(),
        fileData: z.object({
          name: z.string(),
          content: z.string(),
          language: z.string(),
          parentId: z.string().nullable(),
        }).optional(),
      })),
    });

    try {
      const body = rollbackSchema.parse(request.body);
      const { projectId, rollbackData } = body;

      const results: Array<{ type: string; path: string; success: boolean; message: string }> = [];

      for (const item of rollbackData) {
        try {
          if (item.type === 'MODIFY' && item.fileId && item.originalContent !== undefined) {
            await fastify.prisma.projectFile.update({
              where: { id: item.fileId },
              data: { content: item.originalContent },
            });
            results.push({ type: 'MODIFY', path: item.path, success: true, message: 'Reverted to original' });
          } else if (item.type === 'DELETE' && item.fileData) {
            const file = item.fileData;
            await fastify.prisma.projectFile.create({
              data: {
                projectId,
                name: file.name,
                content: file.content,
                language: file.language,
                parentId: file.parentId,
                isFolder: false,
              },
            });
            results.push({ type: 'DELETE', path: item.path, success: true, message: 'File restored' });
          } else if (item.type === 'CREATE' && item.fileId) {
            await fastify.prisma.projectFile.delete({ where: { id: item.fileId } });
            results.push({ type: 'CREATE', path: item.path, success: true, message: 'Deleted created file' });
          }
        } catch (err: any) {
          results.push({ type: item.type, path: item.path, success: false, message: err.message });
        }
      }

      return { success: true, results };
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });
};

export default aiRoutes;
