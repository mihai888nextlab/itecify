export declare function createTerminalSession(sessionId: string, cwd?: string): string;
export declare function executeCommand(sessionId: string, command: string, onOutput: (data: string, type: 'stdout' | 'stderr') => void, onClose: (exitCode: number) => void): void;
export declare function killProcess(sessionId: string): boolean;
export declare function changeDirectory(sessionId: string, newCwd: string): boolean;
export declare function getCwd(sessionId: string): string;
export declare function cleanupSession(sessionId: string): void;
//# sourceMappingURL=terminalService.d.ts.map