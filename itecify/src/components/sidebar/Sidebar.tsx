import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, File, FileCode, ChevronRight, ChevronDown, Plus, MoreHorizontal, Trash2, Bot, Clock, Settings, X, FolderPlus, FilePlus, Sparkles, Loader2 } from 'lucide-react';
import { useEditorStore, FileNode } from '@/stores/editorStore';
import { useSessionStore } from '@/stores/sessionStore';

const fileIcons: Record<string, React.ReactNode> = {
  javascript: <FileCode size={14} className="text-yellow-400" />,
  typescript: <FileCode size={14} className="text-blue-400" />,
  python: <FileCode size={14} className="text-green-400" />,
  json: <FileCode size={14} className="text-orange-400" />,
  rust: <FileCode size={14} className="text-orange-500" />,
  go: <FileCode size={14} className="text-cyan-400" />,
  html: <FileCode size={14} className="text-red-400" />,
  css: <FileCode size={14} className="text-pink-400" />,
  default: <File size={14} className="text-slate-400" />,
};

const getLanguageFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mapping: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    json: 'json',
    rs: 'rust',
    go: 'go',
    html: 'html',
    css: 'css',
  };
  return mapping[ext || ''] || 'javascript';
};

function FileItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const { activeFileId, openFile, toggleFolder, removeFile } = useEditorStore();
  const [showMenu, setShowMenu] = useState(false);
  const isActive = node.id === activeFileId;
  const isFolder = node.type === 'folder';

  useEffect(() => {
    const handleClick = () => setShowMenu(false);
    if (showMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showMenu]);

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer rounded-md transition group ${
          isActive ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-slate-800 text-slate-300'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            toggleFolder(node.id);
          } else {
            openFile(node.id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(true);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded transition"
        >
          <MoreHorizontal size={12} className="text-slate-500" />
        </button>
      </div>
      {showMenu && (
        <div
          className="absolute bg-slate-800 border border-slate-700 rounded-md shadow-lg py-1 z-50 min-w-[120px]"
          style={{ left: '100%', top: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isFolder && (
            <>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
                onClick={() => {
                  useEditorStore.getState().addFile({
                    name: 'new-file.js',
                    type: 'file',
                    language: 'javascript',
                    content: '',
                  }, node.id);
                  setShowMenu(false);
                }}
              >
                <FilePlus size={12} />
                New File
              </button>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
                onClick={() => {
                  useEditorStore.getState().addFolder('new-folder', node.id);
                  setShowMenu(false);
                }}
              >
                <FolderPlus size={12} />
                New Folder
              </button>
              <div className="h-px bg-slate-700 my-1" />
            </>
          )}
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-400 hover:bg-slate-700"
            onClick={() => {
              removeFile(node.id);
              setShowMenu(false);
            }}
          >
            <Trash2 size={12} />
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

interface CreateDialogProps {
  type: 'file' | 'folder';
  onClose: () => void;
  onCreate: (name: string) => void;
  defaultName?: string;
}

function CreateDialog({ type, onClose, onCreate, defaultName }: CreateDialogProps) {
  const [name, setName] = useState(defaultName || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 w-80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">
            {type === 'file' ? 'New File' : 'New Folder'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'file' ? 'filename.js' : 'folder name'}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Create
            </button>
          </div>
        </form>
      </div>
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
  const { files, addFile, addFolder } = useEditorStore();
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  const handleCreateFile = (name: string) => {
    addFile({
      name: name.includes('.') ? name : `${name}.js`,
      type: 'file',
      language: getLanguageFromExtension(name),
      content: '',
    });
    setShowCreateFile(false);
  };

  const handleCreateFolder = (name: string) => {
    addFolder(name);
    setShowCreateFolder(false);
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Files</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCreateFile(true)}
            className="p-1 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white"
            title="New File"
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={() => setShowCreateFolder(true)}
            className="p-1 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>
      <div className="space-y-0.5">
        {files.map(file => (
          <FileItem key={file.id} node={file} />
        ))}
        {files.length === 0 && (
          <div className="text-center py-4 text-slate-500 text-sm">
            No files yet
          </div>
        )}
      </div>

      {showCreateFile && (
        <CreateDialog
          type="file"
          onClose={() => setShowCreateFile(false)}
          onCreate={handleCreateFile}
          defaultName="untitled.js"
        />
      )}
      {showCreateFolder && (
        <CreateDialog
          type="folder"
          onClose={() => setShowCreateFolder(false)}
          onCreate={handleCreateFolder}
          defaultName="new-folder"
        />
      )}
    </div>
  );
}

export function AIAgentsPanel() {
  const { users, addAIBlock, settings } = useSessionStore();
  const { files, activeFileId } = useEditorStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

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

  const getCurrentCode = () => {
    if (!activeFileId) return '';
    const file = findFileInTree(files, activeFileId);
    return file?.content || '';
  };

  const handleAIGenerate = async (instruction: string) => {
    const code = getCurrentCode();
    if (!code.trim()) {
      return;
    }

    setIsGenerating(true);
    setSelectedTask(instruction);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          language: settings.language,
          instruction,
        }),
      });

      const result = await res.json();

      if (result.success) {
        addAIBlock({
          agentId: 'groq-assistant',
          agentName: 'AI Assistant',
          content: result.content,
          status: 'pending',
          startLine: 0,
          endLine: 0,
        });
      } else {
        console.error('AI generation failed:', result.error);
      }
    } catch (err) {
      console.error('AI error:', err);
    } finally {
      setIsGenerating(false);
      setSelectedTask(null);
    }
  };

  const aiTasks = [
    { id: 'complete', label: 'Complete Code', instruction: 'Complete the following code snippet' },
    { id: 'optimize', label: 'Optimize', instruction: 'Optimize this code for better performance' },
    { id: 'debug', label: 'Fix Bugs', instruction: 'Find and fix bugs in this code' },
    { id: 'document', label: 'Add Comments', instruction: 'Add helpful comments to explain this code' },
  ];

  return (
    <div className="p-2">
      <div className="flex items-center gap-2 px-2 py-1 mb-2">
        <Bot size={14} className="text-purple-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Assistant</span>
      </div>
      
      <div className="space-y-2">
        {aiTasks.map(task => (
          <button
            key={task.id}
            onClick={() => handleAIGenerate(task.instruction)}
            disabled={isGenerating || !getCurrentCode()}
            className="w-full flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating && selectedTask === task.instruction ? (
              <Loader2 size={14} className="text-purple-400 animate-spin" />
            ) : (
              <Sparkles size={14} className="text-purple-400" />
            )}
            <span className="text-sm text-slate-300">{task.label}</span>
          </button>
        ))}
      </div>

      {!getCurrentCode() && (
        <p className="text-[10px] text-slate-600 mt-2 text-center">
          Open a file to use AI
        </p>
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
