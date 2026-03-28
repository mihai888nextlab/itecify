import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  containerImage: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
});

const addMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(['viewer', 'member', 'admin']).default('member'),
});

const projectRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // Get all projects for current user
  fastify.get('/', async (request) => {
    const projects = await fastify.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: request.user!.id },
          { members: { some: { userId: request.user!.id } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects;
  });

  // Create a new project
  fastify.post('/', async (request, reply) => {
    const body = createProjectSchema.parse(request.body);

    const project = await fastify.prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        isPublic: body.isPublic ?? false,
        ownerId: request.user!.id,
        containerImage: body.containerImage ?? 'node:20',
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return reply.code(201).send(project);
  });

  // Get a single project
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await fastify.prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    return project;
  });

  // Update a project
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateProjectSchema.parse(request.body);

    const project = await fastify.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    // Only owner can update
    if (project.ownerId !== request.user!.id) {
      return reply.code(403).send({ error: 'Only owner can update project' });
    }

    const updated = await fastify.prisma.project.update({
      where: { id },
      data: body,
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return updated;
  });

  // Delete a project
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await fastify.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    if (project.ownerId !== request.user!.id) {
      return reply.code(403).send({ error: 'Only owner can delete project' });
    }

    await fastify.prisma.project.delete({ where: { id } });

    return { message: 'Project deleted' };
  });

  // Add a member to project
  fastify.post('/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addMemberSchema.parse(request.body);

    const project = await fastify.prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    // Only owner or admin can add members
    if (project.ownerId !== request.user!.id) {
      const member = project.members?.find((m) => m.userId === request.user!.id);
      if (!member || member.role !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }
    }

    // Check if user exists
    const userToAdd = await fastify.prisma.user.findUnique({
      where: { id: body.userId },
    });

    if (!userToAdd) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const member = await fastify.prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: id, userId: body.userId },
      },
      update: { role: body.role },
      create: {
        projectId: id,
        userId: body.userId,
        role: body.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return reply.code(201).send(member);
  });

  // Remove a member from project
  fastify.delete('/:id/members/:userId', async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };

    const project = await fastify.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    // Only owner can remove members (or member can remove themselves)
    if (project.ownerId !== request.user!.id && request.user!.id !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    await fastify.prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId: id, userId },
      },
    });

    return { message: 'Member removed' };
  });

  // Get project collaborators (all users who have access)
  fastify.get('/:id/collaborators', async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await fastify.prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    const collaborators = [
      { ...project.owner, role: 'owner' },
      ...project.members.map((m) => ({ ...m.user, role: m.role })),
    ];

    return collaborators;
  });

  fastify.get('/:id/files', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await fastify.prisma.project.findUnique({ where: { id } });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    const url = new URL(request.url, 'http://localhost');
    const asTree = url.searchParams.get('tree') === 'true';

    const files = await fastify.prisma.projectFile.findMany({
      where: { projectId: id },
      orderBy: [{ isFolder: 'desc' }, { name: 'asc' }],
    });

    if (!asTree) {
      return files;
    }

    const buildTree = (parentId: string | null): any[] => {
      return files
        .filter(f => f.parentId === parentId)
        .map(file => ({
          id: file.id,
          name: file.name,
          type: file.isFolder ? 'folder' : 'file',
          language: file.language,
          content: file.content,
          children: file.isFolder ? buildTree(file.id) : undefined,
        }))
        .sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
    };

    return buildTree(null);
  });

  fastify.put('/:id/files', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, content, language, isFolder, parentId } = request.body as { 
      name: string; 
      content?: string; 
      language?: string;
      isFolder?: boolean;
      parentId?: string | null;
    };
    const project = await fastify.prisma.project.findUnique({ where: { id } });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    if (parentId) {
      const parent = await fastify.prisma.projectFile.findUnique({ where: { id: parentId } });
      if (!parent || !parent.isFolder) {
        return reply.code(400).send({ error: 'Parent must be a folder' });
      }
    }

    const existing = await fastify.prisma.projectFile.findFirst({
      where: { 
        projectId: id, 
        parentId: parentId || null,
        name 
      },
    });

    if (existing) {
      const updated = await fastify.prisma.projectFile.update({
        where: { id: existing.id },
        data: { 
          content: content ?? existing.content,
          language: language ?? existing.language,
          isFolder: isFolder ?? existing.isFolder,
        },
      });
      return updated;
    } else {
      const created = await fastify.prisma.projectFile.create({
        data: {
          projectId: id,
          name,
          content: content ?? '',
          language: language ?? 'javascript',
          isFolder: isFolder ?? false,
          parentId: parentId ?? null,
        },
      });
      return created;
    }
  });

  fastify.patch('/:id/files/:fileId', async (request, reply) => {
    const { id, fileId } = request.params as { id: string; fileId: string };
    const { name, parentId } = request.body as { name?: string; parentId?: string | null };
    const project = await fastify.prisma.project.findUnique({ where: { id } });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    const file = await fastify.prisma.projectFile.findUnique({ where: { id: fileId } });
    if (!file) {
      return reply.code(404).send({ error: 'File not found' });
    }

    if (name || parentId !== undefined) {
      const targetParentId = parentId === undefined ? file.parentId : parentId;
      const targetName = name || file.name;
      
      const collision = await fastify.prisma.projectFile.findFirst({
        where: { 
          projectId: id, 
          parentId: targetParentId,
          name: targetName,
          NOT: { id: fileId }
        },
      });
      
      if (collision) {
        return reply.code(409).send({ error: 'A file with this name already exists in this location' });
      }
    }

    const updated = await fastify.prisma.projectFile.update({
      where: { id: fileId },
      data: {
        ...(name && { name }),
        ...(parentId !== undefined && { parentId: parentId }),
      },
    });

    return updated;
  });

  fastify.delete('/:id/files/:fileId', async (request, reply) => {
    const { id, fileId } = request.params as { id: string; fileId: string };
    const project = await fastify.prisma.project.findUnique({ where: { id } });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    const file = await fastify.prisma.projectFile.findUnique({ 
      where: { id: fileId },
      include: { children: true }
    });

    if (!file) {
      return reply.code(404).send({ error: 'File not found' });
    }

    const deleteRecursive = async (fid: string) => {
      const item = await fastify.prisma.projectFile.findUnique({ 
        where: { id: fid },
        include: { children: true }
      });
      
      if (item?.children) {
        for (const child of item.children) {
          await deleteRecursive(child.id);
        }
      }
      
      await fastify.prisma.projectFile.delete({ where: { id: fid } });
    };

    await deleteRecursive(fileId);

    return { message: 'File deleted successfully' };
  });
};

export default projectRoutes;
