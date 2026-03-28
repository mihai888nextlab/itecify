import { spawn } from 'child_process';
import { Writable } from 'stream';

interface TerminalSession {
  id: string;
  cwd: string;
  process: any;
}

const sessions = new Map<string, TerminalSession>();

export function createTerminalSession(sessionId: string, cwd: string = process.cwd()): string {
  if (sessions.has(sessionId)) {
    return sessionId;
  }
  
  sessions.set(sessionId, {
    id: sessionId,
    cwd,
    process: null,
  });
  
  return sessionId;
}

export function executeCommand(
  sessionId: string,
  command: string,
  onOutput: (data: string, type: 'stdout' | 'stderr') => void,
  onClose: (exitCode: number) => void
): void {
  const session = sessions.get(sessionId);
  if (!session) {
    createTerminalSession(sessionId);
  }

  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd.exe' : '/bin/bash';
  const shellArgs = isWindows 
    ? ['/c', command] 
    : ['-c', command];

  const proc = spawn(shell, shellArgs, {
    cwd: session?.cwd || process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  if (session) {
    session.process = proc;
  }

  proc.stdout?.on('data', (data: Buffer) => {
    onOutput(data.toString(), 'stdout');
  });

  proc.stderr?.on('data', (data: Buffer) => {
    onOutput(data.toString(), 'stderr');
  });

  proc.on('close', (code) => {
    onOutput(`\n[Process exited with code ${code}]\n`, 'stdout');
    onClose(code ?? 0);
    if (session) {
      session.process = null;
    }
  });

  proc.on('error', (err) => {
    onOutput(`\n[Error: ${err.message}]\n`, 'stderr');
    onClose(-1);
  });
}

export function killProcess(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (session?.process) {
    session.process.kill('SIGTERM');
    session.process = null;
    return true;
  }
  return false;
}

export function changeDirectory(sessionId: string, newCwd: string): boolean {
  const session = sessions.get(sessionId);
  if (session) {
    session.cwd = newCwd;
    return true;
  }
  return false;
}

export function getCwd(sessionId: string): string {
  const session = sessions.get(sessionId);
  return session?.cwd || process.cwd();
}

export function cleanupSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session?.process) {
    session.process.kill('SIGTERM');
  }
  sessions.delete(sessionId);
}
