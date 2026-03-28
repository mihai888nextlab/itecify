import { spawn } from 'child_process';
const sessions = new Map();
export function createTerminalSession(sessionId, cwd = process.cwd()) {
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
export function executeCommand(sessionId, command, onOutput, onClose) {
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
    proc.stdout?.on('data', (data) => {
        onOutput(data.toString(), 'stdout');
    });
    proc.stderr?.on('data', (data) => {
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
export function killProcess(sessionId) {
    const session = sessions.get(sessionId);
    if (session?.process) {
        session.process.kill('SIGTERM');
        session.process = null;
        return true;
    }
    return false;
}
export function changeDirectory(sessionId, newCwd) {
    const session = sessions.get(sessionId);
    if (session) {
        session.cwd = newCwd;
        return true;
    }
    return false;
}
export function getCwd(sessionId) {
    const session = sessions.get(sessionId);
    return session?.cwd || process.cwd();
}
export function cleanupSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session?.process) {
        session.process.kill('SIGTERM');
    }
    sessions.delete(sessionId);
}
//# sourceMappingURL=terminalService.js.map