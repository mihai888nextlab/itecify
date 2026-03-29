'use client';

import React, { useState } from 'react';
import { CheckCircle, X, Edit2, Sparkles, ArrowRight } from 'lucide-react';

interface ChangedLine {
  lineNumber: number;
  original: string;
  fixed: string;
}

interface AICopilotSuggestion {
  id: string;
  fixedCode: string;
  changes: ChangedLine[];
  intent: string;
}

interface SuggestionBlockProps {
  suggestion: AICopilotSuggestion | null;
  onAccept: () => void;
  onReject: () => void;
  onModify: (code: string) => void;
}

const C = {
  purple: '#a855f7',
  green: '#22c55e',
  red: '#ef4444',
  card: '#1e1e1e',
  bg: '#0d1117',
  border: '#333',
  muted: '#666',
  text: '#f1f5f9',
};

export function SuggestionBlock({ suggestion, onAccept, onReject, onModify }: SuggestionBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState('');

  if (!suggestion) return null;

  const handleModify = () => {
    setEditedCode(suggestion.fixedCode);
    setIsEditing(true);
  };

  const handleSaveModify = () => {
    onModify(editedCode);
    setIsEditing(false);
  };

  const handleCancelModify = () => {
    setIsEditing(false);
    setEditedCode('');
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '14px 18px',
        backgroundColor: C.card,
        border: `1px solid ${C.purple}`,
        borderRadius: '14px',
        zIndex: 100,
        minWidth: '400px',
        maxWidth: '600px',
        boxShadow: `0 8px 40px rgba(168, 85, 247, 0.4), 0 0 0 1px rgba(168, 85, 247, 0.1)`,
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: `${C.purple}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={18} color={C.purple} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            AI Co-Pilot
          </div>
          <div style={{ fontSize: 11, color: C.purple, marginTop: 2 }}>
            {suggestion.intent}
          </div>
        </div>
        <div
          style={{
            padding: '3px 10px',
            backgroundColor: `${C.purple}20`,
            color: C.purple,
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {suggestion.changes.length} change{suggestion.changes.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div
        style={{
          backgroundColor: C.bg,
          borderRadius: 8,
          padding: 12,
          marginBottom: 14,
          border: `1px solid ${C.border}`,
          maxHeight: 200,
          overflow: 'auto',
        }}
      >
        {isEditing ? (
          <textarea
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
            style={{
              width: '100%',
              minHeight: 100,
              backgroundColor: 'transparent',
              border: 'none',
              color: C.purple,
              fontFamily: "'JetBrains Mono', 'Fragment Mono', monospace",
              fontSize: 12,
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
            }}
            autoFocus
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestion.changes.map((change, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: "'Fragment Mono', monospace" }}>
                  Line {change.lineNumber}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      backgroundColor: `${C.red}15`,
                      borderRadius: 4,
                      fontFamily: "'JetBrains Mono', 'Fragment Mono', monospace",
                      fontSize: 12,
                      color: C.red,
                      textDecoration: 'line-through',
                      opacity: 0.7,
                    }}
                  >
                    {change.original}
                  </div>
                  <ArrowRight size={14} color={C.muted} style={{ marginTop: 4, flexShrink: 0 }} />
                  <div
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      backgroundColor: `${C.green}15`,
                      borderRadius: 4,
                      fontFamily: "'JetBrains Mono', 'Fragment Mono', monospace",
                      fontSize: 12,
                      color: C.green,
                    }}
                  >
                    {change.fixed}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {isEditing ? (
          <>
            <button
              onClick={handleCancelModify}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                backgroundColor: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.muted,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleSaveModify}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                backgroundColor: C.purple,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <CheckCircle size={14} /> Apply
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onReject}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                backgroundColor: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.muted,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <X size={14} /> Dismiss
            </button>
            <button
              onClick={handleModify}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                backgroundColor: 'transparent',
                border: `1px solid ${C.purple}50`,
                borderRadius: 8,
                color: C.purple,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Edit2 size={14} /> Edit
            </button>
            <button
              onClick={onAccept}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                backgroundColor: C.green,
                border: 'none',
                borderRadius: 8,
                color: '#000',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: `0 2px 8px rgba(34, 197, 94, 0.3)`,
              }}
            >
              <CheckCircle size={14} /> Accept
            </button>
          </>
        )}
      </div>
    </div>
  );
}
