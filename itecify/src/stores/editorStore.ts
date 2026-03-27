import { create } from 'zustand';

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
  addFile: (file: FileNode) => void;
  removeFile: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  toggleFolder: (folderId: string) => void;
  closeFile: (fileId: string) => void;
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
  {
    id: 'package',
    name: 'package.json',
    type: 'file',
    language: 'json',
    content: JSON.stringify({
      name: 'itecify-project',
      version: '1.0.0',
      scripts: {
        start: 'node index.js'
      }
    }, null, 2),
  },
];

export const useEditorStore = create<EditorState>((set, get) => ({
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

  addFile: (file) => {
    const files = [...get().files, file];
    set({ files, openFiles: [...get().openFiles, file.id] });
  },

  removeFile: (fileId) => {
    set({
      files: get().files.filter(f => f.id !== fileId),
      openFiles: get().openFiles.filter(id => id !== fileId),
    });
  },

  updateFileContent: (fileId, content) => {
    set({
      files: get().files.map(f => 
        f.id === fileId ? { ...f, content } : f
      ),
    });
  },

  toggleFolder: (folderId) => {
    set({
      files: get().files.map(f =>
        f.id === folderId ? { ...f, isOpen: !f.isOpen } : f
      ),
    });
  },

  closeFile: (fileId) => {
    const openFiles = get().openFiles.filter(id => id !== fileId);
    const activeFileId = get().activeFileId === fileId 
      ? (openFiles[openFiles.length - 1] || null)
      : get().activeFileId;
    set({ openFiles, activeFileId });
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
}));
