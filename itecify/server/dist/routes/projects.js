import { z } from 'zod';
const createProjectSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    isPublic: z.boolean().optional(),
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
const projectRoutes = async (fastify) => {
    fastify.addHook('preHandler', fastify.authenticate);
    // Get all projects for current user
    fastify.get('/', async (request) => {
        const projects = await fastify.prisma.project.findMany({
            where: {
                OR: [
                    { ownerId: request.user.id },
                    { members: { some: { userId: request.user.id } } },
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
                ownerId: request.user.id,
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
        const { id } = request.params;
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
        const { id } = request.params;
        const body = updateProjectSchema.parse(request.body);
        const project = await fastify.prisma.project.findUnique({
            where: { id },
        });
        if (!project) {
            return reply.code(404).send({ error: 'Project not found' });
        }
        // Only owner can update
        if (project.ownerId !== request.user.id) {
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
        const { id } = request.params;
        const project = await fastify.prisma.project.findUnique({
            where: { id },
        });
        if (!project) {
            return reply.code(404).send({ error: 'Project not found' });
        }
        if (project.ownerId !== request.user.id) {
            return reply.code(403).send({ error: 'Only owner can delete project' });
        }
        await fastify.prisma.project.delete({ where: { id } });
        return { message: 'Project deleted' };
    });
    // Add a member to project
    fastify.post('/:id/members', async (request, reply) => {
        const { id } = request.params;
        const body = addMemberSchema.parse(request.body);
        const project = await fastify.prisma.project.findUnique({
            where: { id },
            include: { members: true },
        });
        if (!project) {
            return reply.code(404).send({ error: 'Project not found' });
        }
        // Only owner or admin can add members
        if (project.ownerId !== request.user.id) {
            const member = project.members?.find((m) => m.userId === request.user.id);
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
        const { id, userId } = request.params;
        const project = await fastify.prisma.project.findUnique({
            where: { id },
        });
        if (!project) {
            return reply.code(404).send({ error: 'Project not found' });
        }
        // Only owner can remove members (or member can remove themselves)
        if (project.ownerId !== request.user.id && request.user.id !== userId) {
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
        const { id } = request.params;
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
    // Get project files
    fastify.get('/:id/files', async (request, reply) => {
        const { id } = request.params;
        const project = await fastify.prisma.project.findUnique({ where: { id } });
        if (!project) {
            return reply.code(404).send({ error: 'Project not found' });
        }
        const files = await fastify.prisma.projectFile.findMany({
            where: { projectId: id },
            orderBy: { createdAt: 'asc' },
        });
        return files;
    });
    // Create or update a file
    fastify.put('/:id/files', async (request, reply) => {
        const { id } = request.params;
        const { name, content, language } = request.body;
        const project = await fastify.prisma.project.findUnique({ where: { id } });
        if (!project) {
            return reply.code(404).send({ error: 'Project not found' });
        }
        let file = await fastify.prisma.projectFile.findFirst({
            where: { projectId: id, name },
        });
        if (file) {
            file = await fastify.prisma.projectFile.update({
                where: { id: file.id },
                data: { content, language },
            });
        }
        else {
            file = await fastify.prisma.projectFile.create({
                data: {
                    projectId: id,
                    name,
                    content,
                    language,
                },
            });
        }
        return file;
    });
    // Delete a file
    fastify.delete('/:id/files/:fileId', async (request, reply) => {
        const { id, fileId } = request.params;
        const project = await fastify.prisma.project.findUnique({ where: { id } });
        if (!project) {
            return reply.code(404).send({ error: 'Project not found' });
        }
        await fastify.prisma.projectFile.delete({
            where: { id: fileId },
        });
        return { message: 'File deleted' };
    });
};
export default projectRoutes;
//# sourceMappingURL=projects.js.map