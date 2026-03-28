import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
const containers = new Map();
export const DOCKER_IMAGES = [
    { id: 'node:20', name: 'Node.js 20', description: 'Latest Node.js LTS' },
    { id: 'node:18', name: 'Node.js 18', description: 'Node.js 18 LTS' },
    { id: 'python:3.12', name: 'Python 3.12', description: 'Latest Python' },
    { id: 'python:3.11', name: 'Python 3.11', description: 'Python 3.11' },
    { id: 'ubuntu:22.04', name: 'Ubuntu 22.04', description: 'Ubuntu with full tools' },
    { id: 'golang:1.22', name: 'Go 1.22', description: 'Go programming language' },
];
export async function createContainer(config) {
    const containerName = `itecify-${config.projectId}`;
    try {
        await execAsync(`docker rm -f ${containerName}`).catch(() => { });
        await new Promise(resolve => setTimeout(resolve, 500));
        const workdir = `/workspace/${config.projectId}`;
        const { stdout } = await execAsync(`docker create -it --name ${containerName} -w ${workdir} ${config.image} /bin/sh`);
        const containerId = stdout.trim();
        const container = {
            id: containerId,
            name: containerName,
            status: 'stopped',
            image: config.image,
            projectId: config.projectId,
        };
        containers.set(config.projectId, container);
        return container;
    }
    catch (error) {
        console.error('Failed to create container:', error);
        throw new Error(`Failed to create container: ${error.message}`);
    }
}
export async function startContainer(projectId) {
    const container = containers.get(projectId);
    if (!container) {
        throw new Error('Container not found');
    }
    try {
        await execAsync(`docker start ${container.name}`);
        container.status = 'running';
        containers.set(projectId, container);
        return container;
    }
    catch (error) {
        throw new Error(`Failed to start container: ${error.message}`);
    }
}
export async function stopContainer(projectId) {
    const container = containers.get(projectId);
    if (!container)
        return;
    try {
        await execAsync(`docker stop ${container.name}`).catch(() => { });
        container.status = 'stopped';
        containers.set(projectId, container);
    }
    catch (error) {
        console.error('Failed to stop container:', error);
    }
}
export async function removeContainer(projectId) {
    const container = containers.get(projectId);
    if (!container)
        return;
    try {
        await execAsync(`docker rm -f ${container.name}`).catch(() => { });
        containers.delete(projectId);
    }
    catch (error) {
        console.error('Failed to remove container:', error);
    }
}
export async function executeInContainer(projectId, command, workdir) {
    const container = containers.get(projectId);
    if (!container || container.status !== 'running') {
        throw new Error('Container is not running');
    }
    const workDir = workdir || `/workspace/${projectId}`;
    try {
        const fullCommand = `docker exec -w ${workDir} ${container.name} ${command}`;
        const { stdout, stderr } = await execAsync(fullCommand, { timeout: 30000 });
        return { stdout, stderr, exitCode: 0 };
    }
    catch (error) {
        if (error.stdout) {
            return {
                stdout: error.stdout,
                stderr: error.stderr || '',
                exitCode: error.code || 1
            };
        }
        throw new Error(`Command failed: ${error.message}`);
    }
}
export async function copyFilesToContainer(projectId, files) {
    const container = containers.get(projectId);
    if (!container) {
        throw new Error('Container not found');
    }
    const workDir = `/workspace/${projectId}`;
    try {
        await execAsync(`docker exec ${container.name} mkdir -p ${workDir}`).catch(() => { });
        for (const file of files) {
            const escapedContent = file.content.replace(/'/g, "'\\''");
            const escapedName = file.name.replace(/'/g, "'\\''");
            await execAsync(`docker exec ${container.name} sh -c 'echo '\''${escapedContent}'\'' > ${workDir}/${escapedName}'`).catch(() => { });
        }
    }
    catch (error) {
        console.error('Failed to copy files:', error);
    }
}
export async function getContainerStatus(projectId) {
    const container = containers.get(projectId);
    if (!container)
        return null;
    try {
        const { stdout } = await execAsync(`docker ps -a --filter "name=${container.name}" --format "{{.Status}}"`);
        if (stdout.includes('Up')) {
            container.status = 'running';
        }
        else {
            container.status = 'stopped';
        }
        containers.set(projectId, container);
        return container;
    }
    catch {
        return null;
    }
}
export function getProjectContainer(projectId) {
    return containers.get(projectId);
}
//# sourceMappingURL=dockerService.js.map