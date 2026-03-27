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
    const latestState = await prisma.yjsState.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestState?.data) {
      Y.applyUpdate(doc, Buffer.from(latestState.data));
    }
  } catch (error) {
    console.log('No saved state found for project:', projectId);
  }
}

async function saveState(projectId: string, doc: Y.Doc) {
  try {
    const state = Y.encodeStateAsUpdate(doc);
    await prisma.yjsState.create({
      data: {
        projectId,
        data: Buffer.from(state),
      },
    });
    console.log('State saved for project:', projectId);
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

const connections = new Map<string, WSConnection>();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const projectId = url.pathname.slice(1) || 'default';
  
  console.log(`Client connected to project: ${projectId}`);
  
  const { doc, awareness } = getYDoc(projectId);
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  const conn: WSConnection = { ws, doc, awareness, projectId };
  connections.set(clientId, conn);
  
  const send = (data: Uint8Array) => {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  };
  
  const awarenessChangeHandler = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const changedClients = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
    const message = encoding.toUint8Array(encoder);
    send(message);
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
          awarenessProtocol.applyAwarenessUpdate(
            awareness,
            decoding.readVarUint8Array(decoder),
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
    connections.delete(clientId);
    awareness.off('update', awarenessChangeHandler);
    doc.off('update', docUpdateHandler);
    
    awarenessProtocol.removeAwarenessStates(
      awareness,
      [doc.clientID],
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
