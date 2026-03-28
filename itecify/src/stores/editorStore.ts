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
  parentId?: string | null;
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
  addFile: (file: Omit<FileNode, 'id'>, parentId?: string, projectId?: string) => Promise<string>;
  addFolder: (name: string, parentId?: string) => void;
  removeFile: (fileId: string) => void;
  renameFile: (fileId: string, newName: string) => void;
  moveFile: (fileId: string, newParentId: string | null) => void;
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

console.log('[Store] Creating store...');

// Watch for files changes
let lastFilesCount = -1;

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      activeFileId: 'index',
      files: defaultFiles,
      openFiles: ['index'],
      modifiedFiles: new Set<string>(),
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
        const state = get();
        console.log('[Store] loadFilesFromProject called:', { projectId, currentProjectId: state.currentProjectId, filesCount: state.files.length, isLoading: state.isLoadingFiles });
        
        // Don't reload if already loading or already loaded for this project
        if (state.currentProjectId === projectId && state.files.length > 0) {
          console.log('[Store] Skipping reload - already loaded');
          return;
        }
        
        // Also skip if currently loading for same project
        if (state.isLoadingFiles && state.currentProjectId === projectId) {
          console.log('[Store] Skipping reload - already loading');
          return;
        }
        
        set({ isLoadingFiles: true, currentProjectId: projectId });
        console.log('[Store] Loading files from API...');
        const files = await loadProjectFiles(projectId);
        console.log('[Store] Files loaded from API:', files.length);
        console.log('[Store] Current state before set:', { filesCount: get().files.length, openFiles: get().openFiles });
        
        if (files.length > 0) {
          console.log('[Store] Setting files:', files.length);
          set({ files, openFiles: [], activeFileId: null });
        } else {
          console.log('[Store] API returned 0 files, using defaultFiles:', defaultFiles.length);
          set({ files: defaultFiles, openFiles: [], activeFileId: null });
        }
        set({ isLoadingFiles: false });
        console.log('[Store] After set:', { filesCount: get().files.length, openFiles: get().openFiles });
      },

      setActiveFile: (fileId) => {
        const openFiles = get().openFiles;
        if (!openFiles.includes(fileId)) {
          set({ openFiles: [...openFiles, fileId], activeFileId: fileId });
        } else {
          set({ activeFileId: fileId });
        }
      },

      addFile: async (fileData, parentId, projectId?: string) => {
        const state = get();
        const effectiveProjectId = projectId || state.currentProjectId;
        
        if (effectiveProjectId) {
          try {
            const res = await fetch(`${API_URL}/api/projects/${effectiveProjectId}/files`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
              body: JSON.stringify({
                name: fileData.name,
                content: fileData.content || '',
                language: fileData.language || 'javascript',
                isFolder: false,
                parentId: parentId || null,
              }),
            });
            
            if (res.ok) {
              const savedFile = await res.json();
              const file: FileNode = { ...fileData, id: savedFile.id };
              const newFiles = addFileToTree(state.files, file, parentId);
              set({ files: newFiles, openFiles: [...state.openFiles, savedFile.id] });
              return savedFile.id;
            }
          } catch (err) {
            console.error('Failed to save file:', err);
          }
        }
        
        const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const file: FileNode = { ...fileData, id };
        const newFiles = addFileToTree(state.files, file, parentId);
        set({ files: newFiles, openFiles: [...state.openFiles, id] });
        return id;
      },

      addFolder: (name, parentId) => {
        const state = get();
        const effectiveProjectId = state.currentProjectId;
        const newFiles = addFolderToTree(get().files, name, parentId);
        set({ files: newFiles });
        
        if (effectiveProjectId) {
          fetch(`${API_URL}/api/projects/${effectiveProjectId}/files`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
            body: JSON.stringify({
              name,
              isFolder: true,
              parentId: parentId || null,
            }),
          }).catch(err => console.error('Failed to create folder:', err));
        }
      },

      removeFile: (fileId) => {
        const state = get();
        const file = findFile(state.files, fileId);
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
            files: removeFromTree(state.files, fileId),
            openFiles: state.openFiles.filter(id => !idsToRemove.includes(id)),
          });
        } else {
          set({
            files: removeFromTree(state.files, fileId),
            openFiles: state.openFiles.filter(id => id !== fileId),
          });
        }
        
        if (state.currentProjectId && file) {
          fetch(`${API_URL}/api/projects/${state.currentProjectId}/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
          }).catch(err => console.error('Failed to delete file:', err));
        }
      },

      renameFile: (fileId, newName) => {
        const state = get();
        const file = findFile(state.files, fileId);
        if (!file) return;
        
        set({
          files: state.files.map(node => renameInTree(node, fileId, newName)),
        });
        
        if (state.currentProjectId) {
          fetch(`${API_URL}/api/projects/${state.currentProjectId}/files/${fileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
            body: JSON.stringify({ name: newName }),
          }).catch(err => console.error('Failed to rename file:', err));
        }
      },

      moveFile: (fileId, newParentId) => {
        const state = get();
        const file = findFile(state.files, fileId);
        if (!file) return;
        
        const newFiles = removeFromTree(state.files, fileId);
        const movedFile = { ...file, parentId: newParentId };
        const newFilesWithMoved = addFileToTree(newFiles, movedFile, newParentId || undefined);
        
        set({ files: newFilesWithMoved });
        
        if (state.currentProjectId) {
          fetch(`${API_URL}/api/projects/${state.currentProjectId}/files/${fileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
            body: JSON.stringify({ parentId: newParentId }),
          }).catch(err => console.error('Failed to move file:', err));
        }
      },

      updateFileContent: (fileId, content) => {
        const state = get();
        set({
          files: updateContentInTree(state.files, fileId, content),
        });
        
        if (state.currentProjectId) {
          fetch(`${API_URL}/api/projects/${state.currentProjectId}/files/${fileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
            body: JSON.stringify({ content }),
          }).catch(err => console.error('Failed to save file:', err));
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
        const state = get();
        console.log('[Store] openFile called:', { fileId, openFiles: state.openFiles, filesCount: state.files.length });
        const openFiles = state.openFiles;
        if (!openFiles.includes(fileId)) {
          set({ openFiles: [...openFiles, fileId], activeFileId: fileId });
        } else {
          set({ activeFileId: fileId });
        }
        console.log('[Store] After openFile:', { openFiles: get().openFiles, filesCount: get().files.length });
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
      // Don't persist files - always load fresh from server
      partialize: (state) => ({
        openFiles: state.openFiles,
        activeFileId: state.activeFileId,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[Store] Hydration complete:', { 
          filesCount: state?.files.length, 
          currentProjectId: state?.currentProjectId,
          openFilesCount: state?.openFiles.length
        });
      },
    }
  )
);

// Watch for files changes
useEditorStore.subscribe(
  (state, prevState) => {
    if (state.files !== prevState.files) {
      if (state.files?.length === 0 && prevState.files?.length > 0) {
        console.error('[Store Subscribe] FILES WERE CLEARED!');
        console.trace('FILES CLEARED STACK TRACE:');
      }
    }
  }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const loadProjectFiles = async (projectId: string): Promise<FileNode[]> => {
  const token = localStorage.getItem('accessToken');
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/files?tree=true`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      console.log('[Store] API error:', res.status);
      return [];
    }
    const data = await res.json();
    console.log('[Store] API response:', JSON.stringify(data).substring(0, 500));
    if (!Array.isArray(data)) return [];
    
    return data.map((file: any) => ({
      id: file.id,
      name: file.name,
      type: file.type || 'file',
      language: file.language || 'javascript',
      content: file.content || '',
      children: file.children || undefined,
      isOpen: false,
    }));
  } catch (err) {
    console.log('[Store] API exception:', err);
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
