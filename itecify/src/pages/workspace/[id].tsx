import React, { useEffect, useState, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';
import { useSessionStore } from '@/stores/sessionStore';
import { useEditorStore, FileNode, loadProjectFiles } from '@/stores/editorStore';
import { useToast, ToastProvider } from '@/components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface UserData {
  id: string;
  name: string;
  email?: string;
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Workspace Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-[#020617]">
          <div className="text-center">
            <p className="text-red-400 mb-4">Something went wrong</p>
            <p className="text-slate-400 text-sm mb-4">{this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="text-blue-400 hover:underline"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function WorkspacePageContent() {
  const router = useRouter();
  const { id: projectId } = router.query;
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const { setSession, setCurrentUser, setConnected } = useSessionStore();
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const initContainer = async (project: any, token: string, files: FileNode[]) => {
    try {
      await fetch(`${API_URL}/api/terminal/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: project.id,
          image: project.containerImage || 'node:20',
        }),
      });

      const flatFiles: { name: string; content: string }[] = [];
      const collectFiles = (nodes: FileNode[]) => {
        for (const node of nodes) {
          if (node.type === 'file') {
            flatFiles.push({
              name: node.name,
              content: node.content || '',
            });
          }
          if (node.children) {
            collectFiles(node.children);
          }
        }
      };
      collectFiles(files);

      if (flatFiles.length > 0) {
        await fetch(`${API_URL}/api/terminal/sync-files`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            projectId: project.id,
            files: flatFiles,
          }),
        });
      }
    } catch (err) {
      console.error('Failed to initialize container:', err);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      router.push('/auth/login');
      return;
    }

    if (!projectId || Array.isArray(projectId)) {
      return;
    }

    const user = JSON.parse(storedUser);
    setUserData(user);
    setCurrentUser({
      id: user.id,
      name: user.name || 'User',
      color: '#3b82f6',
      role: 'human',
    });

    fetch(`${API_URL}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (!res.ok) {
          if (res.status === 403) throw new Error('Access denied. You don\'t have permission to view this project.');
          if (res.status === 404) throw new Error('Project not found.');
          throw new Error('Failed to fetch project');
        }
        return res.json();
      })
      .then(async data => {
        if (mountedRef.current) {
          setProject(data);
          setSession(data.id, data.name);
          setConnected(true);

          const files = await loadProjectFiles(projectId as string);
          initContainer(data, token, files);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (mountedRef.current) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#020617]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#020617]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="text-blue-400 hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!project || !userData) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#020617]">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Project not found</p>
          <button onClick={() => router.push('/dashboard')} className="text-blue-400 hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceLayout
      sessionId={project.id}
      currentUser={{
        id: userData.id,
        name: userData.name || 'User',
        color: '#3b82f6',
      }}
      project={project}
    />
  );
}

export default function WorkspacePage() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <WorkspacePageContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}
