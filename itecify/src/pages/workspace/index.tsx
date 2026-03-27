import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';
import { useSessionStore } from '@/stores/sessionStore';
import { useToast, ToastProvider } from '@/components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface UserData {
  id: string;
  name: string;
  email?: string;
}

function WorkspacePageContent() {
  const router = useRouter();
  const { projectId } = router.query;
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const { setSession, setCurrentUser, setConnected } = useSessionStore();
  const { addToast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      router.push('/auth/login');
      return;
    }

    if (!projectId) {
      router.push('/dashboard');
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

    fetchProject(token);
  }, [projectId]);

  const fetchProject = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch project');
      }

      const data = await res.json();
      setProject(data);
      setSession(data.id, data.name);
      setConnected(true);
      addToast('success', `Connected to ${data.name}`);
    } catch (err: any) {
      addToast('error', err.message);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

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
    <ToastProvider>
      <WorkspacePageContent />
    </ToastProvider>
  );
}
