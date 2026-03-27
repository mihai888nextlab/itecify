import React, { useState } from 'react';
import { Folder, FolderOpen, File, FileCode, ChevronRight, ChevronDown, Plus, MoreHorizontal, Trash2, Bot, Clock, Settings } from 'lucide-react';
import { useEditorStore, FileNode } from '@/stores/editorStore';
import { useSessionStore } from '@/stores/sessionStore';

const fileIcons: Record<string, React.ReactNode> = {
  javascript: <FileCode size={14} className="text-yellow-400" />,
  typescript: <FileCode size={14} className="text-blue-400" />,
  python: <FileCode size={14} className="text-green-400" />,
  json: <FileCode size={14} className="text-orange-400" />,
  rust: <FileCode size={14} className="text-orange-500" />,
  go: <FileCode size={14} className="text-cyan-400" />,
  default: <File size={14} className="text-slate-400" />,
};

function FileItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const { activeFileId, setActiveFile, toggleFolder, removeFile } = useEditorStore();
  const [showMenu, setShowMenu] = useState(false);
  const isActive = node.id === activeFileId;
  const isFolder = node.type === 'folder';

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer rounded-md transition ${
          isActive ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-slate-800 text-slate-300'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            toggleFolder(node.id);
          } else {
            setActiveFile(node.id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(true);
        }}
      >
        {isFolder && (
          <span className="text-slate-500">
            {node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        {isFolder ? (
          node.isOpen ? (
            <FolderOpen size={14} className="text-amber-400" />
          ) : (
            <Folder size={14} className="text-amber-400" />
          )
        ) : (
          fileIcons[node.language || 'default'] || fileIcons.default
        )}
        <span className="text-sm truncate flex-1">{node.name}</span>
      </div>
      {showMenu && (
        <div
          className="absolute bg-slate-800 border border-slate-700 rounded-md shadow-lg py-1 z-50"
          style={{ left: `${(depth + 1) * 12 + 80}px` }}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            onClick={() => {
              removeFile(node.id);
              setShowMenu(false);
            }}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
      {isFolder && node.isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <FileItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <FileTree />
        <div className="border-t border-slate-800">
          <AIAgentsPanel />
        </div>
        <HistoryPanel />
      </div>
    </div>
  );
}

export function FileTree() {
  const { files, addFile } = useEditorStore();

  const handleAddFile = () => {
    const newFile: FileNode = {
      id: `file-${Date.now()}`,
      name: 'new-file.js',
      type: 'file',
      language: 'javascript',
      content: '// New file\n',
    };
    addFile(newFile);
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Files</span>
        <button
          onClick={handleAddFile}
          className="p-1 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-0.5 relative">
        {files.map(file => (
          <FileItem key={file.id} node={file} />
        ))}
      </div>
    </div>
  );
}

export function AIAgentsPanel() {
  const { users } = useSessionStore();
  const aiAgents = users.filter(u => u.role === 'ai');

  return (
    <div className="p-2">
      <div className="flex items-center gap-2 px-2 py-1 mb-2">
        <Bot size={14} className="text-purple-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Agents</span>
      </div>
      {aiAgents.length === 0 ? (
        <div className="px-2 py-4 text-center">
          <Bot size={24} className="mx-auto mb-2 text-slate-600" />
          <p className="text-xs text-slate-500">No AI agents active</p>
          <p className="text-[10px] text-slate-600 mt-1">AI blocks will appear here</p>
        </div>
      ) : (
        <div className="space-y-1">
          {aiAgents.map(agent => (
            <div
              key={agent.id}
              className="flex items-center gap-2 px-2 py-1.5 bg-purple-500/10 rounded-md border border-purple-500/20"
            >
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: agent.color }}
              />
              <Bot size={14} className="text-purple-400" />
              <span className="text-sm text-slate-300">{agent.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Snapshot {
  id: string;
  timestamp: Date;
  description: string;
}

const mockSnapshots: Snapshot[] = [
  { id: '1', timestamp: new Date(Date.now() - 300000), description: 'Before AI refactor' },
  { id: '2', timestamp: new Date(Date.now() - 600000), description: 'Initial setup' },
];

export function HistoryPanel() {
  const [snapshots] = useState<Snapshot[]>(mockSnapshots);

  return (
    <div className="p-2">
      <div className="flex items-center gap-2 px-2 py-1 mb-2">
        <Clock size={14} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">History</span>
      </div>
      <div className="space-y-1">
        {snapshots.map(snapshot => (
          <div
            key={snapshot.id}
            className="group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-800 cursor-pointer transition"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 truncate">{snapshot.description}</p>
              <p className="text-[10px] text-slate-500">
                {snapshot.timestamp.toLocaleTimeString()}
              </p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition">
              <button className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                <Settings size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
          <Clock size={12} />
          <span>Auto-save every 30s</span>
        </div>
      </div>
    </div>
  );
}
