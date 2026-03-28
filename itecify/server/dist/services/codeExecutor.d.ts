interface ExecutionResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTime: number;
    error?: string;
}
export declare function executeCode(code: string, language: string): Promise<ExecutionResult>;
export {};
//# sourceMappingURL=codeExecutor.d.ts.map