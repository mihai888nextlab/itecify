'use client';

import React, { useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useEditorStore } from '@/stores/editorStore';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Play, Square, Copy, ExternalLink, Settings, ChevronRight, Zap } from 'lucide-react';

const C = {
  bg: '#09090C',
  surface: '#0E0E13',
  card: '#13131A',
  border: '#222230',
  text: '#E8E8F0',
  muted: '#4A4A60',
  cyan: '#00E5CC',
  green: '#39FF7A',
  orange: '#FF7A3D',
  ana: '#FF4C8E',
  radu: '#4CF0FF',
  ai: '#FFD700',
};

const FILE_TABS = [
  { id: 'py', label: 'main.py', color: '#4C8EFF' },
  { id: 'ts', label: 'api.ts', color: '#00E5CC' },
  { id: 'docker', label: 'Dockerfile', color: '#FF7A3D' },
];

interface HeaderProps {
  projectName?: string;
  onRun: () => void;
  onStop: () => void;
  onShare: () => void;
  onSettings: () => void;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  users?: Array<{ id: string; name: string; color: string; role: string }>;
}

export function Header({ 
  projectName = 'sandbox', 
  onRun, 
  onStop, 
  onShare, 
  onSettings,
  activeTab = 'py',
  onTabChange,
  users = [] 
}: HeaderProps) {
  const [isRunning, setIsRunning] = useState(false);
  const { currentUser } = useSessionStore();

  const handleRun = () => {
    if (isRunning) {
      setIsRunning(false);
      onStop();
    } else {
      setIsRunning(true);
      onRun();
    }
  };

  const displayUsers = users.length > 0 ? users.slice(0, 4) : (currentUser ? [{ ...currentUser, role: 'human' }] : []);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      padding: '0 16px',
      height: 44,
      flexShrink: 0,
      zIndex: 100,
    }}>
      <div style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        marginRight: 20,
        color: C.text,
      }}>
        iTEC<span style={{ color: C.cyan }}>ify</span>
      </div>

      <div style={{ display: 'flex', gap: 2, flex: 1, height: '100%' }}>
        {FILE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '0 14px',
              height: '100%',
              fontFamily: "'Fragment Mono', monospace",
              fontSize: 12,
              color: activeTab === tab.id ? C.text : C.muted,
              background: activeTab === tab.id ? C.bg : 'transparent',
              border: 'none',
              borderRight: `1px solid ${C.border}`,
              position: 'relative',
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: tab.color, flexShrink: 0 }} />
            {tab.label}
            {activeTab === tab.id && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
                background: C.cyan,
              }} />
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
        <div style={{ display: 'flex' }}>
          {displayUsers.map((u, i) => (
            <div
              key={u.id}
              title={u.name}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: u.color,
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "'Syne', sans-serif",
                border: `2px solid ${C.bg}`,
                marginLeft: i === 0 ? 0 : -6,
                position: 'relative',
                zIndex: displayUsers.length - i,
              }}
            >
              {u.role === 'ai' ? (
                <Zap size={11} color="#000" />
              ) : (
                u.name.charAt(0).toUpperCase()
              )}
            </div>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: C.border }} />

        <IconButton title="Share" onClick={onShare}>
          <Copy size={14} />
        </IconButton>
        <IconButton title="External preview">
          <ExternalLink size={14} />
        </IconButton>
        <IconButton title="Settings" onClick={onSettings}>
          <Settings size={14} />
        </IconButton>

        <button
          onClick={handleRun}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: isRunning ? C.orange : C.green,
            border: 'none',
            borderRadius: 7,
            padding: '0 14px',
            height: 30,
            fontFamily: "'Syne', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            color: '#000',
            letterSpacing: '.02em',
            cursor: 'pointer',
            boxShadow: isRunning ? `0 0 16px ${C.orange}50` : `0 0 16px ${C.green}40`,
            transition: 'all .15s',
          }}
        >
          {isRunning ? <Square size={13} /> : <Play size={13} />}
          {isRunning ? 'Stop' : 'Run'}
        </button>
      </div>
    </header>
  );
}

interface IconButtonProps {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}

function IconButton({ children, title, onClick }: IconButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 30,
        height: 30,
        borderRadius: 7,
        background: C.card,
        border: `1px solid ${isHovered ? '#2A2A3A' : C.border}`,
        color: isHovered ? C.text : C.muted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  );
}

export default Header;
