'use client';

import React from 'react';
import {
  Terminal, Clock, MessageSquare, Shield,
  Hash, Send, RefreshCw, AlertTriangle, AlertCircle, CheckCircle,
  Circle, Shield as ShieldIcon,
} from 'lucide-react';

const C = {
  bg: '#09090C',
  surface: '#0E0E13',
  card: '#13131A',
  border: '#222230',
  border2: '#2A2A3A',
  text: '#E8E8F0',
  muted: '#4A4A60',
  subtle: '#1A1A24',
  blue: '#4C8EFF',
  cyan: '#00E5CC',
  green: '#39FF7A',
  yellow: '#FFD700',
  red: '#FF4466',
  ana: '#FF4C8E',
  radu: '#4CF0FF',
  ai: '#FFD700',
};

const PANEL_TABS = [
  { id: 'terminal', label: 'Terminal', icon: <Terminal size={11} /> },
  { id: 'timeline', label: 'Timeline', icon: <Clock size={11} /> },
  { id: 'chat', label: 'Chat', icon: <MessageSquare size={11} /> },
  { id: 'security', label: 'Security', icon: <ShieldIcon size={11} /> },
];

const TL_EVENTS = [
  { label: 'Ana init', color: C.ana },
  { label: 'Radu routes', color: C.radu },
  { label: 'AI block 1', color: C.ai },
  { label: 'First run', color: C.green },
  { label: 'AI block 2', color: C.ai },
  { label: 'Error', color: C.red },
  { label: 'Fixed', color: C.green },
];

const VULNS = [
  { level: 'HIGH', desc: 'Subprocess shell=True allows command injection', file: 'main.py : line 23' },
  { level: 'MED', desc: 'Hardcoded secret key detected in source', file: 'api.ts : line 8' },
  { level: 'LOW', desc: 'Missing input validation on /execute route', file: 'main.py : line 47' },
];

interface RightPanelProps {
  termLines: Array<{ type: string; text: string }>;
  termInput: string;
  onTermInputChange: (value: string) => void;
  onTermCmd: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  cpuPct: number;
  memPct: number;
  chatMsgs: Array<{ from: string; text: string; time: string }>;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onChat: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  tlPct: number;
  onScrubTl: (e: React.MouseEvent<HTMLDivElement>) => void;
  securityScore: number;
  activePanel: string;
  onPanelChange: (panel: string) => void;
  hoveredPanel: string | null;
  onPanelHover: (panel: string | null) => void;
}

export function RightPanel({
  termLines,
  termInput,
  onTermInputChange,
  onTermCmd,
  cpuPct,
  memPct,
  chatMsgs,
  chatInput,
  onChatInputChange,
  onChat,
  tlPct,
  onScrubTl,
  securityScore,
  activePanel,
  onPanelChange,
  hoveredPanel,
  onPanelHover,
}: RightPanelProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderLeft: `1px solid ${C.border}`,
      overflow: 'hidden',
      background: C.surface,
      width: 280,
    }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {PANEL_TABS.map(tab => (
          <PanelTab
            key={tab.id}
            tab={tab}
            active={activePanel === tab.id}
            onClick={() => onPanelChange(tab.id)}
            hovered={hoveredPanel === tab.id}
            onHover={onPanelHover}
          />
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {activePanel === 'terminal' && (
          <TerminalPanel
            termLines={termLines}
            termInput={termInput}
            onTermInputChange={onTermInputChange}
            onTermCmd={onTermCmd}
            cpuPct={cpuPct}
            memPct={memPct}
          />
        )}
        {activePanel === 'timeline' && (
          <TimelinePanel tlPct={tlPct} onScrubTl={onScrubTl} />
        )}
        {activePanel === 'chat' && (
          <ChatPanel
            chatMsgs={chatMsgs}
            chatInput={chatInput}
            onChatInputChange={onChatInputChange}
            onChat={onChat}
          />
        )}
        {activePanel === 'security' && (
          <SecurityPanel securityScore={securityScore} />
        )}
      </div>
    </div>
  );
}

function PanelTab({ tab, active, onClick, hovered, onHover }: {
  tab: { id: string; label: string; icon: React.ReactNode };
  active: boolean;
  onClick: () => void;
  hovered: boolean | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover(tab.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        flex: 1,
        padding: '10px 0',
        fontFamily: "'Fragment Mono', monospace",
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        color: active ? C.text : hovered ? C.text : C.muted,
        borderBottom: `2px solid ${active ? C.cyan : 'transparent'}`,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'all .15s',
      }}
    >
      {tab.icon}
      {tab.label}
    </button>
  );
}

