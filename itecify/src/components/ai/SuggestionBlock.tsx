'use client';

import React, { useState } from 'react';
import { CheckCircle, X, Edit2, Sparkles, Code2 } from 'lucide-react';
import type { Suggestion } from '@/contexts/AICopilotContext';

interface SuggestionBlockProps {
  suggestion: Suggestion | null;
  onAccept: () => void;
  onReject: () => void;
  onModify: (code: string) => void;
}

const C = {
  purple: '#a855f7',
  green: '#22c55e',
  card: '#1e1e1e',
  bg: '#0d1117',
  border: '#333',
  muted: '#666',
  text: '#f1f5f9',
};

const typeColors: Record<string, string> = {
  refactor: '#a855f7',
  optimize: '#22c55e',
  fix: '#ef4444',
  explain: '#3b82f6',
};

export function SuggestionBlock({ suggestion, onAccept, onReject, onModify }: SuggestionBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState('');

  if (!suggestion) return null;

  const handleModify = () => {
    setEditedCode(suggestion.code);
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
        minWidth: '320px',
        maxWidth: '500px',
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
            AI Suggestion
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {suggestion.intent}
          </div>
        </div>
        <div
          style={{
            padding: '3px 10px',
            backgroundColor: `${typeColors[suggestion.type] || C.purple}20`,
            color: typeColors[suggestion.type] || C.purple,
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {suggestion.type}
        </div>
      </div>

      <div
        style={{
          backgroundColor: C.bg,
          borderRadius: 8,
          padding: 12,
          marginBottom: 14,
          border: `1px solid ${C.border}`,
          maxHeight: 120,
          overflow: 'auto',
        }}
      >
        {isEditing ? (
          <textarea
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
            style={{
              width: '100%',
              minHeight: 80,
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
          <pre
            style={{
              margin: 0,
              color: C.purple,
              fontFamily: "'JetBrains Mono', 'Fragment Mono', monospace",
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {suggestion.code}
          </pre>
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
                transition: 'all 0.15s ease',
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
                transition: 'all 0.15s ease',
              }}
            >
              <CheckCircle size={14} /> Save
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
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.color = C.muted;
              }}
            >
              <X size={14} /> Reject
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
                transition: 'all 0.15s ease',
              }}
            >
              <Edit2 size={14} /> Modify
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
                transition: 'all 0.15s ease',
                boxShadow: `0 2px 8px rgba(34, 197, 94, 0.3)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.3)';
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
