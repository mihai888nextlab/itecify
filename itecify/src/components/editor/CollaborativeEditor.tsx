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
    fontFamily: 'JetBrains Mono, monospace',
    whiteSpace: 'nowrap',
  },
});

interface CodeEditorProps {
  projectId: string;
  user: { id: string; name: string; color: string };
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

export function CodeEditor({ projectId, user }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const providerRef = useRef<any>(null);
  const ydocRef = useRef<any>(null);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [isCollabReady, setIsCollabReady] = useState(false);
  const { aiBlocks, updateAIBlock, removeAIBlock } = useSessionStore();
  const { activeFileId, files, updateFileContent, openFile } = useEditorStore();

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

    const initEditor = async () => {
      const Y = await import('yjs');
      const { WebsocketProvider } = await import('y-websocket');
      const { yCollab } = await import('y-codemirror.next');

      ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      yFilesMap = ydoc.getMap('files');

      yFilesMap.observe((event: any) => {
        if (isLocalChange) return;

        const editorStore = useEditorStore.getState();
        const newFiles: FileNode[] = [];

        yFilesMap.forEach((value: any, key: string) => {
          if (key === '_meta') return;
          if (value === null) return;
          const fileData = typeof value === 'string' ? JSON.parse(value) : value;
          newFiles.push(fileData);
        });

        if (event.changes.keys) {
          const deletedKeys: string[] = [];
          event.changes.keys.forEach((change: any, key: string) => {
            if (change.action === 'delete' && key !== '_meta') {
              deletedKeys.push(key);
            }
          });
          
          if (deletedKeys.length > 0) {
            const idsToRemove = new Set<string>();
            const collectIds = (fileId: string) => {
              idsToRemove.add(fileId);
              const file = editorStore.files.find(f => f.id === fileId);
              if (file?.children) {
                file.children.forEach((child: FileNode) => collectIds(child.id));
              }
            };
            deletedKeys.forEach(collectIds);
            
            const filteredFiles = removeFilesFromTree(editorStore.files, idsToRemove);
            useEditorStore.setState({ files: filteredFiles });
            return;
          }
        }

        const needsUpdate = newFiles.length !== editorStore.files.length || 
          !newFiles.every(f => editorStore.files.some(lf => lf.id === f.id));

        if (needsUpdate) {
          const currentFiles = editorStore.files;
          const mergedFiles = mergeFiles(currentFiles, newFiles);
          useEditorStore.setState({ files: mergedFiles });
        }
      });

      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:1234`;
      
      provider = new WebsocketProvider(wsUrl, projectId, ydoc, {
        connect: true,
      });

      providerRef.current = provider;

      provider.awareness.setLocalStateField('user', {
        name: user.name,
        color: user.color,
      });

      provider.awareness.on('change', () => {
        const states = provider.awareness.getStates();
        const users: User[] = [];
        states.forEach((state: any, clientId: number) => {
          if (state.user && clientId !== ydoc.clientID) {
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
      });

      const syncFilesToYjs = () => {
        const editorFiles = useEditorStore.getState().files;
        const currentIds = new Set<string>();
        
        editorFiles.forEach(file => {
          syncFileToYjs(file, yFilesMap);
          collectIds(file, currentIds);
        });
        
        yFilesMap.forEach((value: any, key: string) => {
          if (key !== '_meta' && !currentIds.has(key)) {
            isLocalChange = true;
            yFilesMap.delete(key);
            isLocalChange = false;
          }
        });
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
          isLocalChange = true;
          yMap.set(file.id, file);
          isLocalChange = false;
        }
        if (file.children) {
          file.children.forEach((child: FileNode) => syncFileToYjs(child, yMap));
        }
      };

      const unsubscribe = useEditorStore.subscribe(
        (state, prevState) => {
          if (state.files !== prevState.files) {
            syncFilesToYjs();
          }
        }
      );

      const createExtensions = (fileId: string) => {
        let ytext = ytextMap.get(fileId);
        if (!ytext) {
          ytext = ydoc.getText(`file:${fileId}`);
          ytextMap.set(fileId, ytext);
        }
        
        const updateListener = EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            updateFileContent(fileId, newContent);
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
          yCollab(ytext, provider.awareness),
          updateListener,
        ];
      };

      const activeFile = useEditorStore.getState().activeFileId;
      const initialFileId = activeFile || 'index';
      let initialYText = ytextMap.get(initialFileId);
      
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
        ytextMap.set(initialFileId, initialYText);
        
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

      viewRef.current = view;

      provider.on('synced', () => {
        setIsCollabReady(true);
        
        const editorFiles = useEditorStore.getState().files;
        yFilesMap.forEach((value: any, key: string) => {
          if (key === '_meta') return;
          const fileData = typeof value === 'string' ? JSON.parse(value) : value;
          const existsLocally = editorFiles.some(f => f.id === fileData.id);
          if (!existsLocally) {
            useEditorStore.getState().addFile({
              name: fileData.name,
              type: fileData.type,
              language: fileData.language,
              content: fileData.content || '',
            });
          }
        });
      });

      if (initialYText.length > 0) {
        setIsCollabReady(true);
      }

      let currentFileId = initialFileId;

      const unsubscribeFileChange = useEditorStore.subscribe(
        (state, prevState) => {
          if (state.activeFileId !== prevState.activeFileId && state.activeFileId) {
            const newFileId = state.activeFileId;
            
            let newYText = ytextMap.get(newFileId);
            if (!newYText) {
              newYText = ydoc.getText(`file:${newFileId}`);
              ytextMap.set(newFileId, newYText);
              
              if (newYText.length === 0) {
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
                  return find(state.files, newFileId);
                })();
                if (file?.content) {
                  newYText.insert(0, file.content);
                }
              }
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
        unsubscribe();
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
