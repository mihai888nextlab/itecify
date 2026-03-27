import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Trash2, Copy, Download } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface TerminalProps {
  onCommand?: (command: string) => void;
  output?: string;
}

export function Terminal({ onCommand, output }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'stdout' | 'stderr'>('all');
  const { addToast } = useToast();
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (currentInput.trim()) {
      onCommand?.(currentInput.trim());
      setCommandHistory(prev => [...prev, currentInput]);
      setCurrentInput('');
      setHistoryIndex(-1);
    }
  }, [currentInput, onCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentInput('');
      }
    }
  }, [commandHistory, historyIndex]);

  const handleCopy = useCallback(() => {
    if (terminalRef.current) {
      const text = terminalRef.current.innerText;
      navigator.clipboard.writeText(text);
      addToast('success', 'Output copied to clipboard');
    }
  }, [addToast]);

  const handleDownload = useCallback(() => {
    if (terminalRef.current) {
      const text = terminalRef.current.innerText;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itecify-output-${Date.now()}.log`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'Output downloaded');
    }
  }, [addToast]);

  const handleClear = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.innerHTML = `
        <div class="text-cyan-400 mb-2">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
        <div class="text-cyan-400 font-bold mb-2">  iTECify Terminal v1.0</div>
        <div class="text-cyan-400 mb-4">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
        <div class="text-slate-500">Terminal cleared</div>
      `;
    }
  }, []);

  useEffect(() => {
    if (terminalRef.current && output) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-slate-400 font-mono ml-2">Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white"
            title="Copy"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white"
            title="Download"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white"
            title="Clear"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div 
        ref={terminalRef}
        className="flex-1 overflow-auto p-4 font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="text-cyan-400 mb-2">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
        <div className="text-cyan-400 font-bold mb-2">  iTECify Terminal v1.0</div>
        <div className="text-cyan-400 mb-4">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
        {output && output.split('\n').map((line, i) => {
          let className = 'text-slate-300';
          if (line.includes('Error') || line.includes('✗')) {
            className = 'text-red-400';
          } else if (line.includes('Warning') || line.includes('⚠')) {
            className = 'text-yellow-400';
          } else if (line.includes('✓') || line.includes('success')) {
            className = 'text-green-400';
          } else if (line.startsWith('$')) {
            className = 'text-blue-400';
          }
          return <div key={i} className={className}>{line}</div>;
        })}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center bg-slate-800 border-t border-slate-700 px-4 py-2">
        <span className="text-blue-400 mr-2">$</span>
        <input
          ref={inputRef}
          type="text"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-slate-200 outline-none font-mono text-sm"
          placeholder="Type a command..."
          autoFocus
        />
      </form>
    </div>
  );
}
