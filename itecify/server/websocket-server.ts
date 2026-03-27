import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';

interface Client {
  id: string;
  ws: WebSocket;
  sessionId: string;
  user: {
    id: string;
    name: string;
    color: string;
    cursor?: { line: number; ch: number };
    selection?: { from: number; to: number };
  };
}

interface Message {
  type: string;
  payload: any;
}

class CollaborationServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Client> = new Map();
  private docs: Map<string, Y.Doc> = new Map();
  private port: number;

  constructor(port: number = 1234) {
    this.port = port;
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateId();
      console.log(`Client connected: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message: Message = JSON.parse(data.toString());
          this.handleMessage(clientId, ws, message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`Client ${clientId} error:`, error);
        this.handleDisconnect(clientId);
      });
    });

    console.log(`Collaboration server started on port ${this.port}`);
  }

  private handleMessage(clientId: string, ws: WebSocket, message: Message): void {
    switch (message.type) {
      case 'join':
        this.handleJoin(clientId, ws, message.payload);
        break;
      case 'leave':
        this.handleLeave(clientId);
        break;
      case 'sync':
        this.handleSync(clientId, message.payload);
        break;
      case 'cursor':
        this.handleCursor(clientId, message.payload);
        break;
      case 'awareness':
        this.handleAwareness(clientId, message.payload);
        break;
      case 'update':
        this.handleUpdate(clientId, message.payload);
        break;
      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  private handleJoin(clientId: string, ws: WebSocket, payload: any): void {
    const { sessionId, user } = payload;
    
    if (!this.docs.has(sessionId)) {
      this.docs.set(sessionId, new Y.Doc());
    }

    const client: Client = {
      id: clientId,
      ws,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        color: user.color,
      },
    };

    this.clients.set(clientId, client);

    const sessionClients = this.getSessionClients(sessionId);
    const userList = sessionClients.map(c => c.user);

    this.broadcast(sessionId, {
      type: 'user_joined',
      payload: { user, users: userList },
    }, clientId);

    const doc = this.docs.get(sessionId);
    if (doc) {
      ws.send(JSON.stringify({
        type: 'sync_initial',
        payload: {
          content: doc.getText('content').toString(),
          users: userList,
        },
      }));
    }

    console.log(`User ${user.name} joined session ${sessionId}`);
  }

  private handleLeave(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.broadcast(client.sessionId, {
      type: 'user_left',
      payload: { userId: clientId },
    });

    this.clients.delete(clientId);
    console.log(`User ${client.user.name} left session ${client.sessionId}`);
  }

  private handleDisconnect(clientId: string): void {
    this.handleLeave(clientId);
  }

  private handleSync(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const doc = this.docs.get(client.sessionId);
    if (doc) {
      doc.getText('content').delete(0, doc.getText('content').length);
      doc.getText('content').insert(0, payload.content);
    }
  }

  private handleCursor(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.user.cursor = payload.position;
    client.user.selection = payload.selection;

    this.broadcast(client.sessionId, {
      type: 'cursor_update',
      payload: {
        userId: clientId,
        position: payload.position,
        selection: payload.selection,
      },
    }, clientId);
  }

  private handleAwareness(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.user = { ...client.user, ...payload };

    this.broadcast(client.sessionId, {
      type: 'awareness_update',
      payload: {
        userId: clientId,
        user: client.user,
      },
    }, clientId);
  }

  private handleUpdate(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const doc = this.docs.get(client.sessionId);
    if (doc) {
      try {
        const update = new Uint8Array(payload.update);
        Y.applyUpdate(doc, update);

        this.broadcast(client.sessionId, {
          type: 'update',
          payload: {
            userId: clientId,
            update: payload.update,
          },
        }, clientId);
      } catch (error) {
        console.error('Failed to apply update:', error);
      }
    }
  }

  private getSessionClients(sessionId: string): Client[] {
    return Array.from(this.clients.values()).filter(
      client => client.sessionId === sessionId
    );
  }

  private broadcast(sessionId: string, message: Message, excludeClientId?: string): void {
    const sessionClients = this.getSessionClients(sessionId);
    
    sessionClients.forEach(client => {
      if (client.id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  stop(): void {
    this.wss?.close();
    this.clients.clear();
    this.docs.forEach(doc => doc.destroy());
    this.docs.clear();
    console.log('Collaboration server stopped');
  }
}

const server = new CollaborationServer(1234);
server.start();

process.on('SIGINT', () => {
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.stop();
  process.exit(0);
});

export { CollaborationServer };
