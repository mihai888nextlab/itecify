import React, { useState, useCallback } from 'react';
import { Header } from './Header';
import { CollaborativeEditor } from '@/components/editor/CollaborativeEditor';
import { Terminal } from '@/components/terminal/Terminal';
import { Sidebar, AIAgentsPanel, HistoryPanel, FileTree } from '@/components/sidebar/Sidebar';
import { useSessionStore } from '@/stores/sessionStore';
import { Maximize2, Minimize2, Zap, Terminal as TerminalIcon } from 'lucide-react';

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

  const handleRun = useCallback(async () => {
    setExecuting(true);
    setTerminalOutput('');
    
    const outputLines = [
      '',
      '\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m',
      '\x1b[1;32m  Executing code...\x1b[0m',
      '\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m',
      '',
      `[${new Date().toLocaleTimeString()}] Building container...`,
      `[${new Date().toLocaleTimeString()}] Language: ${settings.language}`,
      `[${new Date().toLocaleTimeString()}] Memory limit: ${settings.memoryLimit}`,
      '',
    ];
    
    setTerminalOutput(outputLines.join('\n'));
    
    setTimeout(() => {
      const runtimeOutput = [
        '',
        '\x1b[32m✓ Container started successfully\x1b[0m',
        '',
        '> Hello, iTEC 2026!',
        '',
        '\x1b[33m⚠ Execution completed in 142ms\x1b[0m',
        '\x1b[90mMemory used: 12.4MB / 512MB\x1b[0m',
        '',
      ].join('\n');
      
      setTerminalOutput(prev => prev + runtimeOutput);
      setExecuting(false);
      
      addAIBlock({
        agentId: 'demo-agent',
        agentName: 'Demo AI',
        content: `// AI-generated optimization suggestion
function optimizedGreeter(name) {
  return \`Hello, \${name}! Welcome to iTECify!\`;
}

// This function uses template literals
// for better performance
console.log(optimizedGreeter('iTEC 2026'));`,
        status: 'pending',
        startLine: 10,
        endLine: 17,
      });
      
    }, 1500);
  }, [settings, setExecuting, addAIBlock]);

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
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-full bg-green-900 flex items-center justify-center text-white">
              <p>Editor loading... sessionId: {sessionId}</p>
            </div>
            {/* <CollaborativeEditor
              projectId={sessionId}
              user={currentUser}
            /> */}
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
              <div className="h-[calc(100%-36px)] bg-slate-800 flex items-center justify-center text-slate-400">
                <p>Terminal</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
