import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Trash2, Copy, Download, Filter } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onCommand?: (command: string) => void;
  output?: string;
}

export function Terminal({ onCommand, output }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [filter, setFilter] = useState<'all' | 'stdout' | 'stderr'>('all');
  const { addToast } = useToast();

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const xterm = new XTerminal({
      theme: {
        background: '#0d1117',
        foreground: '#f1f5f9',
        cursor: '#3b82f6',
        cursorAccent: '#0d1117',
        selectionBackground: 'rgba(59, 130, 246, 0.3)',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#f1f5f9',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#ffffff',
      },
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    xterm.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    xterm.writeln('\x1b[1;36m  iTECify Terminal v1.0\x1b[0m');
    xterm.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    xterm.writeln('');
    xterm.writeln('\x1b[90mReady for commands. Press Enter to execute.\x1b[0m');
    xterm.writeln('');

    let currentLine = '';
    xterm.onData((data) => {
      const code = data.charCodeAt(0);

      if (code === 13) {
        xterm.writeln('');
        if (currentLine.trim()) {
          onCommand?.(currentLine.trim());
        }
        currentLine = '';
      } else if (code === 127) {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          xterm.write('\b \b');
        }
      } else if (code >= 32) {
        currentLine += data;
        xterm.write(data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [onCommand]);

  useEffect(() => {
    if (output && xtermRef.current) {
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.startsWith('[ERROR]') || line.startsWith('Error:')) {
          xtermRef.current?.writeln(`\x1b[31m${line}\x1b[0m`);
        } else if (line.startsWith('[WARN]')) {
          xtermRef.current?.writeln(`\x1b[33m${line}\x1b[0m`);
        } else {
          xtermRef.current?.writeln(line);
        }
      });
    }
  }, [output]);

  const handleClear = useCallback(() => {
    xtermRef.current?.clear();
    xtermRef.current?.writeln('\x1b[90mTerminal cleared\x1b[0m');
  }, []);

  const handleCopy = useCallback(() => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        addToast('success', 'Output copied to clipboard');
      }
    }
  }, [addToast]);

  const handleDownload = useCallback(() => {
    if (xtermRef.current) {
      const buffer = xtermRef.current.buffer.active;
      let output = '';
      for (let i = 0; i < buffer.length; i++) {
        output += buffer.getLine(i)?.translateToString() + '\n';
      }
      const blob = new Blob([output], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itecify-output-${Date.now()}.log`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'Output downloaded');
    }
  }, [addToast]);

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
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="appearance-none bg-slate-700 text-slate-300 text-xs px-2 py-1 pr-6 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="stdout">Stdout</option>
              <option value="stderr">Stderr</option>
            </select>
            <Filter size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
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
      <div ref={terminalRef} className="flex-1 terminal-gradient" />
    </div>
  );
}
