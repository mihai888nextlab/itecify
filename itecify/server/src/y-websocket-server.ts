import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { PrismaClient } from '@prisma/client';

const PORT = 1234;
const wss = new WebSocketServer({ port: PORT });
const docs = new Map();

interface WSConnection {
  ws: any;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  projectId: string;
}

const prisma = new PrismaClient();

const messageSync = 0;
const messageAwareness = 1;
const messageAuth = 2;
const messageQueryAwareness = 3;

function getYDoc(projectId: string): { doc: Y.Doc; awareness: awarenessProtocol.Awareness } {
  if (!docs.has(projectId)) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    
    loadState(projectId, doc);
    
    docs.set(projectId, { doc, awareness });
  }
  return docs.get(projectId)!;
}

async function loadState(projectId: string, doc: Y.Doc) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    
    if (!project) {
      console.log('Project not found, starting fresh:', projectId);
      return;
    }
    
    const latestState = await prisma.yjsState.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestState?.data) {
      Y.applyUpdate(doc, Buffer.from(latestState.data));
      console.log('State loaded for project:', projectId);
    } else {
      console.log('No saved state found, starting fresh:', projectId);
    }
  } catch (error: any) {
    console.log('Error loading state:', error.message);
  }
}

async function saveState(projectId: string, doc: Y.Doc) {
  try {
    const state = Y.encodeStateAsUpdate(doc);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    
    if (project) {
      await prisma.yjsState.create({
        data: {
          projectId,
          data: Buffer.from(state),
        },
      });
      console.log('State saved for project:', projectId);
    } else {
      console.log('Project not found, skipping state save:', projectId);
    }
  } catch (error: any) {
    console.error('Failed to save state:', error.message);
  }
}

const connections = new Map<string, WSConnection>();
const userAwarenessMap = new Map<string, { projectId: string; clientId: number }>();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const projectId = url.pathname.slice(1) || 'default';
  
  console.log(`Client connected to project: ${projectId}`);
  
  const { doc, awareness } = getYDoc(projectId);
  const clientId = doc.clientID;
  
  const conn: WSConnection = { ws, doc, awareness, projectId };
  connections.set(clientId.toString(), conn);
  
  const send = (data: Uint8Array) => {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  };
  
  const cleanupDuplicateAwareness = () => {
    const userIdToClientId = new Map<string, number>();
    const clientIdToUserId = new Map<number, string>();
    
    awareness.getStates().forEach((state: any, clientId: number) => {
      if (state?.user?.id) {
        const existingClientId = userIdToClientId.get(state.user.id);
        if (existingClientId !== undefined) {
          awarenessProtocol.removeAwarenessStates(awareness, [existingClientId], null);
        }
        userIdToClientId.set(state.user.id, clientId);
        clientIdToUserId.set(clientId, state.user.id);
      }
    });
  };
  
  const awarenessChangeHandler = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const changedClients = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
    const message = encoding.toUint8Array(encoder);
    send(message);
    
    if (added.length > 0) {
      cleanupDuplicateAwareness();
    }
  };
  
  awareness.on('update', awarenessChangeHandler);
  
  const docUpdateHandler = (update: Uint8Array, origin: any) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    send(encoding.toUint8Array(encoder));
  };
  
  doc.on('update', docUpdateHandler);
  
  ws.on('message', (data: Buffer) => {
    try {
      const message = new Uint8Array(data);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);
      
      switch (messageType) {
        case messageSync: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null);
          
          if (encoding.length(encoder) > 1) {
            send(encoding.toUint8Array(encoder));
          }
          
          if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
            saveState(projectId, doc);
          }
          break;
        }
        case messageAwareness: {
          const update = decoding.readVarUint8Array(decoder);
          
          awarenessProtocol.applyAwarenessUpdate(
            awareness,
            update,
            null
          );
          break;
        }
        case messageQueryAwareness: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(
              awareness,
              Array.from(awareness.getStates().keys())
            )
          );
          send(encoding.toUint8Array(encoder));
          break;
        }
      }
    } catch (error) {
      console.error('Message error:', error);
    }
  });

  ws.on('close', async () => {
    connections.delete(clientId.toString());
    awareness.off('update', awarenessChangeHandler);
    doc.off('update', docUpdateHandler);
    
    userAwarenessMap.forEach((value, userId) => {
      if (value.projectId === projectId && value.clientId === clientId) {
        userAwarenessMap.delete(userId);
      }
    });
    
    awarenessProtocol.removeAwarenessStates(
      awareness,
      [clientId],
      null
    );
    
    console.log(`Client disconnected from project: ${projectId}`);
    
    const hasConnectionsForProject = Array.from(connections.values()).some(c => c.projectId === projectId);
    if (!hasConnectionsForProject) {
      await saveState(projectId, doc);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(encoding.toUint8Array(encoder));
    
    const awarenessStates = awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          Array.from(awarenessStates.keys())
        )
      );
      send(encoding.toUint8Array(encoder));
    }
  }
});

console.log(`Y-WebSocket server running on ws://localhost:${PORT}`);
console.log('Waiting for connections...');

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  docs.forEach(async (_, projectId) => {
    const { doc } = docs.get(projectId)!;
    await saveState(projectId, doc);
  });
  process.exit(0);
});
