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
export declare const DOCKER_IMAGES: {
    id: string;
    name: string;
    description: string;
}[];
export declare function createContainer(config: ContainerConfig): Promise<Container>;
export declare function startContainer(projectId: string): Promise<Container>;
export declare function stopContainer(projectId: string): Promise<void>;
export declare function removeContainer(projectId: string): Promise<void>;
export declare function executeInContainer(projectId: string, command: string, workdir?: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
export declare function listContainerFiles(projectId: string, dirPath?: string): Promise<{
    name: string;
    type: 'file' | 'directory';
}[]>;
export declare function readContainerFile(projectId: string, filePath: string): Promise<string>;
export declare function readAllContainerFiles(projectId: string): Promise<{
    name: string;
    content: string;
    path: string;
}[]>;
export declare function copyFilesToContainer(projectId: string, files: {
    name: string;
    content: string;
}[]): Promise<void>;
export declare function getContainerStatus(projectId: string): Promise<Container | null>;
export declare function getProjectContainer(projectId: string): Container | undefined;
export declare function ensureContainer(projectId: string, image?: string): Promise<Container>;
export declare function terminalRead(projectId: string, filePath: string): Promise<{
    success: boolean;
    content?: string;
    error?: string;
}>;
export declare function terminalWrite(projectId: string, filePath: string, content: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function terminalDelete(projectId: string, filePath: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function terminalList(projectId: string, dirPath?: string): Promise<{
    success: boolean;
    files?: string[];
    error?: string;
}>;
//# sourceMappingURL=dockerService.d.ts.map