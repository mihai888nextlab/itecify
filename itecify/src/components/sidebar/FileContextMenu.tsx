import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Pencil, Trash2, FilePlus, FolderPlus, Copy, File } from 'lucide-react';
import { FileNode } from '@/stores/editorStore';

interface FileContextMenuProps {
  children: React.ReactNode;
  node: FileNode;
  onRename: (nodeId: string, currentName: string) => void;
  onDelete: (nodeId: string) => void;
  onAddFile?: (parentId?: string) => void;
  onAddFolder?: (parentId?: string) => void;
  onDuplicate?: (nodeId: string) => void;
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  fontSize: 13,
  borderRadius: 4,
  cursor: 'pointer',
  outline: 'none',
  border: 'none',
  background: 'transparent',
  width: '100%',
  textAlign: 'left',
};

const contentStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  borderRadius: 8,
  border: '1px solid #334155',
  padding: 4,
  minWidth: 160,
  zIndex: 99999,
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
};

export function FileContextMenu({
  children,
  node,
  onRename,
  onDelete,
  onAddFile,
  onAddFolder,
}: FileContextMenuProps) {
  const isFolder = node.type === 'folder';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content style={contentStyle}>
          <ContextMenu.Item
            onSelect={() => onRename(node.id, node.name)}
            style={{ ...menuItemStyle, color: '#e2e8f0' }}
            className="context-menu-item"
          >
            <Pencil size={14} color="#94a3b8" />
            Rename
          </ContextMenu.Item>

          {isFolder && (
            <>
              <ContextMenu.Item
                onSelect={() => onAddFile?.(node.id)}
                style={{ ...menuItemStyle, color: '#e2e8f0' }}
                className="context-menu-item"
              >
                <File size={14} color="#94a3b8" />
                New File
              </ContextMenu.Item>

              <ContextMenu.Item
                onSelect={() => onAddFolder?.(node.id)}
                style={{ ...menuItemStyle, color: '#e2e8f0' }}
                className="context-menu-item"
              >
                <FolderPlus size={14} color="#f59e0b" />
                New Folder
              </ContextMenu.Item>

              <ContextMenu.Separator style={{ height: 1, backgroundColor: '#334155', margin: '4px 0' }} />
            </>
          )}

          <ContextMenu.Item
            onSelect={() => onDelete(node.id)}
            style={{ ...menuItemStyle, color: '#f87171' }}
            className="context-menu-item"
          >
            <Trash2 size={14} color="#f87171" />
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
