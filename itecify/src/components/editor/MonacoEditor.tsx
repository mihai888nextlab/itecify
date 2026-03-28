'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { useSessionStore, User } from '@/stores/sessionStore';
import { useEditorStore } from '@/stores/editorStore';

// Color tokens for iTECify theme
const C = {
  bg: '#09090C',
  surface: '#0E0E13',
  card: '#13131A',
  card2: '#18181F',
  border: '#222230',
  border2: '#2A2A3A',
  text: '#E8E8F0',
  muted: '#4A4A60',
  ana: '#FF4C8E',
  radu: '#4CF0FF',
  ai: '#FFD700',
};

interface CollaboratingEditorProps {
  projectId: string;
  user: { id: string; name: string; color: string };
  onEditorMount?: (monaco: Monaco, editor: any) => void;
}

export function CollaboratingEditor({ projectId, user, onEditorMount }: CollaboratingEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const { users, aiBlocks } = useSessionStore();
  const { activeFileId, files } = useEditorStore();

  const currentFile = files.find(f => f.id === activeFileId);

  // Find or create Y.Text for the current file
  const getYText = useCallback(() => {
    if (!ydocRef.current || !activeFileId) return null;
    return ydocRef.current.getText(`file:${activeFileId}`);
  }, [activeFileId]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define custom theme
    monaco.editor.defineTheme('itecify-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '546E7A', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C792EA' },
        { token: 'function', foreground: '82AAFF' },
        { token: 'string', foreground: 'C3E88D' },
        { token: 'number', foreground: 'F78C6C' },
        { token: 'type', foreground: 'FFCB6B' },
        { token: 'operator', foreground: '89DDFF' },
      ],
      colors: {
        'editor.background': '#09090C',
        'editor.foreground': '#E8E8F0',
        'editor.lineHighlightBackground': '#0E0E1380',
        'editor.selectionBackground': '#4C8EFF40',
        'editorCursor.foreground': '#4CF0FF',
        'editorLineNumber.foreground': '#4A4A60',
        'editorLineNumber.activeForeground': '#E8E8F0',
        'editor.inactiveSelectionBackground': '#4C8EFF20',
        'editorIndentGuide.background': '#222230',
        'editorIndentGuide.activeBackground': '#2A2A3A',
        'editorGutter.background': '#09090C',
        'editorWidget.background': '#0E0E13',
        'editorWidget.border': '#222230',
      },
    });

    monaco.editor.setTheme('itecify-dark');

    // Notify parent
    if (onEditorMount) {
      onEditorMount(monaco, editor);
    }
  }, [onEditorMount]);

  // Initialize Yjs and WebSocket provider
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:1234`;
    
    const provider = new WebsocketProvider(wsUrl, `project-${projectId}`, ydoc, {
      connect: true,
    });
    providerRef.current = provider;

    // Set user awareness
    provider.awareness.setLocalStateField('user', {
      name: user.name,
      color: user.color,
      id: user.id,
    });

    provider.on('status', (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    });

    // Listen for awareness changes (other users' cursors)
    provider.awareness.on('change', () => {
      updateCursorDecorations();
    });

    // Cleanup
    return () => {
      bindingRef.current?.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [projectId, user]);

  // Update cursor decorations when awareness changes
  const updateCursorDecorations = useCallback(() => {
    if (!editorRef.current || !monacoRef.current || !providerRef.current) return;

    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const decorations: any[] = [];
    const newDecorations: string[] = [];

    providerRef.current.awareness.getStates().forEach((state: any, clientId: number) => {
      if (state.user && state.user.id !== user.id && state.cursor) {
        const { lineNumber, column } = state.cursor;
        
        // Cursor line decoration
        decorations.push({
          range: new monaco.Range(lineNumber, column, lineNumber, column + 1),
          options: {
            className: `cursor-decoration-${state.user.color.replace('#', '')}`,
            beforeContentClassName: 'remote-cursor',
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });

        // Cursor label
        decorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            marginClassName: `cursor-label-${state.user.color.replace('#', '')}`,
            glyphMarginClassName: 'cursor-glyph',
            glyphMarginHoverMessage: { value: state.user.name },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }
    });

    newDecorations.push(...editor.deltaDecorations(decorationsRef.current, decorations));
    decorationsRef.current = newDecorations;
  }, [user.id]);

  // Bind Y.Text to Monaco model when file changes
  useEffect(() => {
    if (!editorRef.current || !ydocRef.current || !providerRef.current || !activeFileId) return;

    const ytext = ydocRef.current.getText(`file:${activeFileId}`);
    const model = editorRef.current.getModel();

    if (!model) return;

    // Create binding
    const binding = new MonacoBinding(
      ytext,
      model,
      new Set([editorRef.current]),
      providerRef.current.awareness
    );
    bindingRef.current = binding;

    // If Y.Text is empty, initialize with file content
    if (ytext.length === 0 && currentFile?.content) {
      ytext.insert(0, currentFile.content);
    }

    return () => {
      binding.destroy();
    };
  }, [activeFileId, currentFile?.content]);

  // Add CSS for remote cursors
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .remote-cursor {
        position: relative;
        border-left: 2px solid;
        margin-left: -1px;
      }
      .remote-cursor::before {
        content: '';
        position: absolute;
        top: -18px;
        left: -1px;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
        color: #000;
        white-space: nowrap;
      }
      ${[C.ana, C.radu, C.ai, '#3b82f6', '#22c55e', '#a855f7'].map((color, i) => `
        .cursor-decoration-${color.replace('#', '')} {
          border-left-color: ${color} !important;
        }
        .cursor-decoration-${color.replace('#', '')}::before {
          background: ${color};
        }
        .cursor-label-${color.replace('#', '')} {
          background: ${color};
        }
      `).join('\n')}
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <div className="h-full w-full bg-[#09090C]">
      <Editor
        height="100%"
        language={currentFile?.language || 'javascript'}
        value={currentFile?.content || ''}
        onMount={handleEditorMount}
        options={{
          fontSize: 13,
          fontFamily: "'Fragment Mono', monospace",
          lineHeight: 22,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
          tabSize: 4,
          insertSpaces: true,
        }}
        theme="itecify-dark"
        loading={
          <div className="flex items-center justify-center h-full bg-[#09090C] text-[#4A4A60]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#4CF0FF] border-t-transparent rounded-full animate-spin" />
              <span style={{ fontFamily: "'Fragment Mono', monospace" }}>Loading editor...</span>
            </div>
          </div>
        }
      />
      
      {/* Connection status */}
      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#39FF7A]' : 'bg-[#FF4466]'}`} />
        <span style={{ fontFamily: "'Fragment Mono', monospace", fontSize: 10, color: C.muted }}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
}

export default CollaboratingEditor;
