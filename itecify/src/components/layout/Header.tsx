import React from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { UserAvatarsGroup } from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/Button';
import { Play, Square, Wifi, WifiOff, Settings, Bug, Bot, Terminal as TerminalIcon } from 'lucide-react';

interface HeaderProps {
  onRun: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
}

export function Header({ onRun, onStop, onOpenSettings }: HeaderProps) {
  const { 
    sessionName, 
    users, 
    isConnected, 
    isExecuting, 
    containerStatus,
    currentUser 
  } = useSessionStore();

  const activeUsers = users.length > 0 ? users : (currentUser ? [currentUser] : []);

  return (
    <header className="h-14 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="text-xl font-black tracking-tighter text-white">
            iTEC<span className="text-blue-500">ify</span>
          </div>
        </div>
        
        <div className="h-6 w-px bg-slate-700" />
        
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sessionName}
            readOnly
            className="bg-transparent text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 px-2 py-1 rounded"
          />
          <span className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <UserAvatarsGroup users={activeUsers} maxVisible={4} />
        
        <div className="h-6 w-px bg-slate-700" />
        
        <div className="flex items-center gap-2">
          {isExecuting ? (
            <>
              <div className="flex items-center gap-2 text-sm text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Running
              </div>
              <Button variant="danger" size="sm" onClick={onStop}>
                <Square size={14} />
                Stop
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={onRun}>
              <Play size={14} />
              Run
            </Button>
          )}
          
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            <Settings size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
}

interface TabBarProps {
  files: Array<{ id: string; name: string }>;
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
}

export function TabBar({ files, activeFileId, onSelectFile, onCloseFile }: TabBarProps) {
  const { modifiedFiles } = useEditorStore();

  return (
    <div className="h-9 bg-slate-900 border-b border-slate-800 flex items-center overflow-x-auto">
      {files.map(file => (
        <div
          key={file.id}
          className={`flex items-center gap-2 px-3 h-full border-r border-slate-800 cursor-pointer transition ${
            file.id === activeFileId
              ? 'bg-[#020617] text-white border-t-2 border-t-blue-500'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
          onClick={() => onSelectFile(file.id)}
        >
          <FileIcon filename={file.name} />
          <span className="text-sm">{file.name}</span>
          {modifiedFiles.has(file.id) && (
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          )}
          <button
            className="ml-1 p-0.5 hover:bg-slate-700 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onCloseFile(file.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const colors: Record<string, string> = {
    js: 'text-yellow-400',
    ts: 'text-blue-400',
    jsx: 'text-cyan-400',
    tsx: 'text-blue-400',
    py: 'text-green-400',
    rs: 'text-orange-500',
    go: 'text-cyan-400',
    json: 'text-orange-400',
  };

  return (
    <span className={`${colors[ext || ''] || 'text-slate-400'}`}>
      <TerminalIcon size={14} />
    </span>
  );
}

import { useEditorStore } from '@/stores/editorStore';
