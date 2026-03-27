import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { PrismaClient } from '@prisma/client';

const wss = new WebSocketServer({ port: 1234 });
const docs = new Map();
const prisma = new PrismaClient();

const messageSync = 0;
const messageAwareness = 1;

function getYDoc(projectId: string): Y.Doc {
  if (!docs.has(projectId)) {
    const doc = new Y.Doc();
    docs.set(projectId, doc);
    loadState(projectId, doc);
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
    console.error('Failed to load state:', error);
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
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

const connections = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const projectId = url.pathname.slice(1) || 'default';
  
  console.log(`Client connected to project: ${projectId}`);
  
  const doc = getYDoc(projectId);
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  connections.set(clientId, { ws, doc, projectId });
  
  ws.on('message', (data) => {
    try {
      const message = new Uint8Array(data);
      const messageType = message[0];
      
      if (messageType === messageSync) {
        const update = message.slice(1);
        Y.applyUpdate(doc, update);
        
        connections.forEach((conn) => {
          if (conn.projectId === projectId && conn.ws !== ws && conn.ws.readyState === 1) {
            conn.ws.send(Buffer.from([messageSync, ...update]));
          }
        });
      } else if (messageType === messageAwareness) {
        connections.forEach((conn) => {
          if (conn.projectId === projectId && conn.ws !== ws && conn.ws.readyState === 1) {
            conn.ws.send(data);
          }
        });
      }
    } catch (error) {
      console.error('Message error:', error);
    }
  });

  ws.on('close', async () => {
    connections.delete(clientId);
    
    if (connections.size === 0 || !Array.from(connections.values()).some(c => c.projectId === projectId)) {
      await saveState(projectId, doc);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  const state = Y.encodeStateAsUpdate(doc);
  ws.send(Buffer.from([messageSync, ...state]));
});

console.log('Y-WebSocket server running on ws://localhost:1234');
console.log('Waiting for connections...');
