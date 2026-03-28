import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
const LANGUAGE_CONFIG = {
    javascript: {
        extension: 'js',
        command: ['node'],
        timeout: 10000,
    },
    python: {
        extension: 'py',
        command: ['python3'],
        timeout: 10000,
    },
    typescript: {
        extension: 'ts',
        command: ['npx', 'tsx'],
        timeout: 15000,
    },
};
export async function executeCode(code, language) {
    const config = LANGUAGE_CONFIG[language];
    if (!config) {
        return {
            success: false,
            stdout: '',
            stderr: '',
            exitCode: -1,
            executionTime: 0,
            error: `Language '${language}' is not supported. Supported: ${Object.keys(LANGUAGE_CONFIG).join(', ')}`,
        };
    }
    const tempDir = join('/tmp', `itecify-${randomUUID()}`);
    try {
        mkdirSync(tempDir, { recursive: true });
        const codeFile = join(tempDir, `main.${config.extension}`);
        createWriteStream(codeFile).write(code);
        const startTime = Date.now();
        const result = await new Promise((resolve, reject) => {
            const proc = spawn(config.command[0], [...config.command.slice(1), codeFile], {
                cwd: tempDir,
                timeout: config.timeout,
                killSignal: 'SIGKILL',
            });
            let stdout = '';
            let stderr = '';
            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            proc.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code ?? 0 });
            });
            proc.on('error', (err) => {
                reject(err);
            });
            setTimeout(() => {
                proc.kill('SIGKILL');
                reject(new Error(`Execution timed out after ${config.timeout / 1000} seconds`));
            }, config.timeout);
        });
        const executionTime = Date.now() - startTime;
        return {
            success: result.exitCode === 0,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            executionTime,
        };
    }
    catch (error) {
        return {
            success: false,
            stdout: '',
            stderr: '',
            exitCode: -1,
            executionTime: 0,
            error: error.message,
        };
    }
    finally {
        try {
            if (existsSync(tempDir)) {
                rmSync(tempDir, { recursive: true, force: true });
            }
        }
        catch {
            // Ignore cleanup errors
        }
    }
}
//# sourceMappingURL=codeExecutor.js.map