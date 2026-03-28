import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

export interface ContainerConfig {
  projectId: string;
  image: string;
  name: string;
  port?: number;
}

export interface Container {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  image: string;
  projectId: string;
}

const containers = new Map<string, Container>();
const pendingCreations = new Map<string, Promise<Container>>();

export const DOCKER_IMAGES = [
  { id: 'node:20', name: 'Node.js 20', description: 'Latest Node.js LTS' },
  { id: 'node:18', name: 'Node.js 18', description: 'Node.js 18 LTS' },
  { id: 'python:3.12', name: 'Python 3.12', description: 'Latest Python' },
  { id: 'python:3.11', name: 'Python 3.11', description: 'Python 3.11' },
  { id: 'ubuntu:22.04', name: 'Ubuntu 22.04', description: 'Ubuntu with full tools' },
  { id: 'golang:1.22', name: 'Go 1.22', description: 'Go programming language' },
];

export async function createContainer(config: ContainerConfig): Promise<Container> {
  const containerName = `itecify-${config.projectId}`;
  
  // Check if already creating
  const existingPromise = pendingCreations.get(config.projectId);
  if (existingPromise) {
    console.log(`[DockerService] Container creation already in progress for ${config.projectId}`);
    return existingPromise;
  }
  
  // Check if already exists
  const existingContainer = containers.get(config.projectId);
  if (existingContainer) {
    console.log(`[DockerService] Container already exists for ${config.projectId}`);
    return existingContainer;
  }
  
  // Create promise and store it
  const creationPromise = (async () => {
    try {
      // Remove existing container if any
      await execAsync(`docker rm -f ${containerName}`).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const workdir = `/workspace/${config.projectId}`;
      
      // Use docker run -d to keep container running in background
      const { stdout } = await execAsync(
        `docker run -d --name ${containerName} -w ${workdir} ${config.image} tail -f /dev/null`
      );
      
      const containerId = stdout.trim();
      
      console.log(`[DockerService] Created container ${containerName} with ID ${containerId}`);
      
      const container: Container = {
        id: containerId,
        name: containerName,
        status: 'running',
        image: config.image,
        projectId: config.projectId,
      };
      
      containers.set(config.projectId, container);
      
      return container;
    } catch (error: any) {
      console.error('Failed to create container:', error);
      throw new Error(`Failed to create container: ${error.message}`);
    } finally {
      pendingCreations.delete(config.projectId);
    }
  })();
  
  pendingCreations.set(config.projectId, creationPromise);
  return creationPromise;
}

export async function startContainer(projectId: string): Promise<Container> {
  const container = containers.get(projectId);
  if (!container) {
    throw new Error('Container not found');
  }
  
  try {
    console.log(`[DockerService] Starting container ${container.name}`);
    await execAsync(`docker start ${container.name}`);
    container.status = 'running';
    containers.set(projectId, container);
    return container;
  } catch (error: any) {
    console.error(`[DockerService] Failed to start container ${container.name}:`, error.message);
    throw new Error(`Failed to start container: ${error.message}`);
  }
}

export async function stopContainer(projectId: string): Promise<void> {
  const container = containers.get(projectId);
  if (!container) return;
  
  try {
    await execAsync(`docker stop ${container.name}`).catch(() => {});
    container.status = 'stopped';
    containers.set(projectId, container);
  } catch (error: any) {
    console.error('Failed to stop container:', error);
  }
}

export async function removeContainer(projectId: string): Promise<void> {
  const container = containers.get(projectId);
  if (!container) return;
  
  try {
    await execAsync(`docker rm -f ${container.name}`).catch(() => {});
    containers.delete(projectId);
  } catch (error: any) {
    console.error('Failed to remove container:', error);
  }
}

export async function executeInContainer(
  projectId: string,
  command: string,
  workdir?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const container = containers.get(projectId);
  if (!container) {
    throw new Error(`Container not found for project ${projectId}`);
  }
  if (container.status !== 'running') {
    throw new Error(`Container ${container.name} is not running (status: ${container.status})`);
  }
  
  const workDir = workdir || `/workspace/${projectId}`;
  
  console.log(`[DockerService] Executing: docker exec -w ${workDir} ${container.name} ${command}`);
  
  try {
    const fullCommand = `docker exec -w ${workDir} ${container.name} ${command}`;
    const { stdout, stderr } = await execAsync(fullCommand, { timeout: 60000 }); // Increased timeout for npm
    console.log(`[DockerService] Command stdout: ${stdout.substring(0, 500)}`);
    console.log(`[DockerService] Command stderr: ${stderr.substring(0, 500)}`);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    console.error(`[DockerService] Command failed:`, error.message);
    if (error.stdout) {
      console.log(`[DockerService] Error stdout: ${error.stdout.substring(0, 500)}`);
      return {
        stdout: error.stdout,
        stderr: error.stderr || '',
        exitCode: error.code || 1
      };
    }
    throw new Error(`Command failed: ${error.message}`);
  }
}

export async function listContainerFiles(
  projectId: string,
  dirPath?: string
): Promise<{ name: string; type: 'file' | 'directory' }[]> {
  const container = containers.get(projectId);
  if (!container) {
    throw new Error(`Container not found for project ${projectId}`);
  }
  
  const workDir = dirPath || `/workspace/${projectId}`;
  
  try {
    // Use ls -la to list files
    const { stdout } = await execAsync(
      `docker exec ${container.name} ls -la ${workDir} 2>/dev/null || echo ""`
    );
    
    const files: { name: string; type: 'file' | 'directory' }[] = [];
    const lines = stdout.split('\n').filter(Boolean);
    
    for (const line of lines) {
      if (line.startsWith('total') || line.includes(' . ') || line.includes(' .. ')) {
        continue;
      }
      
      const parts = line.split(/\s+/);
      const filename = parts[parts.length - 1];
      
      if (!filename || filename.endsWith('/')) {
        continue;
      }
      
      files.push({
        name: filename,
        type: line.startsWith('d') ? 'directory' : 'file',
      });
    }
    
    return files;
  } catch (error: any) {
    console.error(`[DockerService] Failed to list files:`, error.message);
    return [];
  }
}