function TerminalPanel({
  termLines,
  termInput,
  onTermInputChange,
  onTermCmd,
  cpuPct,
  memPct,
}: {
  termLines: Array<{ type: string; text: string }>;
  termInput: string;
  onTermInputChange: (value: string) => void;
  onTermCmd: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  cpuPct: number;
  memPct: number;
}) {
  const termRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [termLines]);

  const termColors: Record<string, string> = {
    prompt: C.cyan,
    cmd: C.text,
    out: '#666680',
    ok: C.green,
    err: C.red,
    info: C.yellow,
  };

  return (
    <div>
      <div
        ref={termRef}
        style={{
          background: '#050508',
          borderRadius: 8,
          padding: 12,
          height: 200,
          overflowY: 'auto',
          marginBottom: 10,
          fontFamily: "'Fragment Mono', monospace",
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        {termLines.map((line, i) => (
          <div key={i} style={{ color: termColors[line.type] || C.text, marginBottom: 2 }}>
            {line.text}
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#050508',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: '8px 12px',
      }}>
        <Hash size={12} color={C.cyan} />
        <input
          value={termInput}
          onChange={e => onTermInputChange(e.target.value)}
          onKeyDown={onTermCmd}
          placeholder="Enter command…"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: C.text,
            fontFamily: "'Fragment Mono', monospace",
            fontSize: 12,
          }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <Label>Resources</Label>
        <ResourceBar label="CPU" val={`${Math.round(cpuPct)}%`} pct={cpuPct} color={C.blue} />
        <ResourceBar label="Memory" val={`${Math.round(memPct * 5.12)} MB`} pct={memPct} color={C.cyan} />
        <ResourceBar label="Net" val="↑12KB/s ↓8KB/s" pct={18} color={C.green} />
      </div>
    </div>
  );
}

function TimelinePanel({ tlPct, onScrubTl }: { tlPct: number; onScrubTl: (e: React.MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div>
      <Label>Time-Travel Debugging</Label>
      <div style={{ fontFamily: "'Fragment Mono', monospace", fontSize: 10, color: C.muted, margin: '8px 0 6px' }}>
        Drag to replay · 47 snapshots
      </div>
      <div
        onClick={onScrubTl}
        style={{
          height: 32,
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          position: 'relative',
          cursor: 'pointer',
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        <div style={{
          height: '100%',
          width: `${tlPct}%`,
          background: `linear-gradient(90deg, ${C.blue}40, ${C.cyan}40)`,
          position: 'absolute',
          left: 0,
          top: 0,
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          left: `calc(${tlPct}% - 6px)`,
          width: 12,
          height: 24,
          background: C.cyan,
          borderRadius: 3,
          boxShadow: `0 0 8px ${C.cyan}80`,
          transition: 'left .05s',
        }} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {TL_EVENTS.map((ev, i) => (
          <button
            key={i}
            onClick={() => {}}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 20,
              background: C.card,
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: 10,
              fontFamily: "'Fragment Mono', monospace",
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            <Circle size={6} fill={ev.color} color={ev.color} />
            {ev.label}
          </button>
        ))}
      </div>
      <div style={{
        fontFamily: "'Fragment Mono', monospace",
        fontSize: 11,
        color: C.muted,
        lineHeight: 1.7,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '10px 12px',
      }}>
        Snapshot {Math.round(tlPct * 0.47)}/47 · 03:{String(Math.round(tlPct * 0.2)).padStart(2, '0')}:{String(Math.round(tlPct * 0.6) % 60).padStart(2, '0')}<br />
        Ana added sandbox route · +12 lines<br />
        Radu edited Dockerfile · +3 lines<br />
        AI generated auth middleware
      </div>
    </div>
  );
}

function ChatPanel({
  chatMsgs,
  chatInput,
  onChatInputChange,
  onChat,
}: {
  chatMsgs: Array<{ from: string; text: string; time: string }>;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onChat: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const chatRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMsgs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={chatRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', marginBottom: 10 }}>
        {chatMsgs.map((m, i) => <ChatMsg key={i} msg={m} />)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={chatInput}
          onChange={e => onChatInputChange(e.target.value)}
          onKeyDown={onChat}
          placeholder="Message…"
          style={{
            flex: 1,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '9px 12px',
            color: C.text,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={() => onChat({ key: 'Enter' } as any)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: C.blue,
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function ChatMsg({ msg }: { msg: { from: string; text: string; time: string } }) {
  const isUser = msg.from === 'ana';
  const isSystem = msg.from === 'system';
  const nameColors: Record<string, string> = { ana: C.ana, radu: C.radu, ai: C.yellow };
  const names: Record<string, string> = { ana: 'Ana', radu: 'Radu', ai: '✦ AI' };

  if (isSystem) return (
    <div style={{ textAlign: 'center' }}>
      <span style={{
        fontFamily: "'Fragment Mono', monospace",
        fontSize: 11,
        color: C.yellow,
        background: `rgba(255,215,0,.08)`,
        border: `1px solid rgba(255,215,0,.2)`,
        borderRadius: 6,
        padding: '4px 10px',
      }}>
        {msg.text}
      </span>
    </div>
  );

  return (
    <div className="fade-up" style={{
      display: 'flex',
      flexDirection: 'column',
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
      gap: 3,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: nameColors[msg.from] || C.muted, padding: '0 4px' }}>
        {names[msg.from] || msg.from}
      </div>
      <div style={{
        padding: '9px 13px',
        borderRadius: 10,
        fontSize: 13,
        lineHeight: 1.5,
        borderBottomLeftRadius: isUser ? 10 : 3,
        borderBottomRightRadius: isUser ? 3 : 10,
        background: isUser ? C.blue : C.card,
        border: `1px solid ${isUser ? 'transparent' : C.border}`,
        color: isUser ? '#fff' : C.text,
      }}>
        {msg.text}
      </div>
      <div style={{ fontFamily: "'Fragment Mono', monospace", fontSize: 9, color: C.muted, padding: '0 4px', textAlign: isUser ? 'right' : 'left' }}>
        {msg.time}
      </div>
    </div>
  );
}

function SecurityPanel({ securityScore }: { securityScore: number }) {
  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        marginBottom: 12,
      }}>
        <div>
          <Label>Security Score</Label>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>3 issues found</div>
        </div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.yellow }}>
          {securityScore}
        </div>
      </div>
      <Label style={{ marginBottom: 8 }}>Vulnerabilities</Label>
      {VULNS.map((v, i) => <VulnItem key={i} vuln={v} />)}
      <button
        style={{
          width: '100%',
          marginTop: 12,
          padding: '10px 14px',
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: C.text,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        <RefreshCw size={13} />
        Re-scan
      </button>
    </div>
  );
}

function VulnItem({ vuln }: { vuln: { level: string; desc: string; file: string } }) {
  const colors: Record<string, string> = { HIGH: C.red, MED: C.yellow, LOW: C.green };
  const icons: Record<string, React.ReactNode> = {
    HIGH: <AlertTriangle size={11} />,
    MED: <AlertCircle size={11} />,
    LOW: <CheckCircle size={11} />,
  };
  const color = colors[vuln.level];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '9px 12px',
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      marginBottom: 6,
    }}>
      <div style={{
        padding: '2px 7px',
        borderRadius: 4,
        background: `${color}20`,
        color,
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        marginTop: 2,
      }}>
        {icons[vuln.level]} {vuln.level}
      </div>
      <div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>{vuln.desc}</div>
        <div style={{ fontFamily: "'Fragment Mono', monospace", fontSize: 10, color: C.muted, marginTop: 2 }}>
          {vuln.file}
        </div>
      </div>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontFamily: "'Fragment Mono', monospace",
      fontSize: 9,
      color: C.muted,
      letterSpacing: '.12em',
      textTransform: 'uppercase' as const,
      marginBottom: 6,
      ...style,
    }}>
      {children}
    </div>
  );
}

function ResourceBar({ label, val, pct, color }: { label: string; val: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
        <span style={{ fontFamily: "'Fragment Mono', monospace", fontSize: 12, color: C.text }}>{val}</span>
      </div>
      <div style={{ height: 6, background: C.subtle, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

export default RightPanel;
