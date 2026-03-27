import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AIBlock, useSessionStore, User } from '@/stores/sessionStore';
import { Check, X, Move, ChevronDown, ChevronRight, Bot } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';

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
});

interface CodeEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
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

export function CodeEditor({ initialContent = '', onChange, readOnly = false }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [aiBlocks, setAiBlocks] = useState<AIBlock[]>([]);
  const { users, updateAIBlock, removeAIBlock } = useSessionStore();
  const { files, activeFileId, updateFileContent } = useEditorStore();
  
  const activeFile = files.find(f => f.id === activeFileId);
  const content = activeFile?.content || initialContent;

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
      if (update.docChanged) {
        const newContent = update.state.doc.toString();
        if (activeFileId) {
          updateFileContent(activeFileId, newContent);
        }
      }
    });

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      foldGutter(),
      drawSelection(),
      rectangularSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      syntaxHighlighting(defaultHighlightStyle),
      oneDark,
      iTECifyTheme,
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      getLanguageExtension(activeFile?.language || 'javascript'),
      updateListener,
      EditorState.readOnly.of(readOnly),
    ];

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [activeFileId, activeFile?.language]);

  useEffect(() => {
    setAiBlocks(useSessionStore.getState().aiBlocks);
  }, []);

  const handleAcceptBlock = useCallback((blockId: string) => {
    updateAIBlock(blockId, { status: 'accepted' });
  }, [updateAIBlock]);

  const handleRejectBlock = useCallback((blockId: string) => {
    removeAIBlock(blockId);
  }, [removeAIBlock]);

  return (
    <div className="relative h-full flex flex-col bg-[#020617]">
      <div className="flex-1 overflow-hidden relative">
        <div ref={editorRef} className="h-full" />
        
        {users.filter(u => u.id !== 'current').map(user => (
          <RemoteCursor
            key={user.id}
            user={user}
          />
        ))}
      </div>
      
      {aiBlocks.filter(b => b.status === 'pending').length > 0 && (
        <AIBlocksOverlay
          blocks={aiBlocks.filter(b => b.status === 'pending')}
          onAccept={handleAcceptBlock}
          onReject={handleRejectBlock}
        />
      )}
    </div>
  );
}

interface RemoteCursorProps {
  user: User;
}

function RemoteCursor({ user }: RemoteCursorProps) {
  if (!user.cursorPosition) return null;

  const style = {
    left: `${user.cursorPosition.ch * 8}px`,
    top: `${user.cursorPosition.line * 20}px`,
    color: user.color,
  };

  return (
    <div className="user-cursor" style={style}>
      <div className="user-cursor-pointer" style={{ color: user.color }} />
      <div className="user-cursor-label" style={{ backgroundColor: user.color }}>
        {user.name}
      </div>
    </div>
  );
}

interface AIBlocksOverlayProps {
  blocks: AIBlock[];
  onAccept: (blockId: string) => void;
  onReject: (blockId: string) => void;
}

function AIBlocksOverlay({ blocks, onAccept, onReject }: AIBlocksOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
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

interface AIBlockWidgetProps {
  block: AIBlock;
  onAccept: () => void;
  onReject: () => void;
}

function AIBlockWidget({ block, onAccept, onReject }: AIBlockWidgetProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className="ai-block absolute pointer-events-auto"
      style={{
        top: `${block.startLine * 20 + 40}px`,
        left: '16px',
        right: '16px',
      }}
    >
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
            <button
              className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded transition"
              title="Move"
            >
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
