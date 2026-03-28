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
  isLoadingFiles: boolean;
  currentProjectId: string | null;
  editorSetContentFn: ((fileId: string, content: string) => void) | null;
  
  setActiveFile: (fileId: string) => void;
  addFile: (file: Omit<FileNode, 'id'>, parentId?: string, projectId?: string) => string;
  addFolder: (name: string, parentId?: string) => void;
  removeFile: (fileId: string) => void;
  renameFile: (fileId: string, newName: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  toggleFolder: (folderId: string) => void;
  closeFile: (fileId: string) => void;
  openFile: (fileId: string) => void;
  markModified: (fileId: string, modified: boolean) => void;
  loadFilesFromProject: (projectId: string) => Promise<void>;
  setCurrentProjectId: (projectId: string) => void;
  setEditorSetContentFn: (fn: ((fileId: string, content: string) => void) | null) => void;
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
      isLoadingFiles: false,
      currentProjectId: null,
      editorSetContentFn: null,

      setCurrentProjectId: (projectId: string) => {
        set({ currentProjectId: projectId });
      },

      setEditorSetContentFn: (fn) => {
        set({ editorSetContentFn: fn });
      },

      loadFilesFromProject: async (projectId: string) => {
        set({ isLoadingFiles: true, currentProjectId: projectId });
        const files = await loadProjectFiles(projectId);
        if (files.length > 0) {
          set({ files, openFiles: files[0] ? [files[0].id] : [], activeFileId: files[0]?.id || null });
        } else {
          set({ files: defaultFiles, openFiles: ['index'], activeFileId: 'index' });
        }
        set({ isLoadingFiles: false });
      },

      setActiveFile: (fileId) => {
        const openFiles = get().openFiles;
        if (!openFiles.includes(fileId)) {
          set({ openFiles: [...openFiles, fileId], activeFileId: fileId });
        } else {
          set({ activeFileId: fileId });
        }
      },

      addFile: (fileData, parentId, projectId?: string) => {
        const state = get();
        const effectiveProjectId = projectId || state.currentProjectId;
        const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const file: FileNode = { ...fileData, id };
        const newFiles = addFileToTree(state.files, file, parentId);
        set({ files: newFiles, openFiles: [...state.openFiles, id] });
        
        if (effectiveProjectId) {
          fetch(`${API_URL}/api/projects/${effectiveProjectId}/files`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
            body: JSON.stringify({
              name: fileData.name,
              content: fileData.content || '',
              language: fileData.language || 'javascript',
            }),
          }).catch(err => console.error('Failed to save file:', err));
        }
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
        const state = get();
        set({
          files: updateContentInTree(state.files, fileId, content),
        });
        
        if (state.currentProjectId) {
          const file = findFile(state.files, fileId);
          if (file) {
            fetch(`${API_URL}/api/projects/${state.currentProjectId}/files`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
              body: JSON.stringify({
                name: file.name,
                content: content,
                language: file.language || 'javascript',
              }),
            }).catch(err => console.error('Failed to save file:', err));
          }
        }
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const loadProjectFiles = async (projectId: string): Promise<FileNode[]> => {
  const token = localStorage.getItem('accessToken');
  if (!token) return [];
  
  try {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/files`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    
    return data.map((file: any) => ({
      id: file.id,
      name: file.name,
      type: 'file',
      language: file.language || 'javascript',
      content: file.content || '',
    }));
  } catch {
    return [];
  }
};

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
