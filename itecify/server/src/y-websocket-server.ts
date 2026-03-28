import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const PORT = 1234;
const wss = new WebSocketServer({ port: PORT });

interface DocData {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<any>;
}

const docs = new Map<string, DocData>();

function getDoc(projectId: string): DocData {
  if (!docs.has(projectId)) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    const clients = new Set();
    docs.set(projectId, { doc, awareness, clients });
    console.log(`Created doc for: ${projectId}`);
  }
  return docs.get(projectId)!;
}

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

wss.on('error', (err) => {
  console.error('Server error:', err);
});

wss.on('connection', (ws, req) => {
  const projectId = req.url?.replace(/^\//, '') || 'default';
  console.log(`Connection to: ${projectId}`);
  
  const docData = getDoc(projectId);
  docData.clients.add(ws);
  
  const { doc, awareness } = docData;
  
  const send = (data: Uint8Array) => {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  };
  
  const broadcastAwareness = () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys()))
    );
    const msg = encoding.toUint8Array(encoder);
    docData.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(msg);
      }
    });
  };
  
  awareness.on('update', () => {
    broadcastAwareness();
  });
  
  doc.on('update', (update: Uint8Array, origin: any) => {
    if (origin !== ws) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      if (ws.readyState === 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
    }
  });
  
  ws.on('message', (data: Buffer) => {
    try {
      const message = new Uint8Array(data);
      const decoder = decoding.createDecoder(message);
      const type = decoding.readVarUint(decoder);
      
      switch (type) {
        case messageSync: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }
          break;
        }
        case messageAwareness: {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
          break;
        }
        case messageQueryAwareness: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys()))
          );
          ws.send(encoding.toUint8Array(encoder));
          break;
        }
      }
    } catch (e) {
      console.error('Message error:', e);
    }
  });
  
  ws.on('close', () => {
    docData.clients.delete(ws);
    awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], null);
    console.log(`Disconnected: ${projectId} (${docData.clients.size} remaining)`);
    
    if (docData.clients.size === 0) {
      docs.delete(projectId);
    }
  });
  
  ws.on('error', (err) => {
    console.error('WS error:', err);
  });
  
  // Initial sync
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));
});

console.log(`Y-WebSocket server running on ws://localhost:${PORT}`);
