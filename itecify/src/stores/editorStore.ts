import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  language?: string;
  content?: string;
  children?: FileNode[];
  isOpen?: boolean;
}

interface EditorState {
  activeFileId: string | null;
  files: FileNode[];
  openFiles: string[];
  modifiedFiles: Set<string>;
  
  setActiveFile: (fileId: string) => void;
  addFile: (file: Omit<FileNode, 'id'>, parentId?: string) => string;
  addFolder: (name: string, parentId?: string) => void;
  removeFile: (fileId: string) => void;
  renameFile: (fileId: string, newName: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  toggleFolder: (folderId: string) => void;
  closeFile: (fileId: string) => void;
  openFile: (fileId: string) => void;
  markModified: (fileId: string, modified: boolean) => void;
}

const defaultFiles: FileNode[] = [
  {
    id: 'index',
    name: 'index.js',
    type: 'file',
    language: 'javascript',
    content: `// Welcome to iTECify
// Start coding here!

function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('iTEC 2026');
`,
  },
];

const addFileToTree = (files: FileNode[], file: FileNode, parentId?: string): FileNode[] => {
  if (!parentId) {
    return [...files, file];
  }
  
  return files.map(node => {
    if (node.id === parentId && node.type === 'folder') {
      return {
        ...node,
        children: [...(node.children || []), file],
        isOpen: true,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: addFileToTree(node.children, file, parentId),
      };
    }
    return node;
  });
};

const addFolderToTree = (files: FileNode[], name: string, parentId?: string): FileNode[] => {
  const newFolder: FileNode = {
    id: `folder-${Date.now()}`,
    name,
    type: 'folder',
    isOpen: false,
    children: [],
  };
  
  if (!parentId) {
    return [...files, newFolder];
  }
  
  return files.map(node => {
    if (node.id === parentId && node.type === 'folder') {
      return {
        ...node,
        children: [...(node.children || []), newFolder],
        isOpen: true,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: addFolderToTree(node.children, name, parentId),
      };
    }
    return node;
  });
};

const removeFromTree = (files: FileNode[], fileId: string): FileNode[] => {
  return files
    .filter(node => node.id !== fileId)
    .map(node => {
      if (node.children) {
        return {
          ...node,
          children: removeFromTree(node.children, fileId),
        };
      }
      return node;
    });
};

const findFile = (files: FileNode[], fileId: string): FileNode | null => {
  for (const node of files) {
    if (node.id === fileId) return node;
    if (node.children) {
      const found = findFile(node.children, fileId);
      if (found) return found;
    }
  }
  return null;
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      activeFileId: 'index',
      files: defaultFiles,
      openFiles: ['index'],
      modifiedFiles: new Set(),

      setActiveFile: (fileId) => {
        const openFiles = get().openFiles;
        if (!openFiles.includes(fileId)) {
          set({ openFiles: [...openFiles, fileId], activeFileId: fileId });
        } else {
          set({ activeFileId: fileId });
        }
      },

      addFile: (fileData, parentId) => {
        const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const file: FileNode = { ...fileData, id };
        const newFiles = addFileToTree(get().files, file, parentId);
        set({ files: newFiles, openFiles: [...get().openFiles, id] });
        return id;
      },

      addFolder: (name, parentId) => {
        const newFiles = addFolderToTree(get().files, name, parentId);
        set({ files: newFiles });
      },

      removeFile: (fileId) => {
        const file = findFile(get().files, fileId);
        if (file?.type === 'folder' && file.children) {
          const idsToRemove = [fileId];
          const collectIds = (nodes: FileNode[]) => {
            nodes.forEach(n => {
              idsToRemove.push(n.id);
              if (n.children) collectIds(n.children);
            });
          };
          collectIds(file.children);
          set({
            files: removeFromTree(get().files, fileId),
            openFiles: get().openFiles.filter(id => !idsToRemove.includes(id)),
          });
        } else {
          set({
            files: removeFromTree(get().files, fileId),
            openFiles: get().openFiles.filter(id => id !== fileId),
          });
        }
      },

      renameFile: (fileId, newName) => {
        set({
          files: get().files.map(node => renameInTree(node, fileId, newName)),
        });
      },

      updateFileContent: (fileId, content) => {
        set({
          files: updateContentInTree(get().files, fileId, content),
        });
      },

      toggleFolder: (folderId) => {
        set({
          files: get().files.map(node => toggleInTree(node, folderId)),
        });
      },

      closeFile: (fileId) => {
        const openFiles = get().openFiles.filter(id => id !== fileId);
        const activeFileId = get().activeFileId === fileId 
          ? (openFiles[openFiles.length - 1] || null)
          : get().activeFileId;
        set({ openFiles, activeFileId });
      },

      openFile: (fileId) => {
        const openFiles = get().openFiles;
        if (!openFiles.includes(fileId)) {
          set({ openFiles: [...openFiles, fileId], activeFileId: fileId });
        } else {
          set({ activeFileId: fileId });
        }
      },

      markModified: (fileId, modified) => {
        const modifiedFiles = new Set(get().modifiedFiles);
        if (modified) {
          modifiedFiles.add(fileId);
        } else {
          modifiedFiles.delete(fileId);
        }
        set({ modifiedFiles });
      },
    }),
    {
      name: 'itecify-editor',
      partialize: (state) => ({
        files: state.files,
        openFiles: state.openFiles,
        activeFileId: state.activeFileId,
      }),
    }
  )
);

function renameInTree(node: FileNode, fileId: string, newName: string): FileNode {
  if (node.id === fileId) {
    return { ...node, name: newName };
  }
  if (node.children) {
    return {
      ...node,
      children: node.children.map(child => renameInTree(child, fileId, newName)),
    };
  }
  return node;
}

function updateContentInTree(nodes: FileNode[], fileId: string, content: string): FileNode[] {
  return nodes.map(node => {
    if (node.id === fileId) {
      return { ...node, content };
    }
    if (node.children) {
      return {
        ...node,
        children: updateContentInTree(node.children, fileId, content),
      };
    }
    return node;
  });
}

function toggleInTree(node: FileNode, folderId: string): FileNode {
  if (node.id === folderId) {
    return { ...node, isOpen: !node.isOpen };
  }
  if (node.children) {
    return {
      ...node,
      children: node.children.map(child => toggleInTree(child, folderId)),
    };
  }
  return node;
}
