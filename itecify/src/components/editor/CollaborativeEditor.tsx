import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
import { EditorState, Extension, StateEffect, StateField } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSessionStore, AIBlock, User } from '@/stores/sessionStore';
import { useEditorStore, FileNode } from '@/stores/editorStore';
import { Bot, Check, X, ChevronDown, ChevronRight, Move, UserCircle } from 'lucide-react';
import { CollabErrorBoundary } from './CollabErrorBoundary';

const iTECifyTheme = EditorView.theme({
  '&': {
    backgroundColor: '#020617',
    color: '#f1f5f9',
  },
  '.cm-content': {
    caretColor: '#3b82f6',
    fontFamily: "'JetBrains Mono', monospace",
  },
  '.cm-cursor': {
    borderLeftColor: '#3b82f6',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  '.cm-gutters': {
    backgroundColor: '#0f172a',
    color: '#64748b',
    border: 'none',
    borderRight: '1px solid #334155',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1e293b',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 16px 0 8px',
  },
  '.cm-ySelectionInfo': {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
  },
});

interface CodeEditorProps {
  projectId: string;
  user: { id: string; name: string; color: string };
  onUsersChange?: (users: User[]) => void;
  onConnectionChange?: (connected: boolean) => void;
  onSetContent?: (fn: (fileId: string, content: string) => void) => void;
}

function getLanguageExtension(language: string): Extension {
  switch (language) {
    case 'python':
      return python();
    case 'javascript':
    case 'typescript':
    default:
      return javascript({ typescript: language === 'typescript' });
  }
}

export function CodeEditor({ projectId, user, onUsersChange, onConnectionChange, onSetContent }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const providerRef = useRef<any>(null);
  const ydocRef = useRef<any>(null);
  const ytextMapRef = useRef<Map<string, any>>(new Map());
  const onUsersChangeRef = useRef(onUsersChange);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onSetContentRef = useRef(onSetContent);
  const editorSetContentRef = useRef<((fileId: string, content: string) => void) | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [isCollabReady, setIsCollabReady] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<{ user: User | null; position: { x: number; y: number } } | null>(null);
  const { aiBlocks, updateAIBlock, removeAIBlock } = useSessionStore();
  const { activeFileId, files, updateFileContent, openFile } = useEditorStore();
  const [userChanges, setUserChanges] = useState<Map<number, { user: User; timestamp: number }>>(new Map());

  onUsersChangeRef.current = onUsersChange;
  onConnectionChangeRef.current = onConnectionChange;
  onSetContentRef.current = onSetContent;

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('rightID') || event.message?.includes("can't access property \"client\"")) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      return false;
    };
    
    window.addEventListener('error', handleError as unknown as EventListener);
    return () => window.removeEventListener('error', handleError as unknown as EventListener);
  }, []);

  useEffect(() => {
    if (activeFileId && ytextMapRef.current.size > 0) {
      const findFile = (nodes: FileNode[]): FileNode | null => {
        for (const n of nodes) {
          if (n.id === activeFileId) return n;
          if (n.children) {
            const f = findFile(n.children);
            if (f) return f;
          }
        }
        return null;
      };
      const file = findFile(files);
      if (file && file.content !== undefined) {
        const ytext = ytextMapRef.current.get(file.id);
        if (ytext && ytext.toString() !== file.content) {
          ytext.delete(0, ytext.length);
          if (file.content) {
            ytext.insert(0, file.content);
          }
        }
      }
    }
  }, [files, activeFileId]);

  const currentFile = useMemo(() => {
    const findFile = (nodes: FileNode[], id: string): FileNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findFile(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    return findFile(files, activeFileId || '') || null;
  }, [files, activeFileId]);

  useEffect(() => {
    if (!editorRef.current) return;

    let view: EditorView | null = null;
    let provider: any = null;
    let ydoc: any = null;
    let ytextMap = new Map<string, any>();
    let yFilesMap: any = null;
    let isLocalChange = false;
    ytextMapRef.current = ytextMap;

    const setEditorContent = (fileId: string, content: string) => {
      const ytextKey = `file:${fileId}`;
      console.log('[SETEDITOR] fileId:', fileId, 'ytextKey:', ytextKey);
      console.log('[SETEDITOR] Content to set:');
      console.log(content);
      
      let ytext = ytextMap.get(ytextKey);
      console.log('[SETEDITOR] ytext found with key', ytextKey, ':', !!ytext, 'current length:', ytext?.length);
      
      if (!ytext && ydoc) {
        ytext = ydoc.getText(ytextKey);
        ytextMap.set(ytextKey, ytext);
        console.log('[SETEDITOR] Created new ytext with key:', ytextKey);
      }
      
      if (ytext) {
        const oldLen = ytext.length;
        isLocalChange = true;
        if (oldLen > 0) {
          ytext.delete(0, oldLen);
        }
        ytext.insert(0, content);
        isLocalChange = false;
        console.log('[SETEDITOR] Updated ytext, new length:', ytext.length);
        console.log('[SETEDITOR] Ytext content now:');
        console.log(ytext.toString());
      } else {
        console.log('[SETEDITOR] ERROR: No ytext found!');
      }
    };
    
    editorSetContentRef.current = setEditorContent;
    
    if (onSetContentRef.current) {
      console.log('[SETEDITOR] Registering setEditorContent via onSetContentRef');
      onSetContentRef.current(setEditorContent);
    }

    const initEditor = async () => {
      const Y = await import('yjs');
      const { WebsocketProvider } = await import('y-websocket');
      const { yCollab, yRemoteSelectionsTheme } = await import('y-codemirror.next');

      ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      yFilesMap = ydoc.getMap('files');

      const syncFilesFromYjs = () => {
        if (isLocalChange) return;
        isLocalChange = true;
        
        try {
          const storeFiles = useEditorStore.getState().files;
          const newFiles = [...storeFiles];
          const processedIds = new Set<string>();
          
          yFilesMap.forEach((value: any, key: string) => {
            if (key === '_meta') return;
            processedIds.add(key);
            
            const remoteFile: FileNode = value;
            const existingIndex = newFiles.findIndex(f => f.id === key);
            
            if (existingIndex === -1) {
              newFiles.push(remoteFile);
              console.log('[Sync] File added from Yjs:', remoteFile.name);
            } else {
              newFiles[existingIndex] = remoteFile;
            }
          });
          
          const idsToRemove: string[] = [];
          newFiles.forEach((file, index) => {
            if (!processedIds.has(file.id)) {
              idsToRemove.push(String(index));
            }
          });
          idsToRemove.reverse().forEach(idx => newFiles.splice(parseInt(idx), 1));
          
          useEditorStore.setState({ files: newFiles });
        } finally {
          isLocalChange = false;
        }
      };
      
      yFilesMap.observe(() => {
        console.log('[Yjs] File map changed, syncing from Yjs...');
        syncFilesFromYjs();
      });

      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:1234`;
      
      provider = new WebsocketProvider(wsUrl, projectId, ydoc, {
        connect: true,
      });

      providerRef.current = provider;

      await new Promise<void>((resolve) => {
        provider.on('synced', () => {
          console.log('[Collab] Initial sync complete');
          resolve();
        });
        setTimeout(resolve, 2000);
      });

      let cleanupInterval: NodeJS.Timeout | null = null;
      
      if (provider.awareness) {
        let localAwarenessSetAt = Date.now();
        provider.awareness.setLocalStateField('user', {
          id: user.id,
          name: user.name,
          color: user.color,
          setAt: localAwarenessSetAt,
        });

        const refreshLocalAwareness = () => {
          const now = Date.now();
          if (now - localAwarenessSetAt > 10000) {
            localAwarenessSetAt = now;
            provider.awareness?.setLocalStateField('user', {
              id: user.id,
              name: user.name,
              color: user.color,
              setAt: now,
            });
          }
        };

        cleanupInterval = setInterval(refreshLocalAwareness, 10000);

        provider.awareness.on('change', () => {
          try {
            const states = provider.awareness?.getStates();
            if (!states) return;
            const users: User[] = [];
            const localClientId = ydoc?.clientID;
            const now = Date.now();
            states.forEach((state: any, clientId: number) => {
              if (state.user && localClientId !== undefined && clientId !== localClientId) {
                const userSetAt = state.user.setAt || 0;
                if (now - userSetAt > 30000) return;
                const userId = state.user.id || `unknown-${clientId}`;
                const existing = users.find(u => u.id === userId);
                if (!existing) {
                  users.push({
                    id: userId,
                    name: state.user.name || 'Anonymous',
                    color: state.user.color || '#3b82f6',
                    role: 'human',
                    cursorPosition: state.cursor,
                    setAt: userSetAt,
                  });
                }
              }
            });
            setConnectedUsers(users);
            onUsersChangeRef.current?.(users);
          } catch (e) {
            console.warn('Awareness change error:', e);
          }
        });
      }

      provider.on('status', ({ status }: { status: string }) => {
        onConnectionChangeRef.current?.(status === 'connected');
        if (status === 'disconnected') {
          setConnectedUsers([]);
          onUsersChangeRef.current?.([]);
        }
      });

      const cleanupAwareness = () => {
        if (cleanupInterval) {
          clearInterval(cleanupInterval);
          cleanupInterval = null;
        }
        if (provider.awareness) {
          provider.awareness.setLocalState(null);
        }
      };

      const syncFilesToYjs = () => {
        if (isLocalChange) return;
        isLocalChange = true;
        
        const editorFiles = useEditorStore.getState().files;
        if (editorFiles.length === 0) {
          isLocalChange = false;
          return;
        }
        
        const currentIds = new Set<string>();
        
        const flattenFiles = (files: FileNode[]): FileNode[] => {
          const result: FileNode[] = [];
          for (const file of files) {
            result.push({ ...file, children: undefined });
            if (file.children) {
              result.push(...flattenFiles(file.children));
            }
          }
          return result;
        };
        
        const flatFiles = flattenFiles(editorFiles);
        const fileMap = new Map(flatFiles.map(f => [f.id, f]));
        
        fileMap.forEach((file, id) => {
          currentIds.add(id);
          const existing = yFilesMap.get(id);
          const fileStr = JSON.stringify(file);
          if (!existing || JSON.stringify(existing) !== fileStr) {
            yFilesMap.set(id, file);
          }
        });
        
        const idsToDelete: string[] = [];
        yFilesMap.forEach((_: any, key: string) => {
          if (key !== '_meta' && !currentIds.has(key)) {
            idsToDelete.push(key);
          }
        });
        idsToDelete.forEach(id => yFilesMap.delete(id));
        
        isLocalChange = false;
      };

      const createExtensions = (fileId: string, ytext: any) => {
        const file = (() => {
          const find = (nodes: FileNode[], id: string): FileNode | null => {
            for (const n of nodes) {
              if (n.id === id) return n;
              if (n.children) {
                const f = find(n.children, id);
                if (f) return f;
              }
            }
            return null;
          };
          return find(useEditorStore.getState().files, fileId);
        })();
        
        const updateListener = EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            updateFileContent(fileId, newContent);
          }
        });
        
        // Base extensions (no yCollab yet - added after awareness is ready)
        const baseExtensions: Extension[] = [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          foldGutter(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          syntaxHighlighting(defaultHighlightStyle),
          oneDark,
          iTECifyTheme,
          yRemoteSelectionsTheme,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          file?.language === 'python' ? python() : javascript({ typescript: file?.language === 'typescript' }),
          updateListener,
        ];
        
        // Add yCollab if provider and awareness are ready
        if (provider?.awareness) {
          try {
            const undoManager = new Y.UndoManager(ytext);
            const collabExtension = yCollab(ytext, provider.awareness, { undoManager });
            return [...baseExtensions, collabExtension];
          } catch (e) {
            console.warn('yCollab initialization error:', e);
            return baseExtensions;
          }
        }
        
        return baseExtensions;
      };

      const activeFile = useEditorStore.getState().activeFileId;
      const initialFileId = activeFile || 'index';
      let initialYText = ytextMap.get(`file:${initialFileId}`);
      
      const findFileContent = (nodes: FileNode[], id: string): string | null => {
        for (const n of nodes) {
          if (n.id === id) return n.content || null;
          if (n.children) {
            const f = findFileContent(n.children, id);
            if (f !== null) return f;
          }
        }
        return null;
      };
      
      if (!initialYText) {
        initialYText = ydoc.getText(`file:${initialFileId}`);
        ytextMap.set(`file:${initialFileId}`, initialYText);
        
        if (initialYText.length === 0) {
          const storedContent = findFileContent(useEditorStore.getState().files, initialFileId);
          if (!storedContent) {
            const defaultContent = `// Welcome to iTECify
// Start coding together!

function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('iTEC 2026');
`;
            initialYText.insert(0, defaultContent);
          }
        }
      }

      if (!editorRef.current) return;

      const state = EditorState.create({
        doc: initialYText.toString(),
        extensions: createExtensions(initialFileId, initialYText),
      });

      view = new EditorView({
        state,
        parent: editorRef.current,
      });

      setIsCollabReady(true);

      let currentFileId = initialFileId;

      const unsubscribeFileChange = useEditorStore.subscribe(
        (state, prevState) => {
          if (state.activeFileId !== prevState.activeFileId && state.activeFileId) {
            const newFileId = state.activeFileId;
            
            let newYText = ytextMap.get(`file:${newFileId}`);
            if (!newYText) {
              newYText = ydoc.getText(`file:${newFileId}`);
              ytextMap.set(`file:${newFileId}`, newYText);
            }
            
            const findFileContent = (nodes: FileNode[], id: string): string | null => {
              for (const n of nodes) {
                if (n.id === id) return n.content || null;
                if (n.children) {
                  const f = findFileContent(n.children, id);
                  if (f !== null) return f;
                }
              }
              return null;
            };
            
            const storeContent = findFileContent(state.files, newFileId);
            
            if (newYText.length === 0 && storeContent) {
              newYText.insert(0, storeContent);
            } else if (storeContent && newYText.toString() !== storeContent) {
              isLocalChange = true;
              newYText.delete(0, newYText.length);
              newYText.insert(0, storeContent);
              isLocalChange = false;
            }

            currentFileId = newFileId;

            view?.setState(
              EditorState.create({
                doc: newYText.toString(),
                extensions: createExtensions(newFileId, newYText),
              })
            );
          }
          
          if (state.files !== prevState.files) {
            syncFilesToYjs();
          }
        }
      );

      return () => {
        unsubscribeFileChange();
        cleanupAwareness();
        view?.destroy();
        provider?.destroy();
        ydoc?.destroy();
      };
    };

    const cleanup = initEditor();

    return () => {
      cleanup.then(fn => fn?.());
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
    };
  }, [projectId, user]);

  const handleAcceptBlock = useCallback((blockId: string) => {
    updateAIBlock(blockId, { status: 'accepted' });
  }, [updateAIBlock]);

  const handleRejectBlock = useCallback(async (blockId: string) => {
    const block = aiBlocks.find(b => b.id === blockId);
    if (block?.rollbackData && block.rollbackData.length > 0) {
      try {
        const token = localStorage.getItem('accessToken');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        await fetch(`${API_URL}/api/agents/agents/execute/rollback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ projectId, rollbackData: block.rollbackData }),
        });
      } catch (err) {
        console.error('Rollback failed:', err);
      }
    }
    removeAIBlock(blockId);
  }, [aiBlocks, projectId, removeAIBlock]);

  const pendingBlocks = aiBlocks.filter(b => b.status === 'pending');

  return (
    <div className="relative h-full flex flex-col bg-[#020617]">
      <div className="flex-1 overflow-hidden relative">
        <CollabErrorBoundary>
          <div ref={editorRef} className="h-full" />
        </CollabErrorBoundary>
        {!isCollabReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#020617]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Initializing collaborative editor...</p>
            </div>
          </div>
        )}
      </div>

      {pendingBlocks.length > 0 && (
        <AIBlocksOverlay
          blocks={pendingBlocks}
          onAccept={handleAcceptBlock}
          onReject={handleRejectBlock}
        />
      )}

      <div className="absolute bottom-4 right-4 flex items-center gap-2 z-20">
        {connectedUsers.map((u, i) => (
          <div
            key={u.id}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: u.color }}
          >
            <div className="w-2 h-2 rounded-full bg-white/50 animate-pulse" />
            {u.name}
          </div>
        ))}
      </div>

      {selectionInfo && selectionInfo.user && (
        <div
          className="absolute z-30 px-3 py-2 rounded-lg text-xs shadow-lg"
          style={{
            left: Math.min(selectionInfo.position.x, window.innerWidth - 200),
            top: Math.max(selectionInfo.position.y, 10),
            backgroundColor: selectionInfo.user.color,
            color: '#fff',
          }}
        >
          <div className="flex items-center gap-2">
            <UserCircle size={14} />
            <span className="font-medium">{selectionInfo.user.name}</span>
            <span className="opacity-70">is editing this</span>
          </div>
        </div>
      )}
    </div>
  );
}

