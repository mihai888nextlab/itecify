import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { EditorState, Extension, StateField, StateEffect } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { User } from '@/stores/sessionStore';
import { useEditorStore, FileNode } from '@/stores/editorStore';
import { UserCircle } from 'lucide-react';
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
  '.cm-ai-block': {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderBottom: '2px solid rgba(139, 92, 246, 0.4)',
  },
  '.cm-ai-suggestion': {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderBottom: '2px solid #8b5cf6',
    borderRadius: '2px',
    padding: '0 2px',
  },
  '.cm-ai-header': {
    color: '#a855f7',
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
});

const aiSuggestionMark = Decoration.mark({ class: 'cm-ai-suggestion' });
const aiHeaderMark = Decoration.mark({ class: 'cm-ai-header' });

const addAIHighlight = StateEffect.define<{ from: number; to: number; isHeader?: boolean }>();
const removeAIHighlights = StateEffect.define<void>();

const aiHighlightsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(addAIHighlight)) {
        const { from, to, isHeader } = effect.value;
        decorations = decorations.update({
          add: [{ from, to, value: isHeader ? aiHeaderMark : aiSuggestionMark }],
        });
      } else if (effect.is(removeAIHighlights)) {
        decorations = Decoration.none;
      }
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(f),
});

interface CodeEditorProps {
  projectId: string;
  user: { id: string; name: string; color: string };
  onUsersChange?: (users: User[]) => void;
  onConnectionChange?: (connected: boolean) => void;
  onSetContent?: (fn: (fileId: string, content: string) => void) => void;
  onChatMessages?: (messages: Array<{ from: string; text: string; time: string; id: string }>) => void;
  onAddChatMessage?: (fn: (from: string, text: string) => void) => void;
  onInsertAIContent?: (fn: (content: string) => void) => void;
  onAIAccept?: (fn: () => void) => void;
  onAIReject?: (fn: () => void) => void;
  onHasAISuggestion?: (has: boolean) => void;
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

export function CodeEditor({ projectId, user, onUsersChange, onConnectionChange, onSetContent, onChatMessages, onAddChatMessage, onInsertAIContent, onAIAccept, onAIReject, onHasAISuggestion }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const providerRef = useRef<any>(null);
  const ydocRef = useRef<any>(null);
  const ytextMapRef = useRef<Map<string, any>>(new Map());
  const onUsersChangeRef = useRef(onUsersChange);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onSetContentRef = useRef(onSetContent);
  const onChatMessagesRef = useRef(onChatMessages);
  const onAddChatMessageRef = useRef(onAddChatMessage);
  const onInsertAIContentRef = useRef(onInsertAIContent);
  const onAIAcceptRef = useRef(onAIAccept);
  const onAIRejectRef = useRef(onAIReject);
  const onHasAISuggestionRef = useRef(onHasAISuggestion);
  const editorSetContentRef = useRef<((fileId: string, content: string) => void) | null>(null);
  const aiSuggestionRef = useRef<{ from: number; to: number } | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [isCollabReady, setIsCollabReady] = useState(false);
  const [hasAISuggestion, setHasAISuggestion] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<{ user: User | null; position: { x: number; y: number } } | null>(null);
  const { activeFileId, files, updateFileContent, openFile } = useEditorStore();
  const [userChanges, setUserChanges] = useState<Map<number, { user: User; timestamp: number }>>(new Map());

  onUsersChangeRef.current = onUsersChange;
  onConnectionChangeRef.current = onConnectionChange;
  onSetContentRef.current = onSetContent;
  onChatMessagesRef.current = onChatMessages;
  onAddChatMessageRef.current = onAddChatMessage;
  onInsertAIContentRef.current = onInsertAIContent;
  onAIAcceptRef.current = onAIAccept;
  onAIRejectRef.current = onAIReject;
  onHasAISuggestionRef.current = onHasAISuggestion;

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
      const yChatArray = ydoc.getArray('chat');
      
      const syncChatFromYjs = () => {
        const messages: Array<{ from: string; text: string; time: string; id: string }> = [];
        yChatArray.forEach((msg: any) => {
          messages.push(msg);
        });
        onChatMessagesRef.current?.(messages);
      };
      
      yChatArray.observe(() => {
        syncChatFromYjs();
      });
      
      const addChatMessage = (from: string, text: string, msgId?: string) => {
        const msg = {
          id: msgId || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          from,
          text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        yChatArray.push([msg]);
      };
      
      onAddChatMessageRef.current?.(addChatMessage);

      const syncFilesFromYjs = () => {
        if (isLocalChange) return;
        isLocalChange = true;
        
        const filesMap = new Map<string, FileNode>();
        
        yFilesMap.forEach((value: any, key: string) => {
          if (key === '_meta') return;
          filesMap.set(key, value);
        });
        
        const buildTree = (parentId: string | null): FileNode[] => {
          const result: FileNode[] = [];
          filesMap.forEach((file, id) => {
            const fileParentId = (file as any).parentId || null;
            if (fileParentId === parentId) {
              if (file.type === 'folder') {
                const folder: FileNode = { ...file, children: buildTree(id) };
                result.push(folder);
              } else {
                result.push(file);
              }
            }
          });
          return result;
        };
        
        const newFiles = buildTree(null);
        const localFiles = useEditorStore.getState().files;
        
        if (JSON.stringify(newFiles) !== JSON.stringify(localFiles)) {
          console.log('[Sync] Files synced from Yjs:', newFiles.length, 'items');
          // Defer the store update to allow syncFilesToYjs to run first
          requestAnimationFrame(() => {
            useEditorStore.setState({ files: newFiles });
            isLocalChange = false;
          });
        } else {
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
          syncFilesFromYjs();
          syncChatFromYjs();
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
        
        const flattenFiles = (files: FileNode[], parentId: string | null = null): FileNode[] => {
          const result: FileNode[] = [];
          for (const file of files) {
            const fileWithParent = { ...file, children: undefined, parentId };
            result.push(fileWithParent);
            if (file.children) {
              result.push(...flattenFiles(file.children, file.id));
            }
          }
          return result;
        };
        
        const flatFiles = flattenFiles(editorFiles);
        const fileMap = new Map(flatFiles.map(f => [f.id, f]));
        
        flatFiles.forEach(f => currentIds.add(f.id));
        
        fileMap.forEach((file, id) => {
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
        
        console.log('[Sync] Syncing to Yjs:', { currentIds: [...currentIds], idsToDelete });
        
        if (idsToDelete.length > 0) {
          console.log('[Sync] Deleting from Yjs:', idsToDelete);
        }
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
          aiHighlightsField,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          file?.language === 'python' ? python() : javascript({ typescript: file?.language === 'typescript' }),
          updateListener,
        ];
        
        // Add yCollab if provider and awareness are ready
        if (provider?.awareness) {
          try {
            const undoManager = new Y.UndoManager(ytext);
            const collabExtension = yCollab(ytext, provider.awareness, { undoManager });
            console.log('[createExtensions] yCollab added for fileId:', fileId);
            return [...baseExtensions, collabExtension];
          } catch (e) {
            console.warn('yCollab initialization error:', e);
            return baseExtensions;
          }
        } else {
          console.log('[createExtensions] WARNING: provider.awareness is null, yCollab NOT added!');
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

      const insertAIContent = (content: string) => {
        console.log('[insertAIContent] Called with content length:', content.length);
        console.log('[insertAIContent] view exists:', !!view);
        console.log('[insertAIContent] ytextMap size:', ytextMap.size);
        
        const fileId = useEditorStore.getState().activeFileId;
        console.log('[insertAIContent] activeFileId:', fileId);
        
        if (!fileId) {
          console.log('[insertAIContent] ERROR: No active file');
          return;
        }
        
        const ytextKey = `file:${fileId}`;
        console.log('[insertAIContent] ytextKey:', ytextKey);
        
        let ytext = ytextMap.get(ytextKey);
        console.log('[insertAIContent] ytext from map:', !!ytext);
        
        if (!ytext) {
          console.log('[insertAIContent] Creating new ytext for:', ytextKey);
          ytext = ydoc.getText(ytextKey);
          ytextMap.set(ytextKey, ytext);
        }
        
        console.log('[insertAIContent] Final check - ytext:', !!ytext, 'view:', !!view);
        
        if (ytext && view) {
          isLocalChange = true;
          const insertPos = ytext.length;
          const separator = insertPos > 0 ? '\n\n' : '';
          const aiHeader = '// ✦ AI Suggestion\n';
          const fullContent = separator + aiHeader + content;
          
          console.log('[insertAIContent] Inserting at pos:', insertPos, 'content:', fullContent.slice(0, 50));
          
          ytext.insert(insertPos, fullContent);
          
          console.log('[insertAIContent] ytext length after insert:', ytext.length);
          
          const aiFrom = insertPos;
          const aiTo = insertPos + fullContent.length;
          aiSuggestionRef.current = { from: aiFrom, to: aiTo };
          
          setTimeout(() => {
            if (view) {
              view.dispatch({
                selection: { anchor: aiFrom + separator.length + aiHeader.length },
                effects: [
                  addAIHighlight.of({ from: aiFrom, to: aiFrom + separator.length + aiHeader.length, isHeader: true }),
                  addAIHighlight.of({ from: aiFrom + separator.length + aiHeader.length, to: aiTo }),
                ],
              });
              view.focus();
              setHasAISuggestion(true);
              onHasAISuggestionRef.current?.(true);
              console.log('[insertAIContent] Highlight applied and focused');
            }
          }, 50);
          isLocalChange = false;
          console.log('[insertAIContent] SUCCESS - Content inserted with highlight');
        } else {
          console.log('[insertAIContent] ERROR: ytext or view is null', { ytext: !!ytext, view: !!view });
        }
      };
      
      const acceptAISuggestion = () => {
        if (aiSuggestionRef.current && view) {
          view.dispatch({
            effects: [removeAIHighlights.of()],
          });
          aiSuggestionRef.current = null;
          setHasAISuggestion(false);
          onHasAISuggestionRef.current?.(false);
          console.log('[AI] Suggestion accepted');
        }
      };
      
      const rejectAISuggestion = () => {
        if (aiSuggestionRef.current && view) {
          const { from, to } = aiSuggestionRef.current;
          const fileId = useEditorStore.getState().activeFileId;
          if (fileId) {
            const ytextKey = `file:${fileId}`;
            const ytext = ytextMap.get(ytextKey);
            if (ytext) {
              isLocalChange = true;
              ytext.delete(from, to - from);
              isLocalChange = false;
            }
          }
          view.dispatch({
            effects: [removeAIHighlights.of()],
          });
          aiSuggestionRef.current = null;
          setHasAISuggestion(false);
          onHasAISuggestionRef.current?.(false);
          console.log('[AI] Suggestion rejected and removed');
        }
      };
      
      if (onInsertAIContentRef.current) {
        console.log('[Collab] Registering insertAIContent callback');
        onInsertAIContentRef.current(insertAIContent);
        console.log('[Collab] insertAIContent registered successfully');
      } else {
        console.log('[Collab] WARNING: onInsertAIContentRef.current is null!');
      }
      
      if (onAIAcceptRef.current) {
        onAIAcceptRef.current(acceptAISuggestion);
      }
      if (onAIRejectRef.current) {
        onAIRejectRef.current(rejectAISuggestion);
      }

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
            console.log('[Subscription] Files changed, triggering sync');
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

export { CodeEditor as CollaborativeEditor };
