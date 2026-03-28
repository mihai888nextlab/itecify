import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CollaborativeEditor } from '@/components/editor/CollaborativeEditor';
import { useSessionStore } from '@/stores/sessionStore';
import { useEditorStore } from '@/stores/editorStore';
import {
  Zap, Terminal as TerminalIcon, X, FileCode, Play, Square, Copy, ExternalLink, Settings, Files, Search, GitBranch, Puzzle, Bot, Eye, Send, RefreshCw, AlertTriangle, AlertCircle, CheckCircle, Circle, Sparkles, Maximize2, Minimize2, Plus, FolderPlus, File, Hash, ArrowRight, CornerDownLeft
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const C = {
  bg: '#09090C',
  surface: '#0E0E13',
  card: '#13131A',
  border: '#222230',
  border2: '#2A2A3A',
  text: '#E8E8F0',
  muted: '#4A4A60',
  subtle: '#1A1A24',
  blue: '#4C8EFF',
  cyan: '#00E5CC',
  green: '#39FF7A',
  yellow: '#FFD700',
  orange: '#FF7A3D',
  red: '#FF4466',
  purple: '#A855F7',
  ana: '#FF4C8E',
  radu: '#4CF0FF',
};

const RAIL_ITEMS = [
  { id: 'files', icon: <Files size={16} />, label: 'Explorer' },
  { id: 'search', icon: <Search size={16} />, label: 'Search' },
  { id: 'git', icon: <GitBranch size={16} />, label: 'Git' },
  { id: 'ext', icon: <Puzzle size={16} />, label: 'Extensions' },
];

interface SearchResult {
  type: 'file' | 'content';
  fileId: string;
  fileName: string;
  line?: number;
  column?: number;
  match: string;
  context: string;
}

function SearchPanel({ onResultClick }: { onResultClick: (fileId: string, line?: number) => void }) {
  const { files } = useEditorStore();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'files' | 'content'>('content');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const getAllFiles = useCallback((nodes: any[]): any[] => {
    const result: any[] = [];
    for (const node of nodes) {
      if (node.type === 'file') result.push(node);
      if (node.children) result.push(...getAllFiles(node.children));
    }
    return result;
  }, []);

  const performSearch = useCallback((searchQuery: string, searchMode: 'files' | 'content') => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const allFiles = getAllFiles(files);
    const searchResults: SearchResult[] = [];
    const lowerQuery = searchQuery.toLowerCase();

    if (searchMode === 'files') {
      for (const file of allFiles) {
        if (file.name.toLowerCase().includes(lowerQuery)) {
          searchResults.push({
            type: 'file',
            fileId: file.id,
            fileName: file.name,
            match: file.name,
            context: file.language || 'file',
          });
        }
      }
    } else {
      for (const file of allFiles) {
        if (!file.content) continue;
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase();
          let colIndex = lowerLine.indexOf(lowerQuery);
          
          while (colIndex !== -1) {
            const start = Math.max(0, colIndex - 20);
            const end = Math.min(line.length, colIndex + searchQuery.length + 20);
            let context = line.slice(start, end);
            if (start > 0) context = '...' + context;
            if (end < line.length) context = context + '...';

            searchResults.push({
              type: 'content',
              fileId: file.id,
              fileName: file.name,
              line: i + 1,
              column: colIndex + 1,
              match: line.slice(colIndex, colIndex + searchQuery.length),
              context,
            });
            
            colIndex = lowerLine.indexOf(lowerQuery, colIndex + 1);
          }
        }
      }
    }

    setResults(searchResults);
    setSelectedIndex(0);
    setIsSearching(false);
  }, [files, getAllFiles]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(query, mode);
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode, performSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      const result = results[selectedIndex];
      onResultClick(result.fileId, result.line);
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 12px', gap: 8 }}>
      <span className="mono" style={{ fontSize: 9, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase' }}>Search</span>
      
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'files' ? 'Search files...' : 'Search in files...'}
          style={{
            width: '100%',
            backgroundColor: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '8px 10px 8px 32px',
            color: C.text,
            fontSize: 12,
            fontFamily: "'Fragment Mono', monospace",
            outline: 'none',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: C.muted,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => setMode('content')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '5px 8px',
            borderRadius: 4,
            border: 'none',
            fontSize: 10,
            fontFamily: "'Fragment Mono', monospace",
            cursor: 'pointer',
            backgroundColor: mode === 'content' ? `${C.cyan}20` : 'transparent',
            color: mode === 'content' ? C.cyan : C.muted,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: mode === 'content' ? `${C.cyan}40` : C.border,
          }}
        >
          <Hash size={11} /> Content
        </button>
        <button
          onClick={() => setMode('files')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '5px 8px',
            borderRadius: 4,
            border: 'none',
            fontSize: 10,
            fontFamily: "'Fragment Mono', monospace",
            cursor: 'pointer',
            backgroundColor: mode === 'files' ? `${C.cyan}20` : 'transparent',
            color: mode === 'files' ? C.cyan : C.muted,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: mode === 'files' ? `${C.cyan}40` : C.border,
          }}
        >
          <File size={11} /> Files
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {isSearching ? (
          <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 11 }}>
            Searching...
          </div>
        ) : query && results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 11 }}>
            No results found
          </div>
        ) : !query ? (
          <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 11 }}>
            <div style={{ marginBottom: 8 }}>
              <CornerDownLeft size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
            </div>
            Type to search {mode === 'files' ? 'files by name' : 'in file contents'}
          </div>
        ) : (
          <>
            <div className="mono" style={{ fontSize: 9, color: C.muted, padding: '4px 0' }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
            {results.map((result, index) => (
              <button
                key={`${result.fileId}-${result.line || 0}-${index}`}
                onClick={() => onResultClick(result.fileId, result.line)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: index === selectedIndex ? `${C.blue}20` : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <FileCode size={12} color={C.muted} />
                  <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{result.fileName}</span>
                  {result.line && (
                    <span className="mono" style={{ fontSize: 10, color: C.muted }}>
                      :{result.line}
                    </span>
                  )}
                </div>
                <div className="mono" style={{ fontSize: 10, color: C.muted, paddingLeft: 18 }}>
                  {result.context}
                </div>
              </button>
            ))}
          </>
        )}
      </div>

      {results.length > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '4px 0', borderTop: `1px solid ${C.border}` }}>
          <span className="mono" style={{ fontSize: 9, color: C.muted }}>
            <span style={{ color: C.cyan }}>↑↓</span> navigate
          </span>
          <span className="mono" style={{ fontSize: 9, color: C.muted }}>
            <span style={{ color: C.cyan }}>↵</span> open
          </span>
          <span className="mono" style={{ fontSize: 9, color: C.muted }}>
            <span style={{ color: C.cyan }}>esc</span> clear
          </span>
        </div>
      )}
    </div>
  );
}

