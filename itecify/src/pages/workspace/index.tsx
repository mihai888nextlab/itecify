import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';
import { useSessionStore } from '@/stores/sessionStore';
import { useToast, ToastProvider } from '@/components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function WorkspacePageContent() {
  const router = useRouter();
  const { projectId } = router.query;
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const { setSession, setCurrentUser, setConnected, addUser } = useSessionStore();
  const { addToast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/auth/login');
      return;
    }

    if (!projectId) return;

    const user = JSON.parse(userData);
    setCurrentUser({
      id: user.id,
      name: user.name,
      color: '#3b82f6',
      role: 'human',
    });
    addUser({
      id: user.id,
      name: user.name,
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

      connectWebSocket(token, data);
    } catch (err: any) {
      addToast('error', err.message);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const connectWebSocket = useCallback((token: string, project: any) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:4000/api/collaborate/ws/${project.id}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth',
        payload: { token },
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'sync_initial':
          console.log('Synced with initial state');
          break;
        case 'user_joined':
          addUser({
            ...message.payload.user,
            role: 'human',
          });
          addToast('info', `${message.payload.user.name} joined`);
          break;
        case 'user_left':
          useSessionStore.getState().removeUser(message.payload.userId);
          break;
        case 'cursor':
          useSessionStore.getState().updateUserCursor(
            message.payload.userId,
            message.payload.position
          );
          break;
        case 'awareness':
          const existingUser = useSessionStore.getState().users.find(
            u => u.id === message.payload.userId
          );
          if (existingUser) {
            Object.assign(existingUser, message.payload.user);
          }
          break;
      }
    };

    ws.onerror = () => {
      console.log('WebSocket error, running in offline mode');
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [addToast, addUser, setConnected]);

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

  if (!project) {
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

  return <WorkspaceLayout sessionId={project.id} />;
}

export default function WorkspacePage() {
  return (
    <ToastProvider>
      <WorkspacePageContent />
    </ToastProvider>
  );
}