function mergeFiles(localFiles: FileNode[], remoteFiles: FileNode[]): FileNode[] {
  const result = [...localFiles];
  
  for (const remoteFile of remoteFiles) {
    const exists = result.some(f => f.id === remoteFile.id);
    if (!exists) {
      result.push(remoteFile);
    } else {
      const index = result.findIndex(f => f.id === remoteFile.id);
      if (remoteFile.type === 'folder' && result[index].children) {
        result[index] = {
          ...remoteFile,
          children: mergeFiles(result[index].children || [], remoteFile.children || []),
        };
      } else {
        result[index] = remoteFile;
      }
    }
  }
  
  return result;
}

function removeFilesFromTree(files: FileNode[], idsToRemove: Set<string>): FileNode[] {
  return files
    .filter(file => !idsToRemove.has(file.id))
    .map(file => {
      if (file.children) {
        return {
          ...file,
          children: removeFilesFromTree(file.children, idsToRemove),
        };
      }
      return file;
    });
}

function AIBlocksOverlay({ blocks, onAccept, onReject }: { blocks: AIBlock[]; onAccept: (id: string) => void; onReject: (id: string) => void }) {
  return (
    <div className="ai-blocks-container absolute bottom-0 left-0 right-0 pointer-events-none z-10">
      {blocks.map(block => (
        <AIBlockInline
          key={block.id}
          block={block}
          onAccept={() => onAccept(block.id)}
          onReject={() => onReject(block.id)}
        />
      ))}
    </div>
  );
}

function AIBlockInline({ block, onAccept, onReject }: { block: AIBlock; onAccept: () => void; onReject: () => void }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div 
      className="ai-inline-block pointer-events-auto mx-3 mb-3 rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div 
        className="flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', borderBottom: '1px solid rgba(139, 92, 246, 0.2)' }}
      >
        <div className="flex items-center gap-2">
          <Bot size={14} style={{ color: '#a78bfa' }} />
          <span className="text-xs font-medium" style={{ color: '#c4b5fd' }}>
            {block.agentName}
          </span>
          <span className="text-[10px]" style={{ color: '#64748b' }}>
            AI Suggestion
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAccept}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition"
            style={{ backgroundColor: '#22c55e', color: '#000' }}
            title="Accept (keep changes)"
          >
            <Check size={12} />
            Accept
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}
            title="Reject (undo changes)"
          >
            <X size={12} />
            Reject
          </button>
        </div>
      </div>
      <div className="p-4">
        <pre 
          className="font-mono text-sm whitespace-pre-wrap leading-relaxed"
          style={{ color: '#e2e8f0' }}
        >
          {block.content}
        </pre>
      </div>
    </div>
  );
}

export { CodeEditor as CollaborativeEditor };