const VULNS = [
  { level: 'HIGH', desc: 'Shell injection risk', file: 'main.py : 23' },
  { level: 'MED', desc: 'Hardcoded secret', file: 'api.ts : 8' },
  { level: 'LOW', desc: 'Missing validation', file: 'main.py : 47' },
];

interface WorkspaceLayoutProps {
  sessionId: string;
  currentUser: { id: string; name: string; color: string };
  project: { id: string; name: string; owner: any; members: any[] };
}

export function WorkspaceLayout({ sessionId, currentUser, project }: WorkspaceLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(180);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [activeRail, setActiveRail] = useState('files');
  const [hoveredRail, setHoveredRail] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<'chat' | 'security'>('chat');
  const [termInput, setTermInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMsgs, setChatMsgs] = useState([{ from: 'system', text: '✦ Connected to session', time: 'now' }]);
  const [toast, setToast] = useState<string | null>(null);
  const [agentTask, setAgentTask] = useState(0);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const toastRef = React.useRef<NodeJS.Timeout | null>(null);

  const { isExecuting, setExecuting, settings, addAIBlock, aiBlocks, updateAIBlock, removeAIBlock, setUsers, setConnected } = useSessionStore();
  const { activeFileId, files, openFile, closeFile, loadFilesFromProject, addFile, updateFileContent, setCurrentProjectId, editorSetContentFn, setEditorSetContentFn } = useEditorStore();

  React.useEffect(() => {
    if (project?.id) loadFilesFromProject(project.id);
  }, [project?.id, loadFilesFromProject]);

  React.useEffect(() => {
    const id = setInterval(() => setAgentTask(t => (t + 1) % 5), 3500);
    return () => clearInterval(id);
  }, []);

  const projectUsers = React.useMemo(() => {
    const seen = new Set<string>();
    const users: any[] = [];
    
    const addUser = (u: any) => {
      const key = `${u.id}-${u.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        users.push(u);
      }
    };
    
    addUser({ id: currentUser.id, name: currentUser.name, color: currentUser.color, role: 'human', isSelf: true });
    
    if (project?.owner) {
      const ownerId = String(project.owner.id || project.owner.sub || '');
      if (ownerId && ownerId !== String(currentUser.id)) {
        addUser({ id: ownerId, name: project.owner.name, color: C.ana, role: 'human' });
      }
    }
    
    if (project?.members && Array.isArray(project.members)) {
      project.members.forEach((m: any) => {
        const memberId = String(m.userId || m.user?.id || m.id || '');
        if (memberId && memberId !== String(currentUser.id)) {
          const name = m.user?.name || m.name || 'Member';
          addUser({ id: memberId, name, color: C.blue, role: 'human' });
        }
      });
    }
    
    connectedUsers.forEach(u => {
      const uid = String(u.id || '');
      if (uid && uid !== String(currentUser.id)) {
        addUser({ id: uid, name: u.name || 'Unknown', color: u.color || C.blue, isSelf: false });
      }
    });
    
    return users;
  }, [project, currentUser, connectedUsers]);

  const findFileInTree = (nodes: any[], id: string): any => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) { const found = findFileInTree(node.children, id); if (found) return found; }
    }
    return null;
  };

  const getAllFiles = (nodes: any[]): any[] => {
    const result: any[] = [];
    for (const node of nodes) {
      if (node.type === 'file') result.push(node);
      if (node.children) result.push(...getAllFiles(node.children));
    }
    return result;
  };

  const allFiles = getAllFiles(files);
  const currentFile = activeFileId ? findFileInTree(files, activeFileId) : null;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const [terminalLines, setTerminalLines] = useState<Array<{ type: string; text: string }>>([
    { type: 'info', text: 'iTECify sandbox v1.0 — ready' }
  ]);

  const addTermLine = (type: string, text: string) => {
    setTerminalLines(prev => [...prev, { type, text }]);
  };

  const handleRun = useCallback(async () => {
    if (!activeFileId) { addTermLine('err', '⚠ No file selected to execute'); return; }
    
    const activeFile = findFileInTree(files, activeFileId);
    if (!activeFile || activeFile.type === 'folder') { addTermLine('err', '⚠ No file selected'); return; }

    const codeToRun = activeFile.content || '';
    const language = activeFile.language || settings.language;

    setExecuting(true);
    setIsTerminalCollapsed(false);
    addTermLine('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addTermLine('ok', `  Executing: ${activeFile.name}`);
    addTermLine('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addTermLine('info', `[${new Date().toLocaleTimeString()}] Language: ${language}`);
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/api/execute/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ code: codeToRun, language }),
      });
      
      const result = await res.json();
      
      if (result.success) {
        addTermLine('ok', '✓ Execution successful');
        if (result.stdout) addTermLine('out', result.stdout);
      } else {
        addTermLine('err', `✗ ${result.error || 'Execution failed'}`);
        if (result.details) addTermLine('err', result.details);
      }
    } catch (err: any) {
      console.error('Execution error:', err);
      addTermLine('err', `✗ Connection error`);
    } finally {
      setExecuting(false);
    }
  }, [files, activeFileId, settings, setExecuting]);

  const handleStop = () => { setExecuting(false); addTermLine('err', '✗ Execution stopped by user'); };

  const handleTermCmd = (cmd: string) => {
    addTermLine('prompt', `$ ${cmd}`);
    if (cmd === 'help') {
      setTerminalLines(prev => [...prev, { type: 'info', text: 'Commands: help, clear, status, run' }]);
    } else if (cmd === 'clear') {
      setTerminalLines([]);
    } else if (cmd === 'run') {
      handleRun();
    } else if (cmd === 'status') {
      setTerminalLines(prev => [...prev, { type: 'info', text: `Status: ${isExecuting ? 'Running' : 'Idle'}` }]);
    }
  };

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY, startHeight = terminalHeight;
    const handleMouseMove = (moveEvent: MouseEvent) => setTerminalHeight(Math.min(Math.max(80, startHeight + startY - moveEvent.clientY), 400));
    const handleMouseUp = () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [terminalHeight]);

  const handleAcceptAIBlock = (block: any) => {
    if (!currentFile) return;
    const currentContent = currentFile.content || '';
    const newContent = currentContent + '\n' + block.content;
    console.log('[DEBUG] ====== ACCEPT AI BLOCK ======');
    console.log('[DEBUG] File:', currentFile.id, currentFile.name);
    console.log('[DEBUG] New full content:');
    console.log(newContent);
    console.log('[DEBUG] editorSetContentFn:', !!editorSetContentFn);
    console.log('[DEBUG] ===============================');
    updateFileContent(currentFile.id, newContent);
    if (editorSetContentFn) {
      console.log('[DEBUG] Calling editorSetContentFn');
      editorSetContentFn(currentFile.id, newContent);
    } else {
      console.log('[DEBUG] ERROR: editorSetContentFn is not set!');
    }
    updateAIBlock(block.id, { status: 'accepted' });
    addTermLine('ok', '✓ AI code inserted into file');
    showToast('Code inserted into file');
  };

  const handleRejectAIBlock = (blockId: string) => {
    removeAIBlock(blockId);
    addTermLine('info', 'AI suggestion rejected');
  };

  const handleCreateFile = () => {
    if (newFileName.trim()) {
      const ext = newFileName.includes('.') ? newFileName.split('.').pop() : 'js';
      const langMap: Record<string, string> = { js: 'javascript', ts: 'typescript', py: 'python', json: 'json' };
      addFile({ name: newFileName.trim(), type: 'file', language: langMap[ext || 'js'] || 'javascript', content: '' });
      setNewFileName('');
      setShowNewFileInput(false);
      showToast(`Created ${newFileName.trim()}`);
      addTermLine('info', `File created: ${newFileName.trim()}`);
    }
  };

  const handleAIGenerate = useCallback(async (instruction: string) => {
    if (!currentFile?.content) { addTermLine('warn', '⚠ Open a file first to use AI'); return; }
    setIsGeneratingAI(true);
    addTermLine('info', '🤖 AI generating code...');
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: currentFile.content, language: currentFile.language || 'javascript', instruction }),
      });
      const result = await res.json();
      
      if (result.success && result.content) {
        addTermLine('ok', '✓ AI generated code block');
        addAIBlock({ agentId: 'groq-assistant', agentName: 'AI Assistant', content: result.content, status: 'pending', startLine: 0, endLine: 0 });
        setChatMsgs(prev => [...prev, { from: 'ai', text: `Generated: ${result.content.slice(0, 50)}...`, time: 'now' }]);
      } else {
        addTermLine('err', `✗ AI failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      addTermLine('err', `✗ AI Error: ${err.message}`);
    } finally {
      setIsGeneratingAI(false);
    }
  }, [currentFile, addAIBlock]);

  const AGENTS = [
    { id: 'backend', name: 'Backend Gen', icon: <Bot size={13} color="#000" />, color: C.yellow, task: ['Generating…', 'Analyzing…', 'Writing…', 'Refactoring…', 'Types…'][agentTask] },
    { id: 'review', name: 'Code Review', icon: <Eye size={13} color="#fff" />, color: C.purple, task: 'Reviewing code…' },
  ];

  const pendingBlocks = aiBlocks.filter(b => b.status === 'pending');

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fragment+Mono:ital@0;1&family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        .itecify * { box-sizing: border-box; margin: 0; padding: 0; }
        .itecify { font-family: 'DM Sans', sans-serif; background: ${C.bg}; color: ${C.text}; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
        .mono { font-family: 'Fragment Mono', monospace; }
        .syne { font-family: 'Syne', sans-serif; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.6)} }
        .pulse-dot { animation: pulse-dot 2s infinite; }
      `}</style>

      <div className="itecify">
        <header style={{ height: 44, backgroundColor: C.surface, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16 }}>
          <div className="syne" style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>iTEC<span style={{ color: C.cyan }}>ify</span></div>
          <div style={{ width: 1, height: 20, backgroundColor: C.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {projectUsers.slice(0, 4).map((u, i) => (
              <div key={u.id} title={u.name} style={{
                width: 28, height: 28, borderRadius: '50%', backgroundColor: u.color, color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                border: `2px solid ${C.surface}`, marginLeft: i === 0 ? 0 : -8, position: 'relative', zIndex: 4 - i,
              }}>
                {u.role === 'ai' ? <Zap size={12} color="#000" /> : u.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconButton title="Share" onClick={() => {
              const shareUrl = `${window.location.origin}/workspace/${sessionId}`;
              navigator.clipboard.writeText(shareUrl);
              showToast('Link copied to clipboard!');
            }}><Copy size={14} /></IconButton>
            <IconButton title="Preview"><ExternalLink size={14} /></IconButton>
            <IconButton title="Settings"><Settings size={14} /></IconButton>
            <div style={{ width: 1, height: 20, backgroundColor: C.border, margin: '0 4px' }} />
            {isExecuting ? (
              <button onClick={handleStop} style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: C.orange, border: 'none', borderRadius: 6, padding: '0 12px', height: 28, fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer' }}>
                <Square size={12} /> Stop
              </button>
            ) : (
              <button onClick={handleRun} style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: C.green, border: 'none', borderRadius: 6, padding: '0 12px', height: 28, fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer', boxShadow: `0 0 12px ${C.green}40` }}>
                <Play size={12} /> Run
              </button>
            )}
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '52px 240px 1fr 280px', flex: 1, overflow: 'hidden' }}>
          <div style={{ backgroundColor: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 4 }}>
            {RAIL_ITEMS.map(r => (
              <button key={r.id} onClick={() => setActiveRail(r.id)} onMouseEnter={() => setHoveredRail(r.id)} onMouseLeave={() => setHoveredRail(null)}
                style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: activeRail === r.id || hoveredRail === r.id ? C.card : 'transparent',
                  border: `1px solid ${activeRail === r.id ? `${C.cyan}40` : hoveredRail === r.id ? C.border : 'transparent'}`,
                  color: activeRail === r.id ? C.cyan : hoveredRail === r.id ? C.text : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {r.icon}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'transparent', border: 'none', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Settings size={16} />
            </button>
          </div>

          <div style={{ backgroundColor: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeRail === 'files' && (
              <>
                <div style={{ padding: '10px 12px 6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span className="mono" style={{ fontSize: 9, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase' }}>Explorer</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setShowNewFileInput(true)} title="New File" style={{ padding: 4, background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', borderRadius: 4 }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  {showNewFileInput && (
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                      <input value={newFileName} onChange={e => setNewFileName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateFile()}
                        placeholder="filename.js" autoFocus
                        style={{ flex: 1, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', color: C.text, fontSize: 12, fontFamily: "'Fragment Mono', monospace", outline: 'none' }} />
                      <button onClick={handleCreateFile} style={{ padding: '4px 8px', backgroundColor: C.blue, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12 }}>Add</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {allFiles.map(f => {
                      const ext = f.name.split('.').pop() || '';
                      const iconColor = ext === 'py' ? C.blue : ext === 'ts' || ext === 'tsx' ? C.cyan : ext === 'js' ? C.yellow : C.muted;
                      return (
                        <button key={f.id} onClick={() => openFile(f.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, width: '100%', textAlign: 'left',
                          fontFamily: "'Fragment Mono', monospace", fontSize: 12,
                          backgroundColor: f.id === activeFileId ? `rgba(76,142,255,.1)` : 'transparent',
                          border: 'none', color: f.id === activeFileId ? C.blue : C.text, cursor: 'pointer',
                        }}>
                          <FileCode size={13} color={iconColor} /><span style={{ flex: 1 }}>{f.name}</span>
                        </button>
                      );
                    })}
                    {allFiles.length === 0 && <div className="mono" style={{ fontSize: 11, color: C.muted, padding: '8px' }}>No files</div>}
                  </div>
                </div>

                <Divider />

                <div style={{ padding: '10px 12px 6px' }}>
                  <span className="mono" style={{ fontSize: 9, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>AI Agents</span>
                  {AGENTS.map(agent => (
                    <AgentCard key={agent.id} agent={agent} onGenerate={handleAIGenerate} isGenerating={isGeneratingAI} />
                  ))}
                </div>
              </>
            )}

            {activeRail === 'search' && (
              <SearchPanel onResultClick={(fileId, line) => {
                openFile(fileId);
                setActiveRail('files');
                addTermLine('info', `Opened: ${findFileInTree(files, fileId)?.name}${line ? `:${line}` : ''}`);
              }} />
            )}

            {activeRail === 'git' && (
              <div style={{ padding: '10px 12px 6px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span className="mono" style={{ fontSize: 9, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase' }}>Git</span>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ padding: '10px 12px', backgroundColor: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <GitBranch size={14} color={C.green} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>main</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: C.muted }}>
                      No uncommitted changes
                    </div>
                  </div>
                  <button onClick={() => showToast('Pulling latest changes...')} style={{ padding: '8px 12px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={12} /> Pull
                  </button>
                  <button onClick={() => showToast('Commit functionality coming soon')} style={{ padding: '8px 12px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ArrowRight size={12} /> Push
                  </button>
                </div>
              </div>
            )}

            {activeRail === 'ext' && (
              <div style={{ padding: '10px 12px 6px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span className="mono" style={{ fontSize: 9, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase' }}>Extensions</span>
                <div style={{ marginTop: 16, textAlign: 'center', padding: 20, color: C.muted }}>
                  <Puzzle size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <div style={{ fontSize: 12 }}>No extensions installed</div>
                  <div className="mono" style={{ fontSize: 10, marginTop: 4 }}>Browse marketplace to discover</div>
                </div>
              </div>
            )}

            <div style={{ flex: 1 }} />
            <Divider />

            <div style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 9, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>Session</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: C.green }} />
                  <span className="mono" style={{ fontSize: 9, color: C.green }}>LIVE</span>
                </div>
              </div>
              <div className="mono" style={{ fontSize: 10, color: C.muted, lineHeight: 1.6 }}>{projectUsers.length} online</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <EditorTabs />
            
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div className="mono" style={{
                padding: '16px 12px', textAlign: 'right', fontSize: 13, lineHeight: 1.7,
                color: C.muted, backgroundColor: C.bg, flexShrink: 0, borderRight: `1px solid ${C.border}`,
                minWidth: 48, userSelect: 'none', overflowY: 'auto',
              }}>
                {(currentFile?.content || '').split('\n').map((_: any, i: number) => <div key={i}>{i + 1}</div>)}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                <CollaborativeEditor 
                  projectId={sessionId} 
                  user={currentUser}
                  onUsersChange={setConnectedUsers}
                  onConnectionChange={setIsWsConnected}
                  onSetContent={setEditorSetContentFn}
                />
                {pendingBlocks.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 100 }}>
                    {pendingBlocks.map(block => (
                      <div key={block.id} style={{ backgroundColor: C.card, border: `1px solid ${C.yellow}40`, borderRadius: 8, padding: 12, maxWidth: 300 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Bot size={14} color={C.yellow} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{block.agentName}</span>
                        </div>
                        <pre className="mono" style={{ fontSize: 11, color: C.muted, overflow: 'auto', maxHeight: 100, marginBottom: 8 }}>{block.content}</pre>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleAcceptAIBlock(block)} style={{ flex: 1, padding: '6px 12px', backgroundColor: C.green, border: 'none', borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Accept</button>
                          <button onClick={() => handleRejectAIBlock(block.id)} style={{ flex: 1, padding: '6px 12px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 12, cursor: 'pointer' }}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ height: isTerminalCollapsed ? 32 : terminalHeight, backgroundColor: '#0d1117', borderTop: `1px solid ${C.border}`, transition: 'height 0.2s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ height: 4, cursor: 'ns-resize', backgroundColor: 'transparent' }} onMouseDown={handleResizeStart} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.cyan} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} />
              <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', backgroundColor: C.surface, borderBottom: `1px solid ${C.border}`, cursor: 'pointer', flexShrink: 0 }}
                onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TerminalIcon size={14} color={C.muted} />
                  <span className="mono" style={{ fontSize: 11, color: C.text }}>Output</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setIsTerminalCollapsed(!isTerminalCollapsed); }} style={{ padding: 4, background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', borderRadius: 4 }}>
                  {isTerminalCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                </button>
              </div>
              
              {!isTerminalCollapsed && (
                <TerminalPanel lines={terminalLines} input={termInput} onInputChange={setTermInput} onCommand={handleTermCmd} />
              )}
            </div>

            <div style={{ height: 24, backgroundColor: C.surface, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 12px', flexShrink: 0 }}>
              <StatusPill color={isWsConnected ? C.green : C.red} icon={<Circle size={6} fill={isWsConnected ? C.green : C.red} className={isWsConnected ? '' : 'pulse-dot'} />} label={isWsConnected ? 'Connected' : 'Disconnected'} />
              <StatusPill color={C.blue} icon={<RefreshCw size={9} />} label={`${projectUsers.length} users`} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                <span className="mono" style={{ fontSize: 10, color: C.muted }}>{currentFile?.language || 'Plain Text'}</span>
                <span className="mono" style={{ fontSize: 10, color: C.muted }}>Ln {(currentFile?.content || '').split('\n').length}</span>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: C.surface, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <button onClick={() => setRightPanel('chat')} style={{ flex: 1, padding: '10px 0', fontFamily: "'Fragment Mono', monospace", fontSize: 11, border: 'none', borderBottom: `2px solid ${rightPanel === 'chat' ? C.cyan : 'transparent'}`, background: 'transparent', color: rightPanel === 'chat' ? C.text : C.muted, cursor: 'pointer' }}>Chat</button>
              <button onClick={() => setRightPanel('security')} style={{ flex: 1, padding: '10px 0', fontFamily: "'Fragment Mono', monospace", fontSize: 11, border: 'none', borderBottom: `2px solid ${rightPanel === 'security' ? C.cyan : 'transparent'}`, background: 'transparent', color: rightPanel === 'security' ? C.text : C.muted, cursor: 'pointer' }}>Security</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {rightPanel === 'chat' && <ChatPanel messages={chatMsgs} input={chatInput} onInputChange={setChatInput} onSend={() => { if (chatInput.trim()) { setChatMsgs(prev => [...prev, { from: 'user', text: chatInput, time: 'now' }]); setChatInput(''); } }} />}
              {rightPanel === 'security' && <SecurityPanel />}
            </div>
          </div>
        </div>

        {toast && (
          <div className="mono" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 12, color: C.text, zIndex: 9998, whiteSpace: 'nowrap' }}>
            {toast}
          </div>
        )}
      </div>
    </>
  );
}

function EditorTabs() {
  const { openFiles, activeFileId, files, closeFile } = useEditorStore();
  const findFile = (nodes: any[], id: string): any => { for (const node of nodes) { if (node.id === id) return node; if (node.children) { const found = findFile(node.children, id); if (found) return found; } } return null; };

  if (openFiles.length === 0) return <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', backgroundColor: '#1e1e1e', borderBottom: `1px solid ${C.border}` }}><span className="mono" style={{ fontSize: 12, color: C.muted }}>No files open</span></div>;

  const fileColors: Record<string, string> = { py: C.blue, js: C.yellow, ts: C.cyan, tsx: C.cyan, json: C.orange };

  return (
    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e1e1e', borderBottom: `1px solid ${C.border}`, overflow: 'auto', height: 36, flexShrink: 0 }}>
      {openFiles.map(fileId => {
        const file = findFile(files, fileId);
        const isActive = fileId === activeFileId;
        const ext = file?.name?.split('.').pop() || '';
        const dotColor = fileColors[ext] || C.muted;
        return (
          <div key={fileId} onClick={() => useEditorStore.getState().openFile(fileId)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', height: '100%',
            backgroundColor: isActive ? C.bg : 'transparent', borderRight: `1px solid ${C.border}`,
            cursor: 'pointer', color: isActive ? C.text : C.muted, fontFamily: "'Fragment Mono', monospace", fontSize: 12, whiteSpace: 'nowrap', position: 'relative',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor }} />
            {file?.name || 'Unknown'}
            {isActive && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: C.cyan }} />}
            <button onClick={(e) => { e.stopPropagation(); closeFile(fileId); }} style={{ padding: 2, background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TerminalPanel({ lines, input, onInputChange, onCommand }: { lines: any[]; input: string; onInputChange: (v: string) => void; onCommand: (cmd: string) => void }) {
  const termRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [lines]);

  const colors: Record<string, string> = { prompt: C.cyan, out: '#666680', ok: C.green, err: C.red, info: C.yellow, warn: C.orange };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div ref={termRef} style={{ flex: 1, backgroundColor: '#050508', padding: 12, overflowY: 'auto', fontFamily: "'Fragment Mono', monospace", fontSize: 12, lineHeight: 1.7 }}>
        {lines.map((l: any, i: number) => <div key={i} style={{ color: colors[l.type] || C.text, marginBottom: 2 }}>{l.text}</div>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#050508', borderTop: `1px solid ${C.border}`, padding: '8px 12px' }}>
        <TerminalIcon size={12} color={C.cyan} />
        <input value={input} onChange={e => onInputChange(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter' && input.trim()) { onCommand(input.trim()); onInputChange(''); } }}
          placeholder="Enter command…" style={{ flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none', color: C.text, fontFamily: "'Fragment Mono', monospace", fontSize: 12 }} />
      </div>
    </div>
  );
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: C.card, border: `1px solid ${hov ? C.border2 : C.border}`, color: hov ? C.text : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      {children}
    </button>
  );
}

function Divider() { return <div style={{ height: 1, backgroundColor: C.border, margin: '4px 0' }} />; }

function AgentCard({ agent, onGenerate, isGenerating }: { agent: any; onGenerate: (instruction: string) => void; isGenerating: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div style={{ margin: '0 8px 6px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: agent.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{agent.icon}</div>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{agent.name}</span>
        <div className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: C.green, marginLeft: 'auto' }} />
      </div>
      <div className="mono" style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{agent.task}</div>
      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); onGenerate('Complete the following code snippet'); }} disabled={isGenerating}
            style={{ padding: '6px 10px', backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40`, borderRadius: 6, color: C.text, fontSize: 11, cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.5 : 1 }}>
            <Sparkles size={12} style={{ marginRight: 6 }} />Generate Code
          </button>
          <button onClick={(e) => { e.stopPropagation(); onGenerate('Find and fix bugs in this code'); }} disabled={isGenerating}
            style={{ padding: '6px 10px', backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40`, borderRadius: 6, color: C.text, fontSize: 11, cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.5 : 1 }}>
            <Bot size={12} style={{ marginRight: 6 }} />Fix Bugs
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ color, icon, label }: { color: string; icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px', height: 18, borderRadius: 3, backgroundColor: `${color}15`, color }}>
      {icon}<span className="mono" style={{ fontSize: 10 }}>{label}</span>
    </div>
  );
}

function ChatPanel({ messages, input, onInputChange, onSend }: any) {
  const chatRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  const nameColors: Record<string, string> = { user: C.ana, system: C.yellow, ai: C.yellow };
  const names: Record<string, string> = { user: 'You', system: 'System', ai: '✦ AI' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={chatRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', marginBottom: 10 }}>
        {messages.map((m: any, i: number) => (
          m.from === 'system' ? (
            <div key={i} style={{ textAlign: 'center' }}>
              <span className="mono" style={{ fontSize: 11, color: C.yellow, backgroundColor: `rgba(255,215,0,.08)`, border: `1px solid rgba(255,215,0,.2)`, borderRadius: 6, padding: '4px 10px' }}>{m.text}</span>
            </div>
          ) : (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', gap: 3 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: nameColors[m.from] || C.muted }}>{names[m.from] || m.from}</div>
              <div style={{ padding: '9px 13px', borderRadius: 10, fontSize: 13, backgroundColor: m.from === 'user' ? C.blue : C.card, border: `1px solid ${m.from === 'user' ? 'transparent' : C.border}`, color: m.from === 'user' ? '#fff' : C.text, borderBottomLeftRadius: m.from === 'user' ? 10 : 3, borderBottomRightRadius: m.from === 'user' ? 3 : 10 }}>{m.text}</div>
              <div className="mono" style={{ fontSize: 9, color: C.muted, padding: '0 4px', textAlign: m.from === 'user' ? 'right' : 'left' }}>{m.time}</div>
            </div>
          )
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => onInputChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSend()}
          placeholder="Message…" style={{ flex: 1, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
        <button onClick={onSend} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: C.blue, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function SecurityPanel() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 9, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>Security Score</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>3 issues found</div>
        </div>
        <div className="syne" style={{ fontSize: 32, fontWeight: 800, color: C.yellow }}>72</div>
      </div>
      <div className="mono" style={{ fontSize: 9, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>Vulnerabilities</div>
      {VULNS.map((v, i) => {
        const colors: Record<string, string> = { HIGH: C.red, MED: C.yellow, LOW: C.green };
        const icons: Record<string, any> = { HIGH: AlertTriangle, MED: AlertCircle, LOW: CheckCircle };
        const Icon = icons[v.level];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 6 }}>
            <div style={{ padding: '2px 7px', borderRadius: 4, backgroundColor: `${colors[v.level]}20`, color: colors[v.level], fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon size={11} /> {v.level}
            </div>
            <div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>{v.desc}</div>
              <div className="mono" style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{v.file}</div>
            </div>
          </div>
        );
      })}
      <button style={{ width: '100%', marginTop: 12, padding: '10px 14px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <RefreshCw size={13} /> Re-scan
      </button>
    </div>
  );
}

export default WorkspaceLayout;
