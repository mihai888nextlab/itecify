import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';

interface YjsProviderOptions {
  sessionId: string;
  userId: string;
  userName: string;
  userColor: string;
  onSync?: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

class YjsProvider {
  public doc: Y.Doc;
  public provider: WebsocketProvider | null = null;
  public persistence: IndexeddbPersistence | null = null;
  public awareness: WebsocketProvider['awareness'] | null = null;
  private options: YjsProviderOptions;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: YjsProviderOptions) {
    this.options = options;
    this.doc = new Y.Doc();
  }

  connect(wsUrl = 'ws://localhost:1234') {
    this.persistence = new IndexeddbPersistence(
      `itecify-${this.options.sessionId}`,
      this.doc
    );

    this.persistence.on('synced', () => {
      console.log('Content loaded from IndexedDB');
    });

    try {
      this.provider = new WebsocketProvider(
        wsUrl,
        `itecify-${this.options.sessionId}`,
        this.doc,
        { connect: true }
      );

      this.awareness = this.provider.awareness;

      this.awareness.setLocalStateField('user', {
        id: this.options.userId,
        name: this.options.userName,
        color: this.options.userColor,
        cursor: null,
        selection: null,
      });

      this.provider.on('status', ({ status }: { status: string }) => {
        this.options.onConnectionChange?.(status === 'connected');
      });

      this.provider.on('sync', (isSynced: boolean) => {
        if (isSynced) {
          this.options.onSync?.();
        }
      });

      this.provider.on('connection-error', () => {
        console.error('WebSocket connection error');
        this.options.onConnectionChange?.(false);
        this.scheduleReconnect();
      });
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.options.onConnectionChange?.(false);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, 3000);
  }

  updateCursor(position: { line: number; ch: number }, selection?: { from: number; to: number }) {
    if (this.awareness) {
      this.awareness.setLocalStateField('user', {
        ...this.awareness.getLocalState()?.user,
        cursor: position,
        selection,
      });
    }
  }

  getContent(): string {
    return this.doc.getText('content').toString();
  }

  setContent(content: string) {
    this.doc.getText('content').delete(0, this.doc.getText('content').length);
    this.doc.getText('content').insert(0, content);
  }

  insertContent(index: number, content: string) {
    this.doc.getText('content').insert(index, content);
  }

  deleteContent(index: number, length: number) {
    this.doc.getText('content').delete(index, length);
  }

  onContentChange(callback: (event: Y.YTextEvent) => void) {
    this.doc.getText('content').observe(callback);
  }

  onAwarenessChange(callback: (changes: { added: number[]; updated: number[]; removed: number[] }) => void) {
    this.awareness?.on('change', () => {
      const states = this.awareness?.getStates();
      if (states) {
        const userIds = Array.from(states.keys());
        callback({ added: [], updated: userIds, removed: [] });
      }
    });
  }

  getConnectedUsers(): Array<{ id: string; name: string; color: string; cursor?: any }> {
    if (!this.awareness) return [];
    const states = this.awareness.getStates();
    const users: Array<{ id: string; name: string; color: string; cursor?: any }> = [];
    
    states.forEach((state, clientId) => {
      if (state.user && clientId !== this.doc.clientID) {
        users.push(state.user);
      }
    });
    
    return users;
  }

  createSnapshot(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  applySnapshot(snapshot: Uint8Array) {
    Y.applyUpdate(this.doc, snapshot);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.provider?.disconnect();
    this.provider?.destroy();
    this.persistence?.destroy();
    this.doc.destroy();
  }
}

export function createYjsProvider(options: YjsProviderOptions): YjsProvider {
  return new YjsProvider(options);
}

export type { YjsProvider };
