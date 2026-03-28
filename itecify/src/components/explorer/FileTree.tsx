import React, { useState, useCallback, useMemo } from 'react';
import { Tree, NodeApi } from 'react-arborist';
import {
  FileCode, Folder, FolderOpen, ChevronRight, ChevronDown,
  MoreHorizontal, Trash2, Pencil, File, FolderPlus
} from 'lucide-react';

const C = {
  bg: '#09090C',
  surface: '#0E0E13',
  card: '#13131A',
  border: '#2A2A3A',
  text: '#E8E8F0',
  muted: '#6B6B80',
  blue: '#4C8EFF',
  cyan: '#00E5CC',
  yellow: '#FFD700',
  green: '#39FF7A',
  red: '#FF4466',
};

const FILE_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  javascript: { icon: <FileCode size={15} />, color: '#FFD700' },
  typescript: { icon: <FileCode size={15} />, color: '#4C8EFF' },
  tsx: { icon: <FileCode size={15} />, color: '#4C8EFF' },
  python: { icon: <FileCode size={15} />, color: '#4C8EFF' },
  json: { icon: <FileCode size={15} />, color: '#FF7A3D' },
  html: { icon: <FileCode size={15} />, color: '#FF4466' },
  css: { icon: <FileCode size={15} />, color: '#A855F7' },
  rust: { icon: <FileCode size={15} />, color: '#FF7A3D' },
  go: { icon: <FileCode size={15} />, color: '#00E5CC' },
  default: { icon: <File size={15} />, color: '#6B6B80' },
};

interface FileNodeData {
  id: string;
  name: string;
  type: 'file' | 'folder';
  language?: string;
  content?: string;
  children?: FileNodeData[];
}

interface FileTreeProps {
  data: FileNodeData[];
  onSelect: (node: FileNodeData) => void;
  onCreateFile: (parentId: string | null, name: string) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, newParentId: string | null) => void;
  selectedId?: string | null;
}

