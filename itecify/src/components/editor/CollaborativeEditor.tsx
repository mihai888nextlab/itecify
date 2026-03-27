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
  onReady?: (ytext: any, provider: any) => void;
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

export function CodeEditor({ projectId, user, onReady }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const providerRef = useRef<any>(null);
  const ydocRef = useRef<any>(null);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [isCollabReady, setIsCollabReady] = useState(false);
  const { aiBlocks, updateAIBlock, removeAIBlock } = useSessionStore();

  useEffect(() => {
    if (!editorRef.current) return;

    let view: EditorView | null = null;
    let provider: any = null;
    let ydoc: any = null;
    let ytext: any = null;

    const initEditor = async () => {
      const Y = await import('yjs');
      const { WebsocketProvider } = await import('y-websocket');
      const { yCollab } = await import('y-codemirror.next');

      ydoc = new Y.Doc();
      ytext = ydoc.getText('code');
      ydocRef.current = ydoc;

      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:1234/${projectId}`;
      
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
            users.push({
              id: String(clientId),
              name: state.user.name || 'Anonymous',
              color: state.user.color || '#3b82f6',
              role: 'human',
              cursorPosition: state.cursor,
            });
          }
        });
        setConnectedUsers(users);
      });

      provider.on('status', (event: { status: string }) => {
        console.log('WebSocket status:', event.status);
      });

      const extensions: Extension[] = [
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
        javascript(),
        yCollab(ytext, provider.awareness),
      ];

      const state = EditorState.create({
        doc: ytext.toString(),
        extensions,
      });

      if (!editorRef.current) return;

      view = new EditorView({
        state,
        parent: editorRef.current,
      });

      viewRef.current = view;

      if (ytext.length === 0) {
        ytext.insert(0, `// Welcome to iTECify
// Start coding together!

function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('iTEC 2026');
`);
      }

      setIsCollabReady(true);
      onReady?.(ytext, provider);
    };

    initEditor();

    return () => {
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
  }, [projectId, user, onReady]);

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
