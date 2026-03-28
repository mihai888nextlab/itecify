import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Plus, Folder, Users, Clock, LogOut, Trash2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { theme as C } from '@/styles/theme';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Project {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  owner: { id: string; name: string; email: string; avatarUrl?: string };
  members: Array<{ user: { id: string; name: string; avatarUrl?: string }; role: string }>;
  _count: { members: number };
  updatedAt: string;
  createdAt: string;
}

function DashboardContent() {
  const router = useRouter();
  const { addToast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ 
    name: '', 
    description: '',
    containerImage: 'node:20'
  });

  const containerImages = [
    { id: 'node:20', name: 'Node.js 20', description: 'Latest Node.js LTS' },
    { id: 'node:18', name: 'Node.js 18', description: 'Node.js 18 LTS' },
    { id: 'python:3.12', name: 'Python 3.12', description: 'Latest Python' },
    { id: 'python:3.11', name: 'Python 3.11', description: 'Python 3.11' },
    { id: 'ubuntu:22.04', name: 'Ubuntu 22.04', description: 'Ubuntu with full tools' },
    { id: 'golang:1.22', name: 'Go 1.22', description: 'Go programming language' },
  ];

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      router.push('/auth/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchProjects(token);
  }, []);

  const fetchProjects = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch projects');
      
      const data = await res.json();
      setProjects(data);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProject),
      });

      if (!res.ok) throw new Error('Failed to create project');

      const project = await res.json();
      setProjects([project, ...projects]);
      setShowCreateModal(false);
      setNewProject({ name: '', description: '', containerImage: 'node:20' });
      addToast('success', 'Project created!');
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete project');

      setProjects(projects.filter(p => p.id !== projectId));
      addToast('success', 'Project deleted');
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.push('/');
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg }}>
      <header style={{ backgroundColor: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-tighter" style={{ color: C.text }}>
            iTEC<span style={{ color: C.blue }}>ify</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <UserAvatar name={user.name} color={C.blue} size="sm" />
                <span className="text-sm" style={{ color: C.text }}>{user.name}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>Your Projects</h1>
            <p className="mt-1" style={{ color: C.muted }}>Manage your workspaces and collaborators</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={18} /> New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl h-48 animate-pulse" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <Folder size={64} className="mx-auto mb-4" style={{ color: C.border }} />
            <h2 className="text-xl font-semibold mb-2" style={{ color: C.muted }}>No projects yet</h2>
            <p className="mb-6" style={{ color: C.border }}>Create your first project to start collaborating</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={18} /> Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div
                key={project.id}
                className="rounded-xl p-6 transition group"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Link href={`/workspace/${project.id}`}>
                      <h3 className="text-lg font-semibold hover transition" style={{ color: C.text }}>
                        {project.name}
                      </h3>
                    </Link>
                    {project.description && (
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: C.muted }}>{project.description}</p>
                    )}
                  </div>
                  {project.owner.id === user?.id && (
                    <Crown size={16} style={{ color: C.yellow }} />
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs mb-4" style={{ color: C.muted }}>
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {project._count.members} member{project._count.members !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {formatDate(project.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    <UserAvatar name={project.owner.name} color={C.blue} size="sm" />
                    {project.members.slice(0, 3).map((m, i) => (
                      <UserAvatar key={i} name={m.user.name} color={C.green} size="sm" />
                    ))}
                    {project._count.members > 4 && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: C.border, color: C.muted }}>
                        +{project._count.members - 4}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 transition" style={{ opacity: 0 }}>
                    <Link href={`/workspace/${project.id}`}>
                      <Button variant="ghost" size="sm">
                        Open
                      </Button>
                    </Link>
                    {project.owner.id === user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                        className="hover:bg-red-500/10"
                        style={{ color: C.red }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="rounded-xl p-6 w-full max-w-md mx-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: C.text }}>Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: C.text }}>Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full rounded-lg px-4 py-2.5 focus:outline-none"
                  style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                  placeholder="My Awesome Project"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: C.text }}>Description (optional)</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full rounded-lg px-4 py-2.5 resize-none h-24 focus:outline-none"
                  style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                  placeholder="A brief description of your project..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Runtime Environment</label>
                <select
                  value={newProject.containerImage}
                  onChange={(e) => setNewProject({ ...newProject, containerImage: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {containerImages.map(img => (
                    <option key={img.id} value={img.id}>
                      {img.name} - {img.description}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Docker container for running your code</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
