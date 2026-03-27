import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as Y from 'yjs';
import { PrismaClient } from '@prisma/client';

interface WSClient {
  id: string;
  socket: any;
  userId: string;
  projectId: string;
  user: {
    id: string;
    name: string;
    color: string;
  };
  doc: Y.Doc;
}

interface WSMessage {
  type: string;
  payload: any;
}

class CollaborationServer {
  private clients: Map<string, WSClient> = new Map();
  private docs: Map<string, Y.Doc> = new Map();
  private prisma: PrismaClient;
  private colors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  ];
  private colorIndex = 0;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private getNextColor(): string {
    const color = this.colors[this.colorIndex % this.colors.length];
    this.colorIndex++;
    return color;
  }

  private getOrCreateDoc(projectId: string): Y.Doc {
    if (!this.docs.has(projectId)) {
      const doc = new Y.Doc();
      this.docs.set(projectId, doc);

      // Load state from database asynchronously
      this.loadDocState(projectId, doc);
    }
    return this.docs.get(projectId)!;
  }

  private async loadDocState(projectId: string, doc: Y.Doc) {
    try {
      const latestState = await this.prisma.yjsState.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      if (latestState?.data) {
        Y.applyUpdate(doc, Buffer.from(latestState.data));
      }
    } catch (error) {
      console.error('Failed to load Yjs state:', error);
    }
  }

  async saveDocState(projectId: string, doc: Y.Doc) {
    try {
      const state = Y.encodeStateAsUpdate(doc);
      await this.prisma.yjsState.create({
        data: {
          projectId,
          data: Buffer.from(state),
        },
      });
    } catch (error) {
      console.error('Failed to save Yjs state:', error);
    }
  }

  async handleConnection(socket: any, userId: string, projectId: string, userData: { name: string }) {
    const clientId = `${userId}-${Date.now()}`;
    const doc = this.getOrCreateDoc(projectId);

    const client: WSClient = {
      id: clientId,
      socket,
      userId,
      projectId,
      user: {
        id: userId,
        name: userData.name,
        color: this.getNextColor(),
      },
      doc,
    };

    this.clients.set(clientId, client);

    // Send initial state
    const state = Y.encodeStateAsUpdate(doc);
    socket.send(JSON.stringify({
      type: 'sync_initial',
      payload: {
        state: Array.from(state),
        users: this.getProjectUsers(projectId),
      },
    }));

    // Broadcast user joined
    this.broadcast(projectId, {
      type: 'user_joined',
      payload: {
        user: client.user,
        users: this.getProjectUsers(projectId),
      },
    }, clientId);

    // Handle messages
    socket.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        await this.handleMessage(client, message);
      } catch (error) {
        console.error('Failed to handle message:', error);
      }
    });

    // Handle disconnect
    socket.on('close', async () => {
      this.clients.delete(clientId);

      // Save state periodically
      await this.saveDocState(projectId, doc);

      // Broadcast user left
      this.broadcast(projectId, {
        type: 'user_left',
        payload: {
          userId,
          users: this.getProjectUsers(projectId),
        },
      });

      // Clean up docs with no clients
      this.cleanupDoc(projectId);
    });
  }

  private async handleMessage(client: WSClient, message: WSMessage) {
    switch (message.type) {
      case 'sync':
        // Client requests full sync
        const state = Y.encodeStateAsUpdate(client.doc);
        client.socket.send(JSON.stringify({
          type: 'sync_response',
          payload: { state: Array.from(state) },
        }));
        break;

      case 'update':
        // Apply update from client
        try {
          const update = new Uint8Array(message.payload.update);
          Y.applyUpdate(client.doc, update);

          // Broadcast to other clients
          this.broadcast(client.projectId, {
            type: 'update',
            payload: {
              userId: client.userId,
              update: message.payload.update,
            },
          }, client.id);
        } catch (error) {
          console.error('Failed to apply update:', error);
        }
        break;

      case 'cursor':
        // Broadcast cursor position
        this.broadcast(client.projectId, {
          type: 'cursor',
          payload: {
            userId: client.userId,
            position: message.payload.position,
          },
        }, client.id);
        break;

      case 'awareness':
        // Update user awareness state
        client.user = { ...client.user, ...message.payload };
        this.broadcast(client.projectId, {
          type: 'awareness',
          payload: {
            userId: client.userId,
            user: client.user,
          },
        }, client.id);
        break;
    }
  }

  private getProjectUsers(projectId: string) {
    return Array.from(this.clients.values())
      .filter((c) => c.projectId === projectId)
      .map((c) => c.user);
  }

  private broadcast(projectId: string, message: WSMessage, excludeClientId?: string) {
    Array.from(this.clients.values())
      .filter((c) => c.projectId === projectId && c.id !== excludeClientId)
      .forEach((client) => {
        try {
          client.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error('Failed to send to client:', error);
        }
      });
  }

  private cleanupDoc(projectId: string) {
    const hasClients = Array.from(this.clients.values()).some((c) => c.projectId === projectId);
    if (!hasClients) {
      // Save final state before cleanup
      const doc = this.docs.get(projectId);
      if (doc) {
        this.saveDocState(projectId, doc);
      }
      this.docs.delete(projectId);
    }
  }
}

const wsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const collaboration = new CollaborationServer(fastify.prisma);

  // Expose collaboration server for WebSocket handling
  (fastify as any).collaboration = collaboration;

  // WebSocket endpoint
  fastify.get('/ws/:projectId', { websocket: true }, (socket, request) => {
    const { projectId } = request.params as { projectId: string };

    // Get auth from query or headers
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      socket.send(JSON.stringify({ type: 'error', payload: { message: 'Unauthorized' } }));
      socket.close();
      return;
    }

    // Verify token
    fastify.jwt.verify(token).then(async (decoded: any) => {
      await collaboration.handleConnection(socket, decoded.id, projectId, {
        name: decoded.name,
      });
    }).catch(() => {
      socket.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid token' } }));
      socket.close();
    });
  });

  // Save project state endpoint
  fastify.post<{ Params: { id: string } }>('/:id/save', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { state } = request.body as { state: number[] };

    try {
      const update = Buffer.from(state);
      await fastify.prisma.yjsState.create({
        data: {
          projectId: id,
          data: update,
        },
      });

      return { message: 'State saved' };
    } catch (error) {
      console.error('Failed to save state:', error);
      return reply.code(500).send({ error: 'Failed to save state' });
    }
  });

  // Get project state
  fastify.get<{ Params: { id: string } }>('/:id/state', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const latestState = await fastify.prisma.yjsState.findFirst({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
      });

      if (!latestState?.data) {
        return { state: null };
      }

      return { state: Array.from(latestState.data) };
    } catch (error) {
      console.error('Failed to get state:', error);
      return reply.code(500).send({ error: 'Failed to get state' });
    }
  });
};

export default wsRoutes;
