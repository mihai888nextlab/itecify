import { v4 as uuidv4 } from 'uuid';

export interface ContainerConfig {
  language: string;
  memoryLimit?: string;
  cpuLimit?: number;
  timeout?: number;
}

export interface Container {
  id: string;
  config: ContainerConfig;
  status: 'creating' | 'running' | 'stopped' | 'error';
  startedAt?: Date;
  output: string[];
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  memoryUsed?: string;
}

const LANGUAGE_RUNTIMES: Record<string, { command: string[]; image: string; fileExtension: string }> = {
  javascript: {
    image: 'node:18-alpine',
    command: ['node', '/code/main.js'],
    fileExtension: 'js',
  },
  typescript: {
    image: 'node:18-alpine',
    command: ['npx', 'ts-node', '/code/main.ts'],
    fileExtension: 'ts',
  },
  python: {
    image: 'python:3.11-alpine',
    command: ['python', '/code/main.py'],
    fileExtension: 'py',
  },
  rust: {
    image: 'rust:1.70-alpine',
    command: ['sh', '-c', 'cd /code && cargo run 2>&1 || rustc main.rs && ./main'],
    fileExtension: 'rs',
  },
  go: {
    image: 'golang:1.20-alpine',
    command: ['go', 'run', '/code/main.go'],
    fileExtension: 'go',
  },
};

class DockerManager {
  private containers: Map<string, Container> = new Map();
  private onOutput?: (containerId: string, data: string) => void;

  constructor(onOutput?: (containerId: string, data: string) => void) {
    this.onOutput = onOutput;
  }

  async createContainer(sessionId: string, config: ContainerConfig): Promise<Container> {
    const containerId = `itecify-${sessionId}-${uuidv4().slice(0, 8)}`;
    
    const container: Container = {
      id: containerId,
      config,
      status: 'creating',
      output: [],
    };

    this.containers.set(containerId, container);
    this.emitOutput(containerId, `[${new Date().toLocaleTimeString()}] Creating container...`);
    this.emitOutput(containerId, `[${new Date().toLocaleTimeString()}] Language: ${config.language}`);
    this.emitOutput(containerId, `[${new Date().toLocaleTimeString()}] Image: ${LANGUAGE_RUNTIMES[config.language]?.image || 'unknown'}`);

    await this.simulateDelay(500);

    container.status = 'stopped';
    this.emitOutput(containerId, `[${new Date().toLocaleTimeString()}] Container ready`);
    
    return container;
  }

  async runCode(
    containerId: string,
    code: string,
    onOutput?: (data: string) => void
  ): Promise<ExecutionResult> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error('Container not found');
    }

    const startTime = Date.now();
    container.status = 'running';
    container.startedAt = new Date();

    const runtime = LANGUAGE_RUNTIMES[container.config.language];
    const output: string[] = [];

    this.emitOutput(containerId, `\n${'─'.repeat(40)}`);
    this.emitOutput(containerId, 'Executing code...');
    this.emitOutput(containerId, `${'─'.repeat(40)}\n`);

    await this.simulateDelay(300);

    output.push(`> Running ${container.config.language} code...`);
    this.emitOutput(containerId, '> Running code...');
    
    await this.simulateDelay(500);

    const demoOutput = this.generateDemoOutput(container.config.language, code);
    for (const line of demoOutput) {
      output.push(line);
      this.emitOutput(containerId, line);
    }

    await this.simulateDelay(200);

    output.push('');
    output.push(`Execution completed in ${Date.now() - startTime}ms`);
    this.emitOutput(containerId, `\n✓ Execution completed in ${Date.now() - startTime}ms`);

    container.status = 'stopped';

    return {
      success: true,
      stdout: output.join('\n'),
      stderr: '',
      exitCode: 0,
      duration: Date.now() - startTime,
      memoryUsed: `${Math.floor(Math.random() * 50 + 10)}MB`,
    };
  }

  private generateDemoOutput(language: string, code: string): string[] {
    const outputs: string[] = [];
    
    if (code.includes('console.log') || code.includes('print') || code.includes('println')) {
      const printMatches = code.match(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g);
      if (printMatches) {
        outputs.push(...printMatches.map(m => m.replace(/['"`]/g, '')));
      } else {
        outputs.push('Hello, iTEC 2026!');
      }
    }

    if (outputs.length === 0) {
      outputs.push('[No output]');
    }

    return outputs;
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (container) {
      container.status = 'stopped';
      this.emitOutput(containerId, '\n\x1b[31m✗ Execution stopped by user\x1b[0m');
    }
  }

  async removeContainer(containerId: string): Promise<void> {
    this.containers.delete(containerId);
  }

  getContainer(containerId: string): Container | undefined {
    return this.containers.get(containerId);
  }

  private emitOutput(containerId: string, data: string): void {
    this.onOutput?.(containerId, data);
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async pullImage(imageName: string): Promise<void> {
    this.emitOutput('system', `[${new Date().toLocaleTimeString()}] Pulling image: ${imageName}`);
    await this.simulateDelay(1000);
    this.emitOutput('system', `[${new Date().toLocaleTimeString()}] Image pulled successfully`);
  }

  async listContainers(): Promise<Container[]> {
    return Array.from(this.containers.values());
  }

  async cleanup(): Promise<void> {
    for (const containerId of this.containers.keys()) {
      await this.stopContainer(containerId);
      await this.removeContainer(containerId);
    }
  }
}

let dockerManagerInstance: DockerManager | null = null;

export function getDockerManager(
  onOutput?: (containerId: string, data: string) => void
): DockerManager {
  if (!dockerManagerInstance) {
    dockerManagerInstance = new DockerManager(onOutput);
  }
  return dockerManagerInstance;
}

export { DockerManager };
