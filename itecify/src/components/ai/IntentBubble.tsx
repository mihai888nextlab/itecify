'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

interface IntentBubbleProps {
  intent: string;
  isVisible: boolean;
  explanation?: string;
  position?: { x: number; y: number };
}

const C = {
  purple: '#a855f7',
  card: '#1e1e1e',
  bg: '#0d1117',
  text: '#f1f5f9',
  muted: '#94a3b8',
};

export function IntentBubble({ intent, isVisible, explanation, position }: IntentBubbleProps) {
  if (!isVisible || !intent) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: position?.x || '50%',
        top: position?.y ? position.y - 40 : 60,
        transform: position?.x ? 'none' : 'translateX(-50%)',
        padding: '8px 16px',
        backgroundColor: C.card,
        border: `1px solid ${C.purple}`,
        borderRadius: '10px',
        color: C.text,
        fontSize: '12px',
        fontFamily: "'Fragment Mono', monospace",
        zIndex: 100,
        boxShadow: `0 4px 20px rgba(168, 85, 247, 0.4), 0 0 0 1px rgba(168, 85, 247, 0.1)`,
        animation: 'floatIn 0.3s ease-out',
        maxWidth: 400,
      }}
    >
      <style>{`
        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={14} color={C.purple} style={{ animation: intent.includes('Analyzing') ? 'pulse 1.5s infinite' : undefined }} />
        <span style={{ fontWeight: 500, color: C.purple }}>{intent}</span>
        {intent.includes('Analyzing') && (
          <span style={{ color: C.purple, opacity: 0.8 }}>
            <span style={{ animation: 'dots 1.5s infinite' }}>...</span>
          </span>
        )}
      </div>
      {explanation && (
        <div style={{ marginTop: 4, color: C.muted, fontSize: 11 }}>
          {explanation}
        </div>
      )}
    </div>
  );
}
