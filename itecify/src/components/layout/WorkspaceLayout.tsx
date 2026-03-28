import React, { useState, useCallback } from 'react';
import { Header } from './Header';
import { CollaborativeEditor } from '@/components/editor/CollaborativeEditor';
import { Terminal } from '@/components/terminal/Terminal';
import { Sidebar, AIAgentsPanel, HistoryPanel, FileTree } from '@/components/sidebar/Sidebar';
import { useSessionStore } from '@/stores/sessionStore';
import { useEditorStore } from '@/stores/editorStore';
import { Maximize2, Minimize2, Zap, Terminal as TerminalIcon, X, FileCode } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface WorkspaceLayoutProps {
  sessionId: string;
  currentUser: { id: string; name: string; color: string };
  project: { id: string; name: string; owner: any; members: any[] };
}

export function WorkspaceLayout({ sessionId, currentUser, project }: WorkspaceLayoutProps) {
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const { 
    isExecuting, 
    setExecuting, 
    settings,
    addAIBlock,
    aiBlocks
  } = useSessionStore();
  const { activeFileId, files } = useEditorStore();

  const findFileInTree = (nodes: any[], id: string): any => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findFileInTree(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleRun = useCallback(async () => {
    if (!activeFileId) {
      setTerminalOutput(`\x1b[33m⚠ No file selected to execute\x1b[0m\n`);
      return;
    }
    
    const activeFile = findFileInTree(files, activeFileId);
    
    if (!activeFile || activeFile.type === 'folder') {
      setTerminalOutput(`\x1b[33m⚠ No file selected to execute\x1b[0m\n`);
      return;
    }

    const codeToRun = activeFile.content || '';
    const language = activeFile.language || settings.language;

    setExecuting(true);
    setIsTerminalCollapsed(false);
    setTerminalOutput('');
    
    const outputLines = [
      '',
      '\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m',
      `\x1b[1;32m  Executing: ${activeFile.name}\x1b[0m`,
      '\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m',
      '',
      `[${new Date().toLocaleTimeString()}] Language: ${language}`,
      '',
    ];
    
    setTerminalOutput(outputLines.join('\n'));
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/api/execute/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: codeToRun,
          language: language,
        }),
      });
      
      const result = await res.json();
      
      let output = '';
      if (result.success) {
        output = [
          '\x1b[32m✓ Execution successful\x1b[0m',
          '',
          result.stdout || '(no output)',
          '',
        ].join('\n');
        
        if (result.stderr) {
          output += [
            '\x1b[33m⚠ Warnings:\x1b[0m',
            result.stderr,
            '',
          ].join('\n');
        }
      } else {
        output = [
          '\x1b[31m✗ Execution failed\x1b[0m',
          '',
          result.error || result.stderr || 'Unknown error',
          '',
        ].join('\n');
      }
      
      setTerminalOutput(prev => prev + output);
    } catch (err: any) {
      setTerminalOutput(prev => prev + `\n\x1b[31m✗ Error: ${err.message}\x1b[0m\n`);
    } finally {
      setExecuting(false);
    }
  }, [files, activeFileId, settings, setExecuting]);

  const handleStop = useCallback(() => {
    setExecuting(false);
    setTerminalOutput(prev => prev + '\n\x1b[31m✗ Execution stopped by user\x1b[0m\n');
  }, [setExecuting]);

  const handleTerminalCommand = useCallback((command: string) => {
    setTerminalOutput(prev => prev + `\n$ ${command}\n`);
    
    if (command === 'help') {
      setTerminalOutput(prev => prev + [
        '',
        '\x1b[36miTECify Terminal Commands:\x1b[0m',
        '  help     - Show this help message',
        '  clear    - Clear terminal output',
        '  status   - Show container status',
        '  ai:generate - Trigger AI code generation',
        '  run      - Run current file',
        '',
      ].join('\n'));
    } else if (command === 'ai:generate') {
      setTerminalOutput(prev => prev + '\n\x1b[35m🤖 AI Agent generating code...\x1b[0m\n');
      
      setTimeout(() => {
        const aiCode = [
          '',
          '\x1b[32m✓ AI generated new code block\x1b[0m',
          '',
        ].join('\n');
        setTerminalOutput(prev => prev + aiCode);
        
        addAIBlock({
          agentId: 'code-agent',
          agentName: 'Code Assistant',
          content: `// AI Suggestion: Add error handling
try {
  const result = await processData(input);
  console.log('Success:', result);
} catch (error) {
  console.error('Error:', error.message);
  // Handle gracefully
}`,
          status: 'pending',
          startLine: aiBlocks.length * 8 + 10,
          endLine: aiBlocks.length * 8 + 17,
        });
      }, 1000);
    } else if (command === 'status') {
      setTerminalOutput(prev => prev + [
        '',
        '\x1b[36mContainer Status:\x1b[0m',
        `  Status:    ${isExecuting ? '\x1b[33mRunning\x1b[0m' : '\x1b[32mIdle\x1b[0m'}`,
        `  Language:  ${settings.language}`,
        `  Memory:    ${settings.memoryLimit}`,
        `  CPU:       ${settings.cpuLimit} core(s)`,
        `  Timeout:   ${settings.timeout / 1000}s`,
        '',
      ].join('\n'));
    }
  }, [isExecuting, settings, addAIBlock, aiBlocks.length]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(Math.max(100, startHeight + delta), 500);
      setTerminalHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [terminalHeight]);

  return (
    <div className="h-screen flex flex-col bg-[#020617] overflow-hidden">
      <Header
        onRun={handleRun}
        onStop={handleStop}
        onOpenSettings={() => {}}
      />

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={`bg-slate-900 border-r border-slate-800 transition-all duration-300 ${
            isSidebarCollapsed ? 'w-12' : 'w-64'
          }`}
        >
          <div className="flex flex-col h-full">
            {!isSidebarCollapsed && (
              <>
                <div className="flex-1 overflow-y-auto">
                  <div className="border-b border-slate-800">
                    <FileTree />
                  </div>
                  <AIAgentsPanel />
                  <HistoryPanel />
                </div>
              </>
            )}
            
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-3 border-t border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              {isSidebarCollapsed ? <Zap size={16} /> : <Minimize2 size={16} />}
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <EditorTabs />
          <div className="flex-1 flex flex-col overflow-hidden">
            <CollaborativeEditor
              projectId={sessionId}
              user={currentUser}
            />
          </div>

          <div
            className="resizer h-1 cursor-ns-resize hover:bg-blue-500 transition-colors"
            onMouseDown={handleResizeStart}
          />

          <div
            className="bg-[#0d1117] transition-all duration-300 overflow-hidden"
            style={{ height: isTerminalCollapsed ? '36px' : `${terminalHeight}px` }}
          >
            <div
              className="h-9 flex items-center justify-between px-3 bg-slate-800 border-b border-slate-700 cursor-pointer"
              onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
            >
              <div className="flex items-center gap-2">
                <TerminalIcon size={14} className="text-slate-400" />
                <span className="text-sm text-slate-300">Output</span>
              </div>
              <button
                className="p-1 hover:bg-slate-700 rounded transition"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTerminalCollapsed(!isTerminalCollapsed);
                }}
              >
                {isTerminalCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
            </div>
            
            {!isTerminalCollapsed && (
              <div className="h-[calc(100%-36px)]">
                <Terminal
                  onCommand={handleTerminalCommand}
                  output={terminalOutput}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function findFileInTree(files: any[], id: string): any {
  for (const file of files) {
    if (file.id === id) return file;
    if (file.children) {
      const found = findFileInTree(file.children, id);
      if (found) return found;
    }
  }
  return null;
}

function EditorTabs() {
  const { openFiles, activeFileId, files, setActiveFile, closeFile } = useEditorStore();

  return (
    <div className="flex items-center bg-[#1e1e1e] border-b border-slate-700 overflow-x-auto">
      {openFiles.map(fileId => {
        const file = findFileInTree(files, fileId);
        const isActive = fileId === activeFileId;
        return (
          <div
            key={fileId}
            className={`flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-slate-700 transition group ${
              isActive ? 'bg-[#252526] text-white' : 'bg-[#1e1e1e] text-slate-400 hover:bg-slate-800'
            }`}
            onClick={() => setActiveFile(fileId)}
          >
            <FileCode size={14} className="text-yellow-400" />
            <span>{file?.name || 'Unknown'}</span>
            <button
              className="p-0.5 hover:bg-slate-600 rounded transition opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                closeFile(fileId);
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      {openFiles.length === 0 && (
        <div className="px-4 py-2 text-sm text-slate-500">No files open</div>
      )}
    </div>
  );
}