export async function readContainerFile(
  projectId: string,
  filePath: string
): Promise<string> {
  const container = containers.get(projectId);
  if (!container) {
    throw new Error(`Container not found for project ${projectId}`);
  }
  
  try {
    const { stdout } = await execAsync(
      `docker exec ${container.name} cat ${filePath} 2>/dev/null`
    );
    return stdout;
  } catch (error: any) {
    console.error(`[DockerService] Failed to read file ${filePath}:`, error.message);
    return '';
  }
}

export async function readAllContainerFiles(
  projectId: string
): Promise<{ name: string; content: string; path: string }[]> {
  const container = containers.get(projectId);
  if (!container) {
    throw new Error(`Container not found for project ${projectId}`);
  }
  
  const workDir = `/workspace/${projectId}`;
  
  try {
    // Check what's in /workspace first
    const { stdout: wsList } = await execAsync(
      `docker exec ${container.name} ls -la /workspace 2>&1 || echo "DIR_NOT_FOUND"`
    );
    console.log(`[DockerService] Contents of /workspace:`, wsList);
    
    // Check if workDir exists
    const { stdout: dirCheck } = await execAsync(
      `docker exec ${container.name} ls -la "${workDir}" 2>&1 || echo "SUBDIR_NOT_FOUND"`
    );
    console.log(`[DockerService] Contents of ${workDir}:`, dirCheck);
    
    // If /workspace only has the project dir, check the project dir directly
    const { stdout: fileList } = await execAsync(
      `docker exec ${container.name} ls -1a "${workDir}" 2>&1 || echo ""`
    );
    
    console.log(`[DockerService] ls -1a output for ${workDir}:`, JSON.stringify(fileList));
    
    const files: { name: string; content: string; path: string }[] = [];
    
    // Parse file list - ls -1a gives all filenames including hidden
    const filenames = fileList.split('\n').map(f => f.trim()).filter(f => f && f !== '.' && f !== '..');
    
    console.log(`[DockerService] Parsed filenames:`, filenames);
    
    for (const filename of filenames) {
      // Skip node_modules - too many files, don't sync them
      if (filename === 'node_modules' || filename.endsWith('/node_modules')) {
        console.log(`[DockerService] Skipping node_modules`);
        continue;
      }
      
      const filePath = `${workDir}/${filename}`;
      const tempPath = `/tmp/itecify-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      try {
        // Use docker cp to copy file from container to host temp, then read it
        const copyCmd = `docker cp ${container.name}:${filePath} "${tempPath}"`;
        await execAsync(copyCmd, { timeout: 5000 });
        
        // Read the temp file
        const fs = await import('fs');
        const content = fs.readFileSync(tempPath, 'utf8');
        
        // Delete temp file
        fs.unlinkSync(tempPath);
        
        console.log(`[DockerService] Read ${filename}: length = ${content.length}`);
        
        files.push({
          name: filename,
          path: filename,
          content: content,
        });
      } catch (err: any) {
        console.log(`[DockerService] Failed to read file ${filename}:`, err.message);
      }
    }
    
    console.log(`[DockerService] Read ${files.length} files from container:`, files.map(f => f.name));
    return files;
  } catch (error: any) {
    console.error(`[DockerService] Failed to read all files:`, error.message);
    return [];
  }
}

export async function copyFilesToContainer(
  projectId: string,
  files: { name: string; content: string }[]
): Promise<void> {
  const container = containers.get(projectId);
  if (!container) {
    console.error('copyFilesToContainer: Container not found for projectId:', projectId);
    console.error('Available containers:', Array.from(containers.keys()));
    throw new Error('Container not found');
  }
  
  const workDir = `/workspace/${projectId}`;
  
  console.log(`[DockerService] Syncing ${files.length} files to container ${container.name} at ${workDir}`);
  
  try {
    // Create directory first
    await execAsync(`docker exec ${container.name} mkdir -p ${workDir}`);
    
    for (const file of files) {
      console.log(`[DockerService] Writing file: ${file.name} (${file.content.length} chars)`);
      
      // Write content to a temporary file on the host
      const tempPath = `/tmp/itecify-write-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      // Write file content to temp location
      fs.writeFileSync(tempPath, file.content);
      
      // Use docker cp to copy file into container
      const containerPath = `${workDir}/${file.name}`;
      await execAsync(`docker cp "${tempPath}" ${container.name}:${containerPath}`);
      
      // Delete temp file
      fs.unlinkSync(tempPath);
    }
    
    console.log(`[DockerService] Files synced successfully`);
  } catch (error: any) {
    console.error('[DockerService] Failed to copy files:', error.message);
    throw error;
  }
}

export async function getContainerStatus(projectId: string): Promise<Container | null> {
  const container = containers.get(projectId);
  if (!container) return null;
  
  try {
    const { stdout } = await execAsync(
      `docker ps -a --filter "name=${container.name}" --format "{{.Status}}"`
    );
    
    if (stdout.includes('Up')) {
      container.status = 'running';
    } else {
      container.status = 'stopped';
    }
    
    containers.set(projectId, container);
    return container;
  } catch {
    return null;
  }
}

export function getProjectContainer(projectId: string): Container | undefined {
  return containers.get(projectId);
}
