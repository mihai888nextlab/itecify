import React from 'react';

interface WorkspaceLayoutProps {
  sessionId: string;
  currentUser: { id: string; name: string; color: string };
  project: { id: string; name: string; owner: any; members: any[] };
}

export function WorkspaceLayout({ sessionId, currentUser, project }: WorkspaceLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-[#020617] overflow-hidden">
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-4">
        <h1 className="text-white text-xl">iTECify Workspace</h1>
        <span className="ml-4 text-slate-400">|</span>
        <span className="ml-4 text-slate-300">{project.name}</span>
        <span className="ml-4 text-slate-500">User: {currentUser.name}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-2xl mb-4">Workspace Ready</p>
          <p className="text-slate-400">Session ID: {sessionId}</p>
          <p className="text-slate-400">User ID: {currentUser.id}</p>
        </div>
      </div>
    </div>
  );
}
