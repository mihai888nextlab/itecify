import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSessionStore, AIBlock, User } from '@/stores/sessionStore';
import { useEditorStore, FileNode } from '@/stores/editorStore';
import { Bot, Check, X, ChevronDown, ChevronRight, Move } from 'lucide-react';

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

const awarenessTheme = EditorView.theme({
  '.cm-ySelectionInfo': {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontFamily: "'JetBrains Mono', monospace",
    whiteSpace: 'nowrap',
    opacity: '1 !important',
    visibility: 'visible !important',
    pointerEvents: 'none',
  },
  '.cm-ySelection': {
    opacity: '1 !important',
  },
  '.cm-ySelectionCaretDot': {
    display: 'none',
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
  const { aiBlocks, updateAIBlock, removeAIBlock } = useSessionStore();
  const { activeFileId, files, updateFileContent, openFile } = useEditorStore();

  onUsersChangeRef.current = onUsersChange;
  onConnectionChangeRef.current = onConnectionChange;
  onSetContentRef.current = onSetContent;

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
      const { yCollab } = await import('y-codemirror.next');

      ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      yFilesMap = ydoc.getMap('files');

      const syncFromYjs = () => {
        if (isLocalChange) return;

        const editorStore = useEditorStore.getState();
        const yjsFiles: FileNode[] = [];

        yFilesMap.forEach((value: any, key: string) => {
          if (key === '_meta') return;
          if (value === null) return;
          const fileData = typeof value === 'string' ? JSON.parse(value) : value;
          yjsFiles.push(fileData);
        });

        const localIds = new Set<string>();
        const collectLocalIds = (files: FileNode[]) => {
          files.forEach(f => {
            localIds.add(f.id);
            if (f.children) collectLocalIds(f.children);
          });
        };
        collectLocalIds(editorStore.files);

        const yjsIds = new Set(yjsFiles.map(f => f.id));
        const localFilesHaveContent = editorStore.files.some(f => f.content && f.content.length > 0);
        
        if (localFilesHaveContent && yjsFiles.length === 0 && localIds.size > 0) {
          return;
        }

        let needsUpdate = false;
        const allIds = new Set([...localIds, ...yjsFiles.map(f => f.id)]);
        
        allIds.forEach(id => {
          const inLocal = editorStore.files.some(f => f.id === id);
          const inYjs = yjsFiles.some(f => f.id === id);
          if (inLocal !== inYjs) needsUpdate = true;
        });

        if (needsUpdate || editorStore.files.length !== yjsFiles.length) {
          useEditorStore.setState({ files: yjsFiles });
        }
      };

      yFilesMap.observe((event: any) => {
        syncFromYjs();
      });

      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:1234`;
      
      provider = new WebsocketProvider(wsUrl, projectId, ydoc, {
        connect: true,
      });

      providerRef.current = provider;

      if (provider.awareness) {
        provider.awareness.setLocalStateField('user', {
          name: user.name,
          color: user.color,
        });

        provider.awareness.on('change', () => {
          const states = provider.awareness?.getStates();
          if (!states) return;
          const users: User[] = [];
          const localClientId = ydoc?.clientID;
          states.forEach((state: any, clientId: number) => {
            if (state.user && localClientId !== undefined && clientId !== localClientId) {
              const existing = users.find(u => u.name === state.user.name);
              if (!existing) {
                users.push({
                  id: String(clientId),
                  name: state.user.name || 'Anonymous',
                  color: state.user.color || '#3b82f6',
                  role: 'human',
                  cursorPosition: state.cursor,
                });
              }
            }
          });
          setConnectedUsers(users);
          onUsersChangeRef.current?.(users);
        });
      }

      provider.on('status', ({ status }: { status: string }) => {
        onConnectionChangeRef.current?.(status === 'connected');
      });

      const syncFilesToYjs = () => {
        const editorFiles = useEditorStore.getState().files;
        
        if (editorFiles.length === 0) return;
        
        const currentIds = new Set<string>();
        
        isLocalChange = true;
        editorFiles.forEach(file => {
          syncFileToYjs(file, yFilesMap);
          collectIds(file, currentIds);
        });
        
        yFilesMap.forEach((value: any, key: string) => {
          if (key !== '_meta' && !currentIds.has(key)) {
            yFilesMap.delete(key);
          }
        });
        
        setTimeout(() => { isLocalChange = false; }, 100);
      };

      const collectIds = (file: FileNode, ids: Set<string>) => {
        ids.add(file.id);
        if (file.children) {
          file.children.forEach((child: FileNode) => collectIds(child, ids));
        }
      };

      const syncFileToYjs = (file: FileNode, yMap: any) => {
        const existing = yMap.get(file.id);
        if (!existing || JSON.stringify(existing) !== JSON.stringify(file)) {
          yMap.set(file.id, file);
        }
        if (file.children) {
          file.children.forEach((child: FileNode) => syncFileToYjs(child, yMap));
        }
      };

      const createExtensions = (fileId: string) => {
        let ytext = ytextMap.get(`file:${fileId}`);
        if (!ytext) {
          ytext = ydoc.getText(`file:${fileId}`);
          ytextMap.set(`file:${fileId}`, ytext);
        }
        
        const updateListener = EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            updateFileContent(fileId, newContent);
          }
          if (update.selectionSet && provider?.awareness) {
            const selection = update.state.selection.main;
            provider.awareness.setLocalStateField('cursor', {
              anchor: selection.anchor,
              head: selection.head,
              user: { name: user.name, color: user.color },
            });
          }
        });
        
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
        
        const yCollabExtension = (() => {
          if (!provider.awareness) return [];
          try {
            return yCollab(ytext, provider.awareness);
          } catch (e) {
            console.warn('yCollab initialization failed, disabling remote cursors:', e);
            return [];
          }
        })();
        
        return [
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
          awarenessTheme,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          file?.language === 'python' ? python() : javascript({ typescript: file?.language === 'typescript' }),
          yCollabExtension,
          updateListener,
        ];
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
        extensions: createExtensions(initialFileId),
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
                extensions: createExtensions(newFileId),
              })
            );
          }
        }
      );

      return () => {
        unsubscribeFileChange();
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

  const handleRejectBlock = useCallback((blockId: string) => {
    removeAIBlock(blockId);
  }, [removeAIBlock]);

  const pendingBlocks = aiBlocks.filter(b => b.status === 'pending');

  return (
    <div className="relative h-full flex flex-col bg-[#020617]">
      <div className="flex-1 overflow-hidden relative">
        <div ref={editorRef} className="h-full" />
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
    <div className="absolute inset-0 pointer-events-none z-10 overflow-auto">
      {blocks.map(block => (
        <AIBlockWidget
          key={block.id}
          block={block}
          onAccept={() => onAccept(block.id)}
          onReject={() => onReject(block.id)}
        />
      ))}
    </div>
  );
}

function AIBlockWidget({ block, onAccept, onReject }: { block: AIBlock; onAccept: () => void; onReject: () => void }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="ai-block pointer-events-auto" style={{ margin: '8px 16px' }}>
      <div className="ai-block-header">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-purple-400" />
          <span className="text-xs font-medium text-purple-300">
            Generated by {block.agentName}
          </span>
          <span className="text-[10px] text-slate-500">
            {new Date(block.createdAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-white/10 rounded transition"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <div className="ai-block-actions flex gap-1">
            <button
              onClick={onAccept}
              className="p-1.5 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded transition"
              title="Accept"
            >
              <Check size={14} />
            </button>
            <button
              onClick={onReject}
              className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded transition"
              title="Reject"
            >
              <X size={14} />
            </button>
            <button className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded transition" title="Move">
              <Move size={14} />
            </button>
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <div className="p-4 font-mono text-sm text-slate-300">
          <pre className="whitespace-pre-wrap">{block.content}</pre>
        </div>
      )}
    </div>
  );
}

export { CodeEditor as CollaborativeEditor };
