import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  name: string;
  color: string;
  role: 'human' | 'ai';
  cursorPosition?: { line: number; ch: number };
  selection?: { from: number; to: number };
  setAt?: number;
}

export interface RollbackItem {
  type: 'CREATE' | 'MODIFY' | 'DELETE';
  path: string;
  fileId?: string;
  originalContent?: string;
  fileData?: { name: string; content: string; language: string; parentId: string | null };
}

export interface AIBlock {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  status: 'pending' | 'accepted' | 'rejected';
  startLine: number;
  endLine: number;
  createdAt: Date;
  rollbackData?: RollbackItem[];
}

export interface SessionSettings {
  language: string;
  memoryLimit: string;
  cpuLimit: number;
  timeout: number;
}

interface SessionState {
  sessionId: string | null;
  sessionName: string;
  currentUser: User | null;
  users: User[];
  aiBlocks: AIBlock[];
  settings: SessionSettings;
  isConnected: boolean;
  isExecuting: boolean;
  containerStatus: 'stopped' | 'running' | 'error' | null;
  currentCode: string;
  
  setSession: (id: string, name: string) => void;
  setCurrentUser: (user: User) => void;
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
  setUsers: (users: User[]) => void;
  updateUserCursor: (userId: string, position: { line: number; ch: number }, selection?: { from: number; to: number }) => void;
  addAIBlock: (block: Omit<AIBlock, 'id' | 'createdAt'>) => AIBlock;
  updateAIBlock: (blockId: string, updates: Partial<AIBlock>) => void;
  removeAIBlock: (blockId: string) => void;
  setSettings: (settings: Partial<SessionSettings>) => void;
  setConnected: (connected: boolean) => void;
  setExecuting: (executing: boolean) => void;
  setContainerStatus: (status: 'stopped' | 'running' | 'error' | null) => void;
  setCurrentCode: (code: string) => void;
  reset: () => void;
}

const defaultSettings: SessionSettings = {
  language: 'javascript',
  memoryLimit: '512m',
  cpuLimit: 1,
  timeout: 30000,
};

const userColors = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
];

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  sessionName: 'Untitled Session',
  currentUser: null,
  users: [],
  aiBlocks: [],
  settings: defaultSettings,
  isConnected: false,
  isExecuting: false,
  containerStatus: null,
  currentCode: '',

  setSession: (id, name) => set({ sessionId: id, sessionName: name }),

  setCurrentUser: (user) => {
    const users = get().users;
    const existingIndex = users.findIndex(u => u.id === user.id);
    if (existingIndex >= 0) {
      const newUsers = [...users];
      newUsers[existingIndex] = user;
      set({ currentUser: user, users: newUsers });
    } else {
      set({ currentUser: user, users: [...users, user] });
    }
  },

  addUser: (user) => {
    const users = get().users;
    if (!users.find(u => u.id === user.id)) {
      set({ users: [...users, user] });
    }
  },

  removeUser: (userId) => {
    set({ users: get().users.filter(u => u.id !== userId) });
  },

  setUsers: (users) => {
    set({ users });
  },

  updateUserCursor: (userId, position, selection) => {
    const users = get().users.map(u => 
      u.id === userId ? { ...u, cursorPosition: position, selection } : u
    );
    set({ users });
  },

  addAIBlock: (blockData) => {
    const block: AIBlock = {
      ...blockData,
      id: uuidv4(),
      createdAt: new Date(),
    };
    set({ aiBlocks: [...get().aiBlocks, block] });
    return block;
  },

  updateAIBlock: (blockId, updates) => {
    set({
      aiBlocks: get().aiBlocks.map(b => 
        b.id === blockId ? { ...b, ...updates } : b
      ),
    });
  },

  removeAIBlock: (blockId) => {
    set({ aiBlocks: get().aiBlocks.filter(b => b.id !== blockId) });
  },

  setSettings: (settings) => {
    set({ settings: { ...get().settings, ...settings } });
  },

  setConnected: (connected) => set({ isConnected: connected }),

  setExecuting: (executing) => set({ isExecuting: executing }),

  setContainerStatus: (status) => set({ containerStatus: status }),

  setCurrentCode: (code) => set({ currentCode: code }),

  reset: () => set({
    sessionId: null,
    sessionName: 'Untitled Session',
    currentUser: null,
    users: [],
    aiBlocks: [],
    settings: defaultSettings,
    isConnected: false,
    isExecuting: false,
    containerStatus: null,
    currentCode: '',
  }),
}));

export const generateUserColor = (index: number) => userColors[index % userColors.length];