export function FileTree({
  data,
  onSelect,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
  selectedId,
}: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renameState, setRenameState] = useState<{
    id: string;
    currentName: string;
  } | null>(null);
  const [newItemState, setNewItemState] = useState<{
    parentId: string | null;
    type: 'file' | 'folder';
    value: string;
  } | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRename = useCallback((nodeId: string, currentName: string) => {
    setRenameState({ id: nodeId, currentName });
    closeContextMenu();
  }, [closeContextMenu]);

  const handleRenameSubmit = useCallback((newName: string) => {
    if (renameState && newName.trim() && newName !== renameState.currentName) {
      onRename(renameState.id, newName.trim());
    }
    setRenameState(null);
  }, [renameState, onRename]);

  const handleDelete = useCallback((nodeId: string) => {
    onDelete(nodeId);
    closeContextMenu();
  }, [onDelete, closeContextMenu]);

  const handleNewFile = useCallback((parentId: string | null) => {
    setNewItemState({ parentId, type: 'file', value: '' });
    closeContextMenu();
  }, [closeContextMenu]);

  const handleNewFolder = useCallback((parentId: string | null) => {
    setNewItemState({ parentId, type: 'folder', value: '' });
    closeContextMenu();
  }, [closeContextMenu]);

  const handleNewItemSubmit = useCallback(() => {
    if (newItemState?.value.trim()) {
      if (newItemState.type === 'file') {
        const name = newItemState.value.includes('.')
          ? newItemState.value.trim()
          : `${newItemState.value.trim()}.js`;
        onCreateFile(newItemState.parentId, name);
      } else {
        onCreateFolder(newItemState.parentId, newItemState.value.trim());
      }
    }
    setNewItemState(null);
  }, [newItemState, onCreateFile, onCreateFolder]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: NodeApi<FileNodeData>) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      nodeId: node.data.id,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  React.useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, closeContextMenu]);

  const Node = useCallback(({ node, style, dragHandle }: {
    node: NodeApi<FileNodeData>;
    style: React.CSSProperties;
    dragHandle?: (el: HTMLDivElement | null) => void;
  }) => {
    const isSelected = selectedId === node.data.id;
    const isRenaming = renameState?.id === node.data.id;
    const level = node.level;
    const isFolder = node.data.type === 'folder';
    const iconColor = isFolder
      ? C.yellow
      : (FILE_ICONS[node.data.language || 'default']?.color || C.muted);

    const indentSize = 24;

    return (
      <div
        ref={dragHandle as any}
        className="file-tree-node"
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          backgroundColor: isSelected ? 'rgba(76,142,255,0.2)' : 'transparent',
          userSelect: 'none',
          height: 22,
          fontSize: 13,
        }}
        onClick={() => {
          if (isFolder) {
            node.toggle();
          } else {
            onSelect(node.data);
          }
        }}
        onContextMenu={(e) => handleContextMenu(e, node)}
      >
        <div style={{
          width: 20,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {isFolder ? (
            node.isOpen ? <ChevronDown size={14} color={C.muted} /> : <ChevronRight size={14} color={C.muted} />
          ) : null}
        </div>

        <div style={{
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginLeft: isFolder ? 0 : 2,
        }}>
          {isFolder ? (
            node.isOpen ? <FolderOpen size={16} color={iconColor} /> : <Folder size={16} color={iconColor} />
          ) : (
            FILE_ICONS[node.data.language || 'default']?.icon || <File size={16} color={iconColor} />
          )}
        </div>

        {isRenaming ? (
          <input
            autoFocus
            defaultValue={renameState.currentName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setRenameState(null);
              e.stopPropagation();
            }}
            onBlur={(e) => handleRenameSubmit(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              backgroundColor: C.bg,
              border: `1px solid ${C.blue}`,
              borderRadius: 2,
              padding: '0 4px',
              color: C.text,
              fontSize: 13,
              height: 18,
              outline: 'none',
            }}
          />
        ) : (
          <span style={{
            flex: 1,
            fontSize: 13,
            color: isSelected ? C.blue : C.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginLeft: 4,
          }}>
            {node.data.name}
          </span>
        )}
        
        <button
          onClick={(e) => handleContextMenu(e, node)}
          style={{
            padding: 4,
            background: 'transparent',
            border: 'none',
            color: C.muted,
            cursor: 'pointer',
            borderRadius: 4,
            opacity: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginRight: 4,
          }}
          className="node-more-btn"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    );
  }, [selectedId, renameState, onSelect, handleContextMenu, handleRenameSubmit]);

  const findNodeById = (nodes: FileNodeData[], id: string): FileNodeData | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <style>{`
        .file-tree-node:hover {
          background-color: rgba(255,255,255,0.04) !important;
        }
        .file-tree-node:hover .node-more-btn {
          opacity: 1 !important;
        }
        .file-tree-node:hover .node-more-btn:hover {
          background-color: rgba(255,255,255,0.1);
        }
      `}</style>
      
      <Tree
        data={data}
        width={240}
        height={600}
        indent={24}
        rowHeight={22}
        overscanCount={10}
        openByDefault={false}
        onMove={({ dragIds, parentId }) => {
          if (dragIds.length > 0) {
            onMove(dragIds[0] as string, parentId as string | null);
          }
        }}
      >
        {Node}
      </Tree>

      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: '#1E1E1E',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: 4,
            minWidth: 180,
            zIndex: 9999,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleNewFile(contextMenu.nodeId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: C.text,
              cursor: 'pointer',
              borderRadius: 4,
              fontSize: 13,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <File size={14} color={C.blue} /> New File
          </button>
          <button
            onClick={() => handleNewFolder(contextMenu.nodeId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: C.text,
              cursor: 'pointer',
              borderRadius: 4,
              fontSize: 13,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FolderPlus size={14} color={C.yellow} /> New Folder
          </button>
          <div style={{ height: 1, backgroundColor: C.border, margin: '4px 0' }} />
          <button
            onClick={() => {
              const node = findNodeById(data, contextMenu.nodeId);
              if (node) handleRename(contextMenu.nodeId, node.name);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: C.text,
              cursor: 'pointer',
              borderRadius: 4,
              fontSize: 13,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Pencil size={14} color={C.muted} /> Rename
          </button>
          <button
            onClick={() => handleDelete(contextMenu.nodeId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: C.red,
              cursor: 'pointer',
              borderRadius: 4,
              fontSize: 13,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {newItemState && (
        <div
          style={{
            position: 'fixed',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#1E1E1E',
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 16,
            minWidth: 280,
            zIndex: 10000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
            marginBottom: 12,
          }}>
            {newItemState.type === 'file' ? 'New File' : 'New Folder'}
          </div>
          <input
            autoFocus
            value={newItemState.value}
            onChange={(e) => setNewItemState({ ...newItemState, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNewItemSubmit();
              if (e.key === 'Escape') setNewItemState(null);
            }}
            placeholder={newItemState.type === 'file' ? 'filename.js' : 'folder name'}
            style={{
              width: '100%',
              backgroundColor: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: '8px 12px',
              color: C.text,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setNewItemState(null)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                color: C.muted,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleNewItemSubmit}
              style={{
                padding: '6px 12px',
                backgroundColor: C.blue,
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
