import React, { useState } from 'react';
import { X, ExternalLink, Maximize2 } from 'lucide-react';

interface PreviewPanelProps {
  htmlContent: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PreviewPanel({ htmlContent, isOpen, onClose }: PreviewPanelProps) {
  const [key, setKey] = useState(0);

  const handleOpenExternal = () => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 44,
      right: 0,
      bottom: 0,
      width: '50%',
      minWidth: 400,
      backgroundColor: '#fff',
      borderLeft: '1px solid #222230',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: '#1a1a24',
        borderBottom: '1px solid #222230',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExternalLink size={14} color="#00E5CC" />
          <span style={{
            fontSize: 12,
            fontFamily: "'Fragment Mono', monospace",
            color: '#E8E8F0',
          }}>
            Preview
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleOpenExternal}
            style={{
              padding: 4,
              background: 'transparent',
              border: 'none',
              color: '#4A4A60',
              cursor: 'pointer',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Open in new tab"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={onClose}
            style={{
              padding: 4,
              background: 'transparent',
              border: 'none',
              color: '#4A4A60',
              cursor: 'pointer',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Close preview"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <iframe
        key={key}
        title="HTML Preview"
        srcDoc={htmlContent}
        style={{
          flex: 1,
          border: 'none',
          backgroundColor: '#fff',
        }}
        sandbox="allow-scripts"
      />
    </div>
  );
}
